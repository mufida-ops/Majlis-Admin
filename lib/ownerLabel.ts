import { theme } from '@/constants/theme';
import type { OwnerType, WorkspaceMember } from '@/types/db';

// One color per person, matched by name (Mufida's own request: her tasks
// are purple, Victoria's are pink) rather than by sign-in order, so it's
// the same regardless of which of the two founders is looking at the screen.
function colorForName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes('mufida')) return theme.colors.ownerPurple;
  if (lower.includes('victoria')) return theme.colors.ownerPink;
  return null;
}

export function ownerAccentColor(
  userId: string | null | undefined,
  me: WorkspaceMember | null,
  partner: WorkspaceMember | null
): string | null {
  if (!userId) return null;
  const owner = [me, partner].find(m => m?.user_id === userId);
  return owner ? colorForName(owner.display_name) : null;
}

// Same scheme, for entities (like decisions) that store a plain
// 'Mufida' | 'Victoria' | 'Both' owner rather than a user_id — 'Both'
// intentionally gets no tint since it isn't either person's alone.
export function ownerTypeAccentColor(owner: OwnerType | null | undefined): string | null {
  if (!owner || owner === 'Both') return null;
  return colorForName(owner);
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
