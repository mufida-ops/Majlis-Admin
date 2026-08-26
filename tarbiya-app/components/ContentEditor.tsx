"use client";

import { useState } from "react";
import { colors, fonts, shadows } from "@/lib/theme";
import { btnStyle, errorStyle } from "@/components/StepCard";
import type { ReviewStatus } from "@/content/lessons/types";

export function ContentEditor({
  lessonId,
  initialGrounding,
  initialReviewStatus,
}: {
  lessonId: string;
  initialGrounding: string;
  initialReviewStatus: ReviewStatus;
}) {
  const [grounding, setGrounding] = useState(initialGrounding);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(initialReviewStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty = grounding !== initialGrounding || reviewStatus !== initialReviewStatus;

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grounding, reviewStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ background: colors.card, border: `1px solid ${colors.border}`, boxShadow: shadows.card, borderRadius: 14, padding: 22 }}>
      <p style={{ fontFamily: fonts.ui, fontSize: 11, textTransform: "uppercase", color: colors.textMuted, margin: "0 0 8px" }}>
        Layer 2 &middot; Approved pedagogical summary (this is what the AI is grounded in)
      </p>
      <textarea
        value={grounding}
        onChange={(e) => {
          setGrounding(e.target.value);
          setSavedAt(null);
        }}
        rows={10}
        style={{
          width: "100%",
          fontSize: 14,
          lineHeight: 1.5,
          padding: 12,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          fontFamily: fonts.body,
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
        <label style={{ fontFamily: fonts.ui, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={reviewStatus === "approved"}
            onChange={(e) => {
              setReviewStatus(e.target.checked ? "approved" : "draft");
              setSavedAt(null);
            }}
          />
          Mark as reviewed and approved
        </label>

        <button style={btnStyle} onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save"}
        </button>

        {!dirty && savedAt && (
          <span style={{ fontFamily: fonts.ui, fontSize: 12.5, color: colors.goldText }}>Saved</span>
        )}
        {dirty && <span style={{ fontFamily: fonts.ui, fontSize: 12.5, color: colors.textFaint }}>Unsaved changes</span>}
      </div>

      {error && <p style={errorStyle}>{error}</p>}
    </section>
  );
}
