import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import type { LessonContent } from "@/content/lessons/types";
import type { LessonSession } from "@/lib/db";
import { fourDDimensions } from "@/lib/schemas";

const dimensionLabels: Record<string, string> = {
  depthOfUnderstanding: "Depth of Understanding",
  demonstrationOfPractice: "Demonstration of Practice",
  degreeOfReflection: "Degree of Reflection",
  directionOfGrowth: "Direction of Growth",
};

function heading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } });
}

function body(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ text, bullet: { level: 0 } });
}

function notGenerated(step: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `Not yet generated for this lesson run -- open Step ${step} in the app first.`, italics: true })],
  });
}

/**
 * Builds a printable Word lesson plan from a completed (or in-progress)
 * lesson session, following the same 7-step structure the app walks a
 * teacher through. Only formats what's already been generated -- it never
 * invents content, same as everything else in the pipeline.
 */
export async function buildLessonPlanDocx(lesson: LessonContent, session: LessonSession): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: lesson.title, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({ text: `Grade ${lesson.layer3.grade} · ${lesson.layer3.unit}: ${lesson.layer3.unitTitle}`, italics: true }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Source: ${lesson.layer3.sourceRef}`, size: 18, color: "666666" })],
    }),
  ];

  if (lesson.layer2.reviewStatus === "draft") {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Grounding content pending human reviewer approval -- verify against the source before classroom use.",
            size: 18,
            color: "9C6B3F",
            bold: true,
          }),
        ],
        spacing: { after: 200 },
      }),
    );
  }

  children.push(heading("1. Connection"));
  if (session.connection) {
    children.push(body(session.connection.sceneDescription));
    children.push(...session.connection.visualElements.map((el) => bullet(el)));
  } else {
    children.push(notGenerated("1"));
  }

  children.push(heading("2. Activating Prior Knowledge"));
  if (session.activatingPriorKnowledge) {
    children.push(body(session.activatingPriorKnowledge.prompt));
    children.push(...session.activatingPriorKnowledge.followUpQuestions.map((q) => bullet(q)));
  } else {
    children.push(notGenerated("2"));
  }

  children.push(heading("3. Pre-Assessment (also used as the Post-Assessment)"));
  if (session.preAssessment) {
    for (const q of session.preAssessment.questions) {
      children.push(body(`${q.q} (${q.answer}) -- ${dimensionLabels[q.dimension]}`));
    }
  } else {
    children.push(notGenerated("3"));
  }

  children.push(heading("4. Learning Intentions & Success Criteria"));
  if (session.learningIntentions) {
    const li = session.learningIntentions;
    children.push(body(`Understanding: ${li.understanding}`));
    children.push(body(`Application: ${li.application}`));
    children.push(body(`Referencing to Text: ${li.referencingText}`));
    children.push(body(`Connection to Real Life: ${li.connectionToRealLife}`));
    children.push(new Paragraph({ text: "Success Criteria:", spacing: { before: 80 } }));
    children.push(...li.successCriteria.map((c) => bullet(c)));
  } else {
    children.push(notGenerated("4"));
  }

  children.push(heading("5. Active Learning"));
  if (session.activeLearning) {
    const al = session.activeLearning;
    children.push(body(`${al.title} (${al.mode})`));
    children.push(body(al.instructions));
    if (al.materials.length > 0) children.push(body(`Materials: ${al.materials.join(", ")}`));
  } else {
    children.push(notGenerated("5"));
  }

  children.push(heading("6. Consolidation"));
  if (session.consolidation) {
    children.push(body(session.consolidation.summary));
    children.push(body(session.consolidation.discussionPrompt));
  } else {
    children.push(notGenerated("6"));
  }

  children.push(heading("7. Post-Assessment Results"));
  if (session.insight) {
    children.push(body(`Before: ${session.insight.beforePct}% → After: ${session.insight.afterPct}%`));
    children.push(new Paragraph({ children: [new TextRun({ text: session.insight.narrative, italics: true })], spacing: { after: 120 } }));
    for (const dim of fourDDimensions) {
      const d = session.insight.dimensionBreakdown[dim];
      children.push(bullet(`${dimensionLabels[dim]}: ${d.beforePct}% → ${d.afterPct}%`));
    }
  } else {
    children.push(notGenerated("7"));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
