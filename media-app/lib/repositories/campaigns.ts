import { supabase } from '@/lib/supabase';
import type { Campaign, ContentType, Tag } from '@/types/db';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listCampaigns(includeInactive = false) {
  let q = db().from('campaigns').select('*').order('name', { ascending: true });
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Campaign[];
}

export async function createCampaign(name: string, createdBy: string, description?: string, color?: string) {
  const { data, error } = await db().from('campaigns').insert({ name, description, color, created_by: createdBy }).select('*').single();
  if (error) throw error;
  return data as Campaign;
}

export async function setCampaignActive(id: string, isActive: boolean) {
  const { error } = await db().from('campaigns').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

export async function renameCampaign(id: string, name: string) {
  const { error } = await db().from('campaigns').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function listTags() {
  const { data, error } = await db().from('tags').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function findOrCreateTag(name: string, createdBy: string): Promise<Tag> {
  const client = db();
  const trimmed = name.trim();
  const { data: existing } = await client.from('tags').select('*').ilike('name', trimmed).maybeSingle();
  if (existing) return existing as Tag;
  const { data, error } = await client.from('tags').insert({ name: trimmed, created_by: createdBy }).select('*').single();
  if (error) throw error;
  return data as Tag;
}

export async function tagContentItem(contentItemId: string, tagId: string) {
  const { error } = await db().from('content_tags').insert({ content_item_id: contentItemId, tag_id: tagId });
  if (error && error.code !== '23505') throw error;
}

export async function untagContentItem(contentItemId: string, tagId: string) {
  const { error } = await db().from('content_tags').delete().eq('content_item_id', contentItemId).eq('tag_id', tagId);
  if (error) throw error;
}

/** Untags every content item/media asset first (cascades in the DB anyway) so removing a widely-used tag is never surprising. */
export async function deleteTag(id: string) {
  const { error } = await db().from('tags').delete().eq('id', id);
  if (error) throw error;
}

export async function renameTag(id: string, name: string) {
  const { error } = await db().from('tags').update({ name: name.trim() }).eq('id', id);
  if (error) throw error;
}

export async function getTagsForContentItem(contentItemId: string) {
  const { data, error } = await db().from('content_tags').select('tag_id, tags(id, name)').eq('content_item_id', contentItemId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.tags as Tag);
}

export async function listContentTypes(includeInactive = false) {
  let q = db().from('content_types').select('*').order('sort_order');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ContentType[];
}

export async function createContentType(key: string, label: string) {
  const { data, error } = await db().from('content_types').insert({ key, label }).select('*').single();
  if (error) throw error;
  return data as ContentType;
}

export async function renameContentType(id: string, label: string) {
  const { error } = await db().from('content_types').update({ label: label.trim() }).eq('id', id);
  if (error) throw error;
}

/** Deactivate rather than delete — existing content items keep pointing at their content_type_id, they just stop being offered for new ones. */
export async function setContentTypeActive(id: string, isActive: boolean) {
  const { error } = await db().from('content_types').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}
