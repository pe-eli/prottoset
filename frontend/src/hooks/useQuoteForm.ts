import type {
  QuoteFormState,
  QuoteFormStep,
  ClientInfo,
  ProjectInfo,
  ServiceItem,
  ExtraItem,
  PaymentInfo,
  SelectedService,
  SelectedExtra,
} from '../types';
import { useDraft } from './useDraft';

const initialState: QuoteFormState = {
  currentStep: 1,
  client: { name: '', company: '', email: '' },
  project: { name: '', description: '' },
  selectedServices: [],
  selectedExtras: [],
  payment: { method: 'pix' },
};

export function useQuoteForm() {
  const {
    state: formState,
    setState: setFormState,
    clearDraft,
    hasDraft,
  } = useDraft<QuoteFormState>('prottoset_draft_classic', initialState);

  const nextStep = () => {
    setFormState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, 7) as QuoteFormStep,
    }));
  };

  const prevStep = () => {
    setFormState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1) as QuoteFormStep,
    }));
  };

  const goToStep = (step: QuoteFormStep) => {
    setFormState((prev) => ({ ...prev, currentStep: step }));
  };

  const updateClient = (data: Partial<ClientInfo>) => {
    setFormState((prev) => ({ ...prev, client: { ...prev.client, ...data } }));
  };

  const updateProject = (data: Partial<ProjectInfo>) => {
    setFormState((prev) => ({ ...prev, project: { ...prev.project, ...data } }));
  };

  const toggleService = (service: ServiceItem) => {
    setFormState((prev) => {
      const exists = prev.selectedServices.find((s) => s.service.id === service.id);
      const selectedServices: SelectedService[] = exists
        ? prev.selectedServices.filter((s) => s.service.id !== service.id)
        : [...prev.selectedServices, { service, quantity: 1 }];
      return { ...prev, selectedServices };
    });
  };

  const toggleExtra = (extra: ExtraItem) => {
    setFormState((prev) => {
      const exists = prev.selectedExtras.find((e) => e.extra.id === extra.id);
      const selectedExtras: SelectedExtra[] = exists
        ? prev.selectedExtras.filter((e) => e.extra.id !== extra.id)
        : [...prev.selectedExtras, { extra }];
      return { ...prev, selectedExtras };
    });
  };

  const updatePayment = (data: Partial<PaymentInfo>) => {
    setFormState((prev) => ({ ...prev, payment: { ...prev.payment, ...data } }));
  };

  const reset = () => clearDraft();

  return {
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
  };
}
