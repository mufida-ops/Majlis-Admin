import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import type { DropRow } from '@/types/db';

export async function listDrops(workspaceId: string, opts: { onlyUnprocessed?: boolean } = {}): Promise<DropRow[]> {
  const supabase = requireSupabase();
  let query = supabase.from('drops').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (opts.onlyUnprocessed) query = query.eq('processed', false);
  const result = await query;
  return unwrap(result) as DropRow[];
}

export async function createDrop(input: { workspace_id: string; created_by: string; raw_text: string; urgent: boolean }) {
  const supabase = requireSupabase();
  const result = await supabase.from('drops').insert(input).select('*').single();
  return unwrap(result) as DropRow;
}

export async function markDropProcessed(id: string) {
  const supabase = requireSupabase();
  const result = await supabase.from('drops').update({ processed: true }).eq('id', id).select('*').single();
  return unwrap(result) as DropRow;
}

export async function updateDropText(id: string, rawText: string) {
  const supabase = requireSupabase();
  // Editing the text invalidates any summary/suggestions generated from the
  // old wording, so this resets processed/summary — the caller re-triggers
  // parse-drop right after, same as a fresh save.
  const result = await supabase
    .from('drops')
    .update({ raw_text: rawText, processed: false, summary: null })
    .eq('id', id)
    .select('*')
    .single();
  return unwrap(result) as DropRow;
}

export async function deleteDrop(id: string) {
  const supabase = requireSupabase();
  const result = await supabase.from('drops').delete().eq('id', id);
  unwrap(result);
}
