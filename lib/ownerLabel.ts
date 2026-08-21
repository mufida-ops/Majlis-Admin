import type { WorkspaceMember } from '@/types/db';

function withIcon(member: WorkspaceMember): string {
  return member.avatar_emoji ? `${member.avatar_emoji} ${member.display_name}` : member.display_name;
}

export function memberLabel(
  userId: string | null | undefined,
  me: WorkspaceMember | null,
  partner: WorkspaceMember | null
): string {
  if (!userId) return 'Unassigned';
  if (me && userId === me.user_id) return withIcon(me);
  if (partner && userId === partner.user_id) return withIcon(partner);
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
