import type { AuthenticatedUser } from '../../auth/auth.types';

function getSupportAdminEmails(): string[] {
  return (process.env.SUPPORT_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isSupportAdmin(user: AuthenticatedUser): boolean {
  const allowlist = getSupportAdminEmails();
  if (allowlist.includes(user.email.toLowerCase())) {
    return true;
  }

  return process.env.NODE_ENV !== 'production' && user.role === 'owner';
}
