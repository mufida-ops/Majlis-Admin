import { theme } from '@/constants/theme';
import type { WorkspaceMember } from '@/types/db';

// One color per person, stable regardless of which of the two founders is
// signed in (sorted by user_id rather than "me"/"partner", since which
// member is "me" flips depending on the viewer's own phone).
const OWNER_COLORS = [theme.colors.navy, theme.colors.gold] as const;

export function ownerAccentColor(
  userId: string | null | undefined,
  me: WorkspaceMember | null,
  partner: WorkspaceMember | null
): string | null {
  if (!userId) return null;
  const members = [me, partner]
    .filter((m): m is WorkspaceMember => m !== null)
    .sort((a, b) => a.user_id.localeCompare(b.user_id));
  const index = members.findIndex(m => m.user_id === userId);
  return index === -1 ? null : OWNER_COLORS[index % OWNER_COLORS.length];
}

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
