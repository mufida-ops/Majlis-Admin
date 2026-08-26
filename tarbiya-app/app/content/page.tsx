import Link from "next/link";
import { getEffectiveLessonsByUnit } from "@/lib/lesson-content-store";
import { colors, fonts, shadows } from "@/lib/theme";

// Same reasoning as app/page.tsx: this list's approved/pending counts and
// badges must reflect the latest override, never a stale build-time snapshot.
export const dynamic = "force-dynamic";

export default async function ContentReviewList() {
  const units = await getEffectiveLessonsByUnit();
  const total = units.reduce((sum, u) => sum + u.lessons.length, 0);
  const approved = units.reduce((sum, u) => sum + u.lessons.filter((l) => l.layer2.reviewStatus === "approved").length, 0);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/" style={{ fontFamily: fonts.ui, fontSize: 12.5, color: colors.textMuted }}>
        &larr; All lessons
      </Link>
      <h1 style={{ fontSize: 30, margin: "10px 0 6px", color: colors.textPrimary, fontFamily: fonts.display, fontWeight: 600 }}>Content Review</h1>
      <p style={{ color: colors.textMuted, lineHeight: 1.6, marginBottom: 8 }}>
        {approved} of {total} lessons&rsquo; grounding text has been reviewed and approved. The rest is AI-drafted from
        the licensed textbook and should not be treated as final until a reviewer checks it against the source.
      </p>
      <p style={{ color: colors.textMuted, lineHeight: 1.6, marginBottom: 32, fontSize: 13.5, fontStyle: "italic" }}>
        Only the summary text used to ground AI generation can be edited here -- not the underlying Qur&apos;an/hadith
        text, title, or curriculum placement.
      </p>

      {units.map((group) => (
        <div key={group.unit} style={{ marginBottom: 28 }}>
          <p
            style={{
              fontFamily: fonts.ui,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: colors.textMuted,
              margin: "0 0 8px",
            }}
          >
            {group.unit} &middot; {group.unitTitle}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.lessons.map((lesson) => {
              const isApproved = lesson.layer2.reviewStatus === "approved";
              return (
                <Link
                  key={lesson.id}
                  href={`/content/${lesson.id}`}
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
                  <span
                    style={{
                      fontFamily: fonts.ui,
                      fontSize: 11,
                      color: isApproved ? colors.goldText : colors.rust,
                      background: isApproved ? colors.goldBgSoft : colors.rustBgSoft,
                      padding: "2px 9px",
                      borderRadius: 20,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isApproved ? "approved" : "pending review"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </main>
  );
}
