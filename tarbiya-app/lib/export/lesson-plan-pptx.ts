import pptxgen from "pptxgenjs";
import type { LessonContent } from "@/content/lessons/types";
import type { LessonSession } from "@/lib/db";
import { fourDDimensions } from "@/lib/schemas";
import { colors } from "@/lib/theme";

// pptxgenjs wants hex colors without the leading '#'.
const hex = (c: string) => c.replace("#", "");
const INK = hex(colors.ink);
const GOLD = hex(colors.gold);
const PAPER = hex(colors.paper);
const ON_INK = hex(colors.onInk);
const ON_INK_MUTED = hex(colors.onInkMuted);
const RUST_BG_SOFT = hex(colors.rustBgSoft);
const TEXT_PRIMARY = hex(colors.textPrimary);

const dimensionLabels: Record<string, string> = {
  depthOfUnderstanding: "Depth of Understanding",
  demonstrationOfPractice: "Demonstration of Practice",
  degreeOfReflection: "Degree of Reflection",
  directionOfGrowth: "Direction of Growth",
};

/**
 * Builds a presentation deck, one slide per Learning-Journey step, from a
 * completed (or in-progress) lesson session -- the "accompanying
 * presentation" a teacher can actually project in class. Text-only for now:
 * embedding the Connection step's generated illustration would need
 * rasterizing its SVG first (pptx viewers don't reliably render inline SVG),
 * which isn't built yet -- see the scene description on slide 2 instead.
 * Only formats what's already been generated, same as the Word export.
 */
export async function buildLessonPlanPptx(lesson: LessonContent, session: LessonSession): Promise<Buffer> {
  const pres = new pptxgen();
  pres.defineLayout({ name: "TARBIYA_16x9", width: 10, height: 5.63 });
  pres.layout = "TARBIYA_16x9";

  const titleSlide = pres.addSlide();
  titleSlide.background = { color: INK };
  titleSlide.addText(`${lesson.layer3.unit}: ${lesson.layer3.unitTitle}`, {
    x: 0.5, y: 1.6, w: 9, h: 0.5, fontSize: 14, color: ON_INK_MUTED, fontFace: "Arial",
  });
  titleSlide.addText(lesson.title, { x: 0.5, y: 2.1, w: 9, h: 1, fontSize: 36, bold: true, color: ON_INK, fontFace: "Georgia" });
  titleSlide.addText(`Grade ${lesson.layer3.grade}`, { x: 0.5, y: 3.1, w: 9, h: 0.4, fontSize: 14, color: ON_INK_MUTED, fontFace: "Arial" });
  if (lesson.layer2.reviewStatus === "draft") {
    titleSlide.addText("Grounding pending reviewer approval", {
      x: 0.5, y: 4.9, w: 9, h: 0.4, fontSize: 11, color: RUST_BG_SOFT, fontFace: "Arial", italic: true,
    });
  }

  const addStepSlide = (title: string, bodyLines: string[]) => {
    const slide = pres.addSlide();
    slide.background = { color: PAPER };
    slide.addText(title, { x: 0.5, y: 0.35, w: 9, h: 0.7, fontSize: 26, bold: true, color: INK, fontFace: "Georgia" });
    slide.addShape(pres.ShapeType.line, { x: 0.5, y: 1.05, w: 9, h: 0, line: { color: GOLD, width: 2 } });
    slide.addText(
      bodyLines.map((line) => ({ text: line, options: { breakLine: true, paraSpaceAfter: 10 } })),
      { x: 0.5, y: 1.3, w: 9, h: 3.9, fontSize: 16, color: TEXT_PRIMARY, fontFace: "Arial", valign: "top" },
    );
    return slide;
  };

  addStepSlide(
    "1. Connection",
    session.connection
      ? [session.connection.sceneDescription, "", ...session.connection.visualElements.map((el) => `• ${el}`)]
      : ["Not yet generated for this lesson run."],
  );

  addStepSlide(
    "2. Activating Prior Knowledge",
    session.activatingPriorKnowledge
      ? [session.activatingPriorKnowledge.prompt, "", ...session.activatingPriorKnowledge.followUpQuestions.map((q) => `• ${q}`)]
      : ["Not yet generated for this lesson run."],
  );

  addStepSlide(
    "3. Pre-Assessment",
    session.preAssessment
      ? session.preAssessment.questions.map((q, i) => `${i + 1}. ${q.q} (${q.answer})`)
      : ["Not yet generated for this lesson run."],
  );

  addStepSlide(
    "4. Learning Intentions & Success Criteria",
    session.learningIntentions
      ? [
          `Understanding: ${session.learningIntentions.understanding}`,
          `Application: ${session.learningIntentions.application}`,
          `Referencing to Text: ${session.learningIntentions.referencingText}`,
          `Connection to Real Life: ${session.learningIntentions.connectionToRealLife}`,
        ]
      : ["Not yet generated for this lesson run."],
  );

  addStepSlide(
    "5. Active Learning",
    session.activeLearning
      ? [`${session.activeLearning.title} (${session.activeLearning.mode})`, "", session.activeLearning.instructions]
      : ["Not yet generated for this lesson run."],
  );

  addStepSlide(
    "6. Consolidation",
    session.consolidation
      ? [session.consolidation.summary, "", session.consolidation.discussionPrompt]
      : ["Not yet generated for this lesson run."],
  );

  addStepSlide(
    "7. Post-Assessment Results",
    session.insight
      ? [
          `Before: ${session.insight.beforePct}%  →  After: ${session.insight.afterPct}%`,
          "",
          session.insight.narrative,
          "",
          ...fourDDimensions.map((dim) => {
            const d = session.insight!.dimensionBreakdown[dim];
            return `${dimensionLabels[dim]}: ${d.beforePct}% → ${d.afterPct}%`;
          }),
        ]
      : ["Not yet generated for this lesson run."],
  );

  const closing = pres.addSlide();
  closing.background = { color: INK };
  closing.addText(`Source: ${lesson.layer3.sourceRef}`, { x: 0.5, y: 2.4, w: 9, h: 0.8, fontSize: 13, color: ON_INK_MUTED, fontFace: "Arial" });

  const output = await pres.write({ outputType: "nodebuffer" });
  return output as Buffer;
}
