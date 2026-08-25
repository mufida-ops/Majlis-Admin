import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import { normalizeImageForWeb } from '@/lib/normalizeImageForWeb';
import type { MessageRow, ThreadRow } from '@/types/db';

const MESSAGE_IMAGE_BUCKET = 'message-images';
const MESSAGE_AUDIO_BUCKET = 'message-audio';

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

export async function postMessage(input: {
  workspace_id: string;
  thread_id: string;
  author_user_id: string;
  body: string;
  image_path?: string | null;
  audio_path?: string | null;
  audio_duration_seconds?: number | null;
}) {
  const supabase = requireSupabase();
  const result = await supabase.from('messages').insert(input).select('*').single();
  return unwrap(result) as MessageRow;
}

export async function deleteMessage(id: string) {
  const supabase = requireSupabase();
  const result = await supabase.from('messages').delete().eq('id', id);
  unwrap(result);
}

/** Uploads a photo picked for a message and returns its storage path (not yet attached to any message). */
export async function uploadMessageImage(
  threadId: string,
  file: { uri: string; name: string; mimeType: string }
): Promise<string> {
  const supabase = requireSupabase();
  const normalized = await normalizeImageForWeb(file.uri, file.mimeType);
  const ext = normalized.mimeType === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'jpg');
  const path = `${threadId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const response = await fetch(normalized.uri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from(MESSAGE_IMAGE_BUCKET).upload(path, blob, { contentType: normalized.mimeType });
  if (error) throw new Error(error.message);
  return path;
}

/** Signed URL for viewing a message photo — the bucket is private, so this is the only way to view one. */
export async function getMessageImageUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage.from(MESSAGE_IMAGE_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Uploads a recorded voice clip for a message and returns its storage path (not yet attached to any message). */
export async function uploadMessageAudio(threadId: string, file: { uri: string; mimeType: string }): Promise<string> {
  const supabase = requireSupabase();
  const ext = file.mimeType.includes('mp4') || file.mimeType.includes('m4a') ? 'm4a' : 'webm';
  const path = `${threadId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const response = await fetch(file.uri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from(MESSAGE_AUDIO_BUCKET).upload(path, blob, { contentType: file.mimeType });
  if (error) throw new Error(error.message);
  return path;
}

/** Signed URL for playing a voice message — the bucket is private, so this is the only way to play one. */
export async function getMessageAudioUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage.from(MESSAGE_AUDIO_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
