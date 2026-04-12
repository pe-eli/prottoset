import type { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizeOriginList(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function readOrigin(req: Request): string {
  const header = req.header('origin');
  return typeof header === 'string' ? header.trim() : '';
}

function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  return !!origin && allowedOrigins.includes(origin);
}

export function getAllowedOrigins(): string[] {
  return normalizeOriginList(process.env.CLIENT_URL || 'http://localhost:5173');
}

export function requireTrustedOrigin(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const requestedWith = req.header('x-requested-with');
    if (requestedWith !== 'XMLHttpRequest') {
      res.status(403).json({ error: 'Requisição bloqueada por política de segurança' });
      return;
    }

    const origin = readOrigin(req);
    if (!isAllowedOrigin(origin, allowedOrigins)) {
      res.status(403).json({ error: 'Origem não permitida' });
      return;
    }

    next();
  };
}

export function sanitizeErrorMessage(err: unknown, isProduction: boolean): string {
  if (!(err instanceof Error)) return 'Unknown error';
  return isProduction ? err.message : `${err.message}\n${err.stack ?? ''}`;
}