import type { ExtraItem } from '../../types';
import { PriceTag } from '../ui/PriceTag';

interface ExtraCardProps {
  extra: ExtraItem;
  selected: boolean;
  onToggle: () => void;
}

export function ExtraCard({ extra, selected, onToggle }: ExtraCardProps) {
  return (
    <div
      onClick={onToggle}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
        selected
          ? 'border-brand-600 bg-brand-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{extra.name}</h3>
          <p className="text-xs text-gray-500 mt-1">{extra.description}</p>
        </div>
        <PriceTag value={extra.price} className="text-sm whitespace-nowrap" />
      </div>
    </div>
  );
}
