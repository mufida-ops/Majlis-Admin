import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import { normalizeImageForWeb } from '@/lib/normalizeImageForWeb';
import type { DocumentRow } from '@/types/db';

const BUCKET = 'documents';

export async function listDocuments(workspaceId: string): Promise<DocumentRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('documents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  return unwrap(result) as DocumentRow[];
}

export async function addDocumentLink(input: {
  workspace_id: string;
  name: string;
  note?: string;
  url: string;
  created_by: string;
}): Promise<DocumentRow> {
  const supabase = requireSupabase();
  const result = await supabase.from('documents').insert(input).select('*').single();
  return unwrap(result) as DocumentRow;
}

async function uploadDocumentFile(workspaceId: string, file: { uri: string; name: string; mimeType: string }, isImage: boolean) {
  const supabase = requireSupabase();
  const normalized = isImage ? await normalizeImageForWeb(file.uri, file.mimeType) : { uri: file.uri, mimeType: file.mimeType };
  const ext = isImage && normalized.mimeType === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'bin');
  const path = `${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const response = await fetch(normalized.uri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: normalized.mimeType });
  if (error) throw new Error(error.message);
  return path;
}

export async function addDocumentPhoto(
  input: { workspace_id: string; name: string; note?: string; created_by: string },
  file: { uri: string; name: string; mimeType: string }
): Promise<DocumentRow> {
  const supabase = requireSupabase();
  const path = await uploadDocumentFile(input.workspace_id, file, true);
  const result = await supabase
    .from('documents')
    .insert({ workspace_id: input.workspace_id, name: input.name, note: input.note, file_path: path, created_by: input.created_by })
    .select('*')
    .single();
  return unwrap(result) as DocumentRow;
}

/** Attaches an arbitrary document (PDF, etc.). Only image files get the HEIC/web-decode fix; everything else uploads as-is. */
export async function addDocumentFile(
  input: { workspace_id: string; name: string; note?: string; created_by: string },
  file: { uri: string; name: string; mimeType: string }
): Promise<DocumentRow> {
  const supabase = requireSupabase();
  const isImage = file.mimeType.startsWith('image/');
  const path = await uploadDocumentFile(input.workspace_id, file, isImage);
  const result = await supabase
    .from('documents')
    .insert({ workspace_id: input.workspace_id, name: input.name, note: input.note, file_path: path, created_by: input.created_by })
    .select('*')
    .single();
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

export async function getDocumentFileUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
