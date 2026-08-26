import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionStore } from "@/lib/db";
import { learningIntentionsSchema } from "@/lib/schemas";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionStore().get(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json({ session });
}

const assessmentResultsSchema = z.object({ correctCounts: z.array(z.number().int().min(0)) });

const patchBodySchema = z.object({
  classSize: z.number().int().min(1).optional(),
  learningIntentions: learningIntentionsSchema.optional(),
  preAssessmentResults: assessmentResultsSchema.optional(),
  postAssessmentResults: assessmentResultsSchema.optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No patchable fields provided" }, { status: 400 });
  }

  const store = getSessionStore();
  const existing = await store.get(id);
  if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const classSize = patch.classSize ?? existing.classSize;
  for (const field of ["preAssessmentResults", "postAssessmentResults"] as const) {
    const results = patch[field];
    if (!results) continue;

    if (existing.preAssessment && results.correctCounts.length !== existing.preAssessment.questions.length) {
      return NextResponse.json(
        { error: `${field}.correctCounts must have exactly ${existing.preAssessment.questions.length} entries (one per quiz question)` },
        { status: 400 },
      );
    }
    if (classSize != null && results.correctCounts.some((c) => c > classSize)) {
      return NextResponse.json({ error: `${field}.correctCounts entries cannot exceed classSize (${classSize})` }, { status: 400 });
    }
  }

  try {
    const session = await store.update(id, patch);
    return NextResponse.json({ session });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed" }, { status: 404 });
  }
}
