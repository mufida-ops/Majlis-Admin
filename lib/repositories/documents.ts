import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import type { DocumentRow } from '@/types/db';

export async function listDocuments(workspaceId: string): Promise<DocumentRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('documents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  return unwrap(result) as DocumentRow[];
}

export async function createDocument(input: { workspace_id: string; name: string; note?: string; created_by: string }): Promise<DocumentRow> {
  const supabase = requireSupabase();
  const result = await supabase.from('documents').insert(input).select('*').single();
  return unwrap(result) as DocumentRow;
}

export async function updateDocument(id: string, patch: Partial<Pick<DocumentRow, 'name' | 'note'>>): Promise<DocumentRow> {
  const supabase = requireSupabase();
  const result = await supabase.from('documents').update(patch).eq('id', id).select('*').single();
  return unwrap(result) as DocumentRow;
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = requireSupabase();
  unwrap(await supabase.from('documents').delete().eq('id', id));
}
