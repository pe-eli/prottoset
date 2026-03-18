import PDFDocument from 'pdfkit';
import path from 'path';
import { BRAND, PDF_COLORS, PDF_FONTS, PDF_LAYOUT, formatDate } from '../templates';

const LOGO_PATH = path.join(__dirname, '../../..', 'frontend/public/logo.png');

export function drawHeader(doc: typeof PDFDocument.prototype, createdAt: string): void {
  const { marginX, contentWidth } = PDF_LAYOUT;

  // Logo — square with slight rounded corners
  const logoSize = 42;
  const logoY = 42;
  try {
    doc.save();
    doc.roundedRect(marginX, logoY, logoSize, logoSize, 6).clip();
    doc.image(LOGO_PATH, marginX, logoY, { width: logoSize, height: logoSize });
    doc.restore();
  } catch {
    // Logo not found: skip silently
  }

  // Brand name — right of logo
  doc
    .font(PDF_FONTS.bold)
    .fontSize(22)
    .fillColor(PDF_COLORS.primary)
    .text(BRAND.name, marginX + logoSize + 10, logoY + 8);

  // Date — right aligned
  doc
    .font(PDF_FONTS.regular)
    .fontSize(10)
    .fillColor(PDF_COLORS.secondary)
    .text(formatDate(createdAt), marginX, 55, { width: contentWidth, align: 'right' });

  // Blue accent line
  doc
    .moveTo(marginX, 95)
    .lineTo(marginX + contentWidth, 95)
    .strokeColor(PDF_COLORS.accent)
    .lineWidth(2)
    .stroke();

  // Subtitle
  doc
    .font(PDF_FONTS.regular)
    .fontSize(14)
    .fillColor(PDF_COLORS.secondary)
    .text('Orçamento de Desenvolvimento', marginX, 105);

  doc.y = 132;
}
