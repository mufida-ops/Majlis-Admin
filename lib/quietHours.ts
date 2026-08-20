import type { WorkspaceMember } from '@/types/db';

// Both founders share Asia/Dubai by default (see schema.sql), so quiet
// hours are compared against device wall-clock time rather than doing a
// full per-member timezone conversion — correct for the common case of
// two co-founders in the same city, and simple enough for the MVP.
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function isInQuietHours(member: WorkspaceMember | null, at: Date = new Date()): boolean {
  if (!member?.quiet_hours_start || !member?.quiet_hours_end) return false;
  const start = toMinutes(member.quiet_hours_start);
  const end = toMinutes(member.quiet_hours_end);
  if (start === end) return false;
  const nowMin = at.getHours() * 60 + at.getMinutes();
  if (start < end) return nowMin >= start && nowMin < end;
  return nowMin >= start || nowMin < end; // wraps past midnight, e.g. 22:00 -> 07:00
}

function formatClock(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatQuietHoursRange(member: WorkspaceMember | null): string | null {
  if (!member?.quiet_hours_start || !member?.quiet_hours_end) return null;
  return `${formatClock(member.quiet_hours_start)}–${formatClock(member.quiet_hours_end)}`;
}
