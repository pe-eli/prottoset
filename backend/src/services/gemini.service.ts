import { GoogleGenerativeAI } from '@google/generative-ai';

interface RawLead {
  name: string;
  link: string;
  platform: string;
  snippet: string;
}

export interface EnrichedLead {
  name: string;
  description: string;
  website: string;
  instagram: string;
  phone: string;
  email: string;
  link: string;
  platform: string;
  snippet: string;
}

const PROMPT = `Você é um assistente de prospecção de leads. Receba os dados brutos de resultados de busca do Google e extraia informações estruturadas de cada lead.

Para CADA lead, extraia:
- "name": nome do estabelecimento/negócio (limpo, sem @ ou sufixos de plataformas)
- "description": breve descrição do negócio (1-2 frases, baseado no snippet)
- "website": URL do site oficial (se encontrado no snippet ou link, senão "")
- "instagram": URL ou @ do instagram (se encontrado, senão "")
- "phone": telefone de contato (se encontrado no snippet, senão "")
- "email": email de contato (se encontrado no snippet, senão "")

Regras:
- Se o link principal for do Instagram, coloque no campo "instagram"
- Se o link principal for um site, coloque no campo "website"
- Extraia telefones no formato encontrado (com DDD)
- Extraia emails se visíveis no snippet
- O nome deve ser limpo e legível (sem @, sem " - Instagram", etc)
- A descrição deve ser útil e concisa

Responda APENAS com um JSON array, sem markdown, sem explicações. Exemplo:
[{"name":"Studio X","description":"Estúdio de tatuagem em BH","website":"https://studiox.com","instagram":"@studiox","phone":"(31) 99999-0000","email":"contato@studiox.com"}]`;

const WA_SYSTEM_PROMPT = `Você é especialista em comunicação humanizada via WhatsApp para negócios. Gere UMA mensagem de WhatsApp com base na intenção abaixo.

Regras obrigatórias:
- Tom natural, direto e amigável — como de pessoa para pessoa, nunca robotizado
- Não use markdown, asteriscos, hashtags ou formatação especial
- Máximo 3 parágrafos curtos
- Varie estrutura, abertura e vocabulário para que seja ÚNICA (diferente de outros envios)
- Português brasileiro informal
- Não mencione "IA", "automação" ou "sistema"
- Não inclua assunto, títulos ou identificadores

Responda APENAS com o texto da mensagem, sem prefixos, aspas ou explicações.`;

/** Verifica se o erro é um 429 / rate-limit do Gemini */
function isRateLimitError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err).toLowerCase();
  const status = (err as any)?.status;
  return status === 429 || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('rate limit');
}

/** Tenta até maxRetries vezes com backoff exponencial em caso de 429 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 8_000,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isRateLimitError(err) && attempt < maxRetries) {
        const waitMs = baseDelayMs * Math.pow(2, attempt); // 8s → 16s → 32s
        console.warn(
          `[Gemini] 429 rate-limit — aguardando ${waitMs / 1000}s (tentativa ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((res) => setTimeout(res, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Número máximo de tentativas atingido');
}

export const geminiService = {
  /**
   * Gera uma mensagem de WhatsApp levemente única baseada no prompt fornecido.
   * Aplica retry automático com backoff exponencial em caso de 429.
   */
  async generateWhatsAppMessage(promptBase: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not configured, using raw prompt as message');
      return promptBase;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    return withRetry(async () => {
      const result = await model.generateContent(
        `${WA_SYSTEM_PROMPT}\n\nIntenção da mensagem:\n${promptBase}`,
      );
      return result.response.text().trim();
    });
  },

  async enrichLeads(rawLeads: RawLead[]): Promise<EnrichedLead[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not configured, skipping enrichment');
      return rawLeads.map((r) => ({
        ...r,
        description: r.snippet,
        website: r.platform !== 'Instagram' ? r.link : '',
        instagram: r.platform === 'Instagram' ? r.link : '',
        phone: '',
        email: '',
      }));
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const input = JSON.stringify(
      rawLeads.map((r) => ({
        name: r.name,
        link: r.link,
        platform: r.platform,
        snippet: r.snippet,
      }))
    );

    try {
      const result = await model.generateContent(`${PROMPT}\n\nDados brutos:\n${input}`);
      const text = result.response.text().trim();

      // Strip markdown fences if present
      const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const parsed: Array<{
        name: string;
        description: string;
        website: string;
        instagram: string;
        phone: string;
        email: string;
      }> = JSON.parse(clean);

      return rawLeads.map((raw, i) => {
        const enriched = parsed[i];
        if (!enriched) {
          return {
            ...raw,
            description: raw.snippet,
            website: raw.platform !== 'Instagram' ? raw.link : '',
            instagram: raw.platform === 'Instagram' ? raw.link : '',
            phone: '',
            email: '',
          };
        }
        return {
          name: enriched.name || raw.name,
          description: enriched.description || raw.snippet,
          website: enriched.website || '',
          instagram: enriched.instagram || '',
          phone: enriched.phone || '',
          email: enriched.email || '',
          link: raw.link,
          platform: raw.platform,
          snippet: raw.snippet,
        };
      });
    } catch (err) {
      console.error('Gemini enrichment failed, using raw data:', err);
      return rawLeads.map((r) => ({
        ...r,
        description: r.snippet,
        website: r.platform !== 'Instagram' ? r.link : '',
        instagram: r.platform === 'Instagram' ? r.link : '',
        phone: '',
        email: '',
      }));
    }
  },
};
