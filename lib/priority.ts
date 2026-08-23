import { theme } from '@/constants/theme';
import type { PriorityLevel } from '@/types/db';

export const PRIORITY_LEVELS: PriorityLevel[] = ['Low', 'Medium', 'High'];

export const PRIORITY_COLOR: Record<PriorityLevel, string> = {
  Low: theme.colors.success,
  Medium: theme.colors.gold,
  High: theme.colors.danger
};
