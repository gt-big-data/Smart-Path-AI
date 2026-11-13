import { useCallback, useEffect, useRef, useState } from 'react';

// How long a newly created chat or folder row stays highlighted
const NEW_ITEM_SHINE_MS = 1000;

/** Briefly marks one sidebar row (chat or folder id) as newly created */
export function useHighlightedItem() {
  const [shiningId, setShiningId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashNewItem = useCallback((id: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShiningId(id);
    timeoutRef.current = setTimeout(() => setShiningId(null), NEW_ITEM_SHINE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { shiningId, flashNewItem };
}
