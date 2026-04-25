import { useState, useRef, useCallback } from 'react';

export function useDraft<T>(storageKey: string, initialValue: T) {
  void storageKey;
  const initialRef = useRef(initialValue);
  const [initialSnapshot] = useState<T>(initialValue);

  const [state, setState] = useState<T>(initialValue);
  const hasDraft = !Object.is(state, initialSnapshot);

  const clearDraft = useCallback(() => {
    setState(initialRef.current);
  }, []);

  return { state, setState, clearDraft, hasDraft };
}
