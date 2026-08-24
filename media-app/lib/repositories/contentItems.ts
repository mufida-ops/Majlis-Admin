import { supabase } from '@/lib/supabase';
import type { ContentItem, ContentStage } from '@/types/db';

export class ConflictError extends Error {
  constructor() {
    super('This item was updated by another team member. Review the latest version before saving.');
  }
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listContentItems(filters?: { stage?: ContentStage; campaignId?: string }) {
  let q = db().from('content_items').select('*').is('deleted_at', null).order('updated_at', { ascending: false });
  if (filters?.stage) q = q.eq('stage', filters.stage);
  if (filters?.campaignId) q = q.eq('campaign_id', filters.campaignId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentItem[];
}

export interface ContentItemSummary extends ContentItem {
  owner: { full_name: string } | null;
  campaign: { name: string; color: string | null } | null;
  content_type: { label: string; icon: string | null } | null;
  platform_posts: { platform: 'instagram' | 'tiktok' | 'linkedin'; enabled: boolean }[];
}

const SUMMARY_SELECT = `*,
  owner:profiles!content_items_owner_id_fkey(full_name),
  campaign:campaigns(name, color),
  content_type:content_types(label, icon),
  platform_posts(platform, enabled)`;

export async function listContentItemSummaries(filters?: { stage?: ContentStage; campaignId?: string }) {
  let q = db().from('content_items').select(SUMMARY_SELECT).is('deleted_at', null).order('updated_at', { ascending: false });
  if (filters?.stage) q = q.eq('stage', filters.stage);
  if (filters?.campaignId) q = q.eq('campaign_id', filters.campaignId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ContentItemSummary[];
}

export async function getContentItem(id: string) {
  const { data, error } = await db().from('content_items').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data as ContentItem;
}

export async function createContentItem(input: {
  title: string;
  description?: string | null;
  script?: string | null;
  internal_notes?: string | null;
  content_type_id?: string | null;
  campaign_id?: string | null;
  owner_id: string;
  approver_id?: string | null;
  due_date?: string | null;
  priority?: ContentItem['priority'];
  created_by: string;
}) {
  const { data, error } = await db()
    .from('content_items')
    .insert({ stage: 'idea', ...input })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ContentItem;
}

/**
 * Optimistic-concurrency update: the write only applies `WHERE version =
 * expectedVersion`. If another team member saved in between, this matches
 * zero rows and we surface ConflictError instead of silently overwriting
 * their change (Section 12).
 */
export async function updateContentItem(
  id: string,
  expectedVersion: number,
  patch: Partial<Omit<ContentItem, 'id' | 'version' | 'created_at' | 'updated_at'>>
): Promise<ContentItem> {
  const { data, error } = await db()
    .from('content_items')
    .update(patch)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('*');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new ConflictError();
  }
  return data[0] as ContentItem;
}

export async function softDeleteContentItem(id: string, expectedVersion: number) {
  return updateContentItem(id, expectedVersion, { deleted_at: new Date().toISOString() });
}

export async function moveStage(id: string, expectedVersion: number, stage: ContentStage) {
  return updateContentItem(id, expectedVersion, { stage });
}
