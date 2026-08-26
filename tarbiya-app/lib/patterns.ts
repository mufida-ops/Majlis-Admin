/**
 * A faint, repeating 8-point star motif for header/hero backgrounds --
 * texture instead of a flat solid color block, echoing the star used in the
 * Connection step's generated illustration (lib/ai-adapters/template-svg-image-adapter.ts)
 * without being a literal, clip-art "Islamic pattern" border. Non-figurative,
 * consistent with the same visual constraints the grounding engine enforces
 * on generated imagery.
 */
export function starPatternBackground(color: string, opacity = 0.08): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><g fill="none" stroke="${color}" stroke-width="1" opacity="${opacity}"><polygon points="32,8 36,24 52,24 39,34 43,50 32,40 21,50 25,34 12,24 28,24"/></g></svg>`;
  const encoded = encodeURIComponent(svg);
  return `url("data:image/svg+xml,${encoded}")`;
}
