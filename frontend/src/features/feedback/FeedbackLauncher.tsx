import { useFeedback } from '../../contexts/useFeedback';

export function FeedbackLauncher() {
  const { open } = useFeedback();

  return (
    <button
      type="button"
      onClick={open}
      className="hidden lg:flex fixed left-4 bottom-5 z-40 items-center gap-3 rounded-2xl border border-border-light bg-surface/92 px-4 py-3 text-left text-text-primary shadow-2xl shadow-black/25 backdrop-blur hover:border-brand-400/35 hover:bg-surface-elevated transition-all"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-400/15 text-brand-300">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-8 8 2.5-2.5a2 2 0 0 1 1.414-.586H19a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2Z" />
        </svg>
      </span>
      <span>
        <span className="block text-sm font-semibold">Feedback</span>
        <span className="block text-xs text-text-secondary">Suporte, bugs e sugestões</span>
      </span>
    </button>
  );
}
