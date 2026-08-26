import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { ActivityRow } from '@/components/ActivityRow';
import { theme } from '@/constants/theme';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listRecentActivity } from '@/lib/repositories/activity';
import { listDecisions } from '@/lib/repositories/decisions';
import { listProjects } from '@/lib/repositories/projects';
import { listOrganisations } from '@/lib/repositories/organisations';
import { classifyActivity, type ActivityHref } from '@/lib/catchUp';
import type { ActivityEventRow } from '@/types/db';

export default function CatchUpArchiveScreen() {
  const { me, workspaceId } = useWorkspace();

  const { data, loading, error, refresh } = useAsync(async () => {
    if (!workspaceId || !me) return { rows: [] as ActivityEventRow[], hrefs: {} as Record<string, ActivityHref> };
    const [activity, decisions, projects, organisations] = await Promise.all([
      listRecentActivity(workspaceId, 200),
      listDecisions(workspaceId),
      listProjects(workspaceId),
      listOrganisations(workspaceId)
    ]);
    const { needsYou, fyi, hrefs } = classifyActivity(activity, { me, decisions, projects, organisations });
    const rows = [...needsYou, ...fyi].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { rows, hrefs };
  }, [workspaceId, me?.user_id]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const rows = data?.rows ?? [];
  const hrefs = data?.hrefs ?? {};

  const groups: { label: string; items: ActivityEventRow[] }[] = [];
  for (const event of rows) {
    const label = new Date(event.created_at).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(event);
    else groups.push({ label, items: [event] });
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Catch-up history',
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.navy
        }}
      />
      <Text style={styles.sub}>Everything that's come through Catch-up, grouped by day.</Text>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : groups.length === 0 ? (
        <EmptyState label="Nothing yet." />
      ) : (
        groups.map(group => (
          <View key={group.label} style={styles.dayGroup}>
            <Text style={styles.dayLabel}>{group.label}</Text>
            <Card>
              {group.items.map(event => (
                <ActivityRow key={event.id} event={event} href={hrefs[event.id]} />
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { color: theme.colors.muted, fontSize: 14, lineHeight: 20 },
  dayGroup: { gap: 10 },
  dayLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }
});
