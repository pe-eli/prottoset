import type { Quote } from '../types';

const STORAGE_KEY = 'prottoset_quotes';

export const quoteStorage = {
  getAll(): Quote[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  save(quote: Quote): void {
    const quotes = this.getAll();
    const index = quotes.findIndex((q) => q.id === quote.id);
    if (index >= 0) {
      quotes[index] = quote;
    } else {
      quotes.unshift(quote);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  },

  delete(id: string): void {
    const quotes = this.getAll().filter((q) => q.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  },
};
