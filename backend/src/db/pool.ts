import { Pool, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function resolveSslConfig() {
  if (process.env.NODE_ENV !== 'production') {
    return undefined;
  }

  const certificateAuthority = process.env.DATABASE_CA_CERT?.trim();
  const normalizedCa = certificateAuthority ? certificateAuthority.replace(/\\n/g, '\n') : undefined;
  const rejectUnauthorizedEnv = (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? '').trim().toLowerCase();
  const rejectUnauthorized =
    rejectUnauthorizedEnv === 'true' ||
    rejectUnauthorizedEnv === '1' ||
    rejectUnauthorizedEnv === 'yes';

  return {
    // Keep compatibility with managed DBs that require SSL but do not provide a custom CA.
    // To enforce strict TLS verification, set DATABASE_SSL_REJECT_UNAUTHORIZED=true
    // and provide DATABASE_CA_CERT when needed.
    rejectUnauthorized,
    ...(normalizedCa ? { ca: normalizedCa } : {}),
  };
}

const ssl = resolveSslConfig();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
});

const NO_SCOPE_UUID = '00000000-0000-0000-0000-000000000000';

type TypedQueryResult<T> = Omit<QueryResult, 'rows'> & { rows: T[] };

interface DbScope {
  tenantId?: string;
  userId?: string;
  securityBypass?: boolean;
}

async function applyDbScope(client: PoolClient, scope: DbScope): Promise<void> {
  const tenantScope = scope.tenantId || NO_SCOPE_UUID;
  const userScope = scope.userId || NO_SCOPE_UUID;
  const securityBypass = scope.securityBypass === true ? 'true' : 'false';

  await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantScope]);
  await client.query("SELECT set_config('app.current_user', $1, true)", [userScope]);
  await client.query("SELECT set_config('app.security_bypass', $1, true)", [securityBypass]);
}

/**
 * Simple query (no tenant scope). Used by auth repositories.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<TypedQueryResult<T>> {
  return pool.query(text, params) as Promise<TypedQueryResult<T>>;
}

/**
 * Tenant-scoped query. Sets app.current_tenant for RLS, then runs the query.
 * Uses set_config(..., true) so the setting is transaction-local and auto-resets.
 */
export async function tenantQuery<T = Record<string, unknown>>(
  tenantId: string,
  text: string,
  params?: unknown[],
): Promise<TypedQueryResult<T>> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applyDbScope(client, { tenantId, userId: tenantId, securityBypass: false });
    const result = await client.query(text, params) as TypedQueryResult<T>;
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Tenant-scoped transaction. Sets app.current_tenant, runs fn(client), commits.
 * The caller can run multiple queries inside fn using the same client.
 */
export async function tenantTransaction<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applyDbScope(client, { tenantId, userId: tenantId, securityBypass: false });
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * User-scoped query. Sets app.current_user (and app.current_tenant for compatibility) for RLS.
 */
export async function userQuery<T = Record<string, unknown>>(
  userId: string,
  text: string,
  params?: unknown[],
): Promise<TypedQueryResult<T>> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applyDbScope(client, { tenantId: userId, userId, securityBypass: false });
    const result = await client.query(text, params) as TypedQueryResult<T>;
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * User-scoped transaction helper.
 */
export async function userTransaction<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applyDbScope(client, { tenantId: userId, userId, securityBypass: false });
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * System query for internal workers/webhooks. Use sparingly and only for trusted code paths.
 */
export async function systemQuery<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<TypedQueryResult<T>> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applyDbScope(client, { securityBypass: true });
    const result = await client.query(text, params) as TypedQueryResult<T>;
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * System transaction helper for trusted cross-tenant internal flows.
 */
export async function systemTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applyDbScope(client, { securityBypass: true });
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Generic transaction helper (non-tenant scoped).
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get the underlying pool (for graceful shutdown, health checks, etc.)
 */
export function getPool(): Pool {
  return pool;
}
