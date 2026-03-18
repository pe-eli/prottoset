import PDFDocument from 'pdfkit';
import { SelectedExtra } from '../../types/quote.types';
import { PDF_COLORS, PDF_FONTS, PDF_LAYOUT, formatBRL } from '../templates';

export function drawExtrasTable(doc: typeof PDFDocument.prototype, extras: SelectedExtra[]): void {
  const { marginX, contentWidth } = PDF_LAYOUT;

  if (extras.length === 0) return;

  doc
    .font(PDF_FONTS.bold)
    .fontSize(11)
    .fillColor(PDF_COLORS.accent)
    .text('EXTRAS', marginX, doc.y);

  doc.y += 10;

  const cols = {
    name: 180,
    desc: 220,
    price: 95,
  };

  const headerY = doc.y;
  const rowHeight = 24;

  // Header
  doc.rect(marginX, headerY, contentWidth, rowHeight).fillColor(PDF_COLORS.accent).fill();

  let colX = marginX + 8;
  doc.font(PDF_FONTS.bold).fontSize(8).fillColor(PDF_COLORS.white);
  doc.text('Extra', colX, headerY + 8);
  colX += cols.name;
  doc.text('Descrição', colX, headerY + 8);
  colX += cols.desc;
  doc.text('Valor', colX, headerY + 8);

  doc.y = headerY + rowHeight;

  // Rows
  extras.forEach((item, i) => {
    const rowY = doc.y;
    const bg = i % 2 === 0 ? PDF_COLORS.white : PDF_COLORS.lightBg;

    doc.rect(marginX, rowY, contentWidth, rowHeight).fillColor(bg).fill();
    doc.rect(marginX, rowY, contentWidth, rowHeight).strokeColor(PDF_COLORS.border).lineWidth(0.3).stroke();

    colX = marginX + 8;
    doc.font(PDF_FONTS.bold).fontSize(8).fillColor(PDF_COLORS.primary);
    doc.text(item.extra.name, colX, rowY + 8, { width: cols.name - 10, lineBreak: false });
    colX += cols.name;

    doc.font(PDF_FONTS.regular).fontSize(7).fillColor(PDF_COLORS.secondary);
    doc.text(item.extra.description, colX, rowY + 8, { width: cols.desc - 10, lineBreak: false });
    colX += cols.desc;

    doc.font(PDF_FONTS.bold).fontSize(8).fillColor(PDF_COLORS.primary);
    doc.text(formatBRL(item.extra.price), colX, rowY + 8);

    doc.y = rowY + rowHeight;
  });

  doc.y += 20;
}
