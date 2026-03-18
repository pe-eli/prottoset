import { Quote } from '../types/quote.types';
import { storageService } from './storage.service';
import { generateQuotePdf } from '../pdf/generator';
import fs from 'fs';
import path from 'path';

const GENERATED_DIR = path.join(__dirname, '../../generated');

function ensureGeneratedDir(): void {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
}

export const quoteService = {
  async generatePdf(quote: Quote): Promise<{ id: string; pdfPath: string }> {
    await storageService.save(quote);

    const pdfBuffer = await generateQuotePdf(quote);

    ensureGeneratedDir();
    const pdfPath = path.join(GENERATED_DIR, `${quote.id}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    return { id: quote.id, pdfPath };
  },

  async getPdfPath(id: string): Promise<string | null> {
    const pdfPath = path.join(GENERATED_DIR, `${id}.pdf`);
    return fs.existsSync(pdfPath) ? pdfPath : null;
  },

  async getAll(): Promise<Quote[]> {
    return storageService.getAll();
  },

  async getById(id: string): Promise<Quote | null> {
    return storageService.getById(id);
  },
};
