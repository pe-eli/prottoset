const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const BLOCKED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

const BLOCKED_KEYWORDS = [
  'example',
  'exemplo',
  'test',
  'teste',
  'sample',
  'fake',
  'noreply',
  'no-reply',
];

function isValidEmail(email: string): boolean {
  const lower = email.toLowerCase();

  // Bloquear emails com extensões de imagem
  if (BLOCKED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return false;
  }

  // Bloquear emails contendo palavras-chave fake
  if (BLOCKED_KEYWORDS.some((kw) => lower.includes(kw))) {
    return false;
  }

  return true;
}

export const emailExtractor = {
  extract(html: string, max = 2): string[] {
    const matches = html.match(EMAIL_REGEX) || [];
    const unique = [...new Set(matches.map((e) => e.toLowerCase()))];
    const valid = unique.filter(isValidEmail);
    return valid.slice(0, max);
  },
};
