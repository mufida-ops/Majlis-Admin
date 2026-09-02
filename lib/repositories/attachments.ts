import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import { normalizeImageForWeb } from '@/lib/normalizeImageForWeb';
import type { AttachmentRow } from '@/types/db';

const BUCKET = 'attachments';

export type AttachmentScope = { project_id: string } | { task_id: string } | { document_id: string };

function scopeColumn(scope: AttachmentScope) {
  if ('project_id' in scope) return { column: 'project_id' as const, value: scope.project_id };
  if ('task_id' in scope) return { column: 'task_id' as const, value: scope.task_id };
  return { column: 'document_id' as const, value: scope.document_id };
}

export async function listAttachments(scope: AttachmentScope): Promise<AttachmentRow[]> {
  const supabase = requireSupabase();
  const { column, value } = scopeColumn(scope);
  const result = await supabase.from('attachments').select('*').eq(column, value).order('created_at', { ascending: true });
  return unwrap(result) as AttachmentRow[];
}

export async function addAttachmentLink(
  scope: AttachmentScope,
  input: { workspace_id: string; url: string; label?: string; created_by: string }
): Promise<AttachmentRow> {
  const supabase = requireSupabase();
  const result = await supabase.from('attachments').insert({ ...scope, ...input }).select('*').single();
  return unwrap(result) as AttachmentRow;
}

async function uploadAttachmentFile(scope: AttachmentScope, file: { uri: string; name: string; mimeType: string }, isImage: boolean) {
  const supabase = requireSupabase();
  const normalized = isImage ? await normalizeImageForWeb(file.uri, file.mimeType) : { uri: file.uri, mimeType: file.mimeType };
  const ext = isImage && normalized.mimeType === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'bin');
  const { column, value } = scopeColumn(scope);
  const path = `${column}/${value}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const response = await fetch(normalized.uri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: normalized.mimeType });
  if (error) throw new Error(error.message);
  return path;
}

export async function addAttachmentPhoto(
  scope: AttachmentScope,
  input: { workspace_id: string; label?: string; created_by: string },
  file: { uri: string; name: string; mimeType: string }
): Promise<AttachmentRow> {
  const supabase = requireSupabase();
  const path = await uploadAttachmentFile(scope, file, true);
  const result = await supabase
    .from('attachments')
    .insert({ ...scope, workspace_id: input.workspace_id, label: input.label, file_path: path, created_by: input.created_by })
    .select('*')
    .single();
  return unwrap(result) as AttachmentRow;
}

/** Attaches an arbitrary document (PDF, etc.) instead of a link. Only image files get the HEIC/web-decode fix; everything else uploads as-is. */
export async function addAttachmentFile(
  scope: AttachmentScope,
  input: { workspace_id: string; label?: string; created_by: string },
  file: { uri: string; name: string; mimeType: string }
): Promise<AttachmentRow> {
  const supabase = requireSupabase();
  const isImage = file.mimeType.startsWith('image/');
  const path = await uploadAttachmentFile(scope, file, isImage);
  const result = await supabase
    .from('attachments')
    .insert({ ...scope, workspace_id: input.workspace_id, label: input.label ?? file.name, file_path: path, created_by: input.created_by })
    .select('*')
    .single();
  return unwrap(result) as AttachmentRow;
}

export async function deleteAttachment(id: string): Promise<void> {
  const supabase = requireSupabase();
  unwrap(await supabase.from('attachments').delete().eq('id', id));
}

export async function getAttachmentFileUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
