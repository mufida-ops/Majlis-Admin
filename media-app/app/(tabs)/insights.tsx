import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { listContentItemSummaries } from '@/lib/repositories/contentItems';
import { todayInOrgTz } from '@/lib/timezone';

export default function Insights() {
  const { data: items, loading } = useAsync(() => listContentItemSummaries(), []);

  const monthKey = todayInOrgTz().slice(0, 7);
  const thisMonth = (items ?? []).filter((i) => i.created_at.slice(0, 7) === monthKey);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of thisMonth) {
      const label = i.content_type?.label ?? 'Uncategorised';
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [thisMonth]);

  const max = Math.max(1, ...byType.map(([, n]) => n));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>This month</Text>
      <Text style={styles.sub}>{thisMonth.length} pieces of content created — a quick read on content mix, not performance. Use this to spot gaps, not trends.</Text>

      {loading && !items && <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />}

      <View style={{ gap: spacing.md }}>
        {byType.map(([label, count]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(count / max) * 100}%` }]} />
            </View>
            <Text style={styles.rowCount}>{count}</Text>
          </View>
        ))}
        {!loading && byType.length === 0 && <Text style={styles.empty}>Nothing created yet this month.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabel: { width: 120, fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  barTrack: { flex: 1, height: 10, borderRadius: 6, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 6 },
  rowCount: { width: 24, textAlign: 'right', fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  empty: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' }
});
