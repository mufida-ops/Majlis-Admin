import { supabase } from '@/lib/supabase';
import type { ContentItem, MediaAsset } from '@/types/db';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export interface SearchResults {
  contentItems: ContentItem[];
  mediaAssets: MediaAsset[];
}

/** Searches title, campaign name, tags, captions and filenames (Section 29). */
export async function globalSearch(query: string): Promise<SearchResults> {
  const client = db();
  const q = query.trim();
  if (!q) return { contentItems: [], mediaAssets: [] };

  const [byTitle, byCaption, byTag, byFile] = await Promise.all([
    client.from('content_items').select('*').ilike('title', `%${q}%`).is('deleted_at', null).limit(25),
    client.from('platform_posts').select('content_item_id').ilike('caption', `%${q}%`).limit(25),
    client.from('tags').select('id, content_tags(content_item_id)').ilike('name', `%${q}%`),
    client.from('media_versions').select('media_asset_id').ilike('file_name', `%${q}%`).limit(25)
  ]);

  const ids = new Set<string>((byTitle.data ?? []).map((r: any) => r.id));
  for (const r of byCaption.data ?? []) ids.add((r as any).content_item_id);
  for (const t of (byTag.data ?? []) as any[]) {
    for (const ct of t.content_tags ?? []) ids.add(ct.content_item_id);
  }

  let contentItems: ContentItem[] = (byTitle.data ?? []) as ContentItem[];
  const missing = Array.from(ids).filter((id) => !contentItems.some((c) => c.id === id));
  if (missing.length > 0) {
    const { data } = await client.from('content_items').select('*').in('id', missing).is('deleted_at', null);
    contentItems = contentItems.concat((data ?? []) as ContentItem[]);
  }

  const assetIds = (byFile.data ?? []).map((r: any) => r.media_asset_id);
  const { data: byAssetTitle } = await client.from('media_assets').select('*').ilike('title', `%${q}%`).limit(25);
  let mediaAssets: MediaAsset[] = (byAssetTitle ?? []) as MediaAsset[];
  if (assetIds.length > 0) {
    const { data } = await client.from('media_assets').select('*').in('id', assetIds);
    for (const a of (data ?? []) as MediaAsset[]) {
      if (!mediaAssets.some((m) => m.id === a.id)) mediaAssets.push(a);
    }
  }

  return { contentItems, mediaAssets };
}
