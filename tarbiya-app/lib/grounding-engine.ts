import type { LessonContent } from "@/content/lessons/surat-al-humazah";
import type { ActiveLearningMode } from "@/lib/schemas";

/**
 * Safety/Grounding Engine
 * ------------------------
 * The one place that enforces the platform's core safety distinction (see
 * docs/architecture.md section 2):
 *
 *   - Religious claims (ayat, hadith, fiqh rulings, historical facts, Islamic
 *     interpretation) must NEVER be invented -- only what's in the lesson's
 *     approved Layer 1/2 content may be used.
 *   - Pedagogy (activities, scenarios, discussion prompts, visual metaphors)
 *     may be freely and creatively designed, as long as it introduces no new
 *     religious claim.
 *
 * Every prompt built here carries both instructions SEPARATELY and explicitly,
 * on purpose -- collapsing them into one blanket restriction is what makes a
 * product "safe but creatively dead" (brief section 2). This module is the
 * single seam between lesson content and the AI Router: nothing outside this
 * file should be constructing grounding instructions inline in a route handler.
 */

const RELIGIOUS_CLAIM_CONSTRAINT = `You must not state, imply, or add any Qur'anic verse, hadith, fiqh ruling, historical fact about a prophet or companion, or Islamic interpretation that is not explicitly present in the APPROVED CONTENT block below. This restriction applies only to religious claims. If the approved content is insufficient to fully complete the task, say so plainly in your response rather than filling the gap from general knowledge.`;

const PEDAGOGICAL_FREEDOM_INSTRUCTION = `Within that limit, you have full creative freedom over the PEDAGOGY: how you turn the approved concept into a role-play, sorting activity, classroom scenario, reflection question, visual metaphor, discussion prompt, or any other teaching activity you judge serves Grade 3 students well. Inventing teaching activities is encouraged and expected -- only the underlying religious content itself is restricted.`;

/** Explicit, not left to model judgment (brief section 6, item 1). */
const IMAGE_VISUAL_CONSTRAINTS = [
  "No depiction of Allah, angels, prophets, or companions in any human, animal, or symbolic figurative form.",
  "No depiction of any human figure in a manner that resembles worship instruction (e.g. prayer posture) unless that is explicitly the approved lesson content.",
  "Any depicted human figures must be modestly dressed.",
  "Prefer non-figurative Islamic art styles: geometric patterns, arabesque motifs, nature and calligraphy, over figurative illustration.",
  "Must be age-appropriate and warm for an 8-year-old (Grade 3) audience -- no frightening or graphic imagery, even when the surah's content (e.g. warnings of the Hereafter) is serious.",
  "Any Arabic script shown must be the verified verse text supplied, never invented calligraphy presented as Qur'anic text.",
];

export type GenerationTask =
  | "discussion-prompt"
  | "assessment-quiz"
  | "learning-intentions"
  | "active-learning-activity"
  | "image-provocation"
  | "consolidation"
  | "growth-insight";

export interface GroundedPrompt {
  systemPrompt: string;
  userPrompt: string;
  sourceTag: SourceTag;
}

export interface SourceTag {
  lessonId: string;
  lessonTitle: string;
  grade: number;
  unit: string;
  unitTitle: string;
  sourceRef: string;
  layer2ReviewStatus: "draft" | "approved";
}

function baseSourceTag(lesson: LessonContent): SourceTag {
  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    grade: lesson.layer3.grade,
    unit: lesson.layer3.unit,
    unitTitle: lesson.layer3.unitTitle,
    sourceRef: lesson.layer3.sourceRef,
    layer2ReviewStatus: lesson.layer2.reviewStatus,
  };
}

function approvedContentBlock(lesson: LessonContent, includeRawVerse: boolean): string {
  const parts = [`APPROVED CONTENT (Layer 2 -- approved pedagogical summary):\n${lesson.layer2.grounding}`];
  if (includeRawVerse) {
    parts.push(
      `\nRAW SOURCE TEXT (Layer 1 -- quotable verbatim, do not paraphrase or reinterpret if quoting it):\nReference: ${lesson.layer1.reference}\nTranslation: "${lesson.layer1.translation}"`,
    );
  }
  return parts.join("\n");
}

function systemPromptFor(task: GenerationTask, jsonInstruction: string, extraConstraints?: string[]): string {
  const lines = [RELIGIOUS_CLAIM_CONSTRAINT, PEDAGOGICAL_FREEDOM_INSTRUCTION];
  if (extraConstraints?.length) {
    lines.push(`Additional constraints for this task:\n- ${extraConstraints.join("\n- ")}`);
  }
  lines.push(jsonInstruction);
  return lines.join("\n\n");
}

const JSON_ONLY = "Respond with valid JSON only. No prose before or after, no markdown code fences.";

export function buildDiscussionPromptRequest(lesson: LessonContent): GroundedPrompt {
  return {
    systemPrompt: systemPromptFor(
      "discussion-prompt",
      `${JSON_ONLY}\nShape: {"prompt": string, "followUpQuestions": string[]}`,
    ),
    userPrompt: `${approvedContentBlock(lesson, false)}\n\nTask: Write one "Activating Prior Knowledge" discussion prompt for Grade 3 students that surfaces what they already think they know about this concept, before they've studied it -- not a question that tests the content yet, just an opener. Include 2-4 short follow-up questions a teacher could ask.`,
    sourceTag: baseSourceTag(lesson),
  };
}

