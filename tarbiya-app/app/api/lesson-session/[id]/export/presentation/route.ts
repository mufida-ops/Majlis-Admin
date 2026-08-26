import { NextRequest, NextResponse } from "next/server";
import { getSessionStore } from "@/lib/db";
import { getEffectiveLesson } from "@/lib/lesson-content-store";
import { buildLessonPlanPptx } from "@/lib/export/lesson-plan-pptx";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionStore().get(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const lesson = await getEffectiveLesson(session.lessonId);
  const buffer = await buildLessonPlanPptx(lesson, session);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${lesson.id}-presentation.pptx"`,
    },
  });
}
