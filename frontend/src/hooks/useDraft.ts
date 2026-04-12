import { useState, useEffect, useRef, useCallback } from 'react';

export function useDraft<T>(storageKey: string, initialValue: T) {
  void storageKey;
  const initialRef = useRef(initialValue);

  const [state, setState] = useState<T>(initialValue);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    setHasDraft(false);
  }, [state]);

  const clearDraft = useCallback(() => {
    setState(initialRef.current);
    setHasDraft(false);
  }, []);

  return { state, setState, clearDraft, hasDraft };
}
