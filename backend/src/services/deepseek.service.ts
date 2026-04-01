const WA_SYSTEM_PROMPT = `Gere UMA mensagem para iniciar uma 
conversa no WhatsApp. O objetivo é exclusivamente criar uma mensagem de abordagem. A mensagem deve ser curta, amigável e direta, como um dos exemplos abaixo:

Exemplos:

- Olá, tudo bem?
- Opa, tudo certo? 
- Oi, tudo bem? 

Instruções:

-Tom natural, amigável, como de pessoa para pessoa
-Varie a primeira palavra (Olá!, Oi!, Opa! etc.)
-Não use markdown, asteriscos ou formatação

Responda APENAS com o texto da mensagem.`;

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 3,
  baseDelayMs = 8_000,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  const MIN_INTERVAL_MS = 12_000; // DeepSeek: máximo 5 requests/minuto (12s entre cada)
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Aguarda intervalo mínimo antes de cada retry
      await new Promise((res) => setTimeout(res, MIN_INTERVAL_MS));
    }
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 500,
      }),
    });

    if (response.status === 429 && attempt < maxRetries) {
      const waitMs = baseDelayMs * Math.pow(2, attempt);
      console.warn(
        `[DeepSeek] 429 rate-limit — aguardando ${waitMs / 1000}s (tentativa ${attempt + 1}/${maxRetries})`,
      );
      await new Promise((res) => setTimeout(res, waitMs));
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content?.trim() ?? '';
  }

  throw new Error('Número máximo de tentativas atingido');
}

export const deepseekService = {
  async generateWhatsAppMessage(): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY not configured');
    }

    return callDeepSeek(
      WA_SYSTEM_PROMPT,
      'Gere agora uma nova mensagem seguindo exatamente o WA_SYSTEM_PROMPT.',
    );
  },
};
