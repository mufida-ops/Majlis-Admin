import { supabase } from '@/lib/supabase';
import type { PlatformName, PlatformPost, PlatformPostMedia } from '@/types/db';
import { ConflictError } from './contentItems';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listPlatformPosts(contentItemId: string) {
  const { data, error } = await db().from('platform_posts').select('*').eq('content_item_id', contentItemId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PlatformPost[];
  // Ensure all three platform rows always exist for the UI, even before the first save.
  const byPlatform = new Map(rows.map((r) => [r.platform, r]));
  return byPlatform;
}

export async function ensurePlatformPost(contentItemId: string, platform: PlatformName): Promise<PlatformPost> {
  const client = db();
  const { data: existing } = await client
    .from('platform_posts')
    .select('*')
    .eq('content_item_id', contentItemId)
    .eq('platform', platform)
    .maybeSingle();
  if (existing) return existing as PlatformPost;

  const { data, error } = await client
    .from('platform_posts')
    .insert({ content_item_id: contentItemId, platform })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as PlatformPost;
}

export async function updatePlatformPost(
  id: string,
  expectedVersion: number,
  patch: Partial<Omit<PlatformPost, 'id' | 'version' | 'created_at' | 'updated_at' | 'content_item_id' | 'platform'>>
): Promise<PlatformPost> {
  const { data, error } = await db()
    .from('platform_posts')
    .update(patch)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('*');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new ConflictError();
  return data[0] as PlatformPost;
}

export async function setSelectedMedia(platformPostId: string, mediaVersionIds: string[]) {
  const client = db();
  const { error: delError } = await client.from('platform_post_media').delete().eq('platform_post_id', platformPostId);
  if (delError) throw delError;
  if (mediaVersionIds.length === 0) return;
  const rows = mediaVersionIds.map((id, i) => ({ platform_post_id: platformPostId, media_version_id: id, sort_order: i }));
  const { error } = await client.from('platform_post_media').insert(rows);
  if (error) throw new Error(error.message);
}

export async function getSelectedMedia(platformPostId: string) {
  const { data, error } = await db()
    .from('platform_post_media')
    .select('*')
    .eq('platform_post_id', platformPostId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlatformPostMedia[];
}

export async function reorderCarousel(platformPostId: string, orderedMediaVersionIds: string[]) {
  return setSelectedMedia(platformPostId, orderedMediaVersionIds);
}

export async function getPlatformConnections() {
  const { data, error } = await db().from('platform_connections').select('*');
  if (error) throw new Error(error.message);
  return data ?? [];
}