export function buildQuizRequest(lesson: LessonContent, numQuestions: number): GroundedPrompt {
  return {
    systemPrompt: systemPromptFor(
      "assessment-quiz",
      `${JSON_ONLY}\nShape: {"questions": [{"q": string, "answer": "Yes"|"No", "dimension": "depthOfUnderstanding"|"demonstrationOfPractice"|"degreeOfReflection"|"directionOfGrowth"}]}`,
      [
        "Each question must be tagged with exactly one of the four 4D Assessment dimensions it best probes: depthOfUnderstanding (can they explain/relate the concept), demonstrationOfPractice (has it changed behavior/choices), degreeOfReflection (emotional/spiritual engagement), directionOfGrowth (visible movement in mindset/intention).",
        "Distribute the questions across all four dimensions as evenly as the question count allows -- don't concentrate them all in one dimension.",
      ],
    ),
    userPrompt: `${approvedContentBlock(lesson, false)}\n\nTask: Generate exactly ${numQuestions} simple yes/no comprehension questions a Grade 3 teacher can use as a quick pre-assessment, based only on the approved content above. These exact same questions will be reused unchanged as the post-assessment at the end of the lesson.`,
    sourceTag: baseSourceTag(lesson),
  };
}

export function buildLearningIntentionsRequest(lesson: LessonContent): GroundedPrompt {
  return {
    systemPrompt: systemPromptFor(
      "learning-intentions",
      `${JSON_ONLY}\nShape: {"understanding": string, "application": string, "referencingText": string, "connectionToRealLife": string, "successCriteria": string[]}`,
    ),
    userPrompt: `${approvedContentBlock(lesson, true)}\n\nTask: Draft the four-part Learning Intentions for this lesson, one sentence each, written for a teacher to read aloud or edit: Understanding (what they'll understand), Application (what they'll be able to do), Referencing to Text (how they'll refer to the approved source), Connection to Real Life (how it applies to their own life). Also give 2-5 short, observable Success Criteria statements ("I can...") a Grade 3 student could self-check against.`,
    sourceTag: baseSourceTag(lesson),
  };
}

export function buildActiveLearningRequest(lesson: LessonContent, mode: ActiveLearningMode): GroundedPrompt {
  return {
    systemPrompt: systemPromptFor(
      "active-learning-activity",
      `${JSON_ONLY}\nShape: {"mode": string, "title": string, "instructions": string, "materials": string[]}`,
    ),
    userPrompt: `${approvedContentBlock(lesson, false)}\n\nTask: Design one Active Learning activity for Grade 3 students in the "${mode}" mode (discussion / collaborative / movement / creative / inquiry). Give it a short title, clear step-by-step instructions a teacher could run in a 15-20 minute classroom segment, and a materials list (can be empty if none needed). Be genuinely creative with the pedagogy -- the constraint is only on religious content, not on activity design.`,
    sourceTag: baseSourceTag(lesson),
  };
}

export function buildConsolidationRequest(lesson: LessonContent): GroundedPrompt {
  return {
    systemPrompt: systemPromptFor(
      "consolidation",
      `${JSON_ONLY}\nShape: {"summary": string, "discussionPrompt": string}`,
    ),
    userPrompt: `${approvedContentBlock(lesson, false)}\n\nTask: Write a short Consolidation summary (2-3 sentences) that brings the lesson's ideas together for Grade 3 students, plus one closing discussion prompt to wrap up the class.`,
    sourceTag: baseSourceTag(lesson),
  };
}

export function buildImageProvocationRequest(lesson: LessonContent): GroundedPrompt {
  return {
    systemPrompt: systemPromptFor(
      "image-provocation",
      `${JSON_ONLY}\nShape: {"sceneDescription": string, "visualElements": string[] (2 to 6 items)}`,
      IMAGE_VISUAL_CONSTRAINTS,
    ),
    userPrompt: `${approvedContentBlock(lesson, false)}\n\nTask: Describe an age-appropriate "Connection" provocation image for Grade 3 students that will emotionally hook them into this lesson's concept (a scene, metaphor, or everyday classroom situation -- not the Hellfire imagery itself, keep it warm and relatable, e.g. a scene about kind vs. unkind words). List its key visual elements as an array of 2 to 6 items (a template illustrator can only render up to 6) -- pick the most essential ones if you have more ideas.`,
    sourceTag: baseSourceTag(lesson),
  };
}

export function buildGrowthInsightRequest(
  lesson: LessonContent,
  dimensionScores: Record<string, { beforePct: number; afterPct: number }>,
): GroundedPrompt {
  return {
    systemPrompt: systemPromptFor(
      "growth-insight",
      `${JSON_ONLY}\nShape: {"narrative": string, "strongestDimension": string, "weakestDimension": string}`,
      [
        "Base the narrative only on the numeric before/after percentages given per dimension -- do not add any new religious claim about the lesson content itself.",
      ],
    ),
    userPrompt: `Lesson: ${lesson.title}\n\nPer-4D-dimension pre/post assessment results for this class:\n${JSON.stringify(dimensionScores, null, 2)}\n\nTask: Write a short (2-3 sentence), plain-language insight for the teacher: which dimension(s) improved most, which lagged, and one concrete suggestion for what to reinforce next lesson. Name strongestDimension and weakestDimension by their exact key.`,
    sourceTag: baseSourceTag(lesson),
  };
}
