import { useState, useEffect, useRef, useCallback } from 'react';

export function useDraft<T>(storageKey: string, initialValue: T) {
  const initialRef = useRef(initialValue);

  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return initialValue;
      const saved = JSON.parse(raw) as T;
      // Merge with initialValue so new fields always get their default value
      if (saved !== null && typeof saved === 'object' && !Array.isArray(saved)) {
        return { ...initialValue, ...saved };
      }
      return saved;
    } catch {
      return initialValue;
    }
  });

  // True if a non-empty draft was found at mount — cleared when user explicitly discards
  const [hasDraft, setHasDraft] = useState(() => !!localStorage.getItem(storageKey));

  // Auto-save on every state change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setState(initialRef.current);
    setHasDraft(false);
  }, [storageKey]);

  return { state, setState, clearDraft, hasDraft };
}
