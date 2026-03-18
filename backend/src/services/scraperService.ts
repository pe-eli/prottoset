const TIMEOUT_MS = 8_000;

/**
 * Faz fetch do HTML de uma URL com timeout via AbortController.
 * Retorna string vazia em caso de erro (não propaga exceção).
 */
export const scraperService = {
  async fetchHTML(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });

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
