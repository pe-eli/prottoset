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

const DEFAULT_WA_PROMPT = 'iniciar conversa';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const REQUEST_TIMEOUT_MS = 10_000;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 60_000;

let circuitFailures = 0;
let circuitOpenUntil = 0;

interface DeepSeekResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface AiGenerationResult {
  message: string;
  tokensUsed: number;
}

async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 3,
  baseDelayMs = 8_000,
): Promise<AiGenerationResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  if (Date.now() < circuitOpenUntil) {
    throw new Error('DeepSeek circuit breaker aberto temporariamente');
  }

  const MIN_INTERVAL_MS = 12_000; // DeepSeek: máximo 5 requests/minuto (12s entre cada)
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Aguarda intervalo mínimo antes de cada retry
      await new Promise((res) => setTimeout(res, MIN_INTERVAL_MS));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        signal: controller.signal,
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
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        circuitFailures += 1;
        if (circuitFailures >= CIRCUIT_FAILURE_THRESHOLD) {
          circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
        }
        throw new Error('DeepSeek timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

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
      if (response.status >= 500 || response.status === 429) {
        circuitFailures += 1;
        if (circuitFailures >= CIRCUIT_FAILURE_THRESHOLD) {
          circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
        }
      }
      throw new Error(`DeepSeek API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as DeepSeekResponse;

    const message = data.choices[0]?.message?.content?.trim() ?? '';
    const tokensUsed = data.usage?.total_tokens ?? 0;
    circuitFailures = 0;
    circuitOpenUntil = 0;
    return { message, tokensUsed };
  }

  throw new Error('Número máximo de tentativas atingido');
}

export const deepseekService = {
  async generateWhatsAppMessage(promptBase?: string): Promise<AiGenerationResult> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY not configured');
    }

    const prompt = typeof promptBase === 'string' && promptBase.trim().length > 0
      ? promptBase.trim()
      : DEFAULT_WA_PROMPT;

    return callDeepSeek(
      WA_SYSTEM_PROMPT,
      prompt,
    );
  },
};
