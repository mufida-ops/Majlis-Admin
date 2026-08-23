import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import type { ActivityEventRow } from '@/types/db';

export async function listActivitySince(workspaceId: string, sinceIso: string | null): Promise<ActivityEventRow[]> {
  const supabase = requireSupabase();
  let query = supabase
    .from('activity_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (sinceIso) query = query.gt('created_at', sinceIso);
  const result = await query;
  return unwrap(result) as ActivityEventRow[];
}

export async function listActivityForOrganisation(organisationId: string): Promise<ActivityEventRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('activity_events')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .limit(50);
  return unwrap(result) as ActivityEventRow[];
}

// A task's own status-change history — when it moved to Started, Ongoing,
// etc, and when — logged automatically by log_task_activity's trigger, not
// anything the client has to write itself.
export async function listActivityForTask(taskId: string): Promise<ActivityEventRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('activity_events')
    .select('*')
    .eq('entity_type', 'task')
    .eq('entity_id', taskId)
    .order('created_at', { ascending: false })
    .limit(50);
  return unwrap(result) as ActivityEventRow[];
}

export async function listRecentActivity(workspaceId: string, limit = 20): Promise<ActivityEventRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('activity_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return unwrap(result) as ActivityEventRow[];
}
