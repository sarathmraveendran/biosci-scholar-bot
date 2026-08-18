import { useCallback, useEffect, useState } from "react";

const NAME_KEY = "phd-book-assistant:name";

export function useDisplayName() {
  const [name, setNameState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NAME_KEY);
      setNameState(stored && stored.trim() ? stored : null);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setName = useCallback((value: string | null) => {
    const clean = value?.trim() ? value.trim().slice(0, 40) : null;
    try {
      if (clean) window.localStorage.setItem(NAME_KEY, clean);
      else window.localStorage.removeItem(NAME_KEY);
    } catch {
      /* ignore */
    }
    setNameState(clean);
  }, []);

  return { name, setName, ready };
}
