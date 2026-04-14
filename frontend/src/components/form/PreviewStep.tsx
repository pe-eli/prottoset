import type { QuoteFormState } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { formatBRL } from '../ui/PriceTag';

interface PreviewStepProps {
  formState: QuoteFormState;
  subtotalServices: number;
  subtotalExtras: number;
  total: number;
  onGenerate: () => void;
  onPrev: () => void;
  loading: boolean;
}

const paymentLabels: Record<string, string> = {
  pix: 'Pix',
  transferencia: 'Transferência Bancária',
  parcelamento: 'Parcelamento',
};

export function PreviewStep({
  formState,
  subtotalServices,
  subtotalExtras,
  total,
  onGenerate,
  onPrev,
  loading,
}: PreviewStepProps) {
  const { client, project, selectedServices, selectedExtras, payment } = formState;

  return (
    <Card className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="border-b-2 border-brand-600 pb-3 mb-6">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">CLOSR</h2>
        <p className="text-sm text-gray-500">Orçamento de Desenvolvimento</p>
      </div>

      {/* Client */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-brand-600 uppercase mb-2">Dados do Cliente</h3>
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <p><span className="font-medium text-gray-500">Nome:</span> {client.name}</p>
          {client.company && <p><span className="font-medium text-gray-500">Empresa:</span> {client.company}</p>}
          {client.email && <p><span className="font-medium text-gray-500">Email:</span> {client.email}</p>}
        </div>
      </div>

      {/* Project */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-brand-600 uppercase mb-2">Projeto</h3>
        <p className="text-sm font-medium text-gray-900">{project.name}</p>
        {project.description && <p className="text-sm text-gray-500 mt-1">{project.description}</p>}
      </div>

      {/* Services */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-brand-600 uppercase mb-2">Serviços</h3>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-600 text-white">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Serviço</th>
                <th className="text-right px-3 py-2 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {selectedServices.map((item, i) => (
                <tr key={item.service.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2">{item.service.name}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatBRL(item.service.basePrice * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extras */}
      {selectedExtras.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-semibold text-brand-600 uppercase mb-2">Extras</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-brand-600 text-white">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Extra</th>
                  <th className="text-right px-3 py-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {selectedExtras.map((item, i) => (
                  <tr key={item.extra.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2">{item.extra.name}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatBRL(item.extra.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      <div className="mb-5">
        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal Serviços</span>
            <span>{formatBRL(subtotalServices)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Subtotal Extras</span>
            <span>{formatBRL(subtotalExtras)}</span>
          </div>
          <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-brand-600 text-base">
            <span>TOTAL</span>
            <span>{formatBRL(total)}</span>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-brand-600 uppercase mb-2">Forma de Pagamento</h3>
        <p className="text-sm text-gray-900">{paymentLabels[payment.method]}</p>
        {payment.method === 'parcelamento' && payment.installments && (
          <p className="text-sm text-gray-500">{payment.installments}x de {formatBRL(total / payment.installments)}</p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 pt-3 text-center text-xs text-gray-400">
        <p>Orçamento válido por 7 dias</p>
        <p className="font-medium text-brand-600 mt-1">Closr - Plataforma de Prospecção Inteligente</p>
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={onPrev}>
          Voltar
        </Button>
        <Button onClick={onGenerate} disabled={loading}>
          {loading ? 'Gerando...' : 'Gerar PDF'}
        </Button>
      </div>
    </Card>
  );
}
