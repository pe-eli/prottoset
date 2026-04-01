export const evolutionService = {
  /**
   * Validate which phone numbers have WhatsApp.
   * Returns only the numbers that exist on WhatsApp.
   */
  async checkNumbers(
    phones: string[],
  ): Promise<{ valid: string[]; invalid: string[] }> {
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE;

    if (!apiUrl || !apiKey || !instance) {
      throw new Error('Evolution API não configurada');
    }

    const valid: string[] = [];
    const invalid: string[] = [];

    // Evolution API checks numbers in batch
    try {
      const response = await fetch(`${apiUrl}/chat/whatsappNumbers/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({ numbers: phones }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Evolution API ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = (await response.json()) as Array<{
        exists: boolean;
        jid: string;
        number: string;
      }>;

      for (const entry of data) {
        if (entry.exists) {
          // Use the number returned by WhatsApp (canonical form)
          valid.push(entry.number || entry.jid.replace(/@.*$/, ''));
        } else {
          const num = entry.number || entry.jid?.replace(/@.*$/, '') || '';
          invalid.push(num);
        }
      }
    } catch (err: any) {
      console.error('[Evolution] checkNumbers error:', err.message);
      throw err;
    }

    return { valid, invalid };
  },

  /**
   * Fetch all existing chat phone numbers from the instance.
   * Returns a Set of phone numbers (digits only) that already have open conversations.
   */
  async fetchExistingChats(): Promise<Set<string>> {
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE;

    if (!apiUrl || !apiKey || !instance) {
      throw new Error('Evolution API não configurada');
    }

    try {
      const response = await fetch(`${apiUrl}/chat/findChats/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Evolution API ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = (await response.json()) as Array<{ id?: string; remoteJid?: string }>;
      const phones = new Set<string>();

      for (const chat of data) {
        const jid = chat.id || chat.remoteJid || '';
        // JID format: "5511999999999@s.whatsapp.net" (individual) — skip groups (@g.us)
        const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
        if (match) {
          phones.add(match[1]);
        }
      }

      return phones;
    } catch (err: any) {
      console.error('[Evolution] fetchExistingChats error:', err.message);
      throw err;
    }
  },

  async sendMessage(
    phone: string,
    message: string,
  ): Promise<{ success: boolean; error?: string }> {
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE;

    if (!apiUrl || !apiKey || !instance) {
      return {
        success: false,
        error:
          'Evolution API não configurada. Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE no .env',
      };
    }

    // Normalize phone: keep only digits, ensure country code
    const cleanPhone = phone.replace(/\D/g, '');

    try {
      const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: message,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return { success: false, error: `API ${response.status}: ${body.slice(0, 120)}` };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Erro de conexão com a Evolution API' };
    }
  },
};
