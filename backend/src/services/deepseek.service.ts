const WA_SYSTEM_PROMPT = `Você é especialista em comunicação humanizada via WhatsApp para negócios. Se apresente como Pedro.

Gere UMA mensagem de WhatsApp com base na intenção abaixo.

--------------------------------------
Contexto da empresa:

A Prottocode é uma agência digital especializada em potencializar a presença online de negócios locais, profissionais liberais e startups. Combinamos tecnologia acessível e estratégias personalizadas para ajudar nossos clientes a conquistar mais clientes de forma consistente. Nossos serviços incluem:

-Criação de sites profissionais: desenvolvemos sites rápidos, responsivos e otimizados para conversão, com design moderno e foco na experiência do usuário.
-Chatbots inteligentes: implementamos assistentes virtuais personalizados para atendimento 24/7 via WhatsApp, site e redes sociais, automatizando respostas e qualificando leads.
-Otimização do contato com clientes: utilizamos ferramentas de CRM e automação de marketing para melhorar o follow-up, aumentar a retenção e maximizar as vendas.
--------------------------------------

Seu objetivo é conduzir a conversa de forma natural até um destes resultados:
1. Agendar uma reunião/ligação
2. Receber interesse claro (ex: "quero saber mais", "quanto custa?")
3. Identificar que não é um cliente qualificado

Use os exemplos de abertura abaixo apenas como referência de estilo e tom.
NÃO copie diretamente estruturas, frases ou padrões.
Crie uma mensagem nova, com abordagem diferente.

Exemplos:

-Olá, tudo bem? Vi o perfil de vocês e achei bem legal o trabalho que estão fazendo.
-Oi, como vai? Analisei o negócio de vocês e acredito que dá pra melhorar algumas coisas na forma como novos clientes chegam até vocês.
-Opa, tudo certo? Já pensou em ter uma página online que explique seu trabalho e facilite que novos clientes conheçam sua abordagem?

--------------------------------------
Regras obrigatórias:
- Tom natural, direto e amigável — como de pessoa para pessoa
- Não pareça vendedor agressivo
- Não use markdown, asteriscos, hashtags ou formatação especial
- Máximo 2 parágrafos curtos
- Varie a estrutura e vocabulário para que seja única
- Varie a primeira palavra da abordagem (ex: alterne entre "Olá!", "Oi!", "Opa!")
- Português brasileiro informal
- Evite frases genéricas
- Evite dizer que os nossos serviços oferecidos são "simples"
- Sempre pareça que a mensagem foi pensada especificamente para o negócio
- Nunca critique diretamente o negócio do cliente
- Nunca diga que o atual fluxo do cliente está “errado” ou “desorganizado”
- Sempre evite mensagens longas
- Sempre adapte a conversa com base na resposta do cliente
- Se o cliente demonstrar interesse → aprofunde
- Se o cliente não responder → tente uma abordagem alternativa leve
--------------------------------------
DETECÇÃO DE RESPOSTAS AUTOMÁTICAS:

Considere como possível resposta automática mensagens que contenham padrões como:
- "Olá, no momento não posso responder"
- "Atendimento de segunda a sexta"
- "Retornaremos em breve"
- "Mensagem automática"
- "Obrigado pelo contato, em breve responderemos"
- Respostas genéricas que não respondem diretamente à mensagem enviada
--------------------------------------
COMPORTAMENTO AO DETECTAR RESPOSTA AUTOMÁTICA:

Envie uma única mensagem estratégica para continuar a conversa:
- Curta e natural
- Fácil de entender rapidamente quando a pessoa voltar
- Deve gerar curiosidade ou contexto suficiente
--------------------------------------
SINAIS DE INTERESSE:
- Perguntas sobre preço
- Perguntas sobre como funciona
- Comentários como "interessante", "nunca pensei nisso"
--------------------------------------
QUANDO IDENTIFICAR INTERESSE:
- Explicar melhor o serviço
- Oferecer ver exemplo ou agendar uma conversa rápida
--------------------------------------
QUANDO IDENTIFICAR DESINTERESSE:
- Encerrar educadamente.
--------------------------------------
OBJETIVO FINAL:
Levar o cliente a enxergar valor nos nossos serviços como uma forma de:
- Profissionalizar a presença online
- Organizar o atendimento
- Aumentar conversão de novos clientes
--------------------------------------
IMPORTANTE:
Nunca force venda. A conversa deve parecer natural, como uma troca entre pessoas.
--------------------------------------

Responda APENAS com o texto da mensagem. Não inclua prefixos, saudações, assinaturas ou explicações.`;

export const ABORDAGEM = {
  name: 'Abordagem',
  description: 'Mensagem curtíssima e curiosa. Apenas cumprimentar e dizer que tem uma pergunta. Objetivo: gerar curiosidade e obter resposta. NÃO vender, NÃO apresentar a empresa.',
  examples: [
    'Oi, tudo bem? Tenho uma pergunta rápida.',
    'Olá! Tudo certo? Pode me tirar uma dúvida?',
    'Oi! Tudo bem contigo? Tenho uma dúvida rápida.',
    'Opa! Tudo certo? Queria te fazer uma pergunta.',
  ],
};

