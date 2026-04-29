import { describe, expect, it } from 'vitest';
import { parseDuckDuckGoHtml } from '../providers/duckduckgo-html.parser';

describe('parseDuckDuckGoHtml', () => {
  it('extrai titulo, url e snippet da estrutura padrao do DuckDuckGo HTML', () => {
    const html = `
      <html>
        <body>
          <div class="result">
            <h2 class="result__title">
              <a class="result__a" href="https://www.instagram.com/closr.agency/">Closr Agency</a>
            </h2>
            <a class="result__snippet">Growth marketing para empresas</a>
          </div>
        </body>
      </html>
    `;

    const results = parseDuckDuckGoHtml(html);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      title: 'Closr Agency',
      url: 'https://www.instagram.com/closr.agency/',
      snippet: 'Growth marketing para empresas',
    });
  });

  it('usa fallback quando apenas .result__a esta presente', () => {
    const html = `
      <html>
        <body>
          <a class="result__a" href="https://www.instagram.com/closr.tech/">Closr Tech</a>
        </body>
      </html>
    `;

    const results = parseDuckDuckGoHtml(html);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Closr Tech');
  });
});
