import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Gantt, type GanttTask } from '@/components/Gantt';
import { LoadingState, ErrorState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { getProject, createTask, setProjectStatus, updateProject } from '@/lib/repositories/projects';
import { memberLabel } from '@/lib/ownerLabel';
import { toDateInputValue } from '@/lib/format';
import type { ProjectStatus } from '@/types/db';

const STATUSES: ProjectStatus[] = ['Active', 'Blocked', 'Complete'];

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { workspaceId, me, partner } = useWorkspace();
  const { data: project, loading, error, refresh, setData } = useAsync(() => getProject(id), [id]);

  const [nextAction, setNextAction] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskOwner, setTaskOwner] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [progressInput, setProgressInput] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);

  if (loading) return <LoadingState label="Loading project…" />;
  if (error || !project) return <ErrorState message={error ?? 'Project not found.'} onRetry={refresh} />;

  const ganttTasks: GanttTask[] = project.project_tasks.map(task => ({
    id: task.id,
    title: task.title,
    owner: memberLabel(task.owner_user_id, me, partner),
    start: toDateInputValue(task.start_at ?? task.created_at),
    end: toDateInputValue(task.due_at ?? task.start_at ?? task.created_at),
    status: task.status
  }));

  const changeStatus = async (status: ProjectStatus) => {
    const updated = await setProjectStatus(project.id, status);
    setData({ ...project, ...updated });
  };

  const saveNextAction = async () => {
    if (!nextAction.trim()) return;
    const updated = await updateProject(project.id, { next_action: nextAction.trim() });
    setData({ ...project, ...updated });
    setNextAction('');
  };

  const saveProgress = async (value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    setSavingProgress(true);
    try {
      const updated = await updateProject(project.id, { progress: clamped });
      setData({ ...project, ...updated });
      setProgressInput('');
    } finally {
      setSavingProgress(false);
    }
  };

  const addTask = async () => {
    if (!taskTitle.trim() || !workspaceId || !session) return;
    setAddingTask(true);
    try {
      await createTask({
        workspace_id: workspaceId,
        project_id: project.id,
        title: taskTitle.trim(),
        owner_user_id: taskOwner,
        created_by: session.user.id
      });
      setTaskTitle('');
      setTaskOwner(null);
      refresh();
    } finally {
      setAddingTask(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: project.title }} />

      <View style={styles.statusRow}>
        {STATUSES.map(status => (
          <Pressable key={status} onPress={() => changeStatus(status)}>
            <Pill label={status === project.status ? `● ${status}` : status} />
          </Pressable>
        ))}
      </View>

      <Card>
        <Text style={styles.label}>Progress</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${project.progress}%` }]} />
          </View>
          <Text style={styles.progressValue}>{project.progress}%</Text>
        </View>
        <View style={styles.progressButtons}>
          <Pressable
            style={styles.secondarySmall}
            onPress={() => saveProgress(project.progress - 10)}
            disabled={savingProgress || project.progress <= 0}
          >
            <Text style={styles.secondaryText}>-10%</Text>
          </Pressable>
          <Pressable
            style={styles.secondarySmall}
            onPress={() => saveProgress(project.progress + 10)}
            disabled={savingProgress || project.progress >= 100}
          >
            <Text style={styles.secondaryText}>+10%</Text>
          </Pressable>
          <TextInput
            value={progressInput}
            onChangeText={setProgressInput}
            placeholder="Set exact %"
            placeholderTextColor={theme.colors.muted}
            keyboardType="number-pad"
            style={styles.progressInput}
          />
          <Pressable
            style={styles.primarySmall}
            onPress={() => saveProgress(Number(progressInput))}
            disabled={savingProgress || progressInput.trim() === '' || Number.isNaN(Number(progressInput))}
          >
            <Text style={styles.primaryText}>Set</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text style={styles.label}>Next action</Text>
        <Text style={styles.nextAction}>{project.next_action ?? 'Not set yet.'}</Text>
        <TextInput
          value={nextAction}
          onChangeText={setNextAction}
          placeholder="Update the next action…"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        <Pressable style={styles.primarySmall} onPress={saveNextAction} disabled={!nextAction.trim()}>
          <Text style={styles.primaryText}>Save</Text>
        </Pressable>
      </Card>

      {ganttTasks.length > 0 ? (
        <Card>
          <Text style={styles.label}>Timeline</Text>
          <View style={{ marginTop: 14 }}>
            <Gantt tasks={ganttTasks} />
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.label}>Tasks</Text>
        {project.project_tasks.length === 0 ? (
          <Text style={styles.meta}>No tasks yet.</Text>
        ) : (
          project.project_tasks.map(task => (
            <Pressable
              key={task.id}
              style={styles.taskRow}
              onPress={() => router.push({ pathname: '/thread', params: { kind: 'task', id: task.id, title: task.title } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.meta}>
                  {memberLabel(task.owner_user_id, me, partner)} · {task.status}
                  {task.due_at ? ` · due ${toDateInputValue(task.due_at)}` : ''}
                </Text>
              </View>
              <Text style={styles.discuss}>Discuss →</Text>
            </Pressable>
          ))
        )}

        <View style={styles.newTask}>
          <TextInput
            value={taskTitle}
            onChangeText={setTaskTitle}
            placeholder="New task title"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
          <View style={styles.ownerPicker}>
            {[
              { label: 'Unassigned', value: null },
              me ? { label: me.display_name, value: me.user_id } : null,
              partner ? { label: partner.display_name, value: partner.user_id } : null
            ]
              .filter((o): o is { label: string; value: string | null } => o !== null)
              .map(option => (
                <Pressable key={option.label} onPress={() => setTaskOwner(option.value)}>
                  <Pill label={taskOwner === option.value ? `● ${option.label}` : option.label} />
                </Pressable>
              ))}
          </View>
          <Pressable style={styles.primarySmall} onPress={addTask} disabled={addingTask || !taskTitle.trim()}>
            <Text style={styles.primaryText}>{addingTask ? 'Adding…' : '+ Add task'}</Text>
          </Pressable>
        </View>
      </Card>

      <Pressable
        style={styles.discussProject}
        onPress={() => router.push({ pathname: '/thread', params: { kind: 'project', id: project.id, title: project.title } })}
      >
        <Text style={styles.discussProjectText}>Discuss this project →</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  nextAction: { color: theme.colors.text, marginTop: 8, lineHeight: 21 },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 4 },
  input: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  primarySmall: {
    backgroundColor: theme.colors.navy,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    marginTop: 12
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondarySmall: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  secondaryText: { color: theme.colors.text, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  progressTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 99, backgroundColor: theme.colors.gold },
  progressValue: { color: theme.colors.navy, fontWeight: '700', width: 44, textAlign: 'right' },
  progressButtons: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  progressInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    width: 100
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 12
  },
  taskTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  discuss: { color: theme.colors.navy, fontSize: 12, fontWeight: '600' },
  newTask: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  ownerPicker: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  discussProject: { backgroundColor: theme.colors.surfaceMuted, padding: 16, borderRadius: theme.radius.md, alignItems: 'center' },
  discussProjectText: { color: theme.colors.navy, fontWeight: '600' }
});
