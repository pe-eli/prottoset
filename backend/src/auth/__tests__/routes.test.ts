import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Set env vars before any auth imports
process.env.AUTH_JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters-long-ok';
process.env.AUTH_ACCESS_TOKEN_MINUTES = '15';
process.env.AUTH_REFRESH_TOKEN_DAYS = '30';
process.env.NODE_ENV = 'development';
process.env.CLIENT_URL = 'http://localhost:5173';

// Mock db/pool to avoid real PG connection
vi.mock('../../db/pool', () => ({
  query: vi.fn(),
  tenantQuery: vi.fn(),
  tenantTransaction: vi.fn(),
}));

// In-memory stores for the mock repositories
let usersStore: Record<string, any> = {};
let refreshTokensStore: Record<string, any> = {};
let idCounter = 0;

function resetStores() {
  usersStore = {};
  refreshTokensStore = {};
  idCounter = 0;
}

// Mock users repository
vi.mock('../users.repository', () => ({
  usersRepository: {
    getById: vi.fn(async (id: string) => usersStore[id] || null),
    getByEmail: vi.fn(async (email: string) => {
      return Object.values(usersStore).find((u: any) => u.email === email.toLowerCase()) || null;
    }),
    getByGoogleId: vi.fn(async (googleId: string) => {
      return Object.values(usersStore).find((u: any) => u.googleId === googleId) || null;
    }),
    create: vi.fn(async (data: any) => {
      const id = `user-${++idCounter}`;
      const now = new Date().toISOString();
      const user = {
        ...data,
        id,
        emailVerified: data.emailVerified ?? false,
        verificationCodeHash: data.verificationCodeHash ?? null,
        verificationCodeExpiresAt: data.verificationCodeExpiresAt ?? null,
        createdAt: now,
        updatedAt: now,
      };
      usersStore[id] = user;
      return user;
    }),
    updateGoogleLink: vi.fn(async (id: string, googleId: string) => {
      if (usersStore[id]) {
        usersStore[id].googleId = googleId;
        usersStore[id].emailVerified = true;
      }
    }),
    setVerificationCode: vi.fn(async (id: string, codeHash: string, expiresAt: string) => {
      if (usersStore[id]) {
        usersStore[id].verificationCodeHash = codeHash;
        usersStore[id].verificationCodeExpiresAt = expiresAt;
      }
    }),
    markEmailVerified: vi.fn(async (id: string) => {
      if (usersStore[id]) {
        usersStore[id].emailVerified = true;
        usersStore[id].verificationCodeHash = null;
        usersStore[id].verificationCodeExpiresAt = null;
      }
    }),
  },
}));

// Mock refresh tokens repository
vi.mock('../refresh-tokens.repository', () => ({
  refreshTokensRepository: {
    create: vi.fn(async (data: any) => {
      const id = `rt-${++idCounter}`;
      const token = { ...data, id };
      refreshTokensStore[id] = token;
      return token;
    }),
    findByHash: vi.fn(async (hash: string) => {
      return Object.values(refreshTokensStore).find(
        (t: any) => t.tokenHash === hash && !t.revoked
      ) || null;
    }),
    findByHashIncludingRevoked: vi.fn(async (hash: string) => {
      return Object.values(refreshTokensStore).find((t: any) => t.tokenHash === hash) || null;
    }),
    revokeById: vi.fn(async (id: string) => {
      if (refreshTokensStore[id]) refreshTokensStore[id].revoked = true;
    }),
    revokeFamily: vi.fn(async (family: string) => {
      for (const t of Object.values(refreshTokensStore) as any[]) {
        if (t.family === family) t.revoked = true;
      }
    }),
    revokeAllForUser: vi.fn(async (userId: string) => {
      for (const t of Object.values(refreshTokensStore) as any[]) {
        if (t.userId === userId) t.revoked = true;
      }
    }),
  },
}));

