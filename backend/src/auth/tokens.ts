import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { authConfig } from './auth.config';
import type { AccessTokenPayload } from './auth.types';

function getSecretKey() {
  return new TextEncoder().encode(authConfig.jwtSecret());
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const minutes = authConfig.accessTokenMinutes();
  return new SignJWT({ email: payload.email, role: payload.role, tenantId: payload.tenantId, emailVerified: payload.emailVerified })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuer('prottoset-backend')
    .setAudience('prottoset-app')
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .sign(getSecretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: 'prottoset-backend',
      audience: 'prottoset-app',
    });

    const sub = payload.sub;
    const email = payload.email as string | undefined;
    const role = payload.role as string | undefined;
    const tenantId = payload.tenantId as string | undefined;
    const emailVerified = Boolean(payload.emailVerified);

    if (!sub || !email || !role || !tenantId) return null;
    return { sub, email, role, tenantId, emailVerified };
  } catch {
    return null;
  }
}

export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(64).toString('hex');
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
