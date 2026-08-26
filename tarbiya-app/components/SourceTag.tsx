"use client";

import { colors, fonts } from "@/lib/theme";

interface SourceTagProps {
  tag: {
    unit: string;
    unitTitle: string;
    sourceRef: string;
    layer2ReviewStatus: "draft" | "approved";
  };
  provider?: string;
}

/**
 * Every AI output carries a visible, structured source tag -- a first-class
 * data field per docs/architecture.md section 5, not a UI afterthought. This
 * is the one component that renders it, everywhere a generated block appears.
 */
export function SourceTag({ tag, provider }: SourceTagProps) {
  return (
    <div
      style={{
        fontFamily: fonts.ui,
        fontSize: 11.5,
        color: colors.textMuted,
        marginTop: 10,
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      <span
        style={{
          background: colors.goldBgSoft,
          color: colors.goldText,
          padding: "3px 10px",
          borderRadius: 20,
        }}
      >
        Source: {tag.unit} &middot; {tag.sourceRef}
      </span>
      {tag.layer2ReviewStatus === "draft" && (
        <span style={{ background: colors.rustBgSoft, color: colors.rust, padding: "3px 10px", borderRadius: 20 }}>
          Grounding pending reviewer approval
        </span>
      )}
      {provider && <span style={{ color: colors.textFaint }}>via {provider}</span>}
    </div>
  );
}
