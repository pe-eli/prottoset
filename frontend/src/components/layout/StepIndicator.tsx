import type { QuoteFormStep } from '../../types';

const steps = [
  { step: 1, label: 'Cliente' },
  { step: 2, label: 'Projeto' },
  { step: 3, label: 'Serviços' },
  { step: 4, label: 'Extras' },
  { step: 5, label: 'Pagamento' },
  { step: 6, label: 'Preview' },
  { step: 7, label: 'Download' },
] as const;

interface StepIndicatorProps {
  currentStep: QuoteFormStep;
  onGoToStep?: (step: QuoteFormStep) => void;
}

export function StepIndicator({ currentStep, onGoToStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 py-4">
      {steps.map(({ step, label }, i) => {
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <div key={step} className="flex items-center">
            <button
              type="button"
              onClick={() => isCompleted && onGoToStep?.(step as QuoteFormStep)}
              disabled={!isCompleted}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : isCompleted
                    ? 'bg-brand-100 text-brand-700 cursor-pointer hover:bg-brand-200'
                    : 'bg-brand-50 text-brand-300'
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold border border-current">
                {isCompleted ? '✓' : step}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={`w-4 h-px mx-0.5 ${step < currentStep ? 'bg-brand-300' : 'bg-brand-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
