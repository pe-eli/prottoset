import { Quote } from '../types/quote.types';
import { storageService } from './storage.service';
import { generateQuotePdf } from '../pdf/generator';
import fs from 'fs';
import path from 'path';
import { resolveTenantPdfPath } from '../utils/safe-file';

const GENERATED_DIR = path.resolve(__dirname, '../../generated');

function ensureTenantDir(tenantId: string): string {
  const tenantDir = path.join(GENERATED_DIR, tenantId);
  if (!fs.existsSync(tenantDir)) {
    fs.mkdirSync(tenantDir, { recursive: true });
  }
  return tenantDir;
}

export const quoteService = {
  async generatePdf(tenantId: string, quote: Quote): Promise<{ id: string; pdfPath: string }> {
    await storageService.save(tenantId, quote);

    const pdfBuffer = await generateQuotePdf(quote);

    const tenantDir = ensureTenantDir(tenantId);
    const pdfPath = resolveTenantPdfPath(GENERATED_DIR, tenantId, quote.id);
    if (!pdfPath) {
      throw new Error('Identificador de orçamento inválido');
    }
    fs.writeFileSync(pdfPath, pdfBuffer);

    return { id: quote.id, pdfPath };
  },

  async getPdfPath(tenantId: string, id: string): Promise<string | null> {
    const pdfPath = resolveTenantPdfPath(GENERATED_DIR, tenantId, id);
    if (!pdfPath) return null;
    return fs.existsSync(pdfPath) ? pdfPath : null;
  },

  async getAll(tenantId: string): Promise<Quote[]> {
    return storageService.getAll(tenantId);
  },

  async getById(tenantId: string, id: string): Promise<Quote | null> {
    return storageService.getById(tenantId, id);
  },
};
