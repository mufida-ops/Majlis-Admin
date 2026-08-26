import { NextRequest, NextResponse } from "next/server";
import { buildActiveLearningRequest } from "@/lib/grounding-engine";
import { runGrounded } from "@/lib/ai-router";
import { activeLearningModes, activeLearningSchema } from "@/lib/schemas";
import { getSessionStore } from "@/lib/db";
import { loadSessionAndLesson, handleRouteError, RouteError } from "@/lib/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session, lesson } = await loadSessionAndLesson(body.sessionId);

    const mode = body.mode;
    if (!activeLearningModes.includes(mode)) {
      throw new RouteError(400, `mode must be one of: ${activeLearningModes.join(", ")}`);
    }

    const prompt = buildActiveLearningRequest(lesson, mode);
    const result = await runGrounded("active-learning-activity", prompt, activeLearningSchema);

    const updated = await getSessionStore().update(session.id, { activeLearning: result.data });

    return NextResponse.json({
      activeLearning: updated.activeLearning,
      sourceTag: result.sourceTag,
      provider: result.provider,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
