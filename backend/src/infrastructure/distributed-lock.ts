import crypto from 'crypto';
import { getRedisClient, isRedisReady } from './redis';

const FALLBACK_LOCKS = new Map<string, { token: string; expiresAt: number }>();
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

export class DistributedLockUnavailableError extends Error {}

function fullLockKey(key: string): string {
  return `lock:${key}`;
}

function cleanupFallbackLocks(): void {
  const now = Date.now();
  for (const [key, value] of FALLBACK_LOCKS.entries()) {
    if (value.expiresAt <= now) {
      FALLBACK_LOCKS.delete(key);
    }
  }
}

function tryAcquireFallbackLock(lockKey: string, token: string, ttlMs: number): boolean {
  cleanupFallbackLocks();
  const existing = FALLBACK_LOCKS.get(lockKey);
  if (existing && existing.expiresAt > Date.now()) {
    return false;
  }
  FALLBACK_LOCKS.set(lockKey, { token, expiresAt: Date.now() + ttlMs });
  return true;
}

async function releaseFallbackLock(lockKey: string, token: string): Promise<void> {
  const current = FALLBACK_LOCKS.get(lockKey);
  if (!current) return;
  if (current.token === token) {
    FALLBACK_LOCKS.delete(lockKey);
  }
}

export interface HeldDistributedLock {
  key: string;
  token: string;
  mode: 'redis' | 'memory';
  release: () => Promise<void>;
}

export interface LockOptions {
  ttlMs?: number;
  timeoutMs?: number;
  retryIntervalMs?: number;
}

export async function tryAcquireDistributedLock(key: string, ttlMs = 15_000): Promise<HeldDistributedLock | null> {
  const lockKey = fullLockKey(key);
  const token = crypto.randomUUID();

  const redis = getRedisClient();
  if (redis && isRedisReady()) {
    const acquired = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK') {
      return null;
    }

    return {
      key: lockKey,
      token,
      mode: 'redis',
      release: async () => {
        await redis.eval(RELEASE_SCRIPT, 1, lockKey, token);
      },
    };
  }

  const acquiredFallback = tryAcquireFallbackLock(lockKey, token, ttlMs);
  if (!acquiredFallback) {
    return null;
  }

  return {
    key: lockKey,
    token,
    mode: 'memory',
    release: async () => {
      await releaseFallbackLock(lockKey, token);
    },
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withDistributedLock<T>(
  key: string,
  work: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const ttlMs = Math.max(1_000, options.ttlMs ?? 20_000);
  const timeoutMs = Math.max(0, options.timeoutMs ?? 4_000);
  const retryIntervalMs = Math.max(50, options.retryIntervalMs ?? 120);

  const startedAt = Date.now();
  let lock: HeldDistributedLock | null = null;

  while (!lock) {
    lock = await tryAcquireDistributedLock(key, ttlMs);
    if (lock) break;

    if (Date.now() - startedAt >= timeoutMs) {
      throw new DistributedLockUnavailableError(`Nao foi possivel adquirir lock distribuido: ${key}`);
    }

    await sleep(retryIntervalMs);
  }

  try {
    return await work();
  } finally {
    await lock.release();
  }
}
