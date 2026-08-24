import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radii, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { listContentItemSummaries } from '@/lib/repositories/contentItems';
import { listRecentActivity, describeActivity } from '@/lib/repositories/activity';
import { todayInOrgTz } from '@/lib/timezone';
import { timeAgo } from '@/lib/format';
import { PIPELINE_STAGES, STAGE_LABELS, type ContentStage } from '@/types/db';

const STAGE_COLOR: Record<ContentStage, string> = {
  idea: colors.stageIdea, producing: colors.stageToFilm, approval: colors.stageApproval, published: colors.stagePublished
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const { data: items, loading: itemsLoading, reload: reloadItems } = useAsync(() => listContentItemSummaries(), []);
  const { data: activity, loading: activityLoading, reload: reloadActivity } = useAsync(() => listRecentActivity(30), []);
  const loading = itemsLoading || activityLoading;

  function reload() {
    reloadItems();
    reloadActivity();
  }

  const today = todayInOrgTz();
  const weekEnd = addDays(today, 6);

  const stageCounts = useMemo(() => {
    const map = new Map<ContentStage, number>(PIPELINE_STAGES.map((s) => [s, 0]));
    for (const i of items ?? []) map.set(i.stage, (map.get(i.stage) ?? 0) + 1);
    return map;
  }, [items]);

  const overdueCount = (items ?? []).filter((i) => i.due_date && i.due_date < today && i.stage !== 'published').length;
  const dueThisWeekCount = (items ?? []).filter((i) => i.due_date && i.due_date >= today && i.due_date <= weekEnd && i.stage !== 'published').length;

  const monthKey = today.slice(0, 7);
  const thisMonth = (items ?? []).filter((i) => i.created_at.slice(0, 7) === monthKey);
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of thisMonth) {
      const label = i.content_type?.label ?? 'Uncategorised';
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [thisMonth]);
  const maxType = Math.max(1, ...byType.map(([, n]) => n));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.navy} />}
    >
      <View style={{ gap: 2 }}>
        <Text style={styles.title}>Team Dashboard</Text>
        <Text style={styles.sub}>Where everything stands right now, and what just happened.</Text>
      </View>

      {loading && !items && <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />}

      {items && (
        <>
          <View style={styles.statRow}>
            <View style={[styles.statTile, { backgroundColor: colors.danger + '14', borderColor: colors.danger + '3D' }]}>
              <Text style={[styles.statNumber, { color: colors.danger }]}>{overdueCount}</Text>
              <Text style={[styles.statLabel, { color: colors.danger }]}>Overdue</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: colors.gold + '14', borderColor: colors.gold + '3D' }]}>
              <Text style={[styles.statNumber, { color: colors.gold }]}>{dueThisWeekCount}</Text>
              <Text style={[styles.statLabel, { color: colors.gold }]}>Due this week</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: colors.success + '14', borderColor: colors.success + '3D' }]}>
              <Text style={[styles.statNumber, { color: colors.success }]}>{stageCounts.get('published') ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.success }]}>Published</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pipeline right now</Text>
            <View style={{ gap: spacing.sm }}>
              {PIPELINE_STAGES.map((stage) => {
                const count = stageCounts.get(stage) ?? 0;
                const max = Math.max(1, ...Array.from(stageCounts.values()));
                return (
                  <Pressable key={stage} style={styles.stageRow} onPress={() => router.push('/(tabs)/pipeline')}>
                    <Text style={styles.stageLabel}>{STAGE_LABELS[stage]}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(count / max) * 100}%`, backgroundColor: STAGE_COLOR[stage] }]} />
                    </View>
                    <Text style={styles.stageCount}>{count}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>This month by type</Text>
            <Text style={styles.sectionSub}>{thisMonth.length} pieces created this month — a read on content mix, not performance.</Text>
            <View style={{ gap: spacing.sm }}>
              {byType.map(([label, count]) => (
                <View key={label} style={styles.stageRow}>
                  <Text style={styles.stageLabel} numberOfLines={1}>{label}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${(count / maxType) * 100}%`, backgroundColor: colors.gold }]} />
                  </View>
                  <Text style={styles.stageCount}>{count}</Text>
                </View>
              ))}
              {byType.length === 0 && <Text style={styles.empty}>Nothing created yet this month.</Text>}
            </View>
          </View>
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Latest activity</Text>
        <Text style={styles.sectionSub}>What the team's been doing, most recent first.</Text>
        <View style={{ gap: spacing.md }}>
          {(activity ?? []).map((e) => (
            <Pressable key={e.id} style={styles.feedRow} onPress={() => router.push(`/content/${e.content_item_id}`)}>
              <View style={styles.dot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.feedText}>
                  {describeActivity(e, e.actor?.full_name ?? 'Someone')}
                  {e.content_item?.title ? ` — ${e.content_item.title}` : ''}
                </Text>
                <Text style={styles.feedTime}>{timeAgo(e.created_at)}</Text>
              </View>
            </Pressable>
          ))}
          {!loading && (activity ?? []).length === 0 && <Text style={styles.empty}>No activity yet.</Text>}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textSecondary },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statTile: { flex: 1, borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, alignItems: 'center', gap: 2 },
  statNumber: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sectionSub: { fontSize: 12, color: colors.textSecondary, marginTop: -8, lineHeight: 17 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stageLabel: { width: 100, fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  barTrack: { flex: 1, height: 10, borderRadius: 6, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  stageCount: { width: 24, textAlign: 'right', fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  empty: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
  feedRow: { flexDirection: 'row', gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold, marginTop: 6 },
  feedText: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  feedTime: { fontSize: 11, color: colors.textSecondary, marginTop: 1 }
});
