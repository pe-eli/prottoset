import PDFDocument from 'pdfkit';
import { ProjectInfo } from '../../types/quote.types';
import { PDF_COLORS, PDF_FONTS, PDF_LAYOUT } from '../templates';

export function drawProjectInfo(doc: typeof PDFDocument.prototype, project: ProjectInfo): void {
  const { marginX, contentWidth } = PDF_LAYOUT;
  const startY = doc.y;

  doc
    .font(PDF_FONTS.bold)
    .fontSize(11)
    .fillColor(PDF_COLORS.accent)
    .text('PROJETO', marginX, startY);

  doc.y += 8;

  doc
    .font(PDF_FONTS.bold)
    .fontSize(10)
    .fillColor(PDF_COLORS.primary)
    .text(project.name, marginX, doc.y);

  doc.y += 4;

  doc
    .font(PDF_FONTS.regular)
    .fontSize(9)
    .fillColor(PDF_COLORS.secondary)
    .text(project.description, marginX, doc.y, { width: contentWidth });

  doc.y += 20;
}
