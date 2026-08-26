import { z } from "zod";

export const fourDDimensions = [
  "depthOfUnderstanding",
  "demonstrationOfPractice",
  "degreeOfReflection",
  "directionOfGrowth",
] as const;

export type FourDDimension = (typeof fourDDimensions)[number];

export const discussionPromptSchema = z.object({
  prompt: z.string().min(1),
  followUpQuestions: z.array(z.string()).min(1).max(4),
});
export type DiscussionPromptResult = z.infer<typeof discussionPromptSchema>;

export const quizQuestionSchema = z.object({
  q: z.string().min(1),
  answer: z.enum(["Yes", "No"]),
  dimension: z.enum(fourDDimensions),
});

export const quizSchema = z.object({
  questions: z.array(quizQuestionSchema).min(3).max(10),
});
export type QuizResult = z.infer<typeof quizSchema>;

export const learningIntentionsSchema = z.object({
  understanding: z.string().min(1),
  application: z.string().min(1),
  referencingText: z.string().min(1),
  connectionToRealLife: z.string().min(1),
  successCriteria: z.array(z.string()).min(2).max(6),
});
export type LearningIntentionsResult = z.infer<typeof learningIntentionsSchema>;

export const activeLearningModes = [
  "discussion",
  "collaborative",
  "movement",
  "creative",
  "inquiry",
] as const;
export type ActiveLearningMode = (typeof activeLearningModes)[number];

export const activeLearningSchema = z.object({
  mode: z.enum(activeLearningModes),
  title: z.string().min(1),
  instructions: z.string().min(1),
  materials: z.array(z.string()).default([]),
});
export type ActiveLearningResult = z.infer<typeof activeLearningSchema>;

export const consolidationSchema = z.object({
  summary: z.string().min(1),
  discussionPrompt: z.string().min(1),
});
export type ConsolidationResult = z.infer<typeof consolidationSchema>;

export const imageProvocationSchema = z.object({
  sceneDescription: z.string().min(1),
  visualElements: z.array(z.string()).min(2).max(6),
});
export type ImageProvocationResult = z.infer<typeof imageProvocationSchema>;

export const insightSchema = z.object({
  narrative: z.string().min(1),
  strongestDimension: z.enum(fourDDimensions),
  weakestDimension: z.enum(fourDDimensions),
});
export type InsightResult = z.infer<typeof insightSchema>;
