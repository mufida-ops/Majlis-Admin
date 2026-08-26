import { notFound } from "next/navigation";
import { getLessonContent } from "@/content/lessons";
import { LessonWorkspace } from "@/components/LessonWorkspace";

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;

  let meta;
  try {
    const lesson = getLessonContent(lessonId);
    meta = { id: lesson.id, title: lesson.title, unit: lesson.layer3.unit, unitTitle: lesson.layer3.unitTitle };
  } catch {
    notFound();
  }

  return <LessonWorkspace meta={meta} />;
}
