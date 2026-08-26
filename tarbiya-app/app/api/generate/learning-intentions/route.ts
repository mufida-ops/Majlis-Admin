import { NextRequest, NextResponse } from "next/server";
import { buildLearningIntentionsRequest } from "@/lib/grounding-engine";
import { runGrounded } from "@/lib/ai-router";
import { learningIntentionsSchema } from "@/lib/schemas";
import { getSessionStore } from "@/lib/db";
import { loadSessionAndLesson, handleRouteError } from "@/lib/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session, lesson } = await loadSessionAndLesson(body.sessionId);

    const prompt = buildLearningIntentionsRequest(lesson);
    const result = await runGrounded("learning-intentions", prompt, learningIntentionsSchema);

    const updated = await getSessionStore().update(session.id, { learningIntentions: result.data });

    return NextResponse.json({
      learningIntentions: updated.learningIntentions,
      sourceTag: result.sourceTag,
      provider: result.provider,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
