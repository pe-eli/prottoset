export const evolutionService = {
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
