import type { ServiceItem } from '../../types';
import { PriceTag } from '../ui/PriceTag';

interface ServiceCardProps {
  service: ServiceItem;
  selected: boolean;
  onToggle: () => void;
}

export function ServiceCard({ service, selected, onToggle }: ServiceCardProps) {
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
          <h3 className="text-sm font-semibold text-gray-900">{service.name}</h3>
          <p className="text-xs text-gray-500 mt-1">{service.description}</p>
        </div>
        <PriceTag value={service.basePrice} className="text-sm whitespace-nowrap" />
      </div>
    </div>
  );
}
