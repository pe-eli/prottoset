import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useQuoteForm } from '../hooks/useQuoteForm';
import { useQuoteCalculation } from '../hooks/useQuoteCalculation';
import { quoteAPI } from '../services/api';
import type { Quote } from '../types';
import { StepIndicator } from '../components/layout/StepIndicator';
import { QuoteSummary } from '../components/quote/QuoteSummary';
import { ClientInfoStep } from '../components/form/ClientInfoStep';
import { ProjectStep } from '../components/form/ProjectStep';
import { ServicesStep } from '../components/form/ServicesStep';
import { ExtrasStep } from '../components/form/ExtrasStep';
import { PaymentStep } from '../components/form/PaymentStep';
import { PreviewStep } from '../components/form/PreviewStep';
import { DownloadStep } from '../components/form/DownloadStep';

export function NewQuotePage() {
  const {
    formState,
    nextStep,
    prevStep,
    goToStep,
    updateClient,
    updateProject,
    toggleService,
    toggleExtra,
    updatePayment,
    reset,
    clearDraft,
    hasDraft,
  } = useQuoteForm();

  const { subtotalServices, subtotalExtras, total } = useQuoteCalculation(
    formState.selectedServices,
    formState.selectedExtras,
  );

  const [loading, setLoading] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState<Quote | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');

  const handleGenerate = async () => {
    setLoading(true);

    const now = new Date();
    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + 7);

    const quote: Quote = {
      id: uuidv4(),
      client: formState.client,
      project: formState.project,
      services: formState.selectedServices,
      extras: formState.selectedExtras,
      payment: formState.payment,
      subtotalServices,
      subtotalExtras,
      total,
      createdAt: now.toISOString(),
      validUntil: validUntil.toISOString(),
    };

    try {
      const { data } = await quoteAPI.generatePdf(quote);
      setGeneratedQuote(quote);
      setPdfUrl(data.pdfUrl);
      nextStep();
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar o PDF. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewQuote = () => {
    reset();
    setGeneratedQuote(null);
    setPdfUrl('');
  };

  const showSummary = formState.currentStep >= 3 && formState.currentStep <= 6;

  return (
    <div className="max-w-3xl mx-auto">
      {hasDraft && formState.currentStep < 7 && (
        <div className="flex items-center justify-between mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Rascunho restaurado automaticamente
          </span>
          <button
            onClick={clearDraft}
            className="text-red-400 hover:text-red-600 underline underline-offset-2"
          >
            Limpar rascunho
          </button>
        </div>
      )}
      <StepIndicator currentStep={formState.currentStep} onGoToStep={goToStep} />

      <div className="mt-4">
        {showSummary && (
          <div className="mb-4">
            <QuoteSummary
              subtotalServices={subtotalServices}
              subtotalExtras={subtotalExtras}
              total={total}
            />
          </div>
        )}

        {formState.currentStep === 1 && (
          <ClientInfoStep data={formState.client} onChange={updateClient} onNext={nextStep} />
        )}
        {formState.currentStep === 2 && (
          <ProjectStep data={formState.project} onChange={updateProject} onNext={nextStep} onPrev={prevStep} />
        )}
        {formState.currentStep === 3 && (
          <ServicesStep selected={formState.selectedServices} onToggle={toggleService} onNext={nextStep} onPrev={prevStep} />
        )}
        {formState.currentStep === 4 && (
          <ExtrasStep selected={formState.selectedExtras} onToggle={toggleExtra} onNext={nextStep} onPrev={prevStep} />
        )}
        {formState.currentStep === 5 && (
          <PaymentStep data={formState.payment} onChange={updatePayment} onNext={nextStep} onPrev={prevStep} />
        )}
        {formState.currentStep === 6 && (
          <PreviewStep
            formState={formState}
            subtotalServices={subtotalServices}
            subtotalExtras={subtotalExtras}
            total={total}
            onGenerate={handleGenerate}
            onPrev={prevStep}
            loading={loading}
          />
        )}
        {formState.currentStep === 7 && generatedQuote && (
          <DownloadStep quote={generatedQuote} pdfUrl={pdfUrl} onNewQuote={handleNewQuote} />
        )}
      </div>
    </div>
  );
}
