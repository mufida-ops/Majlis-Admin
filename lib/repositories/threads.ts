import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import type { MessageRow, ThreadRow } from '@/types/db';

type ThreadAnchor =
  | { project_id: string }
  | { task_id: string }
  | { organisation_id: string }
  | { decision_id: string };

export async function getOrCreateThread(workspaceId: string, anchor: ThreadAnchor): Promise<ThreadRow> {
  const supabase = requireSupabase();
  const [column, value] = Object.entries(anchor)[0] as [string, string];

  const existing = unwrap(
    await supabase.from('threads').select('*').eq('workspace_id', workspaceId).eq(column, value).limit(1)
  ) as ThreadRow[];
  if (existing.length > 0) return existing[0];

  const inserted = await supabase
    .from('threads')
    .insert({ workspace_id: workspaceId, ...anchor })
    .select('*')
    .single();
  return unwrap(inserted) as ThreadRow;
}

export async function listMessages(threadId: string): Promise<MessageRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  return unwrap(result) as MessageRow[];
}

export async function postMessage(input: { workspace_id: string; thread_id: string; author_user_id: string; body: string }) {
  const supabase = requireSupabase();
  const result = await supabase.from('messages').insert(input).select('*').single();
  return unwrap(result) as MessageRow;
}

export async function deleteMessage(id: string) {
  const supabase = requireSupabase();
  const result = await supabase.from('messages').delete().eq('id', id);
  unwrap(result);
}
