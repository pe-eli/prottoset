type LogLevel = 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = ['authorization', 'token', 'secret', 'apikey', 'api_key', 'password', 'cookie'];

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function maskString(value: string): string {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

function redact(value: unknown, currentKey = ''): unknown {
  if (typeof value === 'string') {
    const key = currentKey.toLowerCase();
    if (SENSITIVE_KEYS.some((token) => key.includes(token))) {
      return maskString(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, currentKey));
  }

  if (isObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = redact(entry, key);
    }
    return result;
  }

  return value;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    meta: meta ? redact(meta) : undefined,
  };

  const payload = JSON.stringify(entry);
  if (level === 'error') {
    console.error(payload);
    return;
  }
  if (level === 'warn') {
    console.warn(payload);
    return;
  }
  console.log(payload);
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    emit('info', message, meta);
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    emit('warn', message, meta);
  },

  error(message: string, meta?: Record<string, unknown>): void {
    emit('error', message, meta);
  },
};
