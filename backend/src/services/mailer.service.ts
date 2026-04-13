import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} não configurada`);
  }
  return value;
}

function buildTransporter(): nodemailer.Transporter {
  const host = getRequiredEnv('SMTP_HOST');
  const port = Number(process.env.SMTP_PORT || 587);
  const user = getRequiredEnv('SMTP_USER');
  const pass = getRequiredEnv('SMTP_PASS');
  const secure = process.env.SMTP_SECURE === 'true';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = buildTransporter();
  }
  return transporter;
}

export const mailerService = {
  async sendMail(params: { to: string; subject: string; html: string; text: string }): Promise<void> {
    const from = process.env.SMTP_FROM?.trim() || 'Prottoset <no-reply@prottoset.local>';
    await getTransporter().sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
  },
};
