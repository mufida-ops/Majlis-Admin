"use client";

import type { ReactNode } from "react";
import { colors, fonts, shadows } from "@/lib/theme";

export function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.card,
        borderRadius: 14,
        padding: 24,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
        <span
          style={{
            fontFamily: fonts.ui,
            fontSize: 12,
            fontWeight: 700,
            color: colors.onInk,
            background: colors.ink,
            boxShadow: `0 0 0 3px ${colors.goldBgSoft}`,
            borderRadius: "50%",
            width: 26,
            height: 26,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {step}
        </span>
        <h2 style={{ fontSize: 20, margin: 0, color: colors.textPrimary, fontFamily: fonts.display, fontWeight: 600 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export const btnStyle: React.CSSProperties = {
  fontFamily: fonts.ui,
  fontSize: 14,
  fontWeight: 500,
  background: colors.ink,
  color: colors.onInk,
  border: "none",
  padding: "10px 20px",
  borderRadius: 8,
  boxShadow: "0 1px 2px rgba(27, 58, 58, 0.15), 0 4px 10px rgba(27, 58, 58, 0.12)",
  cursor: "pointer",
};

export const btnGhostStyle: React.CSSProperties = {
  fontFamily: fonts.ui,
  fontSize: 14,
  fontWeight: 500,
  background: colors.card,
  color: colors.ink,
  border: `1.5px solid ${colors.ink}`,
  padding: "9px 18px",
  borderRadius: 8,
  cursor: "pointer",
};

export const errorStyle: React.CSSProperties = {
  fontFamily: fonts.ui,
  color: colors.danger,
  fontSize: 13.5,
  marginTop: 8,
};
