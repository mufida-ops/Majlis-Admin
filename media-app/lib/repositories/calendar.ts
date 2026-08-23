import { supabase } from '@/lib/supabase';
import type { PlatformName, PublicationStatus } from '@/types/db';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export interface CalendarEntry {
  id: string; // platform_post id
  content_item_id: string;
  platform: PlatformName;
  scheduled_at: string;
  publication_status: PublicationStatus;
  title: string;
  owner_name: string | null;
  campaign_name: string | null;
  content_type: string | null;
}

const SELECT = `id, content_item_id, platform, scheduled_at, publication_status,
  content_item:content_items!platform_posts_content_item_id_fkey(
    title,
    owner:profiles!content_items_owner_id_fkey(full_name),
    campaign:campaigns(name),
    content_type:content_types(label)
  )`;

export async function listCalendarEntries(startIso: string, endIso: string): Promise<CalendarEntry[]> {
  const { data, error } = await db()
    .from('platform_posts')
    .select(SELECT)
    .eq('enabled', true)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    content_item_id: row.content_item_id,
    platform: row.platform,
    scheduled_at: row.scheduled_at,
    publication_status: row.publication_status,
    title: row.content_item?.title ?? 'Untitled',
    owner_name: row.content_item?.owner?.full_name ?? null,
    campaign_name: row.content_item?.campaign?.name ?? null,
    content_type: row.content_item?.content_type?.label ?? null
  }));
}
