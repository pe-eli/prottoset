import { formatBRL } from '../ui/PriceTag';

interface QuoteSummaryProps {
  subtotalServices: number;
  subtotalExtras: number;
  total: number;
}

export function QuoteSummary({ subtotalServices, subtotalExtras, total }: QuoteSummaryProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumo</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Serviços</span>
          <span>{formatBRL(subtotalServices)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Extras</span>
          <span>{formatBRL(subtotalExtras)}</span>
        </div>
        <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-brand-600">
          <span>Total</span>
          <span>{formatBRL(total)}</span>
        </div>
      </div>
    </div>
  );
}
