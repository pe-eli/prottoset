import { PackagesQuote } from '../types/packages.types';
import { generatePackagesPdf } from '../pdf/packagesGenerator';
import fs from 'fs';
import path from 'path';

const GENERATED_DIR = path.join(__dirname, '../../generated');

function ensureGeneratedDir(): void {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
}

export const packagesService = {
  async generatePdf(quote: PackagesQuote): Promise<{ id: string; pdfPath: string }> {
    const pdfBuffer = await generatePackagesPdf(quote);

    ensureGeneratedDir();
    const pdfPath = path.join(GENERATED_DIR, `${quote.id}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    return { id: quote.id, pdfPath };
  },

  getPdfPath(id: string): string | null {
    const pdfPath = path.join(GENERATED_DIR, `${id}.pdf`);
    return fs.existsSync(pdfPath) ? pdfPath : null;
  },
};
