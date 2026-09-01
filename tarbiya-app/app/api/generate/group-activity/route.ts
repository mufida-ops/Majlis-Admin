import { NextRequest, NextResponse } from "next/server";
import { buildGroupActivityRequest } from "@/lib/grounding-engine";
import { runGrounded } from "@/lib/ai-router";
import { groupActivitySchema } from "@/lib/schemas";
import { getSessionStore } from "@/lib/db";
import { loadSessionAndLesson, handleRouteError } from "@/lib/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session, lesson } = await loadSessionAndLesson(body.sessionId);

    const prompt = buildGroupActivityRequest(lesson);
    const result = await runGrounded("group-activity", prompt, groupActivitySchema);

    const updated = await getSessionStore().update(session.id, { groupActivity: result.data });

    return NextResponse.json({
      groupActivity: updated.groupActivity,
      sourceTag: result.sourceTag,
      provider: result.provider,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
