import { NextRequest, NextResponse } from "next/server";
import { buildImageProvocationRequest } from "@/lib/grounding-engine";
import { runGrounded, renderImage } from "@/lib/ai-router";
import { imageProvocationSchema } from "@/lib/schemas";
import { getSessionStore } from "@/lib/db";
import { loadSessionAndLesson, handleRouteError } from "@/lib/route-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session, lesson } = await loadSessionAndLesson(body.sessionId);

    const prompt = buildImageProvocationRequest(lesson);
    const result = await runGrounded("image-provocation", prompt, imageProvocationSchema);
    const imageDataUri = await renderImage(result.data.sceneDescription, result.data.visualElements);

    const connection = { ...result.data, imageDataUri };
    const updated = await getSessionStore().update(session.id, { connection });

    return NextResponse.json({ connection: updated.connection, sourceTag: result.sourceTag, provider: result.provider });
  } catch (e) {
    return handleRouteError(e);
  }
}
