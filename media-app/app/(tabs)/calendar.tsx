import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { listCalendarEntries, type CalendarEntry } from '@/lib/repositories/calendar';
import { listCampaigns } from '@/lib/repositories/campaigns';
import { PlatformIcon } from '@/components/PlatformIcon';
import { PublicationBadge } from '@/components/StatusBadge';
import { formatTimeOnly, ORG_TIMEZONE, todayInOrgTz } from '@/lib/timezone';
import { PLATFORMS, type PlatformName } from '@/types/db';

function toDubaiDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ORG_TIMEZONE }).format(new Date(iso));
}

export default function CalendarScreen() {
  const [view, setView] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [platformFilter, setPlatformFilter] = useState<PlatformName | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);

  const { data: campaigns } = useAsync(() => listCampaigns(), []);

  const rangeStart = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1) - 7 * 86400000).toISOString();
  const rangeEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0) + 7 * 86400000).toISOString();
  const { data: entries, loading } = useAsync(() => listCalendarEntries(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const filtered = (entries ?? []).filter((e) =>
    (!platformFilter || e.platform === platformFilter) && (!campaignFilter || e.campaign_name === campaigns?.find((c) => c.id === campaignFilter)?.name)
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of filtered) {
      const key = toDubaiDateKey(e.scheduled_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [filtered]);

  const today = todayInOrgTz();
  const [selectedDay, setSelectedDay] = useState(today);

  const monthCells = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const weekCells = useMemo(() => buildWeekList(today), [today]);

  return (
    <View style={styles.screen}>
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable style={[styles.viewToggle]} onPress={() => setView(view === 'month' ? 'week' : 'month')}>
            <Feather name={view === 'month' ? 'grid' : 'list'} size={14} color={colors.navy} />
            <Text style={styles.viewToggleText}>{view === 'month' ? 'Month' : 'Week'}</Text>
          </Pressable>
          {PLATFORMS.map((p) => (
            <Pressable key={p} style={[styles.filterChip, platformFilter === p && styles.filterChipActive]} onPress={() => setPlatformFilter(platformFilter === p ? null : p)}>
              <PlatformIcon platform={p} size={14} muted={platformFilter !== null && platformFilter !== p} />
            </Pressable>
          ))}
          {(campaigns ?? []).map((c) => (
            <Pressable key={c.id} style={[styles.filterChip, campaignFilter === c.id && styles.filterChipActive]} onPress={() => setCampaignFilter(campaignFilter === c.id ? null : c.id)}>
              <Text style={[styles.filterChipText, campaignFilter === c.id && styles.filterChipTextActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading && !entries ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />
      ) : view === 'month' ? (
        <>
          <View style={styles.monthHeader}>
            <Pressable onPress={() => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1)))}><Feather name="chevron-left" size={20} color={colors.textPrimary} /></Pressable>
            <Text style={styles.monthTitle}>{cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text>
            <Pressable onPress={() => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)))}><Feather name="chevron-right" size={20} color={colors.textPrimary} /></Pressable>
          </View>
          <View style={styles.grid}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <Text key={i} style={styles.weekday}>{d}</Text>)}
            {monthCells.map((cell) => {
              const items = byDay.get(cell.key) ?? [];
              return (
                <Pressable key={cell.key} style={[styles.dayCell, cell.key === selectedDay && styles.dayCellSelected]} onPress={() => setSelectedDay(cell.key)}>
                  <Text style={[styles.dayNumber, !cell.inMonth && styles.dayNumberMuted, cell.key === today && styles.dayNumberToday]}>{cell.day}</Text>
                  {items.length > 0 && <View style={styles.dayDot} />}
                </Pressable>
              );
            })}
          </View>
          <DayAgenda dateKey={selectedDay} items={byDay.get(selectedDay) ?? []} />
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          {weekCells.map((key) => (
            <View key={key}>
              <Text style={styles.weekDayHeader}>
                {new Date(key + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })}
              </Text>
              <DayAgenda dateKey={key} items={byDay.get(key) ?? []} embedded />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function DayAgenda({ dateKey, items, embedded }: { dateKey: string; items: CalendarEntry[]; embedded?: boolean }) {
  return (
    <ScrollView style={embedded ? undefined : styles.agenda} contentContainerStyle={{ gap: spacing.sm }}>
      {items.length === 0 && <Text style={styles.agendaEmpty}>Nothing scheduled.</Text>}
      {items.map((e) => (
        <Pressable key={e.id} style={styles.agendaRow} onPress={() => router.push(`/content/${e.content_item_id}`)}>
          <PlatformIcon platform={e.platform} size={16} />
          <View style={{ flex: 1 }}>
            <Text style={styles.agendaTitle} numberOfLines={1}>{e.title}</Text>
            <Text style={styles.agendaMeta}>{formatTimeOnly(e.scheduled_at)} · {e.owner_name ?? 'Unassigned'}{e.campaign_name ? ` · ${e.campaign_name}` : ''}</Text>
          </View>
          <PublicationBadge status={e.publication_status} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function buildMonthGrid(cursor: Date) {
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: { key: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) {
    const d = new Date(Date.UTC(year, month, 1 - (startOffset - i)));
    cells.push({ key: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10), day: d, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = new Date(cells[cells.length - 1].key + 'T00:00:00Z');
    const next = new Date(last.getTime() + 86400000);
    cells.push({ key: next.toISOString().slice(0, 10), day: next.getUTCDate(), inMonth: false });
  }
  return cells;
}

function buildWeekList(todayKey: string) {
  const start = new Date(todayKey + 'T00:00:00Z');
  return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  filterBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  viewToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.goldSoft, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  viewToggleText: { fontSize: 12, fontWeight: '700', color: colors.navy },
  filterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: colors.navy },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  filterChipTextActive: { color: '#FFF' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  monthTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textSecondary, paddingBottom: 4 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayCellSelected: { backgroundColor: colors.goldSoft, borderRadius: radii.md },
  dayNumber: { fontSize: 13, color: colors.textPrimary },
  dayNumberMuted: { color: colors.textSecondary + '70' },
  dayNumberToday: { fontWeight: '800', color: colors.gold },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.navy },
  agenda: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  agendaEmpty: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  agendaTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  agendaMeta: { fontSize: 11, color: colors.textSecondary },
  weekDayHeader: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm }
});
