import { theme } from '@/constants/theme';
import type { ProjectTaskRow, TaskStatus } from '@/types/db';

export const TASK_STATUSES: TaskStatus[] = ['Not Started', 'Started', 'Ongoing', 'Done'];

// Every task counts equally toward its project's progress — no manual
// weight to enter. 100 tasks means each one is worth 1% the moment it's
// marked Done; this is computed fresh from the task list on every render
// rather than trusted from the stored projects.progress column, which can
// otherwise go stale (e.g. left over from before a project's tasks were
// deleted) and show a percentage that contradicts the task list on screen.
export function computeProjectProgress(tasks: Pick<ProjectTaskRow, 'status'>[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter(t => t.status === 'Done').length;
  return Math.round((done / tasks.length) * 100);
}

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  'Not Started': theme.colors.muted,
  Started: theme.colors.navy,
  Ongoing: theme.colors.gold,
  Done: theme.colors.success
};

export function nextTaskStatus(current: TaskStatus): TaskStatus {
  const i = TASK_STATUSES.indexOf(current);
  return TASK_STATUSES[(i + 1) % TASK_STATUSES.length];
}
