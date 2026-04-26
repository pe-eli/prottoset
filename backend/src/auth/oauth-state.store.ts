import { getRedisClient, isRedisReady } from '../infrastructure/redis';

interface OAuthStatePayload {
  codeVerifier: string;
  returnTo: string;
  expiresAt: number;
}

const memoryStore = new Map<string, OAuthStatePayload>();

function now(): number {
  return Date.now();
}

function keyFor(state: string): string {
  return `oauth:state:${state}`;
}

function cleanupMemory(): void {
  const ts = now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.expiresAt <= ts) {
      memoryStore.delete(key);
    }
  }
}

export async function saveOAuthState(
  state: string,
  payload: { codeVerifier: string; returnTo: string },
  ttlMs: number,
): Promise<void> {
  const expiresAt = now() + ttlMs;
  const fullPayload: OAuthStatePayload = {
    codeVerifier: payload.codeVerifier,
    returnTo: payload.returnTo,
    expiresAt,
  };

  const redis = getRedisClient();
  if (redis && isRedisReady()) {
    await redis.set(keyFor(state), JSON.stringify(fullPayload), 'PX', ttlMs);
    return;
  }

  cleanupMemory();
  memoryStore.set(state, fullPayload);
}

export async function consumeOAuthState(
  state: string,
): Promise<{ codeVerifier: string; returnTo: string } | null> {
  const redis = getRedisClient();
  if (redis && isRedisReady()) {
    const redisKey = keyFor(state);
    const [raw] = await redis.multi().get(redisKey).del(redisKey).exec() as [
      [null, string | null],
      [null, number],
    ];
    const payloadRaw = raw?.[1];
    if (!payloadRaw) return null;
    try {
      const parsed = JSON.parse(payloadRaw) as OAuthStatePayload;
      if (!parsed.codeVerifier || !parsed.returnTo || parsed.expiresAt <= now()) {
        return null;
      }
      return { codeVerifier: parsed.codeVerifier, returnTo: parsed.returnTo };
    } catch {
      return null;
    }
  }

  cleanupMemory();
  const payload = memoryStore.get(state);
  if (!payload) return null;
  memoryStore.delete(state);
  if (payload.expiresAt <= now()) return null;

  return {
    codeVerifier: payload.codeVerifier,
    returnTo: payload.returnTo,
  };
}
