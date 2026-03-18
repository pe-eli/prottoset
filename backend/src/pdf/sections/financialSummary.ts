import PDFDocument from 'pdfkit';
import { Quote } from '../../types/quote.types';
import { PDF_COLORS, PDF_FONTS, PDF_LAYOUT, formatBRL } from '../templates';

export function drawFinancialSummary(doc: typeof PDFDocument.prototype, quote: Quote): void {
  const { marginX, contentWidth } = PDF_LAYOUT;
  const rightX = marginX + contentWidth - 200;

  doc
    .font(PDF_FONTS.bold)
    .fontSize(11)
    .fillColor(PDF_COLORS.accent)
    .text('RESUMO FINANCEIRO', marginX, doc.y);

  doc.y += 12;

  // Summary box
  const boxY = doc.y;

  doc.rect(rightX - 10, boxY, 210, 70).fillColor(PDF_COLORS.lightBg).fill();
  doc.rect(rightX - 10, boxY, 210, 70).strokeColor(PDF_COLORS.border).lineWidth(0.5).stroke();

  // Subtotal serviços
  doc.font(PDF_FONTS.regular).fontSize(9).fillColor(PDF_COLORS.secondary);
  doc.text('Subtotal Serviços:', rightX, boxY + 10);
  doc.font(PDF_FONTS.regular).fontSize(9).fillColor(PDF_COLORS.primary);
  doc.text(formatBRL(quote.subtotalServices), rightX + 110, boxY + 10, { width: 80, align: 'right' });

  // Subtotal extras
  doc.font(PDF_FONTS.regular).fontSize(9).fillColor(PDF_COLORS.secondary);
  doc.text('Subtotal Extras:', rightX, boxY + 26);
  doc.font(PDF_FONTS.regular).fontSize(9).fillColor(PDF_COLORS.primary);
  doc.text(formatBRL(quote.subtotalExtras), rightX + 110, boxY + 26, { width: 80, align: 'right' });

  // Separator
  doc.moveTo(rightX, boxY + 42).lineTo(rightX + 190, boxY + 42).strokeColor(PDF_COLORS.accent).lineWidth(1).stroke();

  // Total
  doc.font(PDF_FONTS.bold).fontSize(12).fillColor(PDF_COLORS.accent);
  doc.text('TOTAL:', rightX, boxY + 50);
  doc.text(formatBRL(quote.total), rightX + 110, boxY + 50, { width: 80, align: 'right' });

  doc.y = boxY + 90;
}
