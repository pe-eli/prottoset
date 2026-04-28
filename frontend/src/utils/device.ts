import { useEffect, useState } from 'react';

const MOBILE_AUTH_MEDIA_QUERY = '(max-width: 1024px), (pointer: coarse)';

export function isRestrictedMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(MOBILE_AUTH_MEDIA_QUERY).matches;
}

export function useRestrictedMobileDevice(): boolean {
  const [restricted, setRestricted] = useState<boolean>(() => isRestrictedMobileDevice());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_AUTH_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setRestricted(event.matches);
    };

    setRestricted(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return restricted;
}