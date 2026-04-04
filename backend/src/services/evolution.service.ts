function normalizeApiUrl(raw?: string): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Accept host-only values from env (e.g. example.up.railway.app)
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizePhoneForWa(value: string): string {
  const digits = digitsOnly(value);
  // BR default: if user entered local format (10/11 digits), prepend country code.
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function buildEvolutionHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
  };
}

function formatEvolutionHttpError(status: number, body: string): string {
  const excerpt = body.slice(0, 200);
  if (status === 401) {
    return `Evolution API 401 (unauthorized). Verifique EVOLUTION_API_KEY e permissao da instancia. Response: ${excerpt}`;
  }
  return `Evolution API ${status}: ${excerpt}`;
}

export const evolutionService = {
  /**
   * Validate which phone numbers have WhatsApp.
   * Returns only the numbers that exist on WhatsApp.
   */
  async checkNumbers(
    phones: string[],
  ): Promise<{ valid: string[]; invalid: string[] }> {
    const apiUrl = normalizeApiUrl(process.env.EVOLUTION_API_URL);
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE;

    if (!apiUrl || !apiKey || !instance) {
      throw new Error('Evolution API não configurada');
    }

    const valid: string[] = [];
    const invalid: string[] = [];
    const normalizedPhones = phones.map(normalizePhoneForWa).filter((p) => p.length >= 12);

    // Evolution API checks numbers in batch
    try {
      const response = await fetch(`${apiUrl}/chat/whatsappNumbers/${instance}`, {
        method: 'POST',
        headers: buildEvolutionHeaders(apiKey),
        body: JSON.stringify({ numbers: normalizedPhones }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(formatEvolutionHttpError(response.status, body));
      }

      const data = (await response.json()) as Array<{
        exists: boolean;
        jid: string;
        number: string;
      }>;

      for (const entry of data) {
        if (entry.exists) {
          // Use the number returned by WhatsApp (canonical form)
          valid.push(normalizePhoneForWa(entry.number || entry.jid.replace(/@.*$/, '')));
        } else {
          const num = entry.number || entry.jid?.replace(/@.*$/, '') || '';
          invalid.push(normalizePhoneForWa(num));
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
    const apiUrl = normalizeApiUrl(process.env.EVOLUTION_API_URL);
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE;

    if (!apiUrl || !apiKey || !instance) {
      throw new Error('Evolution API não configurada');
    }

    try {
      const response = await fetch(`${apiUrl}/chat/findChats/${instance}`, {
        method: 'POST',
        headers: buildEvolutionHeaders(apiKey),
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(formatEvolutionHttpError(response.status, body));
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
    const apiUrl = normalizeApiUrl(process.env.EVOLUTION_API_URL);
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
    const cleanPhone = normalizePhoneForWa(phone);

    try {
      const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: buildEvolutionHeaders(apiKey),
        body: JSON.stringify({
          number: cleanPhone,
          text: message,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return {
          success: false,
          error: formatEvolutionHttpError(response.status, body).slice(0, 260),
        };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Erro de conexão com a Evolution API' };
    }
  },
};
