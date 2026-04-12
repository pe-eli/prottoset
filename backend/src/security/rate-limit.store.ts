import { getRedisClient, isRedisReady } from '../infrastructure/redis';

interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface CounterRecord {
  count: number;
  resetAt: number;
}

class MemoryRateLimitStore {
  private readonly counters = new Map<string, CounterRecord>();

  consume(key: string, limit: number, windowMs: number): ConsumeResult {
    const now = Date.now();
    const existing = this.counters.get(key);
    if (!existing || existing.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterMs: windowMs };
    }

    existing.count += 1;
    this.counters.set(key, existing);
    return {
      allowed: existing.count <= limit,
      remaining: Math.max(0, limit - existing.count),
      retryAfterMs: Math.max(0, existing.resetAt - now),
    };
  }
}

const memoryStore = new MemoryRateLimitStore();

export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<ConsumeResult> {
  const redis = getRedisClient();
  if (!redis || !isRedisReady()) {
    return memoryStore.consume(key, limit, windowMs);
  }

  const bucketKey = `rl:${key}`;
  const tx = redis.multi();
  tx.incr(bucketKey);
  tx.pttl(bucketKey);
  const result = await tx.exec();

  const count = Number(result?.[0]?.[1] || 0);
  let ttl = Number(result?.[1]?.[1] || 0);

  if (ttl < 0) {
    await redis.pexpire(bucketKey, windowMs);
    ttl = windowMs;
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterMs: Math.max(0, ttl),
  };
}