import { describe, it, expect, beforeAll } from 'vitest';

process.env.AUTH_JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters-long-ok';
process.env.AUTH_ACCESS_TOKEN_MINUTES = '1';

import { signAccessToken, verifyAccessToken, generateRefreshToken, hashToken } from '../tokens';

describe('tokens', () => {
  describe('access token', () => {
    let token: string;

    beforeAll(async () => {
      token = await signAccessToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'owner',
        tenantId: 'user-123',
        emailVerified: true,
      });
    });

    it('access token gerado e verificavel', async () => {
      const payload = await verifyAccessToken(token);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('user-123');
      expect(payload!.email).toBe('test@example.com');
      expect(payload!.role).toBe('owner');
    });

    it('token com secret errado retorna null', async () => {
      const originalSecret = process.env.AUTH_JWT_SECRET;
      // Sign with a different secret by manipulating the token
      const parts = token.split('.');
      // Corrupt the signature
      const corrupted = `${parts[0]}.${parts[1]}.invalidsignature`;
      const result = await verifyAccessToken(corrupted);
      expect(result).toBeNull();
      process.env.AUTH_JWT_SECRET = originalSecret;
    });

    it('token completamente invalido retorna null', async () => {
      const result = await verifyAccessToken('not.a.jwt');
      expect(result).toBeNull();
    });
  });

  describe('refresh token', () => {
    it('gera token raw e hash', () => {
      const { raw, hash } = generateRefreshToken();
      expect(raw).toBeTruthy();
      expect(hash).toBeTruthy();
      expect(raw).not.toBe(hash);
    });

    it('hashToken produz o mesmo hash para o mesmo input', () => {
      const raw = 'some-token-value';
      const hash1 = hashToken(raw);
      const hash2 = hashToken(raw);
      expect(hash1).toBe(hash2);
    });

    it('tokens diferentes geram hashes diferentes', () => {
      const { hash: hash1 } = generateRefreshToken();
      const { hash: hash2 } = generateRefreshToken();
      expect(hash1).not.toBe(hash2);
    });
  });
});
