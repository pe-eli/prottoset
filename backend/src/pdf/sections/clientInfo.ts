import PDFDocument from 'pdfkit';
import { ClientInfo } from '../../types/quote.types';
import { PDF_COLORS, PDF_FONTS, PDF_LAYOUT } from '../templates';

export function drawClientInfo(doc: typeof PDFDocument.prototype, client: ClientInfo): void {
  const { marginX, contentWidth } = PDF_LAYOUT;
  const startY = doc.y;

  // Section title
  doc
    .font(PDF_FONTS.bold)
    .fontSize(11)
    .fillColor(PDF_COLORS.accent)
    .text('DADOS DO CLIENTE', marginX, startY);

  doc.y += 8;

  // Background box
  const boxY = doc.y;
  const boxHeight = client.company || client.email ? 60 : 30;

  doc
    .rect(marginX, boxY, contentWidth, boxHeight)
    .fillColor(PDF_COLORS.lightBg)
    .fill();

  doc
    .rect(marginX, boxY, contentWidth, boxHeight)
    .strokeColor(PDF_COLORS.border)
    .lineWidth(0.5)
    .stroke();

  let innerY = boxY + 8;

  doc.font(PDF_FONTS.bold).fontSize(9).fillColor(PDF_COLORS.secondary).text('Nome:', marginX + 12, innerY);
  doc.font(PDF_FONTS.regular).fontSize(9).fillColor(PDF_COLORS.primary).text(client.name, marginX + 60, innerY);
  innerY += 16;

  if (client.company) {
    doc.font(PDF_FONTS.bold).fontSize(9).fillColor(PDF_COLORS.secondary).text('Empresa:', marginX + 12, innerY);
    doc.font(PDF_FONTS.regular).fontSize(9).fillColor(PDF_COLORS.primary).text(client.company, marginX + 60, innerY);
    innerY += 16;
  }

  if (client.email) {
    doc.font(PDF_FONTS.bold).fontSize(9).fillColor(PDF_COLORS.secondary).text('Email:', marginX + 12, innerY);
    doc.font(PDF_FONTS.regular).fontSize(9).fillColor(PDF_COLORS.primary).text(client.email, marginX + 60, innerY);
  }

  doc.y = boxY + boxHeight + 20;
}
