import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEffectiveLesson, updateLessonContent } from "@/lib/lesson-content-store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const lesson = await getEffectiveLesson(id);
    return NextResponse.json({ lesson });
  } catch {
    return NextResponse.json({ error: `Unknown lesson id: ${id}` }, { status: 404 });
  }
}

const patchSchema = z.object({
  grounding: z.string().min(1).optional(),
  reviewStatus: z.enum(["draft", "approved"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No patchable fields provided" }, { status: 400 });
  }

  try {
    const lesson = await updateLessonContent(id, parsed.data);
    return NextResponse.json({ lesson });
  } catch {
    return NextResponse.json({ error: `Unknown lesson id: ${id}` }, { status: 404 });
  }
}
