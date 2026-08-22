import { theme } from '@/constants/theme';
import type { ProjectTaskRow, TaskStatus } from '@/types/db';

export const TASK_STATUSES: TaskStatus[] = ['Todo', 'Doing', 'Waiting', 'Done'];

// Computed straight from a project's own task list rather than trusted from
// the stored projects.progress column, which only updates when a task on
// that project changes and so can go stale (e.g. left over from before its
// tasks were deleted) and show a percentage that contradicts the task list
// actually on screen.
export function computeProjectProgress(tasks: Pick<ProjectTaskRow, 'status' | 'weight'>[]): number {
  const total = tasks.filter(t => t.status === 'Done').reduce((sum, t) => sum + (t.weight ?? 0), 0);
  return Math.max(0, Math.min(100, total));
}

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
