import { formatBRL } from './price.utils';

interface PriceTagProps {
  value: number;
  className?: string;
}

export function PriceTag({ value, className = '' }: PriceTagProps) {
  return <span className={`font-semibold text-brand-600 ${className}`}>{formatBRL(value)}</span>;
}
