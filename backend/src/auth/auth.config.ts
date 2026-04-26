import { z } from 'zod';
import type { CookieOptions } from 'express';

const envSchema = z.object({
  AUTH_JWT_SECRET: z.string().min(32, 'AUTH_JWT_SECRET deve ter pelo menos 32 caracteres'),
  AUTH_ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  AUTH_COOKIE_SAMESITE: z.enum(['lax', 'none']).optional(),
  AUTH_REQUIRE_VERIFIED_ACCOUNT_FOR_EXPENSIVE_ACTIONS: z.coerce.boolean().default(true),
  NODE_ENV: z.string().default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
});

let _parsed: z.infer<typeof envSchema> | null = null;

function env() {
  if (!_parsed) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('[Auth] Variáveis de ambiente inválidas:', result.error.format());
      process.exit(1);
    }
    _parsed = result.data;
  }
  return _parsed;
}

function isProduction(): boolean {
  return env().NODE_ENV === 'production';
}

function cookieSameSite(): 'lax' | 'none' {
  if (isProduction()) return 'none';
  const configured = env().AUTH_COOKIE_SAMESITE;
  if (configured === 'lax' || configured === 'none') return configured;
  return 'lax';
}

function cookieSecure(): boolean {
  return isProduction() || cookieSameSite() === 'none';
}

export const authConfig = {
  jwtSecret(): string {
    return env().AUTH_JWT_SECRET;
  },

  accessTokenMinutes(): number {
    return env().AUTH_ACCESS_TOKEN_MINUTES;
  },

  refreshTokenDays(): number {
    return env().AUTH_REFRESH_TOKEN_DAYS;
  },

  isProduction,

  requireVerifiedAccountsForExpensiveActions(): boolean {
    return env().AUTH_REQUIRE_VERIFIED_ACCOUNT_FOR_EXPENSIVE_ACTIONS;
  },

  clientUrl(): string {
    return env().CLIENT_URL;
  },

  googleEnabled(): boolean {
    const e = env();
    return !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && e.GOOGLE_REDIRECT_URI);
  },

  googleClientId(): string {
    return env().GOOGLE_CLIENT_ID || '';
  },

  googleClientSecret(): string {
    return env().GOOGLE_CLIENT_SECRET || '';
  },

  googleRedirectUri(): string {
    return env().GOOGLE_REDIRECT_URI || '';
  },

  accessCookieOptions(): CookieOptions {
    const sameSite = cookieSameSite();
    return {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite,
      path: '/',
      maxAge: env().AUTH_ACCESS_TOKEN_MINUTES * 60 * 1000,
    };
  },

  refreshCookieOptions(): CookieOptions {
    const sameSite = cookieSameSite();
    return {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite,
      path: '/api/auth',
      maxAge: env().AUTH_REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    };
  },
};

export const ACCESS_COOKIE = 'prottoset_session';
export const REFRESH_COOKIE = 'prottoset_refresh';
export const OAUTH_STATE_COOKIE = 'prottoset_oauth_state';
