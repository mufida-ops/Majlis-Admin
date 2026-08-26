import { NextRequest, NextResponse } from "next/server";
import { buildDiscussionPromptRequest } from "@/lib/grounding-engine";
import { runGrounded } from "@/lib/ai-router";
import { discussionPromptSchema } from "@/lib/schemas";
import { getSessionStore } from "@/lib/db";
import { loadSessionAndLesson, handleRouteError } from "@/lib/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session, lesson } = await loadSessionAndLesson(body.sessionId);

    const prompt = buildDiscussionPromptRequest(lesson);
    const result = await runGrounded("discussion-prompt", prompt, discussionPromptSchema);

    const updated = await getSessionStore().update(session.id, { activatingPriorKnowledge: result.data });

    return NextResponse.json({
      activatingPriorKnowledge: updated.activatingPriorKnowledge,
      sourceTag: result.sourceTag,
      provider: result.provider,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
