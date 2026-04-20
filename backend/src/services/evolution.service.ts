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

function getApiConfig(): { apiUrl: string; apiKey: string } {
  const apiUrl = normalizeApiUrl(process.env.EVOLUTION_API_URL);
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error('Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY)');
  }
  return { apiUrl, apiKey };
}

export const evolutionService = {
  /**
   * Validate which phone numbers have WhatsApp.
   * Returns only the numbers that exist on WhatsApp.
   */
  async checkNumbers(
    instanceName: string,
    phones: string[],
  ): Promise<{ valid: string[]; invalid: string[] }> {
    const { apiUrl, apiKey } = getApiConfig();

    const valid: string[] = [];
    const invalid: string[] = [];
    const normalizedPhones = phones.map(normalizePhoneForWa).filter((p) => p.length >= 12);

    // Evolution API checks numbers in batch
    try {
      const response = await fetch(`${apiUrl}/chat/whatsappNumbers/${instanceName}`, {
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
      console.error(`[Evolution:${instanceName}] checkNumbers error:`, err.message);
      throw err;
    }

    return { valid, invalid };
  },

  /**
   * Fetch all existing chat phone numbers from the instance.
   * Returns a Set of phone numbers (digits only) that already have open conversations.
   */
  async fetchExistingChats(instanceName: string): Promise<Set<string>> {
    const { apiUrl, apiKey } = getApiConfig();

    try {
      const response = await fetch(`${apiUrl}/chat/findChats/${instanceName}`, {
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
      console.error(`[Evolution:${instanceName}] fetchExistingChats error:`, err.message);
      throw err;
    }
  },

  async sendMessage(
    instanceName: string,
    phone: string,
    message: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { apiUrl, apiKey } = getApiConfig();

    // Normalize phone: keep only digits, ensure country code
    const cleanPhone = normalizePhoneForWa(phone);

    try {
      const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
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

  // ─── Instance management ───

  async createInstance(instanceName: string): Promise<{ qrCode?: string }> {
    const { apiUrl, apiKey } = getApiConfig();
    const body: Record<string, unknown> = {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    };

    const response = await fetch(`${apiUrl}/instance/create`, {
      method: 'POST',
      headers: buildEvolutionHeaders(apiKey),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(formatEvolutionHttpError(response.status, text));
    }

    const data = (await response.json()) as Record<string, any>;
    return { qrCode: data.qrcode?.base64 ?? data.base64 };
  },

  async setWebhook(instanceName: string): Promise<void> {
    const { apiUrl, apiKey } = getApiConfig();
    const webhookBaseUrl = normalizeApiUrl(process.env.EVOLUTION_WEBHOOK_URL);
    const webhookToken = process.env.WEBHOOK_TOKEN?.trim();

    if (!webhookBaseUrl) {
      throw new Error('EVOLUTION_WEBHOOK_URL não configurada para setWebhook');
    }
    if (!webhookToken) {
      throw new Error('WEBHOOK_TOKEN não configurado para setWebhook');
    }

    const webhookUrl = `${webhookBaseUrl}/api/webhooks/evolution?token=${encodeURIComponent(webhookToken)}`;
    const events = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];
    const byEvents = true;

    // 1. { webhook: { url, events, byEvents } }
    const payloadWebhook = {
      webhook: {
        url: webhookUrl,
        events,
        byEvents,
      },
    };
    // 2. { url, events, byEvents }
    const payloadFlat = {
      url: webhookUrl,
      events,
      byEvents,
    };
    // 3. { url }
    const payloadUrlOnly = { url: webhookUrl };

    let lastError;
    // 1. Tenta formato recomendado (Evolution >=2.3.7)
    try {
      const response = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: buildEvolutionHeaders(apiKey),
        body: JSON.stringify(payloadWebhook),
      });
      if (response.ok) return;
      const text = await response.text().catch(() => '');
      if (!(response.status === 400 || response.status === 422)) {
        throw new Error(formatEvolutionHttpError(response.status, text));
      }
      lastError = new Error(formatEvolutionHttpError(response.status, text));
    } catch (err: any) {
      lastError = err;
    }
    // 2. Tenta formato flat (Evolution <=2.3.6)
    try {
      const response = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: buildEvolutionHeaders(apiKey),
        body: JSON.stringify(payloadFlat),
      });
      if (response.ok) return;
      const text = await response.text().catch(() => '');
      if (!(response.status === 400 || response.status === 422)) {
        throw new Error(formatEvolutionHttpError(response.status, text));
      }
      lastError = new Error(formatEvolutionHttpError(response.status, text));
    } catch (err: any) {
      lastError = err;
    }
    // 3. Tenta formato mínimo
    try {
      const response = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: buildEvolutionHeaders(apiKey),
        body: JSON.stringify(payloadUrlOnly),
      });
      if (response.ok) return;
      const text = await response.text().catch(() => '');
      lastError = new Error(formatEvolutionHttpError(response.status, text));
    } catch (err: any) {
      lastError = err;
    }
    // Se todos falharem, lança o último erro
    throw lastError;
  },

  async connectInstance(instanceName: string): Promise<{ qrCode?: string }> {
    const { apiUrl, apiKey } = getApiConfig();

    const response = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: buildEvolutionHeaders(apiKey),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(formatEvolutionHttpError(response.status, text));
    }

    const data = (await response.json()) as Record<string, any>;
    return { qrCode: data.base64 };
  },

  async getInstanceStatus(instanceName: string): Promise<string> {
    const { apiUrl, apiKey } = getApiConfig();

    const response = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: buildEvolutionHeaders(apiKey),
    });

    if (!response.ok) return 'close';
    const data = (await response.json()) as Record<string, any>;
    return data.instance?.state ?? 'close';
  },

  async deleteInstance(instanceName: string): Promise<void> {
    const { apiUrl, apiKey } = getApiConfig();

    await fetch(`${apiUrl}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: buildEvolutionHeaders(apiKey),
    });
  },
};
