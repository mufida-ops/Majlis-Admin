/**
 * Color system.
 *
 * The brief: a deep, dignified ink and warm gold, evoking illuminated
 * manuscript pages rather than a generic "sophisticated SaaS" palette (the
 * original navy-blue + sage-green + tan combination is one of the most
 * overused defaults in AI-generated UI -- it reads as safe rather than
 * considered). Deep teal-ink and antique gold instead: distinctive, warm,
 * and has real cultural resonance for Islamic manuscript/tilework aesthetics
 * without leaning on literal clip-art motifs (no arabesque borders, no
 * mosque-dome iconography).
 *
 * Only three hues do real work here -- ink, gold, rust -- each with one job:
 *   - ink:  brand / primary actions / structure (headers, buttons, labels)
 *   - gold: the one accent color, used for anything that means "this came
 *           from the approved source" -- citations, source tags, growth marks
 *   - rust: the one warning color, used only for "needs human attention"
 *           (pending reviewer approval)
 * Body text is a warm near-black, not reused from the brand hue, so ink and
 * gold still read as deliberate accents rather than "everything is one
 * color." This file is the single place these are defined -- no component
 * should hardcode a hex value that belongs to this system.
 */
export const colors = {
  ink: "#1B3A3A",
  gold: "#B8862E",
  goldText: "#7A5A12",
  goldBgSoft: "#F3E9D2",
  rust: "#93432A",
  rustBgSoft: "#F3DFD3",

  paper: "#F7F3EA",
  card: "#FFFDF9",
  border: "#E2D9C5",

  textPrimary: "#2A2620",
  textMuted: "#6B5D4F",
  textFaint: "#9C948A",
  danger: "#B23B3B",

  onInk: "#FFFDF9",
  onInkMuted: "#D9C9A3",
} as const;

/**
 * Type system: three roles, not one generic sans everywhere.
 *   - display: Fraunces -- a warm, slightly editorial serif with real
 *     character, for headings and the wordmark. Distinct from the safe
 *     "Inter for everything" look.
 *   - body: Source Serif 4 -- for longer reading text (lesson content,
 *     paragraphs), warmer and more legible at length than a display face.
 *   - ui: Inter -- for labels, buttons, and small interface text, where
 *     a plain humanist sans is the right choice, not a compromise.
 * Previously these were referenced as bare font-family strings ("'Inter',
 * sans-serif", "Georgia, serif") without ever loading the actual webfonts
 * via next/font -- every "Inter" label was silently rendering in the
 * system UI font the whole time. Fixed in app/layout.tsx; these tokens
 * point at the CSS variables it defines.
 */
export const fonts = {
  display: "var(--font-display), Georgia, serif",
  body: "var(--font-body), Georgia, serif",
  ui: "var(--font-ui), 'Inter', sans-serif",
} as const;

/** Soft, ink-tinted shadow instead of a flat hairline border on every card -- part of what read as "dry/corporate." */
export const shadows = {
  card: "0 1px 2px rgba(27, 58, 58, 0.05), 0 8px 20px rgba(27, 58, 58, 0.06)",
  hero: "0 12px 32px rgba(27, 58, 58, 0.16)",
} as const;
