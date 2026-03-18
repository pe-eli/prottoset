export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface PriceTagProps {
  value: number;
  className?: string;
}

export function PriceTag({ value, className = '' }: PriceTagProps) {
  return <span className={`font-semibold text-brand-600 ${className}`}>{formatBRL(value)}</span>;
}
