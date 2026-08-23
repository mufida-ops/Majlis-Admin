import { useCallback, useEffect, useState } from 'react';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fn()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => reload(), [reload]);

  return { data, error, loading, reload };
}

/** Debounced autosave helper — call `save(patch)` on every keystroke; the
 * actual write fires `delayMs` after the last call, and `state` tracks
 * Saving… / Saved / error for a status pill in the UI. */
export function useAutosaveState() {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  return { state, setState };
}
