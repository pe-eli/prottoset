import { useState } from 'react';
import type { Quote } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { formatBRL } from '../ui/PriceTag';

interface DownloadStepProps {
  quote: Quote;
  pdfUrl: string;
  onNewQuote: () => void;
}

export function DownloadStep({ quote, pdfUrl, onNewQuote }: DownloadStepProps) {
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `orcamento-${quote.id}.pdf`;
    link.click();
  };

  const handleCopyLink = async () => {
    const fullUrl = `${window.location.origin}${pdfUrl}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="text-center max-w-md mx-auto">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Orçamento Gerado!</h2>
      <p className="text-sm text-gray-500 mb-2">
        {quote.client.name} - {quote.project.name}
      </p>
      <p className="text-2xl font-bold text-brand-600 mb-6">{formatBRL(quote.total)}</p>

      <div className="space-y-3">
        <Button onClick={handleDownload} className="w-full">
          Baixar PDF
        </Button>
        <Button variant="outline" onClick={handleCopyLink} className="w-full">
          {copied ? 'Link copiado!' : 'Copiar Link'}
        </Button>
        <Button variant="secondary" onClick={onNewQuote} className="w-full">
          Novo Orçamento
        </Button>
      </div>
    </Card>
  );
}
