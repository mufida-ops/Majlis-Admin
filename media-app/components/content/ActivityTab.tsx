import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { listActivity, describeActivity } from '@/lib/repositories/activity';
import { listTeam } from '@/lib/repositories/team';
import { timeAgo } from '@/lib/format';

export function ActivityTab({ contentItemId }: { contentItemId: string }) {
  const { data: entries } = useAsync(() => listActivity(contentItemId), [contentItemId]);
  const { data: team } = useAsync(() => listTeam(), []);
  const nameOf = (id: string | null) => (team ?? []).find((p) => p.id === id)?.full_name ?? 'The system';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {(entries ?? []).length === 0 && <Text style={styles.empty}>No activity yet.</Text>}
      {(entries ?? []).map((e) => (
        <View key={e.id} style={styles.row}>
          <View style={styles.dot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>{describeActivity(e, nameOf(e.actor_id))}</Text>
            <Text style={styles.time}>{timeAgo(e.created_at)}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  empty: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold, marginTop: 6 },
  text: { fontSize: 13, color: colors.textPrimary },
  time: { fontSize: 11, color: colors.textSecondary, marginTop: 1 }
});
