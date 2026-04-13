import crypto from 'crypto';
import { authConfig } from './auth.config';
import { mailerService } from '../services/mailer.service';

const TOKEN_BYTES = 32;
const DUMMY_HASH = crypto.createHash('sha256').update('invalid-verification-token').digest('hex');

export function generateEmailVerificationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashEmailVerificationToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashEmailVerificationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function getVerificationExpiryDate(hours = 24): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function safeTokenHashEqual(storedHash: string | null, rawToken: string): boolean {
  const providedHash = hashEmailVerificationToken(rawToken);
  const safeStored = storedHash ?? DUMMY_HASH;

  const storedBuffer = Buffer.from(safeStored, 'hex');
  const providedBuffer = Buffer.from(providedHash, 'hex');

  if (storedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, providedBuffer);
}

export async function sendVerificationEmail(params: {
  to: string;
  displayName: string;
  rawToken: string;
}): Promise<void> {
  const verifyUrl = new URL('/verify-email', authConfig.clientUrl());
  verifyUrl.searchParams.set('email', params.to);
  verifyUrl.searchParams.set('token', params.rawToken);

  const safeName = params.displayName.replace(/[<>]/g, '');
  const subject = 'Confirme seu e-mail no Prottoset';

  const text = [
    `Olá ${safeName},`,
    '',
    'Para ativar sua conta no Prottoset, confirme seu e-mail pelo link abaixo:',
    verifyUrl.toString(),
    '',
    'Este link expira em 24 horas.',
    'Se você não solicitou este cadastro, ignore esta mensagem.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #122b5a;">
      <h2 style="margin-bottom: 12px;">Confirme seu e-mail</h2>
      <p>Olá ${safeName},</p>
      <p>Para ativar sua conta no <strong>Prottoset</strong>, confirme seu e-mail no botão abaixo.</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl.toString()}" style="background: #1f56ff; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 10px; display: inline-block; font-weight: 600;">
          Confirmar e-mail
        </a>
      </p>
      <p>Este link expira em 24 horas.</p>
      <p style="font-size: 12px; color: #5b6f97;">Se você não solicitou este cadastro, ignore esta mensagem.</p>
    </div>
  `;

  await mailerService.sendMail({
    to: params.to,
    subject,
    html,
    text,
  });
}
