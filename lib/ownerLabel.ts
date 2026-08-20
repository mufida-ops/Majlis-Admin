import type { WorkspaceMember } from '@/types/db';

export function memberLabel(
  userId: string | null | undefined,
  me: WorkspaceMember | null,
  partner: WorkspaceMember | null
): string {
  if (!userId) return 'Unassigned';
  if (me && userId === me.user_id) return me.display_name;
  if (partner && userId === partner.user_id) return partner.display_name;
  return 'Team member';
}

export function summarizeOwners(
  ownerIds: (string | null | undefined)[],
  me: WorkspaceMember | null,
  partner: WorkspaceMember | null
): string {
  const distinct = Array.from(new Set(ownerIds.filter((id): id is string => Boolean(id))));
  if (distinct.length === 0) return 'Unassigned';
  if (distinct.length > 1) return 'Both';
  return memberLabel(distinct[0], me, partner);
}
