import dns from 'node:dns/promises';
import net from 'node:net';

const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const PRIVATE_IPV4_PREFIXES = [
  '10.',
  '127.',
  '169.254.',
  '192.168.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
];
const PRIVATE_IPV6_PREFIXES = ['::1', 'fc', 'fd', 'fe80:'];

async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Protocolo não permitido');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost') {
    throw new Error('Host local bloqueado');
  }

  if (net.isIP(hostname)) {
    throw new Error('IP literal não permitido');
  }

  const addresses = await dns.lookup(hostname, { all: true });
  for (const address of addresses) {
    if (address.family === 4 && PRIVATE_IPV4_PREFIXES.some((prefix) => address.address.startsWith(prefix))) {
      throw new Error('Endereço privado bloqueado');
    }
    if (address.family === 6) {
      const normalized = address.address.toLowerCase();
      if (PRIVATE_IPV6_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
        throw new Error('Endereço privado bloqueado');
      }
    }
  }

  return parsed;
}

async function fetchWithSafeRedirects(url: string, signal: AbortSignal, redirectsLeft = MAX_REDIRECTS): Promise<Response> {
  const safeUrl = await assertSafeUrl(url);
  const response = await fetch(safeUrl.toString(), {
    signal,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
  });

  if (response.status >= 300 && response.status < 400) {
    if (redirectsLeft <= 0) {
      throw new Error('Número máximo de redirecionamentos excedido');
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new Error('Redirecionamento sem destino');
    }

    const nextUrl = new URL(location, safeUrl).toString();
    return fetchWithSafeRedirects(nextUrl, signal, redirectsLeft - 1);
  }

  return response;
}

/**
 * Faz fetch do HTML de uma URL com timeout via AbortController.
 * Retorna string vazia em caso de erro (não propaga exceção).
 */
export const scraperService = {
  async fetchHTML(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetchWithSafeRedirects(url, controller.signal);

      if (!response.ok) {
        console.warn(`[Scraper] HTTP ${response.status} para ${url}`);
        return '';
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        console.warn(`[Scraper] Content-Type não HTML: ${contentType} para ${url}`);
        return '';
      }

      const html = await response.text();
      return html;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`[Scraper] Timeout (${TIMEOUT_MS}ms) para ${url}`);
      } else {
        console.warn(`[Scraper] Erro ao buscar ${url}: ${err.message}`);
      }
      return '';
    } finally {
      clearTimeout(timer);
    }
  },
};
