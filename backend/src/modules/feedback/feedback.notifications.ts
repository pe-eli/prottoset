import { mailerService } from '../../services/mailer.service';

function mailerConfigured(): boolean {
  return ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].every((key) => Boolean(process.env[key]?.trim()));
}

export const feedbackNotifications = {
  async sendAdminReplyEmail(input: {
    to: string;
    threadSubject: string;
    userName: string;
    message: string;
  }): Promise<void> {
    if (!mailerConfigured()) {
      return;
    }

    const preview = input.message.trim();
    await mailerService.sendMail({
      to: input.to,
      subject: 'Você recebeu uma resposta do suporte',
      text: `Olá, ${input.userName}.\n\nRecebemos uma nova resposta do suporte sobre: ${input.threadSubject}.\n\n${preview}\n\nAbra o Closr para continuar a conversa.`,
      html: `<p>Olá, ${input.userName}.</p><p>Recebemos uma nova resposta do suporte sobre: <strong>${input.threadSubject}</strong>.</p><blockquote style="margin:16px 0;padding-left:12px;border-left:3px solid #7b8cde;color:#374151;white-space:pre-wrap;">${preview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</blockquote><p>Abra o Closr para continuar a conversa.</p>`,
    });
  },
};
