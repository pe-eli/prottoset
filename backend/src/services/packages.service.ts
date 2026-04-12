import { PackagesQuote } from '../types/packages.types';
import { generatePackagesPdf } from '../pdf/packagesGenerator';
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

export const packagesService = {
  async generatePdf(tenantId: string, quote: PackagesQuote): Promise<{ id: string; pdfPath: string }> {
    const pdfBuffer = await generatePackagesPdf(quote);

    const tenantDir = ensureTenantDir(tenantId);
    const pdfPath = resolveTenantPdfPath(GENERATED_DIR, tenantId, quote.id);
    if (!pdfPath) {
      throw new Error('Identificador de proposta inválido');
    }
    fs.writeFileSync(pdfPath, pdfBuffer);

    return { id: quote.id, pdfPath };
  },

  getPdfPath(tenantId: string, id: string): string | null {
    const pdfPath = resolveTenantPdfPath(GENERATED_DIR, tenantId, id);
    if (!pdfPath) return null;
    return fs.existsSync(pdfPath) ? pdfPath : null;
  },
};
