import type { QuizResult } from "@/lib/schemas";
import type { AssessmentResults } from "@/lib/db";
import { fourDDimensions, type FourDDimension } from "@/lib/schemas";

export interface DimensionBreakdown {
  beforePct: number;
  afterPct: number;
}

/**
 * Aggregates per-question correct counts into per-4D-dimension percentages,
 * and an overall before/after percentage -- the numbers behind the
 * "Before: 42% -> After: 81%" view (brief section 6). Pure function so it's
 * easy to unit test independent of the AI call that turns it into prose.
 */
export function computeDimensionBreakdown(
  quiz: QuizResult,
  classSize: number,
  pre: AssessmentResults,
  post: AssessmentResults,
): { overall: { beforePct: number; afterPct: number }; byDimension: Record<FourDDimension, DimensionBreakdown> } {
  const byDimension = {} as Record<FourDDimension, { preCorrect: number; postCorrect: number; count: number }>;
  for (const dim of fourDDimensions) byDimension[dim] = { preCorrect: 0, postCorrect: 0, count: 0 };

  quiz.questions.forEach((question, i) => {
    const bucket = byDimension[question.dimension];
    bucket.count += 1;
    bucket.preCorrect += pre.correctCounts[i] ?? 0;
    bucket.postCorrect += post.correctCounts[i] ?? 0;
  });

  const pct = (correct: number, questionCount: number) =>
    questionCount === 0 || classSize === 0 ? 0 : Math.round((correct / (questionCount * classSize)) * 100);

  const result = {} as Record<FourDDimension, DimensionBreakdown>;
  for (const dim of fourDDimensions) {
    const b = byDimension[dim];
    result[dim] = { beforePct: pct(b.preCorrect, b.count), afterPct: pct(b.postCorrect, b.count) };
  }

  const totalPreCorrect = pre.correctCounts.reduce((a, b) => a + b, 0);
  const totalPostCorrect = post.correctCounts.reduce((a, b) => a + b, 0);
  const totalQuestions = quiz.questions.length;

  return {
    overall: {
      beforePct: pct(totalPreCorrect, totalQuestions),
      afterPct: pct(totalPostCorrect, totalQuestions),
    },
    byDimension: result,
  };
}
