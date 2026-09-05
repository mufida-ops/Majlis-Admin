import { createClient } from "@supabase/supabase-js";
import type {
  ActiveLearningResult,
  ConsolidationResult,
  GroupActivityResult,
  LearningIntentionsResult,
  QuizResult,
  RubricProjectResult,
  VocabularyResult,
} from "@/lib/schemas";

export interface ConnectionArtifact {
  sceneDescription: string;
  visualElements: string[];
  imageDataUri: string;
}

export interface AssessmentResults {
  /** Number of students who answered each question correctly, same order as the quiz questions. */
  correctCounts: number[];
}

export interface GrowthInsight {
  narrative: string;
  strongestDimension: string;
  weakestDimension: string;
  beforePct: number;
  afterPct: number;
  dimensionBreakdown: Record<string, { beforePct: number; afterPct: number }>;
}

export interface LessonSession {
  id: string;
  lessonId: string;
  classSize: number | null;
  connection: ConnectionArtifact | null;
  vocabulary: VocabularyResult | null;
  activatingPriorKnowledge: { prompt: string; followUpQuestions: string[] } | null;
  preAssessment: QuizResult | null;
  preAssessmentResults: AssessmentResults | null;
  learningIntentions: LearningIntentionsResult | null;
  activeLearning: ActiveLearningResult | null;
  groupActivity: GroupActivityResult | null;
  consolidation: ConsolidationResult | null;
  postAssessmentResults: AssessmentResults | null;
  insight: GrowthInsight | null;
  rubricProject: RubricProjectResult | null;
  createdAt: string;
  updatedAt: string;
}

type SessionPatch = Partial<Omit<LessonSession, "id" | "createdAt" | "updatedAt">>;

interface SessionStore {
  create(lessonId: string): Promise<LessonSession>;
  get(id: string): Promise<LessonSession | null>;
  update(id: string, patch: SessionPatch): Promise<LessonSession>;
}

function emptySession(id: string, lessonId: string): LessonSession {
  const now = new Date().toISOString();
  return {
    id,
    lessonId,
    classSize: null,
    connection: null,
    vocabulary: null,
    activatingPriorKnowledge: null,
    preAssessment: null,
    preAssessmentResults: null,
    learningIntentions: null,
    activeLearning: null,
    groupActivity: null,
    consolidation: null,
    postAssessmentResults: null,
    insight: null,
    rubricProject: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * In-memory fallback used only when Supabase env vars aren't configured yet.
 * Data lives for the process lifetime only -- fine for local development
 * before a real Supabase project exists, never used in production once
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are set.
 */
class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, LessonSession>();

  async create(lessonId: string): Promise<LessonSession> {
    const id = crypto.randomUUID();
    const session = emptySession(id, lessonId);
    this.sessions.set(id, session);
    return session;
  }

  async get(id: string): Promise<LessonSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async update(id: string, patch: SessionPatch): Promise<LessonSession> {
    const existing = this.sessions.get(id);
    if (!existing) throw new Error(`Lesson session not found: ${id}`);
    const updated: LessonSession = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.sessions.set(id, updated);
    return updated;
  }
}

class SupabaseSessionStore implements SessionStore {
  private client;

  constructor(url: string, serviceRoleKey: string) {
    // Uses the default "public" schema. A "tarbiya" schema was tried first
    // to share this Supabase project with unrelated apps without table-name
    // collisions, but Supabase's dashboard would not persist a custom
    // schema in "Exposed schemas" for this project even after the schema,
    // its tables, and the documented GRANTs all existed -- not worth
    // fighting further given the actual collision risk is low.
    this.client = createClient(url, serviceRoleKey);
  }

  async create(lessonId: string): Promise<LessonSession> {
    const { data, error } = await this.client
      .from("tarbiya_lesson_sessions")
      .insert({ lesson_id: lessonId })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data);
  }

  async get(id: string): Promise<LessonSession | null> {
    const { data, error } = await this.client.from("tarbiya_lesson_sessions").select().eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
  }

  async update(id: string, patch: SessionPatch): Promise<LessonSession> {
    const { data, error } = await this.client
      .from("tarbiya_lesson_sessions")
      .update({ ...toRow(patch), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): LessonSession {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    classSize: row.class_size,
    connection: row.connection,
    vocabulary: row.vocabulary,
    activatingPriorKnowledge: row.activating_prior_knowledge,
    preAssessment: row.pre_assessment,
    preAssessmentResults: row.pre_assessment_results,
    learningIntentions: row.learning_intentions,
    activeLearning: row.active_learning,
    groupActivity: row.group_activity,
    consolidation: row.consolidation,
    postAssessmentResults: row.post_assessment_results,
    insight: row.insight,
    rubricProject: row.rubric_project,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(patch: SessionPatch): Record<string, any> {
  const row: Record<string, unknown> = {};
  if ("classSize" in patch) row.class_size = patch.classSize;
  if ("connection" in patch) row.connection = patch.connection;
  if ("vocabulary" in patch) row.vocabulary = patch.vocabulary;
  if ("activatingPriorKnowledge" in patch) row.activating_prior_knowledge = patch.activatingPriorKnowledge;
  if ("preAssessment" in patch) row.pre_assessment = patch.preAssessment;
  if ("preAssessmentResults" in patch) row.pre_assessment_results = patch.preAssessmentResults;
  if ("learningIntentions" in patch) row.learning_intentions = patch.learningIntentions;
  if ("activeLearning" in patch) row.active_learning = patch.activeLearning;
  if ("groupActivity" in patch) row.group_activity = patch.groupActivity;
  if ("consolidation" in patch) row.consolidation = patch.consolidation;
  if ("postAssessmentResults" in patch) row.post_assessment_results = patch.postAssessmentResults;
  if ("insight" in patch) row.insight = patch.insight;
  if ("rubricProject" in patch) row.rubric_project = patch.rubricProject;
  return row;
}

let store: SessionStore | null = null;

export function getSessionStore(): SessionStore {
  if (store) return store;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey) {
    store = new SupabaseSessionStore(url, serviceRoleKey);
  } else {
    console.warn(
      "[db] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set -- using in-memory session store (data will not persist across restarts). See .env.example.",
    );
    store = new InMemorySessionStore();
  }
  return store;
}
