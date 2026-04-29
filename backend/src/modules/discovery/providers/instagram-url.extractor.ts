export interface ExtractedInstagramUrl {
  username: string;
  profileUrl: string;
}

const DISALLOWED_SEGMENTS = new Set([
  'about',
  'accounts',
  'developer',
  'explore',
  'p',
  'posts',
  'reel',
  'reels',
  'stories',
  'tv',
]);

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, '');
}

function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

export function extractInstagramProfileUrl(rawUrl: string): ExtractedInstagramUrl | null {
  const input = String(rawUrl || '').trim();
  if (!input) return null;

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    try {
      parsed = new URL(`https://${input}`);
    } catch {
      return null;
    }
  }

  if (normalizeHost(parsed.hostname) !== 'instagram.com') {
    return null;
  }

  const path = parsed.pathname.replace(/^\/+|\/+$/g, '');
  if (!path) return null;

  const [segment] = path.split('/');
  const username = normalizeUsername(segment || '');
  if (!username) return null;
  if (DISALLOWED_SEGMENTS.has(username)) return null;

  return {
    username,
    profileUrl: `https://www.instagram.com/${username}`,
  };
}
