import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
const DUMMY_HASH = bcrypt.hashSync('__dummy_never_matches__', SALT_ROUNDS);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(plain, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
