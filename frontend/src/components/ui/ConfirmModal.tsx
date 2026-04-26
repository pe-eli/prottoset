import { useCallback, useRef, useState } from 'react';
import { Button } from './Button';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmModalProps {
  state: ConfirmState | null;
  onClose: (value: boolean) => void;
}

function ConfirmModal({ state, onClose }: ConfirmModalProps) {
  if (!state) return null;

  const { title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'danger' } = state;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={() => onClose(false)}
    >
      <div
        className="w-full max-w-sm bg-surface rounded-2xl border border-border shadow-2xl shadow-black/30 p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="text-base font-bold text-text-primary">{title}</h2>
        )}
        <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={() => onClose(false)}>
            {cancelLabel}
          </Button>
          <Button variant={variant} size="sm" onClick={() => onClose(true)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hook to use imperatively: const confirm = useConfirmModal()
// Usage: const ok = await confirm({ message: '...' })
export function useConfirmModal() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, resolve });
    });
  }, []);

  const handleClose = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setState(null);
  }, []);

  const modal = <ConfirmModal state={state} onClose={handleClose} />;

  return { confirm, modal };
}
