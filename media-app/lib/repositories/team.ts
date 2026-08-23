import { supabase } from '@/lib/supabase';
import type { AppRole, ContentAssignment, Profile } from '@/types/db';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listTeam(): Promise<Profile[]> {
  const { data, error } = await db().from('profiles').select('*').order('full_name');
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function listRolesByUser(): Promise<Map<string, AppRole[]>> {
  const { data, error } = await db().from('user_roles').select('user_id, role');
  if (error) throw error;
  const map = new Map<string, AppRole[]>();
  for (const row of data ?? []) {
    const arr = map.get(row.user_id) ?? [];
    arr.push(row.role as AppRole);
    map.set(row.user_id, arr);
  }
  return map;
}

export async function grantRole(userId: string, role: AppRole, grantedBy: string) {
  const { error } = await db().from('user_roles').insert({ user_id: userId, role, granted_by: grantedBy });
  if (error && error.code !== '23505') throw error;
}

export async function revokeRole(userId: string, role: AppRole) {
  const { error } = await db().from('user_roles').delete().eq('user_id', userId).eq('role', role);
  if (error) throw error;
}

/** Open (not-published, not-deleted) content items assigned to a user in any capacity — drives Team workload + Home. */
export async function workloadForUser(userId: string) {
  const client = db();
  const [{ data: owned, error: e1 }, { data: assigned, error: e2 }] = await Promise.all([
    client.from('content_items').select('*').is('deleted_at', null).neq('stage', 'published')
      .or(`owner_id.eq.${userId},approver_id.eq.${userId},publisher_id.eq.${userId}`),
    client.from('content_assignments').select('content_item_id').eq('user_id', userId)
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { direct: owned ?? [], assignmentIds: (assigned ?? []).map((a: { content_item_id: string }) => a.content_item_id) };
}

export async function listAssignments(contentItemId: string) {
  const { data, error } = await db().from('content_assignments').select('*').eq('content_item_id', contentItemId);
  if (error) throw error;
  return (data ?? []) as ContentAssignment[];
}

export async function addAssignment(contentItemId: string, userId: string, role: ContentAssignment['role_on_item'], assignedBy: string) {
  const { error } = await db().from('content_assignments').insert({ content_item_id: contentItemId, user_id: userId, role_on_item: role, assigned_by: assignedBy });
  if (error && error.code !== '23505') throw error;
}

export async function removeAssignment(id: string) {
  const { error } = await db().from('content_assignments').delete().eq('id', id);
  if (error) throw error;
}
