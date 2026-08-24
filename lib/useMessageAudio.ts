import { useEffect, useState } from 'react';
import { getMessageAudioUrl } from '@/lib/repositories/threads';

// Same module-level cache pattern as useMessageImage — signed URLs are valid
// for an hour, this just avoids re-requesting one for a clip already loaded.
const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

export function useMessageAudioUrl(storagePath: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(storagePath ? cache.get(storagePath) ?? null : null);

  useEffect(() => {
    if (!storagePath) {
      setUrl(null);
      return;
    }
    const cached = cache.get(storagePath);
    if (cached) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    const existing =
      inFlight.get(storagePath) ??
      getMessageAudioUrl(storagePath).then(u => {
        cache.set(storagePath, u);
        return u;
      });
    inFlight.set(storagePath, existing);
    existing
      .then(u => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      })
      .finally(() => inFlight.delete(storagePath));
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return url;
}
