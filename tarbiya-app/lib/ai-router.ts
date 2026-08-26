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
 * Runs a grounded prompt through the router, validates the JSON response
 * against the given schema, and retries once with a corrective instruction
 * if validation fails. Never invents a fallback result on failure -- the
 * caller sees a clear error instead of silently-wrong content.
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

  if (!parsed.success) {
    const correctivePrompt = `${prompt.systemPrompt}\n\nYour previous response did not match the required JSON shape or was not valid JSON. Respond again with ONLY the corrected JSON object.`;
    ({ raw, parsed } = await attempt(correctivePrompt));
  }

  if (!parsed.success) {
    throw new GenerationValidationError(task, raw, parsed.error.message);
  }

  return { data: parsed.data, sourceTag: prompt.sourceTag, provider: adapter.name };
}

export async function renderImage(sceneDescription: string, visualElements: string[]): Promise<string> {
  return imageAdapter.generateImage(sceneDescription, visualElements);
}