// Mock express-rate-limit and express-slow-down to be no-ops in tests
vi.mock('express-rate-limit', () => ({
  default: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('express-slow-down', () => ({
  default: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../services/turnstile.service', () => ({
  turnstileService: {
    verify: vi.fn(async () => true),
  },
}));

vi.mock('../../auth/email-verification', () => ({
  generateVerificationCode: vi.fn(() => '123456'),
  getVerificationCodeExpiryDate: vi.fn(() => new Date(Date.now() + 15 * 60 * 1000)),
  safeCompareVerificationCode: vi.fn(async () => true),
  sendVerificationCode: vi.fn(async () => {}),
  hashVerificationCode: vi.fn(async () => 'hash-123'),
}));

import authRoutes from '../../routes/auth.routes';
import { hashPassword } from '../password';

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

function extractCookies(res: request.Response): string[] {
  const raw = res.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

async function fetchCsrfToken(app: express.Application): Promise<string> {
  const res = await request(app).get('/api/auth/csrf');
  return res.body.csrfToken;
}

describe('auth routes', () => {
  let app: express.Application;

  beforeEach(() => {
    resetStores();
    app = createApp();
  });

  describe('POST /api/auth/register', () => {
    it('aceita cadastro com resposta generica', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@example.com', password: 'StrongPass123', name: 'Test User', acceptedTerms: true });

      expect(res.status).toBe(202);
      expect(res.body.message).toBeDefined();
      expect(Object.values(usersStore)).toHaveLength(1);
    });

    it('retorna 400 sem aceitar termos', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@example.com', password: 'StrongPass123', name: 'Test User', acceptedTerms: false });

      expect(res.status).toBe(400);
    });

    it('mantem resposta generica para email duplicado não verificado (reenvia email)', async () => {
      const hash = await hashPassword('StrongPass123');
      usersStore['user-existing'] = {
        id: 'user-existing',
        email: 'existing@example.com',
        displayName: 'Existing',
        passwordHash: hash,
        googleId: '',
        emailVerified: false,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        role: 'member',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'existing@example.com', password: 'StrongPass123', name: 'Dupl', acceptedTerms: true });

      expect(res.status).toBe(202);
      expect(Object.values(usersStore)).toHaveLength(1);
    });
  });

  describe('GET /api/auth/check-email', () => {
    it('retorna exists false para email não cadastrado', async () => {
      const res = await request(app)
        .get('/api/auth/check-email')
        .query({ email: 'new@example.com' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ exists: false, emailVerified: false });
    });

    it('retorna exists true para email cadastrado', async () => {
      const hash = await hashPassword('StrongPass123');
      usersStore['user-existing'] = {
        id: 'user-existing',
        email: 'existing@example.com',
        displayName: 'Existing',
        passwordHash: hash,
        googleId: '',
        emailVerified: true,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        role: 'member',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await request(app)
        .get('/api/auth/check-email')
        .query({ email: 'existing@example.com' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ exists: true, emailVerified: true });
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const hash = await hashPassword('CorrectPassword123');
      usersStore['user-1'] = {
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'Test User',
        passwordHash: hash,
        googleId: '',
        emailVerified: true,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        role: 'member',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    it('retorna user e seta cookies com credenciais corretas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'CorrectPassword123' });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('user@example.com');

      const cookies = extractCookies(res);
      expect(cookies.length).toBeGreaterThanOrEqual(2);
      const cookieNames = cookies.map((c) => c.split('=')[0]);
      expect(cookieNames).toContain('prottoset_session');
      expect(cookieNames).toContain('prottoset_refresh');
    });

    it('retorna 401 com credenciais erradas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('E-mail ou senha incorretos.');
    });

    it('retorna 403 quando email nao verificado', async () => {
      usersStore['user-1'].emailVerified = false;
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'CorrectPassword123' });

      expect(res.status).toBe(403);
    });

    it('retorna mesma mensagem para email inexistente e senha errada', async () => {
      const res1 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'AnyPassword' });

      const res2 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'WrongPassword' });

      expect(res1.status).toBe(401);
      expect(res2.status).toBe(401);
      expect(res1.body.error).toBe(res2.body.error);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('limpa cookies e revoga token', async () => {
      const hash = await hashPassword('MyPassword123!');
      usersStore['user-1'] = {
        id: 'user-1',
        email: 'user@test.com',
        displayName: 'User',
        passwordHash: hash,
        googleId: '',
        emailVerified: true,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        role: 'member',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'MyPassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = await fetchCsrfToken(app);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('retorna 403 sem cookie CSRF/refresh valido', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('X-CSRF-Token', 'missing-cookie-token');
      expect(res.status).toBe(403);
    });

    it('rotaciona tokens com refresh valido', async () => {
      const hash = await hashPassword('MyPassword123!');
      usersStore['user-1'] = {
        id: 'user-1',
        email: 'user@test.com',
        displayName: 'User',
        passwordHash: hash,
        googleId: '',
        emailVerified: true,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        role: 'member',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'MyPassword123!' });

      const cookies = extractCookies(loginRes);
      const csrfToken = await fetchCsrfToken(app);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });

    it('retorna 401 com token revogado (reuse detection)', async () => {
      const hash = await hashPassword('MyPassword123!');
      usersStore['user-1'] = {
        id: 'user-1',
        email: 'user@test.com',
        displayName: 'User',
        passwordHash: hash,
        googleId: '',
        emailVerified: true,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        role: 'member',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'MyPassword123!' });

      const originalCookies = extractCookies(loginRes);
      const csrfToken = await fetchCsrfToken(app);

      // First refresh consumes the original token
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', originalCookies)
        .set('X-CSRF-Token', csrfToken);

      // Second refresh with the same (now revoked) token
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', originalCookies)
        .set('X-CSRF-Token', csrfToken);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('retorna 401 sem autenticacao', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('retorna user com access token valido', async () => {
      const hash = await hashPassword('MyPassword123!');
      usersStore['user-1'] = {
        id: 'user-1',
        email: 'user@test.com',
        displayName: 'User',
        passwordHash: hash,
        googleId: '',
        emailVerified: true,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        role: 'member',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'MyPassword123!' });

      const cookies = extractCookies(loginRes);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('user@test.com');
    });
  });

  describe('GET /api/auth/google', () => {
    it('retorna 404 quando Google OAuth nao esta configurado', async () => {
      const res = await request(app).get('/api/auth/google');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Google OAuth');
    });
  });

  describe('GET /api/auth/google/callback', () => {
    it('retorna 403 sem state cookie', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'test', state: 'test' });

      expect(res.status).toBe(403);
    });
  });
});
