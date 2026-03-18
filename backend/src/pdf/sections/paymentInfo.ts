import PDFDocument from 'pdfkit';
import { PaymentInfo } from '../../types/quote.types';
import { PDF_COLORS, PDF_FONTS, PDF_LAYOUT, formatBRL } from '../templates';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  transferencia: 'Transferência Bancária',
  parcelamento: 'Parcelamento',
};

export function drawPaymentInfo(doc: typeof PDFDocument.prototype, payment: PaymentInfo, total: number): void {
  const { marginX } = PDF_LAYOUT;

  doc
    .font(PDF_FONTS.bold)
    .fontSize(11)
    .fillColor(PDF_COLORS.accent)
    .text('FORMA DE PAGAMENTO', marginX, doc.y);

  doc.y += 10;

  doc
    .font(PDF_FONTS.regular)
    .fontSize(10)
    .fillColor(PDF_COLORS.primary)
    .text(PAYMENT_LABELS[payment.method] || payment.method, marginX, doc.y);

  if (payment.method === 'parcelamento' && payment.installments && payment.installments > 1) {
    doc.y += 4;
    const installmentValue = total / payment.installments;
    doc
      .font(PDF_FONTS.regular)
      .fontSize(9)
      .fillColor(PDF_COLORS.secondary)
      .text(`${payment.installments}x de ${formatBRL(installmentValue)}`, marginX, doc.y);
  }

  doc.y += 20;
}
