import pptxgen from "pptxgenjs";
import type { LessonContent } from "@/content/lessons/types";
import type { LessonSession } from "@/lib/db";
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

const NOT_READY = "Not yet generated for this lesson run.";

/**
 * Builds the deck a teacher actually projects in front of the class -- this
 * is deliberately NOT the lesson plan in slide form. A Grade 3 student can't
 * read a paragraph on a screen, so this show one big idea per slide, drops
 * everything that's teacher-facing-only (follow-up question lists, the four
 * learning-intention paragraphs + success criteria, the 4D percentage/
 * dimension breakdown), and never reveals a pre-assessment answer next to
 * its question -- that's for students to answer live, not read off the
 * screen. All of that teacher-facing detail still lives in the full Word
 * lesson plan (lib/export/lesson-plan-docx.ts); this is the other, much
 * shorter half of the same session data, chosen for a very different reader.
 *
 * Text-only for now: embedding the Connection step's generated illustration
 * would need rasterizing its SVG first (pptx viewers don't reliably render
 * inline SVG), which isn't built yet -- see the scene description instead.
 */
export async function buildLessonPlanPptx(lesson: LessonContent, session: LessonSession): Promise<Buffer> {
  const pres = new pptxgen();
  pres.defineLayout({ name: "TARBIYA_16x9", width: 10, height: 5.63 });
  pres.layout = "TARBIYA_16x9";

  const titleSlide = pres.addSlide();
  titleSlide.background = { color: INK };
  titleSlide.addText(lesson.title, {
    x: 0.5, y: 2.0, w: 9, h: 1.6, fontSize: 44, bold: true, color: ON_INK, fontFace: "Georgia", align: "center", valign: "middle",
  });
  if (lesson.layer2.reviewStatus === "draft") {
    titleSlide.addText("Grounding pending reviewer approval", {
      x: 0.5, y: 4.9, w: 9, h: 0.4, fontSize: 11, color: RUST_BG_SOFT, fontFace: "Arial", italic: true, align: "center",
    });
  }

  /** One big, short idea, centered, in as few words as the content allows -- not a bullet list. */
  const addBigIdeaSlide = (eyebrow: string, lines: string[]) => {
    const slide = pres.addSlide();
    slide.background = { color: PAPER };
    slide.addText(eyebrow, {
      x: 0.5, y: 0.4, w: 9, h: 0.5, fontSize: 15, color: GOLD, fontFace: "Arial", bold: true, align: "center", charSpacing: 2,
    });
    slide.addText(
      lines.map((line) => ({ text: line, options: { breakLine: true, paraSpaceAfter: 18 } })),
      { x: 0.7, y: 1.1, w: 8.6, h: 4.2, fontSize: 28, color: TEXT_PRIMARY, fontFace: "Arial", align: "center", valign: "middle" },
    );
    return slide;
  };

  // 1. Connection -- the hook. Just the scene, no illustrator's checklist.
  addBigIdeaSlide("Let's imagine...", [session.connection?.sceneDescription ?? NOT_READY]);

  // 2. Activating Prior Knowledge -- one question to talk about, not a list
  // of teacher follow-ups.
  addBigIdeaSlide("Think about this", [session.activatingPriorKnowledge?.prompt ?? NOT_READY]);

  // 3. Pre-Assessment -- one question per slide, answer never shown: students
  // answer out loud, they don't read the answer off the screen.
  if (session.preAssessment) {
    session.preAssessment.questions.forEach((q, i) => {
      addBigIdeaSlide(`Question ${i + 1} of ${session.preAssessment!.questions.length}`, [q.q]);
    });
  } else {
    addBigIdeaSlide("Quick Questions", [NOT_READY]);
  }

  // 4. Learning Intentions -- one plain "today we will..." line, not four
  // paragraphs and a success-criteria checklist (that's for the teacher).
  addBigIdeaSlide("Today we will learn", [session.learningIntentions?.understanding ?? NOT_READY]);

  // 5. Active Learning -- the activity's name and its one main instruction.
  addBigIdeaSlide("Let's do it!", [
    session.activeLearning?.title ?? NOT_READY,
    ...(session.activeLearning ? [session.activeLearning.instructions] : []),
  ]);

  // 6. Consolidation -- already short; keep as-is, just bigger.
  addBigIdeaSlide("What we learned", [
    session.consolidation?.summary ?? NOT_READY,
    ...(session.consolidation ? [session.consolidation.discussionPrompt] : []),
  ]);

  // 7. Closing -- a warm plain-language note, no percentages or dimension
  // jargon (those stay in the teacher's Word lesson plan).
  const closing = pres.addSlide();
  closing.background = { color: INK };
  closing.addText(session.insight?.narrative ?? "Great work today!", {
    x: 0.7, y: 1.8, w: 8.6, h: 2, fontSize: 26, color: ON_INK, fontFace: "Georgia", align: "center", valign: "middle",
  });
  closing.addText(`Source: ${lesson.layer3.sourceRef}`, { x: 0.5, y: 5.0, w: 9, h: 0.4, fontSize: 10, color: ON_INK_MUTED, fontFace: "Arial", align: "center" });

  const output = await pres.write({ outputType: "nodebuffer" });
  return output as Buffer;
}
