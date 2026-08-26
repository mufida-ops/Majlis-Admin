import type { GenerationTask } from "@/lib/grounding-engine";

export interface TextGenerationAdapter {
  name: string;
  generateText(task: GenerationTask, systemPrompt: string, userPrompt: string): Promise<string>;
}

export interface ImageGenerationAdapter {
  name: string;
  /** Returns a data URI (svg or raster) the UI can render directly. */
  generateImage(sceneDescription: string, visualElements: string[]): Promise<string>;
}
