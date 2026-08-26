import type { ImageGenerationAdapter } from "@/lib/ai-adapters/types";
import { colors } from "@/lib/theme";

/**
 * Phase 1 image adapter: renders a geometric, non-figurative Islamic-art-style
 * illustration from the AI-generated scene description, instead of calling a
 * third-party image-generation provider (none is connected yet -- see
 * docs/architecture.md section 3 on the AI Router's provider seam). This
 * satisfies the IMAGE_VISUAL_CONSTRAINTS in the grounding engine by
 * construction (no figurative rendering at all) while still giving the
 * "Connection" step a real, on-brand picture rather than a placeholder.
 *
 * Swapping in a live image-generation provider later is a one-adapter change:
 * implement ImageGenerationAdapter and register it in ai-router.ts.
 */
export class TemplateSvgImageAdapter implements ImageGenerationAdapter {
  name = "template-svg";

  async generateImage(sceneDescription: string, visualElements: string[]): Promise<string> {
    const size = 480;
    const cx = size / 2;
    const cy = size / 2;
    const points = 8;
    const outerR = 170;
    const innerR = 70;

    const starPoints: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      starPoints.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }

    const chips = visualElements
      .slice(0, 5)
      .map(
        (el, i) =>
          `<text x="24" y="${size - 24 - i * 22}" font-family="Georgia, serif" font-size="13" fill="${colors.goldText}">&#8226; ${escapeXml(el)}</text>`,
      )
      .join("\n");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.paper}"/>
      <stop offset="100%" stop-color="${colors.goldBgSoft}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect x="10" y="10" width="${size - 20}" height="${size - 20}" fill="none" stroke="${colors.gold}" stroke-width="2" rx="16"/>
  <polygon points="${starPoints.join(" ")}" fill="${colors.ink}" opacity="0.08"/>
  <polygon points="${starPoints.join(" ")}" fill="none" stroke="${colors.gold}" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="${innerR - 10}" fill="${colors.card}" stroke="${colors.rust}" stroke-width="1.5"/>
  <foreignObject x="${cx - innerR + 10}" y="${cy - innerR + 20}" width="${(innerR - 10) * 2 - 20}" height="${(innerR - 10) * 2 - 40}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Georgia, serif; font-size: 12px; color: ${colors.textPrimary}; text-align: center; line-height: 1.3;">
      ${escapeXml(truncate(sceneDescription, 160))}
    </div>
  </foreignObject>
  ${chips}
</svg>`;

    const base64 = Buffer.from(svg, "utf-8").toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
