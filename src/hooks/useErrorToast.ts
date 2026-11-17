import { useCallback, useEffect, useRef, useState } from 'react';

// How long error toasts stay up before they dismiss themselves
const ERROR_TOAST_MS = 10000;

/** A single error toast at a time. A new message replaces the current one and restarts the timer. */
export function useErrorToast() {
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissErrorToast = useCallback(() => setErrorToast(null), []);

  const showErrorToast = useCallback((message: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setErrorToast(message);
    timeoutRef.current = setTimeout(() => setErrorToast(null), ERROR_TOAST_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { errorToast, showErrorToast, dismissErrorToast };
}
