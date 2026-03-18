import type { ProjectInfo } from '../../types';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ProjectStepProps {
  data: ProjectInfo;
  onChange: (data: Partial<ProjectInfo>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function ProjectStep({ data, onChange, onNext, onPrev }: ProjectStepProps) {
  const canProceed = data.name.trim().length > 0;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados do Projeto</h2>
      <div className="space-y-4">
        <Input
          label="Nome do projeto *"
          placeholder="Ex: App de Gestão de Estoque"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <TextArea
          label="Descrição curta"
          placeholder="Descreva brevemente o projeto..."
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
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
