import { createClient } from "@supabase/supabase-js";
import { getLessonContent as getSeedLesson, availableLessons, groupByUnit, type UnitGroup } from "@/content/lessons";
import type { LessonContent, ReviewStatus } from "@/content/lessons/types";

/**
 * Lets a human reviewer edit a lesson's Layer 2 grounding text and mark it
 * approved, through the UI at /content -- the #1 priority item from the
 * original build brief ("a way to add/edit lesson grounding content through
 * the UI, not hardcoded in a file"). The seed data in content/lessons/*.ts
 * stays as the starting draft; an edit here is stored as an override layered
 * on top, so every generation call (via lib/route-helpers.ts) picks up the
 * reviewer's corrected text going forward, not just the UI display.
 *
 * This intentionally does NOT let a reviewer edit title, unit, or Layer 1
 * raw source -- only the Layer 2 summary and its review status. Editing raw
 * source text is a different, more sensitive operation than the content
 * governance this build brief scoped ("a small review panel checks the AI's
 * assembly work, not the underlying religious sources").
 */

export interface LessonContentOverride {
  grounding: string;
  reviewStatus: ReviewStatus;
  updatedAt: string;
}

interface OverrideStore {
  get(lessonId: string): Promise<LessonContentOverride | null>;
  set(lessonId: string, override: LessonContentOverride): Promise<void>;
  getAll(): Promise<Record<string, LessonContentOverride>>;
}

/** Dev-mode fallback, same pattern as lib/db.ts's InMemorySessionStore. */
class InMemoryOverrideStore implements OverrideStore {
  private data = new Map<string, LessonContentOverride>();

  async get(lessonId: string): Promise<LessonContentOverride | null> {
    return this.data.get(lessonId) ?? null;
  }

  async set(lessonId: string, override: LessonContentOverride): Promise<void> {
    this.data.set(lessonId, override);
  }

  async getAll(): Promise<Record<string, LessonContentOverride>> {
    return Object.fromEntries(this.data);
  }
}

class SupabaseOverrideStore implements OverrideStore {
  private client;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey);
  }

  async get(lessonId: string): Promise<LessonContentOverride | null> {
    const { data, error } = await this.client
      .from("lesson_content_overrides")
      .select()
      .eq("lesson_id", lessonId)
      .maybeSingle();
    if (error) throw error;
    return data ? { grounding: data.grounding, reviewStatus: data.review_status, updatedAt: data.updated_at } : null;
  }

  async set(lessonId: string, override: LessonContentOverride): Promise<void> {
    const { error } = await this.client.from("lesson_content_overrides").upsert({
      lesson_id: lessonId,
      grounding: override.grounding,
      review_status: override.reviewStatus,
      updated_at: override.updatedAt,
    });
    if (error) throw error;
  }

  async getAll(): Promise<Record<string, LessonContentOverride>> {
    const { data, error } = await this.client.from("lesson_content_overrides").select();
    if (error) throw error;
    const result: Record<string, LessonContentOverride> = {};
    for (const row of data ?? []) {
      result[row.lesson_id] = { grounding: row.grounding, reviewStatus: row.review_status, updatedAt: row.updated_at };
    }
    return result;
  }
}

let store: OverrideStore | null = null;

function getOverrideStore(): OverrideStore {
  if (store) return store;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  store = url && serviceRoleKey ? new SupabaseOverrideStore(url, serviceRoleKey) : new InMemoryOverrideStore();
  return store;
}

function applyOverride(lesson: LessonContent, override: LessonContentOverride | null): LessonContent {
  if (!override) return lesson;
  return { ...lesson, layer2: { grounding: override.grounding, reviewStatus: override.reviewStatus } };
}

/** Throws the same "Unknown lesson id" error as the seed lookup for an unknown id. */
export async function getEffectiveLesson(lessonId: string): Promise<LessonContent> {
  const seed = getSeedLesson(lessonId);
  const override = await getOverrideStore().get(lessonId);
  return applyOverride(seed, override);
}

export async function getAllEffectiveLessons(): Promise<LessonContent[]> {
  const overrides = await getOverrideStore().getAll();
  return availableLessons.map((lesson) => applyOverride(lesson, overrides[lesson.id] ?? null));
}

export async function getEffectiveLessonsByUnit(): Promise<UnitGroup[]> {
  return groupByUnit(await getAllEffectiveLessons());
}

export async function updateLessonContent(
  lessonId: string,
  patch: { grounding?: string; reviewStatus?: ReviewStatus },
): Promise<LessonContent> {
  const current = await getEffectiveLesson(lessonId);
  const next: LessonContentOverride = {
    grounding: patch.grounding ?? current.layer2.grounding,
    reviewStatus: patch.reviewStatus ?? current.layer2.reviewStatus,
    updatedAt: new Date().toISOString(),
  };
  await getOverrideStore().set(lessonId, next);
  return applyOverride(current, next);
}