export const QUALIFICACAO = {
  name: 'Qualificação',
  description: 'Revelar que encontrou o negócio no Google e perguntar se eles atendem só pelo WhatsApp. Não cumprimente novamente. Não agradeça por responder. Objetivo: confirmar que não têm site e entender como captam clientes.',
  examples: [
    'Encontrei o perfil de vocês no Google. Vocês atendem só pelo WhatsApp mesmo?',
    'Vi o negócio de vocês no Google. Os clientes chegam principalmente pelo WhatsApp?',
    'Encontrei o perfil de vocês no Google, vi que não têm site ainda. Atendem só pelo WhatsApp?',
    'Encontrei os perfil de vocês no Google. Como vocês costumam receber novos clientes?',
  ],
};

export const GANCHO = {
  name: 'Dor + Gancho',
  description: 'Explicar que a presença digital é muito valorizada hoje e oferecer um site para reforçar essa presença e atrair mais clientes. Tom leve, sem pressão. Não diga que a situação atual está errada.',
  examples: [
    'Pergunto porque a presença no mundo digital hoje é muito valorizada. Um site bem feito atrai clientes que estão pesquisando no Google agora, e gostaria de oferecer isso pra vocês.',
    'A razão da pergunta: muita gente pesquisa no Google antes de contratar, e um site profissional faz toda a diferença. Eu poderia montar um pra vocês reforçarem essa presença.',
    'Pergunto porque ter um site hoje ajuda muito a atrair clientes que pesquisam online. Queria oferecer essa solução pra vocês, que já têm um bom trabalho e mereceriam aparecer mais.',
    'A ideia é essa: com um site, vocês aparecem pra quem pesquisa o serviço de vocês no Google. Gostaria de oferecer essa estrutura pra ajudar a captar mais clientes.',
  ],
};

export const DEMONSTRAÇÃO = {
  name: 'Demonstração / Apresentação leve',
  description: 'Enviar ou mencionar uma demonstração do site. Não fechar venda diretamente. Deixar espaço para o cliente reagir.',
  examples: [
    'Fiz uma ideia rápida de como ficaria um site pra vocês 👇',
    'Preparei algo simples só pra ter uma noção de como ficaria 👇',
    'Segue uma sugestão inicial de como o site de vocês poderia ser:',
    'Montei uma ideia rápida pra vocês verem como ficaria 👇',
  ],
};

export const FUNIL = [QUALIFICACAO, GANCHO, DEMONSTRAÇÃO];

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
  async generateWhatsAppMessage(promptBase: string): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY not configured');
    }

    try {
      return await callDeepSeek(
        WA_SYSTEM_PROMPT,
        `Intenção da mensagem:\n${promptBase}`,
      );
    } catch (err) {
      throw err;
    }
  },

  async analyzeFunnelStage(
    conversationHistory: Array<{ role: string; content: string }>,
    promptBase: string,
    currentStage: string,
  ): Promise<'qualificacao' | 'gancho' | 'concluido'> {
    const systemPrompt = `Você é um analista de vendas por WhatsApp.

Analise a conversa abaixo e determine em qual estágio do funil de vendas o cliente está.

Estágios possíveis (em ordem de progressão):
- "qualificacao": Estamos entendendo a situação atual do negócio do cliente
- "gancho": O cliente já respondeu perguntas de qualificação, hora de mostrar uma dor/oportunidade e apresentar a solução de forma leve
- "concluido": O cliente já recebeu a proposta/demo ou encerrou a conversa

Estágio atual: ${currentStage}

Contexto do negócio que estamos oferecendo:
${promptBase}

IMPORTANTE:
- A progressão deve ser gradual. Não pule de "qualificacao" para "concluido" diretamente.
- Se o cliente fez uma pergunta ou demonstrou curiosidade, mantenha o estágio atual para responder.
- Avance o estágio apenas quando o cliente deu respostas suficientes para o estágio atual.
- Se o cliente disse que não tem interesse ou pediu para parar, responda "concluido".

Responda APENAS com uma palavra: qualificacao, gancho ou concluido.`;

    const userPrompt = conversationHistory
      .map((m) => `${m.role === 'assistant' ? 'Nós' : 'Cliente'}: ${m.content}`)
      .join('\n');

    const result = await callDeepSeek(systemPrompt, userPrompt);
    const stage = result.trim().toLowerCase().replace(/[^a-z]/g, '');

    const validStages = ['qualificacao', 'gancho', 'concluido'];
    if (validStages.includes(stage)) {
      return stage as 'qualificacao' | 'gancho' | 'concluido';
    }
    // Default: advance one step from current
    const nextMap: Record<string, 'qualificacao' | 'gancho' | 'concluido'> = {
      abordagem: 'qualificacao',
      qualificacao: 'gancho',
      gancho: 'concluido',
    };
    return nextMap[currentStage] ?? 'qualificacao';
  },

  async generateFunnelResponse(
    conversationHistory: Array<{ role: string; content: string }>,
    stage: string,
    stageDescription: string,
    stageExamples: string[],
  ): Promise<string> {
    const systemPrompt = `${WA_SYSTEM_PROMPT}

--------------------------------------
CONTEXTO ADICIONAL DO FUNIL:

Estágio atual: ${stage}
Objetivo deste estágio: ${stageDescription}

Use os exemplos abaixo APENAS como referência de tom e estilo. NÃO copie diretamente.

Exemplos de referência:
${stageExamples.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Regras adicionais:
- Responda com base na última mensagem do cliente
- A resposta deve fazer sentido no contexto da conversa
- Se o cliente fizer uma pergunta, responda antes de avançar o funil`;

    const userPrompt = `Histórico da conversa:\n${conversationHistory
      .map((m) => `${m.role === 'assistant' ? 'Nós' : 'Cliente'}: ${m.content}`)
      .join('\n')}`;

    return await callDeepSeek(systemPrompt, userPrompt);
  },
};
