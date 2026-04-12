interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

export const turnstileService = {
  async verify(token: string, ip?: string): Promise<boolean> {
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!secret) {
      throw new Error('TURNSTILE_SECRET_KEY não configurada');
    }

    const params = new URLSearchParams({
      secret,
      response: token,
    });

    if (ip) {
      params.set('remoteip', ip);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`Turnstile respondeu com status ${response.status}`);
    }

    const result = (await response.json()) as TurnstileResponse;
    return result.success;
  },
};