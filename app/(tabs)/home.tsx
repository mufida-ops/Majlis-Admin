import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { SectionTitle } from '@/components/SectionTitle';
import { LoadingState, ErrorState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listProjects, type ProjectWithTasks } from '@/lib/repositories/projects';
import { listDecisions } from '@/lib/repositories/decisions';
import { listOrganisations } from '@/lib/repositories/organisations';
import { isInQuietHours } from '@/lib/quietHours';
import { formatShortDate } from '@/lib/format';
import { quoteOfTheDay } from '@/lib/quotes';
import type { DecisionRow, OrganisationRow } from '@/types/db';

type FocusItem = {
  key: string;
  eyebrow: string;
  title: string;
  meta: string;
  href: string;
};

export default function HomeScreen() {
  const { session } = useAuth();
  const { me, partner, loading: workspaceLoading, workspaceId } = useWorkspace();

  const { data, loading, error, refresh } = useAsync(async () => {
    if (!workspaceId) return { projects: [] as ProjectWithTasks[], decisions: [] as DecisionRow[], organisations: [] as OrganisationRow[] };
    const [projects, decisions, organisations] = await Promise.all([
      listProjects(workspaceId),
      listDecisions(workspaceId),
      listOrganisations(workspaceId)
    ]);
    return { projects, decisions, organisations };
  }, [workspaceId]);

  const focus = useMemo<FocusItem[]>(() => {
    if (!data || !me) return [];
    const items: FocusItem[] = [];

    const nextOrg = data.organisations
      .filter(o => o.next_action_at)
      .sort((a, b) => new Date(a.next_action_at!).getTime() - new Date(b.next_action_at!).getTime())[0];
    if (nextOrg) {
      items.push({
        key: `org-${nextOrg.id}`,
        eyebrow: `CRM · ${nextOrg.name}`,
        title: nextOrg.next_action ?? 'Follow up',
        meta: `Due ${formatShortDate(nextOrg.next_action_at!)}`,
        href: `/(tabs)/crm/${nextOrg.id}`
      });
    }

    const waitingDecision = data.decisions
      .filter(d => d.status === 'Waiting')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    if (waitingDecision) {
      items.push({
        key: `decision-${waitingDecision.id}`,
        eyebrow: 'Discussion',
        title: waitingDecision.title,
        meta: waitingDecision.owner === 'Both' ? 'Needs both of you' : `${waitingDecision.owner ?? 'Someone'} needs to weigh in`,
        href: `/(tabs)/decisions`
      });
    }

    const myTask = data.projects
      .flatMap(p => p.project_tasks.map(t => ({ task: t, project: p })))
      .filter(({ task }) => task.status !== 'Done' && task.owner_user_id === me.user_id)
      .sort((a, b) => (a.task.due_at ?? '').localeCompare(b.task.due_at ?? ''))[0];
    if (myTask) {
      items.push({
        key: `task-${myTask.task.id}`,
        eyebrow: `Project · ${myTask.project.title}`,
        title: myTask.task.title,
        meta: myTask.task.due_at ? `Due ${formatShortDate(myTask.task.due_at)}` : 'No due date yet',
        href: `/(tabs)/projects/${myTask.project.id}`
      });
    }

    return items;
  }, [data, me]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const dateLabel = useMemo(
    () => new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }),
    []
  );

  const todaysQuote = useMemo(() => quoteOfTheDay(), []);

  if (workspaceLoading) return <LoadingState label="Loading your workspace…" />;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.date}>{dateLabel}</Text>
          <Text style={styles.greeting}>
            {greeting}, {me?.avatar_emoji ? `${me.avatar_emoji} ` : ''}
            {me?.display_name ?? session?.user.email}
          </Text>
          <Text style={styles.sub}>Here's what needs your attention — nothing more.</Text>
        </View>
        <Pressable onPress={() => router.push('/settings')}>
          <Pill label={partner && isInQuietHours(partner) ? `${partner.display_name} · quiet hours` : 'You · settings'} />
        </Pressable>
      </View>

      <Card style={styles.quoteCard}>
        <Text style={styles.quoteEyebrow}>Today, for both of you</Text>
        <Text style={styles.quoteText}>"{todaysQuote}"</Text>
      </Card>

      <Pressable onPress={() => router.push('/(tabs)/drop')}>
        <Card style={styles.capture}>
          <Text style={styles.captureTitle}>Give something in</Text>
          <Text style={styles.captureText}>Thought, task, discussion, follow-up — organise it later.</Text>
          <Text style={styles.capturePrompt}>What's on your mind?</Text>
        </Card>
      </Pressable>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Right now" subtitle="Only the things that genuinely need movement." />
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : focus.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Image source={require('@/assets/images/reading-together.jpg')} style={styles.emptyImage} resizeMode="cover" />
            <Text style={[styles.meta, styles.emptyText]}>Nothing urgent right now. Give a thought in, or check Catch-up.</Text>
          </Card>
        ) : (
          focus.map(item => (
            <Pressable key={item.key} onPress={() => router.push(item.href as never)}>
              <Card>
                <Text style={styles.eyebrow}>{item.eyebrow}</Text>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.meta}>{item.meta}</Text>
              </Card>
            </Pressable>
          ))
        )}
      </View>

      <Pressable style={styles.catchUp} onPress={() => router.push('/(tabs)/catch-up')}>
        <Text style={styles.catchUpTitle}>Catch me up</Text>
        <Text style={styles.catchUpText}>
          See what {partner?.display_name ?? 'your partner'} changed while you were away →
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  date: { color: theme.colors.muted, fontSize: 13 },
  greeting: { color: theme.colors.text, fontSize: 26, fontWeight: '600', marginTop: 4 },
  sub: { color: theme.colors.muted, fontSize: 15, marginTop: 6, lineHeight: 21 },
  quoteCard: { backgroundColor: theme.colors.surfaceMuted, borderWidth: 0 },
  quoteEyebrow: { color: theme.colors.gold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  quoteText: { color: theme.colors.text, fontSize: 16, lineHeight: 23, marginTop: 8, fontStyle: 'italic' },
  capture: { backgroundColor: theme.colors.navy },
  captureTitle: { color: theme.colors.surface, fontSize: 20, fontWeight: '600' },
  captureText: { color: theme.colors.background, marginTop: 5, lineHeight: 20 },
  capturePrompt: { color: theme.colors.surface, marginTop: 20, fontSize: 16 },
  eyebrow: { color: theme.colors.gold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  itemTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600', marginTop: 5 },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 6 },
  emptyCard: { padding: 0, overflow: 'hidden' },
  emptyImage: { width: '100%', height: 140 },
  emptyText: { padding: 16, marginTop: 0 },
  catchUp: { backgroundColor: theme.colors.surfaceMuted, padding: 16, borderRadius: theme.radius.md },
  catchUpTitle: { color: theme.colors.navy, fontSize: 18, fontWeight: '600' },
  catchUpText: { color: theme.colors.muted, marginTop: 4 }
});
