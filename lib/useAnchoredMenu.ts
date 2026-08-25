import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';

// Positions a dropdown via a full-screen Modal instead of a plain
// position:absolute sibling. A plain absolute dropdown only reliably paints
// above whatever comes right after it in a short, static layout — inside a
// list of many sibling rows (e.g. one task row per line), a zIndex on the
// dropdown itself doesn't reliably beat the *next row's own opaque
// background* painting over it on web, since each row is its own stacking
// context. A Modal always renders in its own top-level layer, so this can
// never happen regardless of how many rows are around it.
export function useAnchoredMenu() {
  const anchorRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    anchorRef.current?.measureInWindow((x, y, _width, height) => {
      setPosition({ top: y + height + 4, left: x });
      setOpen(true);
    });
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return { anchorRef, open, position, toggle, close };
}
