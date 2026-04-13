import { Resend } from 'resend';

let _client: Resend | null = null;

function getClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY não configurado no .env');
    _client = new Resend(key);
  }
  return _client;
}

const FROM = () => process.env.EMAIL_FROM || process.env.RESEND_FROM || 'Prottoset <noreply@prottocode.com.br>';

interface SendEmailOptions {
  html?: string;
  text?: string;
}

export const resendService = {
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    options: SendEmailOptions = {},
  ): Promise<{ success: boolean; error?: string }> {
    const from = FROM();
    console.log(`[Resend] Iniciando envio de e-mail para=${to}, from=${from}, subject="${subject}"`);
    console.log(`[Resend] RESEND_API_KEY presente: ${!!process.env.RESEND_API_KEY} (${(process.env.RESEND_API_KEY || '').slice(0, 8)}...)`);
    console.log(`[Resend] EMAIL_FROM=${process.env.EMAIL_FROM || '(vazio)'}, RESEND_FROM=${process.env.RESEND_FROM || '(vazio)'}`);
    console.log(`[Resend] Usando html customizado: ${!!options.html}, usando text customizado: ${!!options.text}`);

    try {
      const htmlBody = body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      const html = options.html || `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #0f1f5b;">
            <div style="font-size: 15px; line-height: 1.7; color: #374151;">
              ${htmlBody}
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f4; margin: 28px 0;">
            <p style="font-size: 12px; color: #93afd4; margin: 0;">
              Prottocode - Desenvolvimento de Sistemas
            </p>
          </div>
        `;

      console.log(`[Resend] Chamando resend.emails.send()...`);
      const { data, error } = await getClient().emails.send({
        from,
        to,
        subject,
        html,
        text: options.text || body,
      });

      if (error) {
        console.error(`[Resend] API retornou erro:`, JSON.stringify(error));
        return { success: false, error: error.message };
      }
      console.log(`[Resend] E-mail enviado com sucesso! ID:`, data?.id);
      return { success: true };
    } catch (err: any) {
      console.error(`[Resend] Exceção ao enviar e-mail:`, err?.message, err?.statusCode, JSON.stringify(err));
      return { success: false, error: err?.message || 'Erro desconhecido' };
    }
  },
};
