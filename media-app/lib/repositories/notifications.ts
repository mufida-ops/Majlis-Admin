import { supabase } from '@/lib/supabase';
import type { AppNotification } from '@/types/db';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listNotifications(userId: string) {
  const { data, error } = await db()
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function unreadCount(userId: string) {
  const { count, error } = await db()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(id: string) {
  const { error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function markAllRead(userId: string) {
  const { error } = await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  if (error) throw error;
}

/** Groups repetitive events (same type + group_key) so the centre doesn't get noisy — Section 27. */
export function groupNotifications(items: AppNotification[]): { key: string; items: AppNotification[] }[] {
  const groups = new Map<string, AppNotification[]>();
  for (const n of items) {
    const key = n.group_key ?? n.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
}
