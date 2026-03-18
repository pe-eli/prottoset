import PDFDocument from 'pdfkit';
import { SelectedService } from '../../types/quote.types';
import { PDF_COLORS, PDF_FONTS, PDF_LAYOUT, formatBRL } from '../templates';

export function drawServicesTable(doc: typeof PDFDocument.prototype, services: SelectedService[]): void {
  const { marginX, contentWidth } = PDF_LAYOUT;

  if (services.length === 0) return;

  doc
    .font(PDF_FONTS.bold)
    .fontSize(11)
    .fillColor(PDF_COLORS.accent)
    .text('SERVIÇOS', marginX, doc.y);

  doc.y += 10;

  // Column widths
  const cols = {
    name: 160,
    desc: 150,
    qty: 40,
    unit: 75,
    sub: 70,
  };

  const headerY = doc.y;
  const rowHeight = 24;

  // Header background
  doc
    .rect(marginX, headerY, contentWidth, rowHeight)
    .fillColor(PDF_COLORS.accent)
    .fill();

  // Header text
  let colX = marginX + 8;
  doc.font(PDF_FONTS.bold).fontSize(8).fillColor(PDF_COLORS.white);
  doc.text('Serviço', colX, headerY + 8);
  colX += cols.name;
  doc.text('Descrição', colX, headerY + 8);
  colX += cols.desc;
  doc.text('Qtd', colX, headerY + 8);
  colX += cols.qty;
  doc.text('Valor Unit.', colX, headerY + 8);
  colX += cols.unit;
  doc.text('Subtotal', colX, headerY + 8);

  doc.y = headerY + rowHeight;

  // Rows
  services.forEach((item, i) => {
    const rowY = doc.y;
    const bg = i % 2 === 0 ? PDF_COLORS.white : PDF_COLORS.lightBg;

    doc.rect(marginX, rowY, contentWidth, rowHeight).fillColor(bg).fill();
    doc.rect(marginX, rowY, contentWidth, rowHeight).strokeColor(PDF_COLORS.border).lineWidth(0.3).stroke();

    colX = marginX + 8;
    doc.font(PDF_FONTS.bold).fontSize(8).fillColor(PDF_COLORS.primary);
    doc.text(item.service.name, colX, rowY + 8, { width: cols.name - 10, lineBreak: false });
    colX += cols.name;

    doc.font(PDF_FONTS.regular).fontSize(7).fillColor(PDF_COLORS.secondary);
    doc.text(item.service.description, colX, rowY + 8, { width: cols.desc - 10, lineBreak: false });
    colX += cols.desc;

    doc.font(PDF_FONTS.regular).fontSize(8).fillColor(PDF_COLORS.primary);
    doc.text(String(item.quantity), colX, rowY + 8);
    colX += cols.qty;

    doc.text(formatBRL(item.service.basePrice), colX, rowY + 8);
    colX += cols.unit;

    doc.font(PDF_FONTS.bold).fontSize(8);
    doc.text(formatBRL(item.service.basePrice * item.quantity), colX, rowY + 8);

    doc.y = rowY + rowHeight;
  });

  doc.y += 20;
}
