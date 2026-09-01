import { NextRequest, NextResponse } from "next/server";
import { buildRubricProjectRequest } from "@/lib/grounding-engine";
import { runGrounded } from "@/lib/ai-router";
import { rubricProjectSchema } from "@/lib/schemas";
import { getSessionStore } from "@/lib/db";
import { loadSessionAndLesson, handleRouteError } from "@/lib/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session, lesson } = await loadSessionAndLesson(body.sessionId);

    const prompt = buildRubricProjectRequest(lesson);
    const result = await runGrounded("rubric-project", prompt, rubricProjectSchema);

    const updated = await getSessionStore().update(session.id, { rubricProject: result.data });

    return NextResponse.json({
      rubricProject: updated.rubricProject,
      sourceTag: result.sourceTag,
      provider: result.provider,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
