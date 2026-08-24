import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { loadHomeData } from '@/lib/repositories/home';
import { useAsync } from '@/lib/useAsync';
import { colors, radii, spacing } from '@/constants/theme';
import { CardRow } from '@/components/CardRow';
import { canCreateContent } from '@/lib/permissions';

export default function Home() {
  const { session, profile, roles } = useAuth();
  const { data, loading, error, reload } = useAsync(
    () => (session ? loadHomeData(session.user.id, roles.includes('admin')) : Promise.resolve(null)),
    [session?.user.id, roles.join(',')]
  );

  const canCreate = canCreateContent({ userId: session?.user.id ?? null, roles });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.navy} />}
    >
      <View style={styles.hero}>
        <Text style={styles.greeting}>Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}</Text>
        <Text style={styles.sub}>Here's what needs your attention today.</Text>
      </View>

      <Pressable style={styles.dashboardButton} onPress={() => router.push('/(tabs)/insights')}>
        <Feather name="bar-chart-2" size={18} color={colors.navy} />
        <Text style={styles.dashboardButtonText}>Team Dashboard — see what's happening across the whole pipeline</Text>
        <Feather name="chevron-right" size={16} color={colors.textSecondary} />
      </Pressable>

      {canCreate && (
        <View style={{ gap: spacing.sm }}>
          <Pressable style={styles.newButton} onPress={() => router.push('/content/new')}>
            <Feather name="plus" size={18} color="#FFF" />
            <Text style={styles.newButtonText}>New content idea</Text>
          </Pressable>
          <Pressable style={styles.batchButton} onPress={() => router.push('/content/batch-add')}>
            <Feather name="message-circle" size={18} color={colors.navy} />
            <Text style={styles.batchButtonText}>Describe a month's content, get it organized</Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
      {loading && !data && <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />}

      {data && (() => {
        const sections = [
          { title: 'Overdue', items: data.overdue, accent: colors.danger },
          { title: 'Due Today', items: data.dueToday, accent: colors.gold },
          { title: 'Waiting for Me', items: data.waitingForMe, accent: colors.warning },
          { title: 'Awaiting Approval', items: data.awaitingApproval, accent: colors.stageApproval },
          { title: 'Scheduled Today', items: data.scheduledToday, accent: colors.stageScheduled },
          { title: 'My Tasks', items: data.myTasks, accent: colors.navy },
          { title: 'Recently Published', items: data.recentlyPublished, accent: colors.success }
        ].filter((s) => s.items.length > 0);

        if (sections.length === 0) {
          return <Text style={styles.allClear}>Nothing needs your attention right now — you're all caught up.</Text>;
        }

        return (
          <View style={{ gap: spacing.xl }}>
            {sections.map((s) => (
              <CardRow key={s.title} title={s.title} items={s.items} thumbnails={data.thumbnails} accent={s.accent} />
            ))}
          </View>
        );
      })()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl, gap: spacing.lg },
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 4 },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 14, color: colors.textSecondary },
  newButton: {
    marginHorizontal: spacing.lg, backgroundColor: colors.navy, borderRadius: radii.md, paddingVertical: 14,
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center'
  },
  newButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  dashboardButton: {
    marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 8, alignItems: 'center'
  },
  dashboardButtonText: { flex: 1, color: colors.navy, fontWeight: '700', fontSize: 12.5 },
  batchButton: {
    marginHorizontal: spacing.lg, backgroundColor: colors.goldSoft, borderRadius: radii.md, paddingVertical: 14,
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center'
  },
  batchButtonText: { color: colors.navy, fontWeight: '700', fontSize: 13, textAlign: 'center', flexShrink: 1 },
  errorText: { color: colors.danger, paddingHorizontal: spacing.lg },
  allClear: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.xl }
});
