import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import { BOOK_TASK_TEMPLATE } from '@/lib/bookTemplate';
import type { ProjectRow, ProjectStatus, TaskDependencyRow, ProjectTaskRow, TaskStatus, PriorityLevel } from '@/types/db';

export type ProjectWithTasks = ProjectRow & { project_tasks: ProjectTaskRow[] };

export async function listProjects(workspaceId: string): Promise<ProjectWithTasks[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('projects')
    .select('*, project_tasks(*)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  return unwrap(result) as unknown as ProjectWithTasks[];
}

export async function getProject(id: string): Promise<ProjectWithTasks> {
  const supabase = requireSupabase();
  const result = await supabase.from('projects').select('*, project_tasks(*)').eq('id', id).single();
  return unwrap(result) as unknown as ProjectWithTasks;
}

export async function createProject(input: {
  workspace_id: string;
  title: string;
  status?: ProjectStatus;
  priority?: PriorityLevel;
  next_action?: string;
  created_by: string;
}) {
  const supabase = requireSupabase();
  // Set explicitly rather than relying on the DB column default, since
  // that default still says 'Active' from before this project's lifecycle
  // grew a 4th step (Not Started) — changing an enum's DEFAULT in the same
  // migration that adds the new enum value hits Postgres's "unsafe use of
  // new value" restriction, so this is set here instead.
  const result = await supabase
    .from('projects')
    .insert({ status: 'Not Started', ...input })
    .select('*')
    .single();
  return unwrap(result) as ProjectRow;
}

// Creates a project pre-loaded with the standard book-production checklist
// (see lib/bookTemplate.ts) instead of an empty task list.
export async function createBookProject(input: { workspace_id: string; title: string; created_by: string }) {
  const project = await createProject({ workspace_id: input.workspace_id, title: input.title, created_by: input.created_by });
  const supabase = requireSupabase();
  const result = await supabase.from('project_tasks').insert(
    BOOK_TASK_TEMPLATE.map(({ section, title }) => ({
      workspace_id: input.workspace_id,
      project_id: project.id,
      title,
      section,
      created_by: input.created_by
    }))
  );
  unwrap(result);
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<ProjectRow, 'title' | 'status' | 'priority' | 'next_action' | 'due_at' | 'needs_review' | 'completed_at'>>
) {
  // progress is intentionally not editable here: it's derived server-side
  // (see recalc_project_progress in supabase/schema.sql) from the sum of
  // Done tasks' weight, so it can never drift from the actual task list.
  const supabase = requireSupabase();
  const result = await supabase
    .from('projects')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  return unwrap(result) as ProjectRow;
}

export async function getTask(id: string): Promise<ProjectTaskRow> {
  const supabase = requireSupabase();
  const result = await supabase.from('project_tasks').select('*').eq('id', id).single();
  return unwrap(result) as ProjectTaskRow;
}

export async function deleteProject(id: string) {
  const supabase = requireSupabase();
  const result = await supabase.from('projects').delete().eq('id', id);
  unwrap(result);
}

export async function createTask(input: {
  workspace_id: string;
  project_id: string;
  title: string;
  owner_user_id?: string | null;
  weight?: number;
  priority?: PriorityLevel;
  start_at?: string | null;
  due_at?: string | null;
  created_by: string;
}) {
  const supabase = requireSupabase();
  const result = await supabase.from('project_tasks').insert(input).select('*').single();
  return unwrap(result) as ProjectTaskRow;
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<ProjectTaskRow, 'title' | 'status' | 'owner_user_id' | 'weight' | 'priority' | 'start_at' | 'due_at' | 'needs_review'>>
) {
  const supabase = requireSupabase();
  const result = await supabase
    .from('project_tasks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  return unwrap(result) as ProjectTaskRow;
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  return updateTask(id, { status });
}

export async function deleteTask(id: string) {
  const supabase = requireSupabase();
  const result = await supabase.from('project_tasks').delete().eq('id', id);
  unwrap(result);
}

// completed_at is set the moment a project reaches Complete, and cleared if
// it's ever moved back off Complete — so "date done" reflects when it
// actually finished, not the last time any field on it changed.
export async function setProjectStatus(id: string, status: ProjectStatus) {
  return updateProject(id, { status, completed_at: status === 'Complete' ? new Date().toISOString() : null });
}

export async function addTaskDependency(taskId: string, dependsOnTaskId: string) {
  const supabase = requireSupabase();
  const result = await supabase
    .from('task_dependencies')
    .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId })
    .select('*')
    .single();
  return unwrap(result) as TaskDependencyRow;
}
