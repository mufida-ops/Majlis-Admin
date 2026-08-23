import { useEffect, useState } from 'react';
import { getMediaUrl } from '@/lib/repositories/media';

// Module-level cache so scrolling a list of cards doesn't re-request the
// same signed URL over and over; signed URLs are valid for an hour, this
// cache just avoids duplicate in-flight requests within that window.
const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

export function useThumbnail(storagePath: string | null | undefined) {
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
    const existing = inFlight.get(storagePath) ?? getMediaUrl(storagePath).then((u) => {
      cache.set(storagePath, u);
      return u;
    });
    inFlight.set(storagePath, existing);
    existing
      .then((u) => {
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
