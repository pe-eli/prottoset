import { Pool, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function resolveSslConfig() {
  if (process.env.NODE_ENV !== 'production') {
    return undefined;
  }

  const certificateAuthority = process.env.DATABASE_CA_CERT?.trim();
  if (certificateAuthority) {
    return {
      rejectUnauthorized: true,
      ca: certificateAuthority,
    };
  }

  return {
    rejectUnauthorized: false,
  };
}

const ssl = resolveSslConfig();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
});

type TypedQueryResult<T> = Omit<QueryResult, 'rows'> & { rows: T[] };

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
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
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
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
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
