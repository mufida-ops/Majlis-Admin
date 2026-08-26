import Link from "next/link";
import { getEffectiveLessonsByUnit } from "@/lib/lesson-content-store";
import { colors, fonts, shadows } from "@/lib/theme";
import { starPatternBackground } from "@/lib/patterns";

// The review-status badges here depend on lesson-content-store overrides,
// which change at runtime via the /content editor -- this page must not be
// statically cached, or an edit/approval would never show up without a
// full rebuild.
export const dynamic = "force-dynamic";

export default async function Home() {
  const units = await getEffectiveLessonsByUnit();

  return (
    <div style={{ minHeight: "100vh" }}>
      <div
        style={{
          background: colors.ink,
          backgroundImage: starPatternBackground(colors.gold, 0.1),
          color: colors.onInk,
          padding: "56px 24px 40px",
          borderBottom: `4px solid ${colors.gold}`,
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <p
            style={{
              fontFamily: fonts.display,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.02em",
              color: colors.onInk,
              margin: 0,
            }}
          >
            Tarbiya
          </p>
          <h1 style={{ fontSize: 36, margin: "10px 0 12px", fontFamily: fonts.display, fontWeight: 600 }}>
            Grade 3 Islamic Education
          </h1>
          <p style={{ color: colors.onInkMuted, lineHeight: 1.65, maxWidth: 560, margin: 0 }}>
            Every lesson here is written by AI, but only ever drawn from an approved, cited library -- nothing is
            ever invented. Lessons marked &ldquo;pending review&rdquo; haven&rsquo;t been checked by a human yet.
          </p>
        </div>
      </div>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "36px 24px 48px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <Link href="/content" style={{ fontFamily: fonts.ui, fontSize: 13.5, color: colors.goldText, fontWeight: 500 }}>
            Review content &rarr;
          </Link>
        </div>

        {units.map((group) => (
          <div key={group.unit} style={{ marginBottom: 32 }}>
            <p
              style={{
                fontFamily: fonts.ui,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: colors.textMuted,
                margin: "0 0 10px",
              }}
            >
              {group.unit} &middot; {group.unitTitle} &middot; Vol {group.volume}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {group.lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/lesson/${lesson.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: `1px solid ${colors.border}`,
                    boxShadow: shadows.card,
                    borderRadius: 12,
                    padding: "14px 18px",
                    background: colors.card,
                    textDecoration: "none",
                    color: colors.textPrimary,
                  }}
                >
                  <span style={{ fontSize: 16, fontFamily: fonts.body }}>{lesson.title}</span>
                  {lesson.layer2.reviewStatus === "draft" && (
                    <span
                      style={{
                        fontFamily: fonts.ui,
                        fontSize: 11,
                        color: colors.rust,
                        background: colors.rustBgSoft,
                        padding: "2px 9px",
                        borderRadius: 20,
                        whiteSpace: "nowrap",
                      }}
                    >
                      pending review
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
