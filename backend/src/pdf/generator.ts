import PDFDocument from 'pdfkit';
import { Quote } from '../types/quote.types';
import { drawHeader } from './sections/header';
import { drawClientInfo } from './sections/clientInfo';
import { drawProjectInfo } from './sections/projectInfo';
import { drawServicesTable } from './sections/servicesTable';
import { drawExtrasTable } from './sections/extrasTable';
import { drawFinancialSummary } from './sections/financialSummary';
import { drawPaymentInfo } from './sections/paymentInfo';
import { drawFooter } from './sections/footer';

export async function generateQuotePdf(quote: Quote): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, quote.createdAt);
    drawClientInfo(doc, quote.client);
    drawProjectInfo(doc, quote.project);
    drawServicesTable(doc, quote.services);
    drawExtrasTable(doc, quote.extras);
    drawFinancialSummary(doc, quote);
    drawPaymentInfo(doc, quote.payment, quote.total);
    drawFooter(doc, quote);

    doc.end();
  });
}
