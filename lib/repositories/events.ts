import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import type { EventRow, OwnerType } from '@/types/db';

export async function listEvents(workspaceId: string): Promise<EventRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('start_at', { ascending: true });
  return unwrap(result) as EventRow[];
}

export async function createEvent(input: {
  workspace_id: string;
  title: string;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  all_day?: boolean;
  owner: OwnerType;
  created_by: string;
}) {
  const supabase = requireSupabase();
  const result = await supabase.from('events').insert(input).select('*').single();
  return unwrap(result) as EventRow;
}

export async function updateEvent(
  id: string,
  patch: Partial<Pick<EventRow, 'title' | 'description' | 'start_at' | 'end_at' | 'all_day' | 'owner'>>
) {
  const supabase = requireSupabase();
  const result = await supabase
    .from('events')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  return unwrap(result) as EventRow;
}

export async function deleteEvent(id: string) {
  const supabase = requireSupabase();
  const result = await supabase.from('events').delete().eq('id', id);
  unwrap(result);
}
