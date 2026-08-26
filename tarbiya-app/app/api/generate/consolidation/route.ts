import { NextRequest, NextResponse } from "next/server";
import { buildConsolidationRequest } from "@/lib/grounding-engine";
import { runGrounded } from "@/lib/ai-router";
import { consolidationSchema } from "@/lib/schemas";
import { getSessionStore } from "@/lib/db";
import { loadSessionAndLesson, handleRouteError } from "@/lib/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session, lesson } = await loadSessionAndLesson(body.sessionId);

    const prompt = buildConsolidationRequest(lesson);
    const result = await runGrounded("consolidation", prompt, consolidationSchema);

    const updated = await getSessionStore().update(session.id, { consolidation: result.data });

    return NextResponse.json({
      consolidation: updated.consolidation,
      sourceTag: result.sourceTag,
      provider: result.provider,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
