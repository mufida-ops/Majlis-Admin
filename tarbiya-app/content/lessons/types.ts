/**
 * Content Architecture (see docs/architecture.md):
 *   Layer 1 - raw source: quotable, never paraphrased or reinterpreted.
 *   Layer 2 - approved pedagogical content: human-prepared summary anchored to
 *             the MOE-certified textbook. This is what the AI is grounded in
 *             for generation.
 *   Layer 3 - curriculum alignment tags.
 *
 * Layer 2's `grounding` text is a short, human-preparable summary, not a
 * verbatim reproduction of the copyrighted textbook pages -- see licensing
 * note in the brief. It carries reviewStatus so the UI can show it hasn't
 * been reviewer-approved yet.
 */

export type ReviewStatus = "draft" | "approved";

export interface RawSource {
  kind: "quran" | "hadith";
  reference: string;
  /**
   * Included only where the exact Arabic script has been independently
   * verified (short, universally-known verses). Longer or less-common
   * passages were extracted from the source PDF with garbled Arabic
   * glyph encoding, so their Arabic script is deliberately omitted here
   * rather than risk reproducing it incorrectly -- transliteration and
   * translation (both extracted cleanly as plain text) are used instead,
   * pending a human reviewer supplying verified Arabic.
   */
  arabic?: string;
  transliteration?: string;
  translation: string;
}

export interface LessonContent {
  id: string;
  title: string;
  layer1: RawSource;
  layer2: {
    grounding: string;
    reviewStatus: ReviewStatus;
  };
  layer3: {
    grade: number;
    volume: number;
    unit: string;
    unitTitle: string;
    lessonNumber: number;
    sourceRef: string;
  };
}
