import { useCallback, useEffect, useRef, useState } from 'react';
import { getContentItem, updateContentItem, ConflictError } from '@/lib/repositories/contentItems';
import type { ContentItem } from '@/types/db';
import type { SaveState } from '@/components/SaveIndicator';

/**
 * Local-first editor for a content item: edits apply to local state
 * immediately (so typing feels instant) and are flushed to Supabase 800ms
 * after the last keystroke, using the optimistic-concurrency update in
 * lib/repositories/contentItems.ts (Section 11/12: autosave + conflict
 * protection). A conflict surfaces a banner rather than overwriting.
 */
export function useContentEditor(id: string) {
  const [item, setItemState] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [conflict, setConflict] = useState(false);
  const pendingPatch = useRef<Partial<ContentItem>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<ContentItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getContentItem(id);
    setItemState(data);
    itemRef.current = data;
    setLoading(false);
    setConflict(false);
    setSaveState('idle');
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const flush = useCallback(async () => {
    const current = itemRef.current;
    if (!current || Object.keys(pendingPatch.current).length === 0) return;
    const patch = pendingPatch.current;
    pendingPatch.current = {};
    setSaveState('saving');
    try {
      const updated = await updateContentItem(current.id, current.version, patch);
      setItemState(updated);
      itemRef.current = updated;
      setSaveState('saved');
    } catch (err) {
      if (err instanceof ConflictError) {
        setConflict(true);
      }
      setSaveState('error');
    }
  }, []);

  const updateField = useCallback(<K extends keyof ContentItem>(key: K, value: ContentItem[K]) => {
    setItemState((prev) => {
      const next = prev ? { ...prev, [key]: value } : prev;
      itemRef.current = next;
      return next;
    });
    (pendingPatch.current as any)[key] = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      flush();
    }, 800);
  }, [flush]);

  return { item, loading, saveState, conflict, updateField, reload: load, flushNow: flush };
}
