import type { z } from "zod";
import type { GenerationTask, GroundedPrompt } from "@/lib/grounding-engine";
import type { TextGenerationAdapter } from "@/lib/ai-adapters/types";
import { AnthropicTextAdapter } from "@/lib/ai-adapters/anthropic-text-adapter";
import { MockTextAdapter } from "@/lib/ai-adapters/mock-text-adapter";
import { TemplateSvgImageAdapter } from "@/lib/ai-adapters/template-svg-image-adapter";

/**
 * AI Router
 * ---------
 *   Teacher -> Platform UI -> Safety/Grounding Engine -> AI Router -> best
 *   model for the task -> Validation -> Teacher   (docs/architecture.md sec. 3)
 *
 * This is the ONLY place that knows which provider serves which task. Route
 * handlers never import an adapter directly -- they call runGrounded() with a
 * GroundedPrompt from the grounding engine and a zod schema, and get back
 * validated, typed data plus the source tag. Adding a second provider (e.g. a
 * dedicated Arabic-pedagogy model) later means adding one entry to
 * TEXT_TASK_PROVIDER and one adapter class -- not touching any route handler.
 */

type TextProviderKey = "anthropic";

const TEXT_TASK_PROVIDER: Record<GenerationTask, TextProviderKey> = {
  "discussion-prompt": "anthropic",
  "assessment-quiz": "anthropic",
  "learning-intentions": "anthropic",
  "active-learning-activity": "anthropic",
  "image-provocation": "anthropic", // scene description only; rendering is a separate image adapter
  consolidation: "anthropic",
  "growth-insight": "anthropic",
  vocabulary: "anthropic",
  "group-activity": "anthropic",
  "rubric-project": "anthropic",
};

function getTextAdapter(task: GenerationTask): TextGenerationAdapter {
  const providerKey = TEXT_TASK_PROVIDER[task];
  const apiKey = process.env.ANTHROPIC_API_KEY;

  switch (providerKey) {
    case "anthropic":
      return apiKey ? new AnthropicTextAdapter(apiKey) : new MockTextAdapter();
    default:
      throw new Error(`No text adapter configured for provider "${providerKey}"`);
  }
}

const imageAdapter = new TemplateSvgImageAdapter();

export class GenerationValidationError extends Error {
  constructor(public task: GenerationTask, public rawResponse: string, public issues: string) {
    super(`Validation failed for task "${task}": ${issues}`);
  }
}

/**
 * Finds the JSON object's real closing brace by scanning depth, rather than
 * lastIndexOf('}') -- which would grab past the real end if the model adds
 * any trailing prose that itself contains a '}' (e.g. in a code sample or a
 * stray remark), discarding an otherwise-valid response.
 */
function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response");
  const end = findMatchingBrace(cleaned, start);
  if (end === -1) throw new Error("No matching closing brace found in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export interface GroundedResult<T> {
  data: T;
  sourceTag: GroundedPrompt["sourceTag"];
  provider: string;
}

/**
 * Cheap, dependency-free readability check (docs/architecture.md sec. 9.3):
 * every generation prompt already *asks* for "Grade 3" / "age-appropriate"
 * language, but nothing verified the result -- a schema-valid response could
 * still be a 30-word sentence no 8-year-old could parse. This estimates a
 * Flesch-Kincaid grade level (syllables approximated by vowel-group
 * counting, no NLP library needed) over the response's actual prose fields,
 * and is used to trigger one corrective retry, same pattern as the
 * JSON-shape check below.
 */
const GRADE3_READABILITY_CEILING = 4.5;

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;
  if (w.endsWith("e") && count > 1) count -= 1;
  return Math.max(count, 1);
}

function fleschKincaidGrade(text: string): number | null {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.match(/[A-Za-z']+/g) ?? [];
  if (sentences.length === 0 || words.length === 0) return null;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
}

/** Collects prose (4+ word) string values from a generation result, skipping short labels/enum values like "Yes" or "creative". */
function collectProseStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.trim().split(/\s+/).length >= 4) out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectProseStrings(v, out));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectProseStrings(v, out));
  }
  return out;
}

function isReadableForGrade3(data: unknown): boolean {
  const prose = collectProseStrings(data).join(" ");
  const grade = fleschKincaidGrade(prose);
  return grade === null || grade <= GRADE3_READABILITY_CEILING;
}

/**
 * Runs a grounded prompt through the router, validates the JSON response
 * against the given schema, and retries once with a corrective instruction
 * if validation fails. Never invents a fallback result on failure -- the
 * caller sees a clear error instead of silently-wrong content.
 *
 * Also retries once (independently of the shape check) if the response
 * parses fine but reads above a Grade 3 level -- unlike a shape failure,
 * this never throws: a heuristic miss is a quality issue, not a broken
 * response, so the original schema-valid result is kept if the retry
 * doesn't clearly improve on it.
 */
export async function runGrounded<S extends z.ZodTypeAny>(
  task: GenerationTask,
  prompt: GroundedPrompt,
  schema: S,
): Promise<GroundedResult<z.infer<S>>> {
  const adapter = getTextAdapter(task);

  const attempt = async (systemPrompt: string): Promise<{ raw: string; parsed: z.ZodSafeParseResult<z.infer<S>> }> => {
    const raw = await adapter.generateText(task, systemPrompt, prompt.userPrompt);
    let json: unknown;
    try {
      json = extractJson(raw);
    } catch {
      return { raw, parsed: schema.safeParse(undefined) };
    }
    return { raw, parsed: schema.safeParse(json) };
  };

  let { raw, parsed } = await attempt(prompt.systemPrompt);
  let shapeRetried = false;

  if (!parsed.success) {
    const correctivePrompt = `${prompt.systemPrompt}\n\nYour previous response did not match the required JSON shape or was not valid JSON. Respond again with ONLY the corrected JSON object.`;
    ({ raw, parsed } = await attempt(correctivePrompt));
    shapeRetried = true;
  }

  if (!parsed.success) {
    throw new GenerationValidationError(task, raw, parsed.error.message);
  }

  if (!shapeRetried && !isReadableForGrade3(parsed.data)) {
    const correctivePrompt = `${prompt.systemPrompt}\n\nYour previous response was too complex for an 8-year-old (Grade 3) reader. Rewrite it with shorter sentences (under 10 words where possible) and simpler, more common words. Respond again with ONLY the corrected JSON object.`;
    const retry = await attempt(correctivePrompt);
    if (retry.parsed.success) {
      raw = retry.raw;
      parsed = retry.parsed;
    }
  }

  return { data: parsed.data, sourceTag: prompt.sourceTag, provider: adapter.name };
}

export async function renderImage(sceneDescription: string, visualElements: string[]): Promise<string> {
  return imageAdapter.generateImage(sceneDescription, visualElements);
}
