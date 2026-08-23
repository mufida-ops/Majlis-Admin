import { useCallback, useEffect, useRef, useState } from 'react';
import { ensurePlatformPost, updatePlatformPost } from '@/lib/repositories/platformPosts';
import { ConflictError } from '@/lib/repositories/contentItems';
import type { PlatformName, PlatformPost } from '@/types/db';
import type { SaveState } from '@/components/SaveIndicator';

/** Same local-first autosave pattern as useContentEditor, scoped to one platform_posts row. */
export function usePlatformPostEditor(contentItemId: string, platform: PlatformName) {
  const [post, setPost] = useState<PlatformPost | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [conflict, setConflict] = useState(false);
  const pendingPatch = useRef<Partial<PlatformPost>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postRef = useRef<PlatformPost | null>(null);

  const load = useCallback(async () => {
    const data = await ensurePlatformPost(contentItemId, platform);
    setPost(data);
    postRef.current = data;
    setConflict(false);
  }, [contentItemId, platform]);

  useEffect(() => {
    load();
  }, [load]);

  const flush = useCallback(async () => {
    const current = postRef.current;
    if (!current || Object.keys(pendingPatch.current).length === 0) return;
    const patch = pendingPatch.current;
    pendingPatch.current = {};
    setSaveState('saving');
    try {
      const updated = await updatePlatformPost(current.id, current.version, patch);
      setPost(updated);
      postRef.current = updated;
      setSaveState('saved');
    } catch (err) {
      if (err instanceof ConflictError) setConflict(true);
      setSaveState('error');
    }
  }, []);

  const updateField = useCallback(<K extends keyof PlatformPost>(key: K, value: PlatformPost[K], immediate = false) => {
    setPost((prev) => {
      const next = prev ? { ...prev, [key]: value } : prev;
      postRef.current = next;
      return next;
    });
    (pendingPatch.current as any)[key] = value;
    if (timer.current) clearTimeout(timer.current);
    if (immediate) {
      flush();
    } else {
      timer.current = setTimeout(() => flush(), 800);
    }
  }, [flush]);

  return { post, saveState, conflict, updateField, reload: load, flushNow: flush };
}
