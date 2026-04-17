import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { consumeRateLimit } from '../security/rate-limit.store';
import crypto from 'crypto';
import { fraudService } from '../security/fraud.service';

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
  email?: { limit: number; windowMs: number; field?: string };
}

function getClientIp(req: Request): string {
  // Rely on Express trust-proxy processing instead of trusting raw headers.
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getEmailValue(req: Request, field = 'email'): string | null {
  const body = req.body as Record<string, unknown> | undefined;
  const raw = body?.[field];
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
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

  if (options.email) {
    const email = getEmailValue(req, options.email.field);
    if (email) {
      rules.push({
        key: `${options.name}:email:${hashValue(email)}`,
        limit: options.email.limit,
        windowMs: options.email.windowMs,
      });
    }
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
          const tenantId = req.authUser?.userId;
          if (tenantId) {
            await fraudService.recordEvent({
              tenantId,
              eventType: 'rate_limit_blocked',
              severity: 'medium',
              details: {
                route: req.originalUrl,
                limiter: options.name,
                method: req.method,
              },
            });
            await fraudService.detectRequestBurstAndBlock(tenantId);
          }

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