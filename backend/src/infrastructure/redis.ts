import IORedis from 'ioredis';

let redisClient: IORedis | null = null;
let redisReady = false;
let redisDisabled = false;
let unavailableWarned = false;

const redisOptional = process.env.REDIS_OPTIONAL !== 'false';

function warnRedisUnavailableOnce(message: string): void {
  if (unavailableWarned) return;
  unavailableWarned = true;
  console.warn(`[Redis] ${message}`);
}

function disableRedis(message: string): void {
  redisReady = false;
  redisDisabled = true;
  warnRedisUnavailableOnce(message);
  if (redisClient) {
    redisClient.removeAllListeners();
    redisClient.disconnect(false);
    redisClient = null;
  }
}

export function getRedisClient(): IORedis | null {
  if (redisDisabled) return null;
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  redisClient = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (!redisOptional) {
        return Math.min(times * 500, 3000);
      }

      if (times > 2) {
        disableRedis('Redis indisponivel em ambiente local. Usando fallback em memoria.');
        return null;
      }

      return 300;
    },
  });

  redisClient.on('ready', () => {
    redisReady = true;
    redisDisabled = false;
    unavailableWarned = false;
  });
  redisClient.on('end', () => {
    redisReady = false;
  });
  redisClient.on('error', (err: NodeJS.ErrnoException) => {
    redisReady = false;

    if (redisOptional && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND')) {
      warnRedisUnavailableOnce('Redis indisponivel em ambiente local. Usando fallback em memoria.');
      return;
    }

    console.error('[Redis] Connection error:', err.message);
  });

  redisClient.connect().catch((err) => {
    if (redisOptional) {
      disableRedis('Falha na conexao inicial. Usando fallback em memoria.');
      return;
    }

    console.error('[Redis] Initial connection failed:', err.message);
  });

  return redisClient;
}

export function isRedisReady(): boolean {
  return redisReady;
}