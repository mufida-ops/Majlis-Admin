import { supabase } from '@/lib/supabase';
import type { ActivityLogEntry } from '@/types/db';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listActivity(contentItemId: string) {
  const { data, error } = await db()
    .from('activity_log')
    .select('*')
    .eq('content_item_id', contentItemId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ActivityLogEntry[];
}

export interface RecentActivityEntry extends ActivityLogEntry {
  actor: { full_name: string } | null;
  content_item: { title: string; deleted_at: string | null } | null;
}

/** Team-wide "what's the latest" feed for the shared dashboard — across every content item, newest first. */
export async function listRecentActivity(limit = 30): Promise<RecentActivityEntry[]> {
  const { data, error } = await db()
    .from('activity_log')
    .select('*, actor:profiles(full_name), content_item:content_items(title, deleted_at)')
    .order('created_at', { ascending: false })
    .limit(limit * 2);
  if (error) throw error;
  return ((data ?? []) as unknown as RecentActivityEntry[])
    .filter((e) => e.content_item && !e.content_item.deleted_at)
    .slice(0, limit);
}

export function describeActivity(entry: ActivityLogEntry, actorName: string): string {
  const d = entry.detail ?? {};
  switch (entry.action) {
    case 'created': return `${actorName} created this content`;
    case 'stage_changed': return `${actorName} moved this from ${d.from} to ${d.to}`;
    case 'owner_changed': return `${actorName} changed the owner`;
    case 'assigned': return `${actorName} assigned someone as ${d.role}`;
    case 'media_uploaded': return `${actorName} uploaded ${d.version_label} (${d.asset_title})`;
    case 'commented': return `${actorName} commented`;
    case 'approved': return `${actorName} approved this`;
    case 'changes_requested': return `${actorName} requested changes`;
    case 'platform_approved': return `${actorName} approved a platform version`;
    case 'platform_changes_requested': return `${actorName} requested changes on a platform version`;
    case 'platform_approval_revoked': return `Approval was revoked on ${d.platform} — content changed after approval`;
    case 'publication_status_changed': return `${d.platform} publishing status changed to ${d.to}`;
    case 'team_notified': {
      const count = Array.isArray(d.user_ids) ? d.user_ids.length : 0;
      return `${actorName} notified ${count} team member${count === 1 ? '' : 's'} about this`;
    }
    default: return `${actorName} ${entry.action.replace(/_/g, ' ')}`;
  }
}
