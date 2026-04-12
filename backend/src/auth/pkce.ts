import crypto from 'crypto';
import { authConfig } from './auth.config';

export function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function buildAuthorizationUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: authConfig.googleClientId(),
    redirect_uri: authConfig.googleRedirectUri(),
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
