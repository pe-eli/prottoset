import PDFDocument from 'pdfkit';
import path from 'path';
import { Quote } from '../../types/quote.types';
import { BRAND, PDF_COLORS, PDF_FONTS, PDF_LAYOUT, formatDate } from '../templates';

const LOGO_PATH = path.join(__dirname, '../../..', 'frontend/public/logo.png');

export function drawFooter(doc: typeof PDFDocument.prototype, quote: Quote): void {
  const { marginX, contentWidth, pageHeight, marginBottom } = PDF_LAYOUT;
  const footerY = pageHeight - marginBottom;

  // Separator line
  doc
    .moveTo(marginX, footerY)
    .lineTo(marginX + contentWidth, footerY)
    .strokeColor(PDF_COLORS.border)
    .lineWidth(0.5)
    .stroke();

  // Validity
  doc
    .font(PDF_FONTS.regular)
    .fontSize(8)
    .fillColor(PDF_COLORS.secondary)
    .text(
      `Este orçamento é válido por 7 dias a partir de ${formatDate(quote.createdAt)}.`,
      marginX,
      footerY + 10,
      { width: contentWidth, align: 'center' }
    );

  // Logo + brand side by side
  const logoSize = 18;
  const brandBlockWidth = 180;
  const brandX = marginX + (contentWidth - brandBlockWidth) / 2;
  const brandY = footerY + 25;

  try {
    doc.save();
    doc.roundedRect(brandX, brandY, logoSize, logoSize, 3).clip();
    doc.image(LOGO_PATH, brandX, brandY, { width: logoSize, height: logoSize });
    doc.restore();
  } catch {
    // Logo not found: skip silently
  }

  doc
    .font(PDF_FONTS.bold)
    .fontSize(8)
    .fillColor(PDF_COLORS.accent)
    .text(`${BRAND.name} – Desenvolvimento de Sistemas`, brandX + logoSize + 5, brandY + 3);

  // Contact
  doc
    .font(PDF_FONTS.regular)
    .fontSize(7.5)
    .fillColor(PDF_COLORS.secondary)
    .text(`${BRAND.email}  |  ${BRAND.phone}`, marginX, footerY + 48, {
      width: contentWidth,
      align: 'center',
    });
}
