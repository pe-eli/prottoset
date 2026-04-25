import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const WA_SYSTEM_PROMPT = `Gere UMA mensagem curta para iniciar uma conversa no WhatsApp com um dono de negócio (dentistas, advogados, clínicas, agências ou consultorias).

OBJETIVO: Despertar curiosidade tocando em uma dor real e abrir caminho para marcar uma reunião. Nada mais.

CONTEXTO DA DOR: Esse cliente provavelmente está perdendo espaço para concorrentes que têm presença 
digital mais forte — aparece melhor no Google, tem site profissional, usa automações. Ele pode nem ter percebido isso ainda.

REGRAS:
- Máximo 2 frases curtas
- Tom humano, direto, sem parecer vendedor ou robótico
- Mencione sutilmente que você pesquisou o segmento ou o negócio dele
- Plante a dúvida: "será que meu concorrente está na minha frente?"
- Termine com uma pergunta ou gancho que convide resposta
- Varie a saudação (Oi, Olá, Opa, E aí etc.)
- Jamais mencione preço, serviço, produto ou proposta
- Não use markdown, asteriscos ou emojis excessivos

EXEMPLOS DO TOM CERTO:
- "Oi [Nome]! Dei uma olhada em alguns [dentistas/advogados/clínicas] da região e achei interessante como alguns estão se posicionando online. Você já chegou a comparar isso com o seu?"
- "Olá [Nome]! Estava analisando o mercado de [segmento] por aqui e notei alguns movimentos diferentes no digital. Você já parou pra ver como está a sua presença digital hoje?"
- "E aí [Nome], tudo bem? Andei pesquisando negócios do seu segmento e vi algumas estratégias sendo usadas pra atrair clientes online. Você já testou algo nesse sentido?"

Responda APENAS com o texto da mensagem.`;

const DEFAULT_WA_PROMPT = 'iniciar conversa';
const DEEPSEEK_MODEL = 'deepseek-reasoner';
const AI_MEMORY_FILE_NAME = 'whatsapp-ai-memory.json';
const AI_MEMORY_MAX_ENTRIES = 120;
const AI_MEMORY_CONTEXT_ENTRIES = 8;

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

interface AiMemoryEntry {
  timestamp: string;
  tenantId?: string;
  source: 'blast' | 'reply' | 'test';
  prompt: string;
  message: string;
}

interface AiMemoryStore {
  version: number;
  updatedAt: string | null;
  entries: AiMemoryEntry[];
}

interface GenerationOptions {
  tenantId?: string;
  source?: 'blast' | 'reply' | 'test';
}

function resolveMemoryFilePath(): string {
  const backendPath = path.resolve(process.cwd(), 'data', AI_MEMORY_FILE_NAME);
  const rootPath = path.resolve(process.cwd(), 'backend', 'data', AI_MEMORY_FILE_NAME);
  return existsSync(backendPath) || !existsSync(rootPath) ? backendPath : rootPath;
}

async function readMemoryStore(): Promise<AiMemoryStore> {
  const filePath = resolveMemoryFilePath();
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AiMemoryStore>;
    const rawEntries: unknown[] = Array.isArray(parsed.entries) ? parsed.entries : [];
    const entries = rawEntries
      .filter((entry): entry is AiMemoryEntry => {
        if (!entry || typeof entry !== 'object') return false;
        const candidate = entry as Record<string, unknown>;
        return typeof candidate.timestamp === 'string'
          && typeof candidate.prompt === 'string'
          && typeof candidate.message === 'string'
          && typeof candidate.source === 'string';
      });

    return {
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      entries,
    };
  } catch {
    return {
      version: 1,
      updatedAt: null,
      entries: [],
    };
  }
}

async function writeMemoryStore(store: AiMemoryStore): Promise<void> {
  const filePath = resolveMemoryFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

function buildPromptWithMemory(
  prompt: string,
  memory: AiMemoryEntry[],
  generatedInThisRequest: string[],
): string {
  const memoryBlock = memory.length > 0
    ? memory.map((entry, index) => `${index + 1}. ${entry.message}`).join('\n')
    : '';

  const generatedBlock = generatedInThisRequest.length > 0
    ? generatedInThisRequest.map((message, index) => `${index + 1}. ${message}`).join('\n')
    : '';

  const parts = [
    `PROMPT DO USUÁRIO:\n${prompt}`,
  ];

  if (memoryBlock) {
    parts.push(`HISTÓRICO RECENTE (evite repetir frases idênticas):\n${memoryBlock}`);
  }

  if (generatedBlock) {
    parts.push(`JÁ GERADAS NESTE TESTE (crie variação real):\n${generatedBlock}`);
  }

  return parts.join('\n\n');
}

async function appendMemoryEntries(entries: AiMemoryEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const store = await readMemoryStore();
  const nextEntries = [...store.entries, ...entries].slice(-AI_MEMORY_MAX_ENTRIES);
  await writeMemoryStore({
    version: store.version || 1,
    updatedAt: new Date().toISOString(),
    entries: nextEntries,
  });
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
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.9,
          max_tokens: 1000,
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
  async generateWhatsAppMessages(
    promptBase?: string,
    count = 1,
    options: GenerationOptions = {},
  ): Promise<{ messages: string[]; tokensUsed: number }> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY not configured');
    }

    const prompt = typeof promptBase === 'string' && promptBase.trim().length > 0
      ? promptBase.trim()
      : DEFAULT_WA_PROMPT;

    const safeCount = Math.max(1, Math.min(5, Math.floor(Number(count) || 1)));
    const store = await readMemoryStore();
    const memoryContext = options.tenantId
      ? store.entries
        .filter((entry) => entry.tenantId === options.tenantId)
        .slice(-AI_MEMORY_CONTEXT_ENTRIES)
      : [];
    const messages: string[] = [];
    let totalTokens = 0;

    for (let index = 0; index < safeCount; index++) {
      const result = await callDeepSeek(
        WA_SYSTEM_PROMPT,
        buildPromptWithMemory(prompt, memoryContext, messages),
      );
      const message = result.message.trim();
      if (!message) {
        throw new Error('DeepSeek não retornou uma mensagem válida');
      }
      messages.push(message);
      totalTokens += result.tokensUsed;
    }

    if (options.tenantId) {
      await appendMemoryEntries(messages.map((message) => ({
        timestamp: new Date().toISOString(),
        tenantId: options.tenantId,
        source: options.source || 'blast',
        prompt,
        message,
      })));
    }

    return { messages, tokensUsed: totalTokens };
  },

  async generateWhatsAppMessage(promptBase?: string, options: GenerationOptions = {}): Promise<AiGenerationResult> {
    const generated = await this.generateWhatsAppMessages(promptBase, 1, options);

    return {
      message: generated.messages[0] || '',
      tokensUsed: generated.tokensUsed,
    };
  },

  async getRecentWhatsAppMemory(limit = 20, tenantId?: string): Promise<AiMemoryEntry[]> {
    const store = await readMemoryStore();
    const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 20)));
    const scoped = tenantId
      ? store.entries.filter((entry) => entry.tenantId === tenantId)
      : store.entries.filter((entry) => !entry.tenantId);
    return scoped.slice(-safeLimit);
  },
};
