import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
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
  priority?: PriorityLevel;
  next_action?: string;
  created_by: string;
}) {
  const supabase = requireSupabase();
  const result = await supabase.from('projects').insert(input).select('*').single();
  return unwrap(result) as ProjectRow;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<ProjectRow, 'title' | 'status' | 'priority' | 'next_action'>>
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
  patch: Partial<Pick<ProjectTaskRow, 'title' | 'status' | 'owner_user_id' | 'weight' | 'priority' | 'start_at' | 'due_at'>>
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

export async function setProjectStatus(id: string, status: ProjectStatus) {
  return updateProject(id, { status });
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
