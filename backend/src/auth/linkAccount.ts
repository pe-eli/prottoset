import { usersRepository } from './users.repository';
import type { UserDoc } from './auth.types';
import type { GoogleProfile } from './verify';

export async function findOrLinkAccount(profile: GoogleProfile): Promise<UserDoc> {
  const byGoogle = await usersRepository.getByGoogleId(profile.sub);
  if (byGoogle) return byGoogle;

  const byEmail = await usersRepository.getByEmail(profile.email);
  if (byEmail) {
    if (!profile.emailVerified) {
      throw new Error('Não é possível vincular conta: e-mail do Google não verificado');
    }
    await usersRepository.updateGoogleLink(byEmail.id, profile.sub);
    return { ...byEmail, googleId: profile.sub };
  }

  return usersRepository.create({
    email: profile.email.toLowerCase(),
    displayName: profile.name || profile.email.split('@')[0],
    passwordHash: '',
    googleId: profile.sub,
    emailVerified: false,
    role: 'member',
  });
}
