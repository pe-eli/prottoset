import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, getPool } from '../db/pool';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Uso: npx ts-node-dev src/scripts/seed-owner.ts <email> <password>');
    console.error('Exemplo: npx ts-node-dev src/scripts/seed-owner.ts admin@exemplo.com SenhaForte123!');
    process.exit(1);
  }

  if (password.length < 10) {
    console.error('A senha deve ter pelo menos 10 caracteres.');
    process.exit(1);
  }

  const { rows: existing } = await query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()],
  );

  if (existing.length > 0) {
    console.error(`Usuário com e-mail ${email} já existe.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  const { rows } = await query(
    `INSERT INTO users (email, display_name, password_hash, google_id, email_verified, role)
     VALUES ($1, $2, $3, NULL, false, 'owner')
     RETURNING id`,
    [email.toLowerCase(), email.split('@')[0], hash],
  );

  console.log(`Owner criado com sucesso!`);
  console.log(`  ID: ${rows[0].id}`);
  console.log(`  Email: ${email.toLowerCase()}`);
  console.log(`  Role: owner`);

  await getPool().end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao criar owner:', err.message);
  process.exit(1);
});
