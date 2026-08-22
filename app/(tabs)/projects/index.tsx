import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { Gantt, type GanttTask } from '@/components/Gantt';
import { PageBanner } from '@/components/PageBanner';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listProjects, createProject } from '@/lib/repositories/projects';
import { summarizeOwners, memberLabel } from '@/lib/ownerLabel';
import { toDateInputValue } from '@/lib/format';
import { PRIORITY_COLOR } from '@/lib/priority';
import { computeProjectProgress } from '@/lib/taskStatus';

export default function ProjectsScreen() {
  const { session } = useAuth();
  const { workspaceId, me, partner } = useWorkspace();
  const { data: projects, loading, error, refresh } = useAsync(
    () => (workspaceId ? listProjects(workspaceId) : Promise.resolve([])),
    [workspaceId]
  );

  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!title.trim() || !workspaceId || !session) return;
    setCreating(true);
    try {
      await createProject({ workspace_id: workspaceId, title: title.trim(), created_by: session.user.id });
      setTitle('');
      setShowNew(false);
      refresh();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen>
      <SectionTitle title="Projects" subtitle="Shared work, owners, next actions and dependencies." />
      <PageBanner image={require('@/assets/images/reading-together.jpg')} />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !projects || projects.length === 0 ? (
        <EmptyState label="No projects yet. Start one below." />
      ) : (
        projects.map(project => {
          const ganttTasks: GanttTask[] = project.project_tasks.map(task => ({
            id: task.id,
            title: task.title,
            owner: memberLabel(task.owner_user_id, me, partner),
            start: toDateInputValue(task.start_at ?? task.created_at),
            end: toDateInputValue(task.due_at ?? task.start_at ?? task.created_at),
            status: task.status
          }));
          const ownerLabel = summarizeOwners(project.project_tasks.map(t => t.owner_user_id), me, partner);
          const progress = computeProjectProgress(project.project_tasks);

          return (
            <Pressable key={project.id} onPress={() => router.push(`/(tabs)/projects/${project.id}`)}>
              <Card style={{ borderLeftWidth: 4, borderLeftColor: PRIORITY_COLOR[project.priority] }}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{project.title}</Text>
                    <Text style={styles.meta}>
                      {ownerLabel} · {project.status}
                    </Text>
                  </View>
                  <Text style={styles.progress}>{progress}%</Text>
                </View>
                {project.next_action ? <Text style={styles.next}>Next: {project.next_action}</Text> : null}
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${progress}%` }]} />
                </View>
                {ganttTasks.length > 0 ? (
                  <View style={{ marginTop: 18 }}>
                    <Gantt tasks={ganttTasks} />
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        })
      )}

      {showNew ? (
        <Card>
          <Text style={styles.label}>New project</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Project title"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
          <View style={styles.buttons}>
            <Pressable style={styles.primary} onPress={create} disabled={creating || !title.trim()}>
              <Text style={styles.primaryText}>{creating ? 'Creating…' : 'Create project'}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setShowNew(false)}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <Pressable style={styles.newButton} onPress={() => setShowNew(true)}>
          <Text style={styles.newButtonText}>+ New project</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '600' },
  meta: { color: theme.colors.muted, marginTop: 4, fontSize: 13 },
  progress: { color: theme.colors.navy, fontWeight: '700' },
  next: { color: theme.colors.text, marginTop: 12 },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: theme.colors.surfaceMuted, marginTop: 10, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 99, backgroundColor: theme.colors.gold },
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  input: {
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primary: { backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, paddingHorizontal: 16, paddingVertical: 10 },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.sm, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryText: { color: theme.colors.text, fontWeight: '600' },
  newButton: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 16, alignItems: 'center' },
  newButtonText: { color: theme.colors.navy, fontWeight: '600' }
});
