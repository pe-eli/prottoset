import type { Lead } from '../../types/leads.types';

export type PersonalizationField = 'name' | 'city' | 'niche' | 'pain_points';

export function normalizePhone(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function buildPhoneKeys(value: string): string[] {
  const normalized = normalizePhone(value);
  const keys = new Set<string>([normalized]);
  if (normalized.startsWith('55') && normalized.length > 11) {
    keys.add(normalized.slice(2));
  }
  return Array.from(keys);
}

export function parsePersonalizationFields(fields: string[]): PersonalizationField[] {
  const valid = fields.filter((field): field is PersonalizationField => (
    field === 'name' || field === 'city' || field === 'niche' || field === 'pain_points'
  ));
  return Array.from(new Set(valid));
}

export function resolveLeadByPhone(phone: string, leadMap: Map<string, Lead>): Lead | null {
  for (const key of buildPhoneKeys(phone)) {
    const lead = leadMap.get(key);
    if (lead) return lead;
  }
  return null;
}

export function pickPainPoint(painPoints: string[], batchIndex: number, itemIndex: number): string | null {
  if (painPoints.length === 0) return null;
  return painPoints[(batchIndex + itemIndex) % painPoints.length] || null;
}

export function buildPersonalizedPrompt(params: {
  basePrompt: string;
  fields: PersonalizationField[];
  lead: Lead | null;
  painPoint: string | null;
}): string {
  const basePrompt = params.basePrompt.trim();
  const lead = params.lead;
  const blocks: string[] = [];

  if (params.fields.includes('name')) {
    if (lead?.name) {
      blocks.push(`NOME_BRUTO_MAPS: ${lead.name}`);
      blocks.push('REGRA_DE_SAUDACAO: Se for nome de pessoa, cumprimente com "Olá, <primeiro_nome>". Se for empresa/marca, use "Olá, Equipe da <nome>".');
    } else {
      blocks.push('REGRA_DE_SAUDACAO: Sem nome confiável. Use saudação neutra e curta.');
    }
  }

  if (params.fields.includes('city') && lead?.city) {
    blocks.push(`CIDADE: ${lead.city}`);
  }

  if (params.fields.includes('niche') && lead?.niche) {
    blocks.push(`NICHO: ${lead.niche}`);
  }

  if (params.fields.includes('pain_points') && params.painPoint) {
    blocks.push(`DOR_PRINCIPAL_DO_LEAD: ${params.painPoint}`);
  }

  if (blocks.length === 0) {
    return basePrompt;
  }

  return [
    basePrompt,
    'CONTEXTUALIZACAO_POR_LEAD:',
    ...blocks,
    'INSTRUCAO_FINAL: Consolide os dados acima em uma mensagem curta de primeira abordagem para WhatsApp. Responda apenas com a mensagem final.',
  ].join('\n');
}
