import { theme } from '@/constants/theme';
import type { TaskStatus } from '@/types/db';

export const TASK_STATUSES: TaskStatus[] = ['Todo', 'Doing', 'Waiting', 'Done'];

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  Todo: theme.colors.muted,
  Doing: theme.colors.navy,
  Waiting: theme.colors.gold,
  Done: theme.colors.success
};

export function nextTaskStatus(current: TaskStatus): TaskStatus {
  const i = TASK_STATUSES.indexOf(current);
  return TASK_STATUSES[(i + 1) % TASK_STATUSES.length];
}
