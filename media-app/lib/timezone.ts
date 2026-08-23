// Organisational timezone (Section 21). All scheduling is stored as an
// absolute UTC timestamptz in Postgres; this module only controls how it's
// displayed/entered, using Intl (no extra date library needed).
export const ORG_TIMEZONE = 'Asia/Dubai';

export function formatInOrgTz(iso: string | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ORG_TIMEZONE,
    ...opts
  }).format(new Date(iso));
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return 'Not scheduled';
  return formatInOrgTz(iso, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

export function formatDateOnly(iso: string | null): string {
  if (!iso) return '';
  return formatInOrgTz(iso, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTimeOnly(iso: string | null): string {
  if (!iso) return '';
  return formatInOrgTz(iso, { hour: '2-digit', minute: '2-digit' });
}

/** Builds a UTC ISO timestamp from a local (Asia/Dubai) date + time picked in the UI. */
export function orgLocalToUtcIso(dateStr: string, timeStr: string): string {
  // Asia/Dubai is a fixed UTC+4 offset (no DST), so this is a plain arithmetic
  // shift rather than needing a timezone database.
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, h - 4, min);
  return new Date(utcMs).toISOString();
}

export function todayInOrgTz(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ORG_TIMEZONE }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}
