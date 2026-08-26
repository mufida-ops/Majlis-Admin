import type { TextGenerationAdapter } from "@/lib/ai-adapters/types";
import type { GenerationTask } from "@/lib/grounding-engine";

/**
 * Real provider adapter. Server-side only -- the API key never reaches the
 * client, and route handlers never call fetch() to the provider directly;
 * they always go through the AI Router, which picks this adapter (or a
 * different one, per task) by config.
 */
export class AnthropicTextAdapter implements TextGenerationAdapter {
  name = "anthropic";

  constructor(private apiKey: string, private model = "claude-sonnet-4-6") {}

  async generateText(_task: GenerationTask, systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic API error (${response.status}): ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    return data.content.map((block: { type: string; text?: string }) => (block.type === "text" ? block.text ?? "" : "")).join("");
  }
}
