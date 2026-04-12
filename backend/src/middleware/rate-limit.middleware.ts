import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { consumeRateLimit } from '../security/rate-limit.store';

interface RateLimitRule {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimitOptions {
  name: string;
  message: string;
  ip?: { limit: number; windowMs: number };
  user?: { limit: number; windowMs: number };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function buildRules(req: Request, options: RateLimitOptions): RateLimitRule[] {
  const rules: RateLimitRule[] = [];
  if (options.ip) {
    rules.push({
      key: `${options.name}:ip:${getClientIp(req)}`,
      limit: options.ip.limit,
      windowMs: options.ip.windowMs,
    });
  }

  const userId = req.authUser?.userId;
  if (userId && options.user) {
    rules.push({
      key: `${options.name}:user:${userId}`,
      limit: options.user.limit,
      windowMs: options.user.windowMs,
    });
  }

  return rules;
}

export function createSecurityRateLimit(options: RateLimitOptions): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rules = buildRules(req, options);
      for (const rule of rules) {
        const result = await consumeRateLimit(rule.key, rule.limit, rule.windowMs);
        if (!result.allowed) {
          res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));
          res.status(429).json({ error: options.message });
          return;
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}