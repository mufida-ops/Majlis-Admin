import { NextRequest, NextResponse } from "next/server";
import { buildGrowthInsightRequest } from "@/lib/grounding-engine";
import { runGrounded } from "@/lib/ai-router";
import { insightSchema } from "@/lib/schemas";
import { getSessionStore } from "@/lib/db";
import { loadSessionAndLesson, handleRouteError, RouteError } from "@/lib/route-helpers";
import { computeDimensionBreakdown } from "@/lib/insight";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session, lesson } = await loadSessionAndLesson(body.sessionId);

    if (!session.preAssessment || !session.classSize) {
      throw new RouteError(400, "classSize and preAssessment must be set before computing insight");
    }
    if (!session.preAssessmentResults || !session.postAssessmentResults) {
      throw new RouteError(400, "Both pre- and post-assessment results must be recorded first");
    }

    const { overall, byDimension } = computeDimensionBreakdown(
      session.preAssessment,
      session.classSize,
      session.preAssessmentResults,
      session.postAssessmentResults,
    );

    const prompt = buildGrowthInsightRequest(lesson, byDimension);
    const result = await runGrounded("growth-insight", prompt, insightSchema);

    const insight = {
      narrative: result.data.narrative,
      strongestDimension: result.data.strongestDimension,
      weakestDimension: result.data.weakestDimension,
      beforePct: overall.beforePct,
      afterPct: overall.afterPct,
      dimensionBreakdown: byDimension,
    };

    const updated = await getSessionStore().update(session.id, { insight });

    return NextResponse.json({ insight: updated.insight, sourceTag: result.sourceTag, provider: result.provider });
  } catch (e) {
    return handleRouteError(e);
  }
}
