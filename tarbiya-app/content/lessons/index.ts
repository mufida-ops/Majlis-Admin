import { suratAlHumazah } from "@/content/lessons/surat-al-humazah";
import { grade3Vol1Lessons } from "@/content/lessons/grade3-vol1";
import type { LessonContent } from "@/content/lessons/types";

/**
 * Phase 1 shipped exactly one lesson (Surat al-Humazah) to prove the model on
 * real architecture. Phase 2 adds the rest of Grade 3 Volume 1 (Units 1-3) to
 * confirm the Safety/Grounding Engine and AI Router generalize across lesson
 * types -- surah, hadith, and historical/biographical -- not just the one
 * lesson Phase 1 was built around. Volume 2 (Units 4-6) is not yet added.
 *
 * Lessons are sorted here by (unit number, lesson number) rather than relying
 * on the two source files already listing them in the right order, so adding
 * or renumbering a lesson in either file can never silently misplace it.
 */
function unitNumber(unit: string): number {
  return Number(unit.match(/\d+/)?.[0] ?? 0);
}

const allLessons: LessonContent[] = [...grade3Vol1Lessons, suratAlHumazah].sort((a, b) => {
  const unitDiff = unitNumber(a.layer3.unit) - unitNumber(b.layer3.unit);
  return unitDiff !== 0 ? unitDiff : a.layer3.lessonNumber - b.layer3.lessonNumber;
});

const lessonsById: Record<string, LessonContent> = Object.fromEntries(allLessons.map((l) => [l.id, l]));

export function getLessonContent(lessonId: string): LessonContent {
  const lesson = lessonsById[lessonId];
  if (!lesson) throw new Error(`Unknown lesson id: ${lessonId}`);
  return lesson;
}

export const availableLessons = allLessons;

export interface UnitGroup {
  unit: string;
  unitTitle: string;
  volume: number;
  lessons: LessonContent[];
}

/** Shared so lib/lesson-content-store.ts can group the override-merged list the same way. */
export function groupByUnit(lessons: LessonContent[]): UnitGroup[] {
  const groups = new Map<string, UnitGroup>();
  for (const lesson of lessons) {
    const key = lesson.layer3.unit;
    if (!groups.has(key)) {
      groups.set(key, { unit: lesson.layer3.unit, unitTitle: lesson.layer3.unitTitle, volume: lesson.layer3.volume, lessons: [] });
    }
    groups.get(key)!.lessons.push(lesson);
  }
  return [...groups.values()].sort((a, b) => unitNumber(a.unit) - unitNumber(b.unit));
}

export function lessonsByUnit(): UnitGroup[] {
  return groupByUnit(allLessons);
}
