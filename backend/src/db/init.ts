import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const ssl = process.env.NODE_ENV === 'production'
  ? {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT } : {}),
    }
  : undefined;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl,
  });

  const schemaPath = join(__dirname, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');

  console.log('Running schema.sql...');
  await pool.query(sql);
  console.log('Schema applied successfully.');

  await pool.end();
}

main().catch((err) => {
  console.error('Failed to init database:', err);
  process.exit(1);
});
