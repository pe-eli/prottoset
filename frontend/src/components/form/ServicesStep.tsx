import type { ServiceItem, SelectedService } from '../../types';
import { defaultServices } from '../../data/services';
import { ServiceCard } from '../quote/ServiceCard';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ServicesStepProps {
  selected: SelectedService[];
  onToggle: (service: ServiceItem) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function ServicesStep({ selected, onToggle, onNext, onPrev }: ServicesStepProps) {
  const canProceed = selected.length > 0;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Selecione os Serviços</h2>
      <p className="text-sm text-gray-500 mb-4">Escolha os serviços que farão parte do orçamento</p>
      <div className="grid gap-3">
        {defaultServices.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            selected={selected.some((s) => s.service.id === service.id)}
            onToggle={() => onToggle(service)}
          />
        ))}
      </div>
      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={onPrev}>
          Voltar
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Próximo
        </Button>
      </div>
    </Card>
  );
}
