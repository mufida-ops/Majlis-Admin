import { theme } from '@/constants/theme';
import type { ProjectTaskRow, TaskStatus } from '@/types/db';

export const TASK_STATUSES: TaskStatus[] = ['Not Started', 'Started', 'Ongoing', 'Done'];

// Display order for grouping task lists — once a task has started it moves
// up above the not-yet-started ones, since that's the work actually moving,
// with Done sinking to the bottom. TASK_STATUSES itself stays in lifecycle
// order (Not Started → … → Done) for the status picker, where that's the
// order that makes sense to pick from.
export const TASK_STATUS_DISPLAY_ORDER: TaskStatus[] = ['Started', 'Ongoing', 'Not Started', 'Done'];

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

// No progression color before a task has actually started — Not Started
// stays neutral grey rather than being judged red. Once it has, amber
// (Started/Ongoing) through to green (Done) reads the same red-less
// progression ladder used for projects.
export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  'Not Started': theme.colors.muted,
  Started: theme.colors.gold,
  Ongoing: theme.colors.gold,
  Done: theme.colors.success
};
