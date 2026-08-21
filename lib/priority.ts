import { theme } from '@/constants/theme';
import type { PriorityLevel } from '@/types/db';

export const PRIORITY_LEVELS: PriorityLevel[] = ['Low', 'Medium', 'High'];

export const PRIORITY_COLOR: Record<PriorityLevel, string> = {
  Low: theme.colors.success,
  Medium: theme.colors.gold,
  High: theme.colors.danger
};

export function nextPriority(current: PriorityLevel): PriorityLevel {
  const i = PRIORITY_LEVELS.indexOf(current);
  return PRIORITY_LEVELS[(i + 1) % PRIORITY_LEVELS.length];
}
