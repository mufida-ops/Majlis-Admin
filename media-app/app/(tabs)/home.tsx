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

      {data && (
        <View style={{ gap: spacing.xl }}>
          <CardRow title="Overdue" items={data.overdue} thumbnails={data.thumbnails} accent={colors.danger} emptyText="Nothing overdue — good work." />
          <CardRow title="Due Today" items={data.dueToday} thumbnails={data.thumbnails} accent={colors.gold} emptyText="Nothing due today." />
          <CardRow title="Waiting for Me" items={data.waitingForMe} thumbnails={data.thumbnails} accent={colors.warning} emptyText="Nothing waiting on you." />
          <CardRow title="Awaiting Approval" items={data.awaitingApproval} thumbnails={data.thumbnails} accent={colors.stageApproval} emptyText="Nothing in the approval queue." />
          <CardRow title="Scheduled Today" items={data.scheduledToday} thumbnails={data.thumbnails} accent={colors.stageScheduled} emptyText="Nothing scheduled today." />
          <CardRow title="My Tasks" items={data.myTasks} thumbnails={data.thumbnails} accent={colors.navy} emptyText="You're all caught up." />
          <CardRow title="Recently Published" items={data.recentlyPublished} thumbnails={data.thumbnails} accent={colors.success} emptyText="Nothing published yet." />
        </View>
      )}
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
  batchButton: {
    marginHorizontal: spacing.lg, backgroundColor: colors.goldSoft, borderRadius: radii.md, paddingVertical: 14,
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center'
  },
  batchButtonText: { color: colors.navy, fontWeight: '700', fontSize: 13, textAlign: 'center', flexShrink: 1 },
  errorText: { color: colors.danger, paddingHorizontal: spacing.lg }
});
