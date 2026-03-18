export const BRAND = {
  name: 'Prottocode',
  displayName: 'PROTTOCODE',
  tagline: 'Soluções em automação e desenvolvimento de software',
  email: 'prottocode@gmail.com',
  phone: '37 9840 9691',
};

export const PDF_COLORS = {
  primary: '#1a1a1a',
  secondary: '#4a4a4a',
  accent: '#2563eb',
  accentLight: '#dbeafe',
  border: '#e5e7eb',
  white: '#ffffff',
  lightBg: '#f9fafb',
};

export const PDF_FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
};

export const PDF_LAYOUT = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  marginX: 50,
  marginTop: 50,
  marginBottom: 80,
  contentWidth: 495.28,
};

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
}
