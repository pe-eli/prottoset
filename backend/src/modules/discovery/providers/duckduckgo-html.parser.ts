import * as cheerio from 'cheerio';

export interface ParsedSearchResult {
  title: string;
  url: string;
  snippet: string;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseDuckDuckGoHtml(html: string): ParsedSearchResult[] {
  const $ = cheerio.load(html);
  const results: ParsedSearchResult[] = [];

  $('.result').each((_idx, node) => {
    const root = $(node);
    const anchor = root.find('.result__a').first();
    if (!anchor.length) return;

    const href = String(anchor.attr('href') || '').trim();
    if (!href) return;

    const title = cleanText(anchor.text() || root.find('.result__title').first().text() || '');
    const snippet = cleanText(root.find('.result__snippet').first().text() || '');

    results.push({
      title,
      url: href,
      snippet,
    });
  });

  if (results.length > 0) {
    return results;
  }

  // Fallback for small HTML structure variations that keep result links.
  $('.result__a').each((_idx, node) => {
    const anchor = $(node);
    const href = String(anchor.attr('href') || '').trim();
    if (!href) return;

    const title = cleanText(anchor.text() || '');
    const snippet = cleanText(anchor.closest('.result').find('.result__snippet').first().text() || '');

    results.push({
      title,
      url: href,
      snippet,
    });
  });

  return results;
}
