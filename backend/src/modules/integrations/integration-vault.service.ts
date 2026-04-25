import crypto from 'crypto';
import { query } from '../../db/pool';
import { structuredLogger } from '../../observability/structured-logger';

interface TenantIntegrationRow {
  provider: string;
  encrypted_secret: string;
  metadata: Record<string, unknown>;
  updated_at: Date;
}

export interface TenantIntegrationSecret {
  provider: string;
  secret: string;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

function readVaultKey(): Buffer {
  const raw = process.env.INTEGRATION_VAULT_KEY?.trim();
  if (!raw) {
    throw new Error('INTEGRATION_VAULT_KEY nao configurada');
  }

  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  try {
    const base64 = Buffer.from(raw, 'base64');
    if (base64.length === 32) {
      return base64;
    }
  } catch {
    // Ignore parse errors and fallback to hash.
  }

  if (raw.length === 32) {
    return Buffer.from(raw, 'utf-8');
  }

  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecret(secret: string): string {
  const key = readVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptSecret(payload: string): string {
  const key = readVaultKey();
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Payload de segredo criptografado invalido');
  }

  const iv = Buffer.from(parts[0], 'base64url');
  const authTag = Buffer.from(parts[1], 'base64url');
  const ciphertext = Buffer.from(parts[2], 'base64url');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

function toIntegration(row: TenantIntegrationRow): TenantIntegrationSecret {
  return {
    provider: row.provider,
    secret: decryptSecret(row.encrypted_secret),
    metadata: row.metadata ?? {},
    updatedAt: row.updated_at.toISOString(),
  };
}

export const integrationVaultService = {
  async upsertSecret(
    tenantId: string,
    provider: string,
    secret: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const normalizedProvider = provider.trim().toLowerCase();
    const encrypted = encryptSecret(secret);

    await query(
      `INSERT INTO tenant_integrations (tenant_id, provider, encrypted_secret, metadata)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (tenant_id, provider)
       DO UPDATE SET
         encrypted_secret = EXCLUDED.encrypted_secret,
         metadata = EXCLUDED.metadata,
         updated_at = now()`,
      [tenantId, normalizedProvider, encrypted, JSON.stringify(metadata)],
    );

    structuredLogger.event('integration_secret_updated', {
      tenantId,
      provider: normalizedProvider,
    });
  },

  async getSecret(tenantId: string, provider: string): Promise<TenantIntegrationSecret | null> {
    const normalizedProvider = provider.trim().toLowerCase();
    const { rows } = await query<TenantIntegrationRow>(
      `SELECT provider, encrypted_secret, metadata, updated_at
       FROM tenant_integrations
       WHERE tenant_id = $1 AND provider = $2
       LIMIT 1`,
      [tenantId, normalizedProvider],
    );

    if (!rows[0]) {
      return null;
    }

    try {
      return toIntegration(rows[0]);
    } catch (err) {
      structuredLogger.error('integration_secret_decrypt_failed', {
        tenantId,
        provider: normalizedProvider,
        error: err instanceof Error ? err.message : 'unknown_error',
      });
      return null;
    }
  },

  async deleteSecret(tenantId: string, provider: string): Promise<void> {
    const normalizedProvider = provider.trim().toLowerCase();
    await query('DELETE FROM tenant_integrations WHERE tenant_id = $1 AND provider = $2', [tenantId, normalizedProvider]);
  },
};
