import type { ExtraItem, SelectedExtra } from '../../types';
import { defaultExtras } from '../../data/extras';
import { ExtraCard } from '../quote/ExtraCard';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ExtrasStepProps {
  selected: SelectedExtra[];
  onToggle: (extra: ExtraItem) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function ExtrasStep({ selected, onToggle, onNext, onPrev }: ExtrasStepProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Extras Opcionais</h2>
      <p className="text-sm text-gray-500 mb-4">Selecione extras que deseja incluir (opcional)</p>
      <div className="grid gap-3">
        {defaultExtras.map((extra) => (
          <ExtraCard
            key={extra.id}
            extra={extra}
            selected={selected.some((e) => e.extra.id === extra.id)}
            onToggle={() => onToggle(extra)}
          />
        ))}
      </div>
      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={onPrev}>
          Voltar
        </Button>
        <Button onClick={onNext}>
          Próximo
        </Button>
      </div>
    </Card>
  );
}
