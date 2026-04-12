import IORedis from 'ioredis';

let redisClient: IORedis | null = null;
let redisReady = false;

export function getRedisClient(): IORedis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  redisClient = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redisClient.on('ready', () => {
    redisReady = true;
  });
  redisClient.on('end', () => {
    redisReady = false;
  });
  redisClient.on('error', (err) => {
    redisReady = false;
    console.error('[Redis] Connection error:', err.message);
  });

  redisClient.connect().catch((err) => {
    console.error('[Redis] Initial connection failed:', err.message);
  });

  return redisClient;
}

export function isRedisReady(): boolean {
  return redisReady;
}