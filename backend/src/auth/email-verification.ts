import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { resendService } from '../services/resend.service';

const CODE_MIN = 0;
const CODE_MAX = 1_000_000;
const EXPIRATION_MINUTES = 15;
const CODE_SALT_ROUNDS = 12;
const DUMMY_CODE_HASH = bcrypt.hashSync('000000', CODE_SALT_ROUNDS);

export function generateVerificationCode(): string {
  // Security requirement: use crypto.randomInt to generate a 6-digit code.
  return crypto.randomInt(CODE_MIN, CODE_MAX).toString().padStart(6, '0');
}

export async function hashVerificationCode(code: string): Promise<string> {
  return bcrypt.hash(code, CODE_SALT_ROUNDS);
}

export async function safeCompareVerificationCode(storedHash: string | null, providedCode: string): Promise<boolean> {
  // Compare against a dummy hash when user/code is missing to reduce timing differences.
  const hashToCompare = storedHash ?? DUMMY_CODE_HASH;
  const matches = await bcrypt.compare(providedCode, hashToCompare);
  return !!storedHash && matches;
}

export function getVerificationCodeExpiryDate(minutes = EXPIRATION_MINUTES): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function escapeHtml(value: string): string {
  return value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
}

function buildVerificationTemplate(params: {
  appName: string;
  code: string;
  expiresIn: string;
  verificationUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Verificação de E-mail</title>
  <!-- Estilos inline garantem melhor compatibilidade com clientes de email -->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <center style="width: 100%; table-layout: fixed;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #f4f6f9; margin: 0 auto;">
      <tr>
        <td align="center" style="padding: 30px 20px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
            <!-- Cabeçalho com logo/nome da empresa -->
            <tr>
              <td align="center" style="padding: 40px 30px 20px;">
                <h1 style="margin: 0; font-size: 28px; color: #1a1e24; font-weight: 600; letter-spacing: -0.5px;">
                  ${params.appName}
                </h1>
              </td>
            </tr>

            <!-- Título da mensagem -->
            <tr>
              <td align="center" style="padding: 0 30px;">
                <h2 style="margin: 0; font-size: 22px; color: #2c3e50; font-weight: 500;">
                  Verifique seu endereço de e-mail
                </h2>
              </td>
            </tr>

            <!-- Saudação e instrução -->
            <tr>
              <td align="center" style="padding: 20px 40px 10px; color: #5b6778; font-size: 16px; line-height: 1.5;">
                <p style="margin: 0;">
                  Olá, <br style="display: none;" />
                  Use o código abaixo para confirmar seu e-mail e ativar sua conta.
                </p>
              </td>
            </tr>

            <!-- Código de verificação em destaque -->
            <tr>
              <td align="center" style="padding: 30px 40px;">
                <div style="background-color: #f0f4fc; border-radius: 12px; padding: 24px 20px; border: 1px dashed #3b82f6;">
                  <span style="font-size: 42px; font-weight: 700; letter-spacing: 8px; color: #1e293b; font-family: 'Courier New', monospace;">
                    ${params.code}
                  </span>
                </div>
              </td>
            </tr>

            <!-- Informações adicionais -->
            <tr>
              <td align="center" style="padding: 0 40px 20px; color: #5b6778; font-size: 15px;">
                <p style="margin: 0 0 8px;">
                  ⏳ Este código expira em <strong>${params.expiresIn}</strong>.
                </p>
                <p style="margin: 0;">
                  Se você não solicitou este código, pode ignorar este e-mail com segurança.
                </p>
              </td>
            </tr>

            <!-- Botão alternativo (caso o código não seja copiável) -->
            <tr>
              <td align="center" style="padding: 10px 40px 30px;">
                <!-- Observação: muitos clientes de email não suportam botões estilizados, então usamos um link simples também -->
                <p style="margin: 0; font-size: 14px; color: #8892a0;">
                  Ou se preferir, acesse: <br />
                  <a href="${params.verificationUrl}" style="color: #3b82f6; text-decoration: none; word-break: break-all;">
                    ${params.verificationUrl}
                  </a>
                </p>
              </td>
            </tr>

            <!-- Linha divisória -->
            <tr>
              <td style="padding: 0 30px;">
                <hr style="border: 0; border-top: 1px solid #e9ecef; margin: 0;">
              </td>
            </tr>

            <!-- Rodapé com informações de contato -->
            <tr>
              <td align="center" style="padding: 30px 40px 40px; color: #8892a0; font-size: 13px; line-height: 1.6;">
                <p style="margin: 0 0 12px;">
                  © ${new Date().getFullYear()} ${params.appName}. Todos os direitos reservados.
                </p>
                <p style="margin: 0;">
                  Você recebeu este e-mail porque se registrou em nosso serviço.<br>
                  Em caso de dúvidas, entre em contato conosco.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}

export async function sendVerificationCode(params: {
  to: string;
  displayName: string;
  code: string;
}): Promise<void> {
  const appName = escapeHtml(process.env.APP_NAME?.trim() || 'Prottoset');
  const verificationUrl = new URL('/verify-email', authConfig.clientUrl());
  verificationUrl.searchParams.set('email', params.to.trim().toLowerCase());

  const expiresIn = `${EXPIRATION_MINUTES} minutos`;
  const subject = 'Seu código de verificação chegou!';
  const body = [
  'Olá,',
    '',
    'Seu código de verificação é:',
    `\n${params.code}\n`,
  `Ele expira em ${expiresIn}.`,
  `Verificar conta: ${verificationUrl.toString()}`,
    'Se você não solicitou este cadastro, ignore esta mensagem.',
  ].join('\n');

  const html = buildVerificationTemplate({
  appName,
  code: escapeHtml(params.code),
  expiresIn: escapeHtml(expiresIn),
  verificationUrl: escapeHtml(verificationUrl.toString()),
  });

  const result = await resendService.sendEmail(params.to, subject, body, { html, text: body });
  if (!result.success) {
    // Log the full error in any environment so operators can diagnose failures.
    console.error(`[Auth] Falha ao enviar código de verificação para ${params.to}:`, result.error);

    if (process.env.NODE_ENV !== 'production') {
      // Helpful fallback during local development when Resend is not configured.
      console.info(`[Auth] Código de verificação para ${params.to}: ${params.code}`);
      return;
    }
    throw new Error(result.error || 'Falha ao enviar código de verificação');
  }
}
