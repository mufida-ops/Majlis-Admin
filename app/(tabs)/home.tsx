import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { SectionTitle } from '@/components/SectionTitle';
import { LoadingState, ErrorState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listProjects, setTaskStatus, type ProjectWithTasks } from '@/lib/repositories/projects';
import { listDecisions } from '@/lib/repositories/decisions';
import { listOrganisations } from '@/lib/repositories/organisations';
import { listTodos, createTodo, setTodoDone, deleteTodo } from '@/lib/repositories/todos';
import { isInQuietHours } from '@/lib/quietHours';
import { formatShortDate } from '@/lib/format';
import { quoteOfTheDay } from '@/lib/quotes';
import type { DecisionRow, OrganisationRow, ProjectTaskRow, TodoItemRow } from '@/types/db';

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

  const { data, loading, error, refresh, setData } = useAsync(async () => {
    if (!workspaceId || !me) {
      return {
        projects: [] as ProjectWithTasks[],
        decisions: [] as DecisionRow[],
        organisations: [] as OrganisationRow[],
        todos: [] as TodoItemRow[]
      };
    }
    const [projects, decisions, organisations, todos] = await Promise.all([
      listProjects(workspaceId),
      listDecisions(workspaceId),
      listOrganisations(workspaceId),
      listTodos(workspaceId, me.user_id)
    ]);
    return { projects, decisions, organisations, todos };
  }, [workspaceId, me?.user_id]);

  // "Right now" reads task/project state that can change from screens
  // reached deeper in the app (a task's thread, a project's own page) —
  // refetch on every return to Home instead of showing what was true when
  // the tab was first opened.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

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

    // Flagged for review by whoever's not the task's own owner — someone
    // finished their part and needs the other founder to look it over, not
    // a reminder to the same person who flagged it.
    const flaggedTask = data.projects
      .flatMap(p => p.project_tasks.map(t => ({ task: t, project: p })))
      .find(({ task }) => task.needs_review && task.owner_user_id !== me.user_id);
    if (flaggedTask) {
      items.push({
        key: `review-${flaggedTask.task.id}`,
        eyebrow: `Needs review · ${flaggedTask.project.title}`,
        title: flaggedTask.task.title,
        meta: '🔍 Flagged for you to check',
        href: `/(tabs)/projects/${flaggedTask.project.id}`
      });
    }

    const flaggedProject = data.projects.find(p => p.needs_review && p.created_by !== me.user_id);
    if (flaggedProject) {
      items.push({
        key: `review-project-${flaggedProject.id}`,
        eyebrow: `Needs review · ${flaggedProject.title}`,
        title: flaggedProject.next_action ?? 'Next action',
        meta: '🔍 Flagged for you to check',
        href: `/(tabs)/projects/${flaggedProject.id}`
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

  // The full list of what's assigned to you across every project — "Right
  // now" above only ever surfaces the single most urgent one of these.
  const myOpenTasks = useMemo(() => {
    if (!data || !me) return [];
    return data.projects
      .flatMap(p => p.project_tasks.map(t => ({ task: t, project: p })))
      .filter(({ task }) => task.status !== 'Done' && task.owner_user_id === me.user_id)
      .sort((a, b) => (a.task.due_at ?? '9999-99-99').localeCompare(b.task.due_at ?? '9999-99-99'));
  }, [data, me]);

  const completeTask = async (task: ProjectTaskRow) => {
    const updated = await setTaskStatus(task.id, 'Done');
    setData(prev =>
      prev
        ? {
            ...prev,
            projects: prev.projects.map(p =>
              p.id === updated.project_id ? { ...p, project_tasks: p.project_tasks.map(t => (t.id === updated.id ? updated : t)) } : p
            )
          }
        : prev
    );
  };

  const [todoDraft, setTodoDraft] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);

  const addTodo = async () => {
    const body = todoDraft.trim();
    if (!workspaceId || !me || !body) return;
    setAddingTodo(true);
    try {
      const item = await createTodo(workspaceId, me.user_id, body);
      setData(prev => (prev ? { ...prev, todos: [...prev.todos, item] } : prev));
      setTodoDraft('');
    } catch {
      showAlert('Could not add that', 'Try again in a moment.');
    } finally {
      setAddingTodo(false);
    }
  };

  const toggleTodo = async (item: TodoItemRow) => {
    setData(prev => (prev ? { ...prev, todos: prev.todos.map(t => (t.id === item.id ? { ...t, done: !t.done } : t)) } : prev));
    try {
      await setTodoDone(item.id, !item.done);
    } catch {
      setData(prev => (prev ? { ...prev, todos: prev.todos.map(t => (t.id === item.id ? item : t)) } : prev));
    }
  };

  const removeTodo = (item: TodoItemRow) => {
    showAlert(`Delete "${item.body}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setData(prev => (prev ? { ...prev, todos: prev.todos.filter(t => t.id !== item.id) } : prev));
          try {
            await deleteTodo(item.id);
          } catch {
            refresh();
          }
        }
      }
    ]);
  };

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

      <View style={{ gap: 10 }}>
        <SectionTitle title="My tasks" subtitle="Everything assigned to you, across every project." />
        {myOpenTasks.length === 0 ? (
          !loading && (
            <Card>
              <Text style={styles.meta}>Nothing assigned to you right now.</Text>
            </Card>
          )
        ) : (
          <Card style={{ gap: 2 }}>
            {myOpenTasks.map(({ task, project }, index) => (
              <View key={task.id} style={[styles.checkRow, index > 0 && styles.checkRowDivider]}>
                <Pressable onPress={() => completeTask(task)} hitSlop={10}>
                  <Ionicons name="ellipse-outline" size={22} color={theme.colors.muted} />
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/(tabs)/projects/${project.id}` as never)}>
                  <Text style={styles.checkRowTitle}>{task.title}</Text>
                  <Text style={styles.meta}>
                    {project.title}
                    {task.due_at ? ` · Due ${formatShortDate(task.due_at)}` : ''}
                  </Text>
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="To-do" subtitle="Quick things for you only — not tied to a project." />
        <Card style={{ gap: 10 }}>
          <View style={styles.todoInputRow}>
            <TextInput
              value={todoDraft}
              onChangeText={setTodoDraft}
              placeholder="Add something…"
              placeholderTextColor={theme.colors.muted}
              style={styles.todoInput}
              onSubmitEditing={addTodo}
              returnKeyType="done"
            />
            <Pressable style={styles.todoAdd} onPress={addTodo} disabled={addingTodo || !todoDraft.trim()}>
              <Ionicons name="add" size={22} color="#FFF" />
            </Pressable>
          </View>
          {data?.todos.length ? (
            <View style={{ gap: 2 }}>
              {[...data.todos]
                .sort((a, b) => Number(a.done) - Number(b.done))
                .map((item, index) => (
                  <View key={item.id} style={[styles.checkRow, index > 0 && styles.checkRowDivider]}>
                    <Pressable onPress={() => toggleTodo(item)} hitSlop={10}>
                      <Ionicons
                        name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={item.done ? theme.colors.gold : theme.colors.muted}
                      />
                    </Pressable>
                    <Text style={[styles.checkRowTitle, { flex: 1 }, item.done && styles.todoDone]}>{item.body}</Text>
                    <Pressable onPress={() => removeTodo(item)} hitSlop={10}>
                      <Ionicons name="close" size={18} color={theme.colors.muted} />
                    </Pressable>
                  </View>
                ))}
            </View>
          ) : (
            !loading && <Text style={styles.meta}>Nothing on your list.</Text>
          )}
        </Card>
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
  catchUpText: { color: theme.colors.muted, marginTop: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  checkRowDivider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  checkRowTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  todoInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  todoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  todoAdd: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.navy,
    alignItems: 'center',
    justifyContent: 'center'
  },
  todoDone: { color: theme.colors.muted, textDecorationLine: 'line-through' }
});
