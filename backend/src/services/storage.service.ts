import fs from 'fs';
import path from 'path';
import { Quote } from '../types/quote.types';

const DATA_DIR = path.join(__dirname, '../../data');
const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(QUOTES_FILE)) {
    fs.writeFileSync(QUOTES_FILE, '[]', 'utf-8');
  }
}

function readQuotes(): Quote[] {
  ensureDataDir();
  const raw = fs.readFileSync(QUOTES_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeQuotes(quotes: Quote[]): void {
  ensureDataDir();
  fs.writeFileSync(QUOTES_FILE, JSON.stringify(quotes, null, 2), 'utf-8');
}

export const storageService = {
  async getAll(): Promise<Quote[]> {
    return readQuotes();
  },

  async getById(id: string): Promise<Quote | null> {
    const quotes = readQuotes();
    return quotes.find((q) => q.id === id) || null;
  },

  async save(quote: Quote): Promise<void> {
    const quotes = readQuotes();
    const index = quotes.findIndex((q) => q.id === quote.id);
    if (index >= 0) {
      quotes[index] = quote;
    } else {
      quotes.unshift(quote);
    }
    writeQuotes(quotes);
  },
};
