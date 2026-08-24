import { supabase } from '@/lib/supabase';
import type { Approval } from '@/types/db';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listApprovalHistory(contentItemId: string) {
  const { data, error } = await db()
    .from('approvals')
    .select('*')
    .eq('content_item_id', contentItemId)
    .order('decided_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Approval[];
}

/**
 * The only sanctioned way to change approval_state — inserts one decision
 * row and lets the `approvals_after_insert` trigger apply the transition,
 * lock the final media, snapshot the platform copy, and notify the owner.
 * Pass `platformPostId` for a per-platform re-approval after a revoke;
 * omit it to approve/request-changes on the whole item.
 */
export async function decide(input: {
  contentItemId: string;
  decidedBy: string;
  decision: 'approved' | 'changes_requested';
  note?: string;
  platformPostId?: string;
}): Promise<Approval> {
  const { data, error } = await db()
    .from('approvals')
    .insert({
      content_item_id: input.contentItemId,
      platform_post_id: input.platformPostId ?? null,
      decided_by: input.decidedBy,
      decision: input.decision,
      note: input.note ?? null
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Approval;
}

/**
 * The only sanctioned way to move a card from Producing into Approval — the
 * submitter picks which admin(s) get notified (never a blanket "every
 * admin"). Server-side re-checks edit rights and the version, so a version
 * mismatch throws rather than silently overwriting a concurrent change.
 */
export async function submitForApproval(contentItemId: string, expectedVersion: number, approverIds: string[]): Promise<void> {
  const { error } = await db().rpc('submit_for_approval', {
    p_item_id: contentItemId,
    p_expected_version: expectedVersion,
    p_approver_ids: approverIds
  });
  if (error) throw new Error(error.message);
}

/** Approval inbox: items whose current stage is 'approval' and where I'm the approver (or I'm admin — pass includeAll). */
export async function listAwaitingMyApproval(userId: string, includeAll: boolean) {
  let q = db().from('content_items').select('*').eq('stage', 'approval').is('deleted_at', null);
  if (!includeAll) q = q.eq('approver_id', userId);
  const { data, error } = await q.order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
