import { describe, it, expect, beforeAll } from 'vitest';

// Set env before importing modules
process.env.AUTH_JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters-long-ok';

import { hashPassword, verifyPassword } from '../password';

describe('password', () => {
  let hashed: string;

  beforeAll(async () => {
    hashed = await hashPassword('MyStrongPassword123');
  });

  it('hash e verify de senha correta retorna true', async () => {
    const result = await verifyPassword('MyStrongPassword123', hashed);
    expect(result).toBe(true);
  });

  it('verify de senha errada retorna false', async () => {
    const result = await verifyPassword('WrongPassword', hashed);
    expect(result).toBe(false);
  });

  it('dois hashes da mesma senha sao diferentes (salt unico)', async () => {
    const hash1 = await hashPassword('SamePassword');
    const hash2 = await hashPassword('SamePassword');
    expect(hash1).not.toBe(hash2);
  });

  it('verifyPassword com hash vazio executa dummy compare e retorna false (timing-safe)', async () => {
    const result = await verifyPassword('AnyPassword', '');
    expect(result).toBe(false);
  });
});
