import { supabase } from '@/lib/supabase';
import type { ContentPriority, PlatformName, PostType } from '@/types/db';

export interface ProposedPlatform {
  platform: PlatformName;
  enabled: boolean;
  caption: string | null;
  hashtags: string[];
  post_type: PostType | null;
}

export interface ProposedContentItem {
  title: string;
  due_date: string | null;
  priority: ContentPriority;
  content_type: string;
  description: string | null;
  script: string | null;
  campaign: string | null;
  tags: string[];
  notes: string | null;
  platforms: ProposedPlatform[];
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

/** Sends the founder's freeform monthly content dump to parse-content-batch and gets back a proposed list to review. */
export async function parseContentBatch(text: string, todayDate: string): Promise<ProposedContentItem[]> {
  const { data, error } = await db().functions.invoke('parse-content-batch', {
    body: { text, today_date: todayDate }
  });
  if (error) throw new Error(error.message);
  const items = (data as { items?: (ProposedContentItem & { platforms?: Partial<ProposedPlatform>[] })[] })?.items ?? [];
  return items.map(item => ({
    title: item.title,
    due_date: item.due_date ?? null,
    priority: item.priority ?? 'normal',
    content_type: item.content_type ?? 'other',
    description: item.description ?? null,
    script: item.script ?? null,
    campaign: item.campaign ?? null,
    tags: item.tags ?? [],
    notes: item.notes ?? null,
    platforms: (item.platforms ?? [])
      .filter(p => !!p.platform)
      .map(p => ({
        platform: p.platform as PlatformName,
        enabled: p.enabled ?? false,
        caption: p.caption ?? null,
        hashtags: p.hashtags ?? [],
        post_type: p.post_type ?? null
      }))
  }));
}
