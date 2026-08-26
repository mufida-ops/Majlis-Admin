import { NextRequest, NextResponse } from "next/server";
import { getSessionStore } from "@/lib/db";
import { getLessonContent } from "@/content/lessons";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lessonId = body.lessonId;
  if (typeof lessonId !== "string") {
    return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
  }

  try {
    getLessonContent(lessonId);
  } catch {
    return NextResponse.json({ error: `Unknown lessonId: ${lessonId}` }, { status: 404 });
  }

  const session = await getSessionStore().create(lessonId);
  return NextResponse.json({ session });
}
