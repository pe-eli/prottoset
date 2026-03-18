import type { ClientInfo } from '../../types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ClientInfoStepProps {
  data: ClientInfo;
  onChange: (data: Partial<ClientInfo>) => void;
  onNext: () => void;
}

export function ClientInfoStep({ data, onChange, onNext }: ClientInfoStepProps) {
  const canProceed = data.name.trim().length > 0;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados do Cliente</h2>
      <div className="space-y-4">
        <Input
          label="Nome do cliente *"
          placeholder="Ex: João Silva"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <Input
          label="Empresa (opcional)"
          placeholder="Ex: Silva Tech Ltda"
          value={data.company}
          onChange={(e) => onChange({ company: e.target.value })}
        />
        <Input
          label="Email (opcional)"
          type="email"
          placeholder="Ex: joao@email.com"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} disabled={!canProceed}>
          Próximo
        </Button>
      </div>
    </Card>
  );
}
