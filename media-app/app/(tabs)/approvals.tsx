import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { listContentItemSummaries } from '@/lib/repositories/contentItems';
import { latestMediaThumbnails } from '@/lib/repositories/media';
import { colors, spacing } from '@/constants/theme';
import { ContentCard } from '@/components/ContentCard';

export default function Approvals() {
  const { session, roles, isAdmin } = useAuth();
  const [showAll, setShowAll] = useState(isAdmin);
  const { data: items, loading, reload } = useAsync(() => listContentItemSummaries({ stage: 'approval' }), []);
  const { data: thumbnails } = useAsync(() => latestMediaThumbnails((items ?? []).map((i) => i.id)), [items?.map((i) => i.id).join(',')]);

  const mine = (items ?? []).filter((i) => showAll || i.approver_id === session?.user.id);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.navy} />}
    >
      <Text style={styles.intro}>Only content that currently needs your approval shows up here.</Text>

      {isAdmin && (
        <View style={styles.toggleRow}>
          <Text onPress={() => setShowAll(false)} style={[styles.toggle, !showAll && styles.toggleActive]}>Mine</Text>
          <Text onPress={() => setShowAll(true)} style={[styles.toggle, showAll && styles.toggleActive]}>Everyone's</Text>
        </View>
      )}

      {loading && !items && <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />}
      {!loading && mine.length === 0 && <Text style={styles.empty}>Nothing waiting on you right now.</Text>}

      <View style={{ gap: spacing.md }}>
        {mine.map((item) => (
          <ContentCard key={item.id} item={item} thumb={thumbnails?.get(item.id)} showStage={false} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { fontSize: 13, color: colors.textSecondary },
  toggleRow: { flexDirection: 'row', gap: spacing.md },
  toggle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, paddingVertical: 4 },
  toggleActive: { color: colors.navy, textDecorationLine: 'underline' },
  empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 40 }
});
