import { NextRequest, NextResponse } from "next/server";
import { buildQuizRequest } from "@/lib/grounding-engine";
import { runGrounded } from "@/lib/ai-router";
import { quizSchema } from "@/lib/schemas";
import { getSessionStore } from "@/lib/db";
import { loadSessionAndLesson, handleRouteError, RouteError } from "@/lib/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session, lesson } = await loadSessionAndLesson(body.sessionId);

    const numQuestions = Number(body.numQuestions ?? 6);
    if (!Number.isInteger(numQuestions) || numQuestions < 3 || numQuestions > 10) {
      throw new RouteError(400, "numQuestions must be an integer between 3 and 10");
    }

    const prompt = buildQuizRequest(lesson, numQuestions);
    const result = await runGrounded("assessment-quiz", prompt, quizSchema);

    // A fresh pre-assessment invalidates any prior results tied to the old question set.
    const updated = await getSessionStore().update(session.id, {
      preAssessment: result.data,
      preAssessmentResults: null,
      postAssessmentResults: null,
      insight: null,
    });

    return NextResponse.json({
      preAssessment: updated.preAssessment,
      sourceTag: result.sourceTag,
      provider: result.provider,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
