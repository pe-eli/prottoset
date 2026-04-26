export interface SavedPromptStorageItem {
  id: string;
  name: string;
  content: string;
}

const LEGACY_SAVED_PROMPTS_KEY = 'closr.whatsapp.savedPrompts';
const USER_SAVED_PROMPTS_PREFIX = 'closr.whatsapp.savedPrompts.user:';
const MAX_PROMPTS = 50;

export function buildSavedPromptsStorageKey(userId: string): string {
  return `${USER_SAVED_PROMPTS_PREFIX}${userId}`;
}

function normalizePromptItems(value: unknown): SavedPromptStorageItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is SavedPromptStorageItem => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as Record<string, unknown>;
      return typeof candidate.id === 'string'
        && typeof candidate.name === 'string'
        && typeof candidate.content === 'string';
    })
    .slice(0, MAX_PROMPTS);
}

export function readSavedPrompts(storageKey: string): SavedPromptStorageItem[] {
  if (typeof window === 'undefined' || !storageKey) return [];

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizePromptItems(parsed);
  } catch {
    return [];
  }
}

export function writeSavedPrompts(storageKey: string, prompts: SavedPromptStorageItem[]): void {
  if (typeof window === 'undefined' || !storageKey) return;
  const normalized = normalizePromptItems(prompts);
  window.localStorage.setItem(storageKey, JSON.stringify(normalized));
}

export function clearLegacySavedPromptsStorage(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LEGACY_SAVED_PROMPTS_KEY);
}

export function migrateLegacySavedPrompts(storageKey: string): SavedPromptStorageItem[] {
  if (typeof window === 'undefined' || !storageKey) return [];

  const scoped = readSavedPrompts(storageKey);
  if (scoped.length > 0) {
    clearLegacySavedPromptsStorage();
    return scoped;
  }

  const legacy = readSavedPrompts(LEGACY_SAVED_PROMPTS_KEY);
  if (legacy.length > 0) {
    writeSavedPrompts(storageKey, legacy);
  }
  clearLegacySavedPromptsStorage();

  return legacy;
}
