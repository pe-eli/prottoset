import { createRemoteJWKSet, jwtVerify } from 'jose';
import { authConfig } from './auth.config';

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: authConfig.googleClientId(),
  });

  const emailVerified = payload.email_verified as boolean | undefined;
  if (!emailVerified) {
    throw new Error('E-mail do Google não verificado');
  }

  return {
    sub: payload.sub!,
    email: payload.email as string,
    emailVerified: true,
    name: (payload.name as string) || '',
    picture: (payload.picture as string) || '',
  };
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<{ idToken: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: authConfig.googleClientId(),
      client_secret: authConfig.googleClientSecret(),
      redirect_uri: authConfig.googleRedirectUri(),
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao trocar code por tokens: ${response.status} ${body}`);
  }

  const data = await response.json() as { id_token?: string };
  if (!data.id_token) {
    throw new Error('Google OAuth não retornou id_token');
  }
  return { idToken: data.id_token };
}
