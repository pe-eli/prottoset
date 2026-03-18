import type { PaymentInfo, PaymentMethod } from '../../types';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface PaymentStepProps {
  data: PaymentInfo;
  onChange: (data: Partial<PaymentInfo>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const paymentOptions = [
  { value: 'pix', label: 'Pix' },
  { value: 'transferencia', label: 'Transferência Bancária' },
  { value: 'parcelamento', label: 'Parcelado' },
];

export function PaymentStep({ data, onChange, onNext, onPrev }: PaymentStepProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Forma de Pagamento</h2>
      <div className="space-y-4">
        <Select
          label="Método de pagamento"
          options={paymentOptions}
          value={data.method}
          onChange={(e) => onChange({ method: e.target.value as PaymentMethod, installments: undefined })}
        />
        {data.method === 'parcelamento' && (
          <Input
            label="Número de parcelas"
            type="number"
            min={2}
            max={12}
            value={data.installments || ''}
            onChange={(e) => onChange({ installments: parseInt(e.target.value) || undefined })}
            placeholder="Ex: 3"
          />
        )}
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
