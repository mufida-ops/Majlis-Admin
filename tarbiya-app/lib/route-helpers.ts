import { NextResponse } from "next/server";
import { getSessionStore, type LessonSession } from "@/lib/db";
import { getEffectiveLesson } from "@/lib/lesson-content-store";
import type { LessonContent } from "@/content/lessons/surat-al-humazah";
import { GenerationValidationError } from "@/lib/ai-router";

export class RouteError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function loadSessionAndLesson(
  sessionId: unknown,
): Promise<{ session: LessonSession; lesson: LessonContent }> {
  if (typeof sessionId !== "string") throw new RouteError(400, "sessionId is required");
  const session = await getSessionStore().get(sessionId);
  if (!session) throw new RouteError(404, "Session not found");
  const lesson = await getEffectiveLesson(session.lessonId);
  return { session, lesson };
}

export function handleRouteError(e: unknown): NextResponse {
  if (e instanceof RouteError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof GenerationValidationError) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
  console.error(e);
  return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
}
