import { NextRequest, NextResponse } from "next/server";
import { buildVocabularyRequest } from "@/lib/grounding-engine";
import { runGrounded } from "@/lib/ai-router";
import { vocabularySchema } from "@/lib/schemas";
import { getSessionStore } from "@/lib/db";
import { loadSessionAndLesson, handleRouteError } from "@/lib/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session, lesson } = await loadSessionAndLesson(body.sessionId);

    const prompt = buildVocabularyRequest(lesson);
    const result = await runGrounded("vocabulary", prompt, vocabularySchema);

    const updated = await getSessionStore().update(session.id, { vocabulary: result.data });

    return NextResponse.json({
      vocabulary: updated.vocabulary,
      sourceTag: result.sourceTag,
      provider: result.provider,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
