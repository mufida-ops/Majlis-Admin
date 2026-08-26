import { notFound } from "next/navigation";
import Link from "next/link";
import { getEffectiveLesson } from "@/lib/lesson-content-store";
import { ContentEditor } from "@/components/ContentEditor";
import { colors, fonts, shadows } from "@/lib/theme";

export default async function ContentReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let lesson;
  try {
    lesson = await getEffectiveLesson(id);
  } catch {
    notFound();
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      <Link href="/content" style={{ fontFamily: fonts.ui, fontSize: 12.5, color: colors.textMuted }}>
        &larr; Content review
      </Link>
      <p
        style={{
          fontFamily: fonts.ui,
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: colors.textMuted,
          margin: "10px 0 0",
        }}
      >
        {lesson.layer3.unit} &middot; {lesson.layer3.unitTitle}
      </p>
      <h1 style={{ fontSize: 28, margin: "6px 0 20px", color: colors.textPrimary, fontFamily: fonts.display, fontWeight: 600 }}>{lesson.title}</h1>

      <section style={{ background: colors.card, border: `1px solid ${colors.border}`, boxShadow: shadows.card, borderRadius: 14, padding: 22, marginBottom: 20 }}>
        <p style={{ fontFamily: fonts.ui, fontSize: 11, textTransform: "uppercase", color: colors.textMuted, margin: "0 0 8px" }}>
          Layer 1 &middot; Raw source (read-only reference -- not editable here)
        </p>
        <p style={{ fontSize: 13.5, color: colors.textMuted, margin: "0 0 6px" }}>{lesson.layer1.reference}</p>
        {lesson.layer1.transliteration && (
          <p style={{ fontSize: 13.5, fontStyle: "italic", margin: "0 0 6px" }}>{lesson.layer1.transliteration}</p>
        )}
        <p style={{ fontSize: 14, margin: 0 }}>&ldquo;{lesson.layer1.translation}&rdquo;</p>
      </section>

      <ContentEditor lessonId={lesson.id} initialGrounding={lesson.layer2.grounding} initialReviewStatus={lesson.layer2.reviewStatus} />

      <p style={{ fontFamily: fonts.ui, fontSize: 12, color: colors.textMuted, marginTop: 18 }}>
        Source: {lesson.layer3.sourceRef}
      </p>
    </main>
  );
}
