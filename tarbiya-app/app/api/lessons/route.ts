import { NextResponse } from "next/server";
import { getAllEffectiveLessons } from "@/lib/lesson-content-store";

export async function GET() {
  const lessons = await getAllEffectiveLessons();
  return NextResponse.json({ lessons });
}
