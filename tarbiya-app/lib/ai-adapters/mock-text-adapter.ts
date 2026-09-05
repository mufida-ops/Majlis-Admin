import type { TextGenerationAdapter } from "@/lib/ai-adapters/types";
import type { GenerationTask } from "@/lib/grounding-engine";
import { activeLearningModes, fourDDimensions } from "@/lib/schemas";

/**
 * Dev-mode fallback so the full pipeline (grounding engine -> router ->
 * validation -> UI) can be exercised end-to-end without a live provider key.
 * Used automatically when ANTHROPIC_API_KEY is unset -- see ai-router.ts.
 * Never used when a real key is configured.
 *
 * Deliberately lesson-agnostic: it derives a short topic snippet from
 * whatever grounding text the caller actually sent, instead of hardcoding
 * one lesson's content. An earlier version returned fixed Surat al-Humazah
 * text for every lesson, which meant selecting e.g. "Belief in Angels" in
 * dev mode showed a quiz about backbiting -- exactly the kind of
 * lesson/content mismatch the Safety/Grounding Engine exists to prevent, even
 * though this is only placeholder filler. Every string below is explicitly
 * marked "(mock)" so it's never mistaken for reviewed content.
 */
export class MockTextAdapter implements TextGenerationAdapter {
  name = "mock";

  async generateText(task: GenerationTask, _systemPrompt: string, userPrompt: string): Promise<string> {
    const topic = extractTopic(userPrompt);

    switch (task) {
      case "discussion-prompt":
        return JSON.stringify({
          prompt: `(mock) Before we start today's lesson on "${topic}" -- what do you already think you know about it?`,
          followUpQuestions: [
            "(mock) Where might you have heard about this before?",
            "(mock) How do you think this connects to being a good Muslim?",
            "(mock) What questions do you have about it?",
          ],
        });
      case "assessment-quiz": {
        const match = userPrompt.match(/exactly (\d+) simple/);
        const n = match ? Number(match[1]) : 6;
        return JSON.stringify({
          questions: Array.from({ length: n }, (_, i) => ({
            q: `(mock) Question ${i + 1}: does today's approved content relate to "${topic}"?`,
            answer: i % 2 === 0 ? "Yes" : "No",
            dimension: fourDDimensions[i % fourDDimensions.length],
          })),
        });
      }
      case "learning-intentions":
        return JSON.stringify({
          understanding: `(mock) I understand the key idea behind "${topic}".`,
          application: `(mock) I can apply what "${topic}" teaches in how I treat others.`,
          referencingText: `(mock) I can refer back to the approved source when explaining "${topic}".`,
          connectionToRealLife: `(mock) I can connect "${topic}" to something in my own daily life.`,
          successCriteria: [
            `(mock) I can explain "${topic}" in my own words.`,
            "(mock) I can give one real-life example related to this lesson.",
            "(mock) I can say why this matters to a Muslim.",
          ],
        });
      case "active-learning-activity": {
        const modeMatch = activeLearningModes.find((m) => userPrompt.includes(`"${m}"`));
        return JSON.stringify({
          mode: modeMatch ?? "discussion",
          title: `(mock) Exploring "${topic}"`,
          instructions: `(mock) In small groups, students discuss how "${topic}" applies to a situation from their own school day, then share one idea with the class.`,
          materials: ["(mock) Discussion cards"],
        });
      }
      case "consolidation":
        return JSON.stringify({
          summary: `(mock) Today we learned about "${topic}" and how it shapes a Muslim's character and worship.`,
          discussionPrompt: `(mock) What is one thing you'll remember about "${topic}" tomorrow?`,
        });
      case "image-provocation":
        return JSON.stringify({
          sceneDescription: `(mock) A warm, age-appropriate classroom scene evoking "${topic}", without any figurative depiction of prophets, angels, or companions.`,
          visualElements: ["(mock) soft warm color palette", "(mock) geometric Islamic star border", "(mock) classroom setting"],
        });
      case "growth-insight":
        return JSON.stringify({
          narrative: `(mock) Based on the numbers given, most students improved on this lesson's core idea, but applying "${topic}" to real-life situations remains the area to reinforce next lesson.`,
          strongestDimension: "depthOfUnderstanding",
          weakestDimension: "demonstrationOfPractice",
        });
      case "vocabulary":
        return JSON.stringify({
          words: [
            { term: "(mock) Key term", definition: `(mock) A simple word related to "${topic}" that a Grade 3 student should know.` },
            { term: "(mock) Second term", definition: `(mock) Another simple word tied to "${topic}".` },
          ],
        });
      case "group-activity":
        return JSON.stringify({
          taskPrompt: `(mock) In your group, list examples related to "${topic}".`,
          columnHeaders: ["(mock) Example", "(mock) Why it matters"],
          rowCount: 5,
        });
      case "rubric-project":
        return JSON.stringify({
          taskPrompt: `(mock) Create something at home that shows what you learned about "${topic}".`,
          levels: [
            { level: "approaching", descriptors: [`(mock) I can describe "${topic}" with help.`] },
            { level: "developing", descriptors: [`(mock) I can describe "${topic}" on my own.`] },
            { level: "achieving", descriptors: [`(mock) I can explain "${topic}" and give an example.`] },
            { level: "mastering", descriptors: [`(mock) I can explain "${topic}", give an example, and teach someone else.`] },
          ],
        });
      default:
        throw new Error(`Mock adapter has no canned response for task: ${task}`);
    }
  }
}

function extractTopic(userPrompt: string): string {
  const match = userPrompt.match(/APPROVED CONTENT \(Layer 2[^)]*\):\n([^\n]+)/);
  const text = match?.[1]?.trim() || "this lesson";
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return firstSentence.length > 140 ? `${firstSentence.slice(0, 140)}…` : firstSentence;
}
