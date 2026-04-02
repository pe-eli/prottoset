import type { Quote } from '../types';
import { safeArray } from '../utils/safe';

const STORAGE_KEY = 'prottoset_quotes';

export const quoteStorage = {
  getAll(): Quote[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return safeArray<Quote>(JSON.parse(raw));
    } catch {
      return [];
    }
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
