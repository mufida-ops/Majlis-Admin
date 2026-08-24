import { supabase } from '@/lib/supabase';
import type { MediaAsset, MediaSection, MediaVersion } from '@/types/db';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

const BUCKET = 'media';

export async function listAssetsForContentItem(contentItemId: string) {
  const { data, error } = await db()
    .from('media_assets')
    .select('*')
    .eq('content_item_id', contentItemId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MediaAsset[];
}

export async function listVersions(assetId: string) {
  const { data, error } = await db()
    .from('media_versions')
    .select('*')
    .eq('media_asset_id', assetId)
    .order('version_number', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MediaVersion[];
}

export async function listVersionsForContentItem(contentItemId: string) {
  const assets = await listAssetsForContentItem(contentItemId);
  if (assets.length === 0) return [];
  const { data, error } = await db()
    .from('media_versions')
    .select('*')
    .in('media_asset_id', assets.map((a) => a.id))
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MediaVersion[];
}

/** Signed URL for playback/preview — the bucket is private, so this is the only way to view a file. */
export async function getMediaUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

function guessKind(mimeType: string): MediaAsset['kind'] {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'other';
}

/**
 * Uploads a new version. If `assetId` is omitted, creates a new media_assets
 * row first (a brand-new slot); otherwise appends the next version_number
 * onto the existing asset — the old version stays exactly as it was
 * (Section 10: never silently replace).
 */
export async function uploadMediaVersion(input: {
  contentItemId: string | null;
  assetId?: string;
  assetTitle: string;
  section: MediaSection;
  isBankItem?: boolean;
  file: { uri: string; name: string; mimeType: string; size?: number };
  uploadedBy: string;
  versionLabel?: string;
  uploadComment?: string;
}): Promise<{ asset: MediaAsset; version: MediaVersion }> {
  const client = db();
  let asset: MediaAsset;

  if (input.assetId) {
    const { data, error } = await client.from('media_assets').select('*').eq('id', input.assetId).single();
    if (error) throw error;
    asset = data as MediaAsset;
  } else {
    const { data, error } = await client
      .from('media_assets')
      .insert({
        content_item_id: input.contentItemId,
        section: input.section,
        title: input.assetTitle,
        kind: guessKind(input.file.mimeType),
        is_bank_item: input.isBankItem ?? !input.contentItemId,
        created_by: input.uploadedBy
      })
      .select('*')
      .single();
    if (error) throw error;
    asset = data as MediaAsset;
  }

  const existing = await listVersions(asset.id);
  const nextVersionNumber = existing.length > 0 ? existing[0].version_number + 1 : 1;
  const label = input.versionLabel ?? `V${nextVersionNumber}`;
  const ext = input.file.name.split('.').pop() ?? 'bin';
  const path = `content/${input.contentItemId ?? 'bank'}/${asset.id}/v${nextVersionNumber}-${Date.now()}.${ext}`;

  const response = await fetch(input.file.uri);
  const blob = await response.blob();

  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, blob, {
    contentType: input.file.mimeType,
    upsert: false
  });
  if (uploadError) throw uploadError;

  const { data: versionRow, error: versionError } = await client
    .from('media_versions')
    .insert({
      media_asset_id: asset.id,
      version_number: nextVersionNumber,
      version_label: label,
      storage_bucket: BUCKET,
      storage_path: path,
      file_name: input.file.name,
      mime_type: input.file.mimeType,
      file_size_bytes: input.file.size ?? null,
      uploaded_by: input.uploadedBy,
      upload_comment: input.uploadComment ?? null
    })
    .select('*')
    .single();
  if (versionError) throw versionError;

  return { asset, version: versionRow as MediaVersion };
}

/** Bulk-resolves one representative thumbnail per content item (final > draft/graphic > raw > other), two queries total regardless of list size. */
export async function latestMediaThumbnails(contentItemIds: string[]): Promise<Map<string, { storagePath: string; kind: MediaAsset['kind'] }>> {
  const result = new Map<string, { storagePath: string; kind: MediaAsset['kind'] }>();
  if (contentItemIds.length === 0) return result;
  const client = db();
  const { data: assets, error: assetsError } = await client
    .from('media_assets')
    .select('id, content_item_id, section, kind')
    .in('content_item_id', contentItemIds);
  if (assetsError) throw assetsError;
  const assetIds = (assets ?? []).map((a) => a.id);
  if (assetIds.length === 0) return result;

  const { data: versions, error: versionsError } = await client
    .from('media_versions')
    .select('media_asset_id, storage_path, uploaded_at')
    .in('media_asset_id', assetIds)
    .order('uploaded_at', { ascending: false });
  if (versionsError) throw versionsError;

  const latestByAsset = new Map<string, { storage_path: string }>();
  for (const v of versions ?? []) {
    if (!latestByAsset.has(v.media_asset_id)) latestByAsset.set(v.media_asset_id, v);
  }

  const sectionRank: Record<MediaSection, number> = { final: 0, draft: 1, graphic: 1, raw: 2, other: 3 };
  const rankByItem = new Map<string, number>();
  for (const a of (assets ?? []) as { id: string; content_item_id: string; section: MediaSection; kind: MediaAsset['kind'] }[]) {
    const v = latestByAsset.get(a.id);
    if (!v || !a.content_item_id) continue;
    const rank = sectionRank[a.section] ?? 3;
    const bestRank = rankByItem.get(a.content_item_id);
    if (bestRank === undefined || rank < bestRank) {
      rankByItem.set(a.content_item_id, rank);
      result.set(a.content_item_id, { storagePath: v.storage_path, kind: a.kind });
    }
  }
  return result;
}

export async function searchBankAssets(query: string) {
  const client = db();
  let q = client.from('media_assets').select('*').eq('is_bank_item', true).order('created_at', { ascending: false });
  if (query.trim()) q = q.ilike('title', `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MediaAsset[];
}

export async function attachBankAssetToContentItem(assetId: string, contentItemId: string, section: MediaSection) {
  const { error } = await db().from('media_assets').update({ content_item_id: contentItemId, section }).eq('id', assetId);
  if (error) throw error;
}

export async function tagMediaAsset(assetId: string, tagId: string) {
  const { error } = await db().from('media_asset_tags').insert({ media_asset_id: assetId, tag_id: tagId });
  if (error && error.code !== '23505') throw error; // ignore duplicate-tag conflicts
}

export async function untagMediaAsset(assetId: string, tagId: string) {
  const { error } = await db().from('media_asset_tags').delete().eq('media_asset_id', assetId).eq('tag_id', tagId);
  if (error) throw error;
}

export async function renameMediaAsset(assetId: string, title: string) {
  const { error } = await db().from('media_assets').update({ title, updated_at: new Date().toISOString() }).eq('id', assetId);
  if (error) throw error;
}

/** Only ever allowed for unattached Content Bank items — see the RLS policy comment in schema.sql. */
export async function deleteBankAsset(assetId: string) {
  const client = db();
  const versions = await listVersions(assetId);
  if (versions.length > 0) {
    const { error: storageError } = await client.storage.from(BUCKET).remove(versions.map((v) => v.storage_path));
    if (storageError) throw storageError;
  }
  const { error } = await client.from('media_assets').delete().eq('id', assetId);
  if (error) throw error;
}

export async function getTagsForAsset(assetId: string) {
  const { data, error } = await db().from('media_asset_tags').select('tag_id, tags(id, name)').eq('media_asset_id', assetId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.tags);
}
