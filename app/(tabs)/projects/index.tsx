import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { listProjects, createProject, createBookProject, updateProject, deleteProject } from '@/lib/repositories/projects';
import { summarizeOwners, memberLabel, ownerAccentColor } from '@/lib/ownerLabel';
import { toDateInputValue } from '@/lib/format';
import { BOOK_TASK_TEMPLATE } from '@/lib/bookTemplate';
import { PRIORITY_COLOR, PRIORITY_LEVELS } from '@/lib/priority';
import { computeProjectProgress } from '@/lib/taskStatus';

export default function ProjectsScreen() {
  const { session } = useAuth();
  const { workspaceId, me, partner } = useWorkspace();
  const { data: projects, loading, error, refresh, setData } = useAsync(
    () => (workspaceId ? listProjects(workspaceId) : Promise.resolve([])),
    [workspaceId]
  );

  const [showNew, setShowNew] = useState(false);
  const [newKind, setNewKind] = useState<'project' | 'book'>('project');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const create = async () => {
    if (!title.trim() || !workspaceId || !session) return;
    setCreating(true);
    try {
      if (newKind === 'book') {
        await createBookProject({ workspace_id: workspaceId, title: title.trim(), created_by: session.user.id });
      } else {
        await createProject({ workspace_id: workspaceId, title: title.trim(), created_by: session.user.id });
      }
      setTitle('');
      setShowNew(false);
      setNewKind('project');
      refresh();
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await updateProject(id, { title: editTitle.trim() });
      setData(prev => (prev ?? []).map(p => (p.id === id ? { ...p, ...updated } : p)));
      setEditingId(null);
      setEditTitle('');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = (id: string, projectTitle: string) => {
    Alert.alert(`Delete "${projectTitle}"?`, "This removes it and all its tasks. This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProject(id);
          setData(prev => (prev ?? []).filter(p => p.id !== id));
        }
      }
    ]);
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
        // Most important first — High priority projects lead the list
        // instead of just being colored the same as everything else.
        [...projects]
          .sort((a, b) => PRIORITY_LEVELS.indexOf(b.priority) - PRIORITY_LEVELS.indexOf(a.priority))
          .map(project => {
          const ganttTasks: GanttTask[] = project.project_tasks.map(task => ({
            id: task.id,
            title: task.title,
            owner: memberLabel(task.owner_user_id, me, partner),
            start: toDateInputValue(task.start_at ?? task.created_at),
            end: toDateInputValue(task.due_at ?? task.start_at ?? task.created_at),
            status: task.status
          }));
          const ownerLabel = summarizeOwners(project.project_tasks.map(t => t.owner_user_id), me, partner);
          const progress = project.status === 'Complete' ? 100 : computeProjectProgress(project.project_tasks);
          const accent = ownerAccentColor(project.created_by, me, partner);
          const isEditing = editingId === project.id;

          return (
            <Pressable key={project.id} onPress={() => !isEditing && router.push(`/(tabs)/projects/${project.id}`)}>
              <Card
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: PRIORITY_COLOR[project.priority],
                  backgroundColor: accent ?? theme.colors.surface
                }}
              >
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    {isEditing ? (
                      <TextInput value={editTitle} onChangeText={setEditTitle} style={styles.editInput} autoFocus />
                    ) : (
                      <Text style={styles.title}>{project.title}</Text>
                    )}
                    <Text style={styles.meta}>
                      {ownerLabel} · {project.status}
                      {project.due_at ? ` · due ${toDateInputValue(project.due_at)}` : ''}
                    </Text>
                  </View>
                  {isEditing ? (
                    <View style={styles.iconRow}>
                      <Pressable hitSlop={10} onPress={() => saveEdit(project.id)} disabled={savingEdit}>
                        <Text style={styles.saveText}>{savingEdit ? '…' : 'Save'}</Text>
                      </Pressable>
                      <Pressable hitSlop={10} onPress={cancelEdit} disabled={savingEdit}>
                        <Ionicons name="close-outline" size={20} color={theme.colors.muted} />
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.progress}>{progress}%</Text>
                      <View style={styles.iconRow}>
                        <Pressable hitSlop={10} onPress={() => startEdit(project.id, project.title)}>
                          <Ionicons name="pencil-outline" size={18} color={theme.colors.muted} />
                        </Pressable>
                        <Pressable hitSlop={10} onPress={() => confirmDelete(project.id, project.title)}>
                          <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
                <View style={styles.priorityChip}>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[project.priority] }]} />
                  <Text style={[styles.priorityChipText, { color: PRIORITY_COLOR[project.priority] }]}>
                    {project.priority} priority
                  </Text>
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
          <Text style={styles.label}>{newKind === 'book' ? 'New book' : 'New project'}</Text>
          <View style={styles.kindPicker}>
            <Pressable onPress={() => setNewKind('project')}>
              <Text style={[styles.kindChip, newKind === 'project' && styles.kindChipActive]}>Project</Text>
            </Pressable>
            <Pressable onPress={() => setNewKind('book')}>
              <Text style={[styles.kindChip, newKind === 'book' && styles.kindChipActive]}>Book</Text>
            </Pressable>
          </View>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={newKind === 'book' ? 'Book title' : 'Project title'}
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
          {newKind === 'book' ? (
            <Text style={styles.meta}>
              Creates {BOOK_TASK_TEMPLATE.length} tasks for the usual book workflow — book creation, checking, ISBN,
              props, Praveen, and the cultural box. Assign and date each one from the project.
            </Text>
          ) : null}
          <View style={styles.buttons}>
            <Pressable style={styles.primary} onPress={create} disabled={creating || !title.trim()}>
              <Text style={styles.primaryText}>
                {creating ? 'Creating…' : newKind === 'book' ? 'Create book project' : 'Create project'}
              </Text>
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
  editInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: 8,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    fontSize: 18,
    fontWeight: '600'
  },
  saveText: { color: theme.colors.navy, fontWeight: '600', fontSize: 13 },
  iconRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  meta: { color: theme.colors.muted, marginTop: 4, fontSize: 13 },
  progress: { color: theme.colors.navy, fontWeight: '700' },
  priorityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityChipText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  next: { color: theme.colors.text, marginTop: 12 },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: theme.colors.surfaceMuted, marginTop: 10, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 99, backgroundColor: theme.colors.gold },
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  kindPicker: { flexDirection: 'row', gap: 8, marginTop: 12 },
  kindChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    color: theme.colors.text,
    fontSize: 13
  },
  kindChipActive: { backgroundColor: theme.colors.navy, borderColor: theme.colors.navy, color: '#fff' },
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
