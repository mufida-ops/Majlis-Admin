import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { PriorityBadge } from '@/components/PriorityBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { Gantt, type GanttTask } from '@/components/Gantt';
import { LoadingState, ErrorState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { getProject, createTask, updateTask, deleteTask, deleteProject, setProjectStatus, updateProject } from '@/lib/repositories/projects';
import { memberLabel, ownerAccentColor } from '@/lib/ownerLabel';
import { toDateInputValue } from '@/lib/format';
import { TASK_STATUSES, computeProjectProgress } from '@/lib/taskStatus';
import { PRIORITY_LEVELS } from '@/lib/priority';
import { PROJECT_STATUS_TINT } from '@/lib/projectStatus';
import { BOOK_SECTIONS } from '@/lib/bookTemplate';
import type { ProjectStatus, PriorityLevel, TaskStatus, ProjectTaskRow } from '@/types/db';

const BOOK_SECTION_ORDER = BOOK_SECTIONS.map(s => s.section);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const STATUSES: ProjectStatus[] = ['Not Started', 'Active', 'Blocked', 'Complete'];
const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  'Not Started': 'Not Started',
  Started: 'Started',
  Ongoing: 'Ongoing',
  Done: 'Done'
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { workspaceId, me, partner } = useWorkspace();
  const { data: project, loading, error, refresh, setData } = useAsync(() => getProject(id), [id]);

  // Refetch whenever this screen regains focus — e.g. coming back from a
  // task's own thread, where its status/owner/due date can change without
  // this screen's already-fetched data knowing about it.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const [nextAction, setNextAction] = useState('');
  const [projectDueDate, setProjectDueDate] = useState('');
  const [projectDueDateError, setProjectDueDateError] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskOwner, setTaskOwner] = useState<string | null>(null);
  const [taskPriority, setTaskPriority] = useState<PriorityLevel>('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskOwner, setEditTaskOwner] = useState<string | null>(null);
  const [editTaskPriority, setEditTaskPriority] = useState<PriorityLevel>('Medium');
  const [editTaskStatus, setEditTaskStatus] = useState<TaskStatus>('Not Started');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskError, setEditTaskError] = useState('');
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  if (loading) return <LoadingState label="Loading project…" />;
  if (error || !project) return <ErrorState message={error ?? 'Project not found.'} onRetry={refresh} />;

  // A project marked Complete should always read 100%, even if a task
  // still shows as not-Done (e.g. added after the fact) — the status pill
  // is the stronger signal.
  const progress = project.status === 'Complete' ? 100 : computeProjectProgress(project.project_tasks);

  const ganttTasks: GanttTask[] = project.project_tasks.map(task => ({
    id: task.id,
    title: task.title,
    owner: memberLabel(task.owner_user_id, me, partner),
    start: toDateInputValue(task.start_at ?? task.created_at),
    end: toDateInputValue(task.due_at ?? task.start_at ?? task.created_at),
    status: task.status
  }));

  // Tinted by progress (red/amber/green), not by who created it — a
  // project is shared work, so an owner tint here answers the wrong
  // question (unlike individual tasks, which do belong to one person).
  const projectAccent = PROJECT_STATUS_TINT[project.status];

  const startEditTitle = () => {
    setEditingTitle(true);
    setTitleDraft(project.title);
  };

  const saveTitle = async () => {
    if (!titleDraft.trim()) return;
    setSavingTitle(true);
    try {
      const updated = await updateProject(project.id, { title: titleDraft.trim() });
      setData({ ...project, ...updated });
      setEditingTitle(false);
    } finally {
      setSavingTitle(false);
    }
  };

  const changeStatus = async (status: ProjectStatus) => {
    const updated = await setProjectStatus(project.id, status);
    setData({ ...project, ...updated });
  };

  const changePriority = async (priority: PriorityLevel) => {
    const updated = await updateProject(project.id, { priority });
    setData({ ...project, ...updated });
  };

  const changeTaskPriority = async (taskId: string, priority: PriorityLevel) => {
    await updateTask(taskId, { priority });
    refresh();
  };

  const changeTaskStatus = async (taskId: string, status: TaskStatus) => {
    await updateTask(taskId, { status });
    refresh();
  };

  const toggleNeedsReview = async (taskId: string, current: boolean) => {
    try {
      await updateTask(taskId, { needs_review: !current });
      refresh();
    } catch (err) {
      Alert.alert('Could not flag that task', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const saveNextAction = async () => {
    if (!nextAction.trim()) return;
    const updated = await updateProject(project.id, { next_action: nextAction.trim() });
    setData({ ...project, ...updated });
    setNextAction('');
  };

  const clearNextAction = () => {
    Alert.alert('Clear the next action?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          const updated = await updateProject(project.id, { next_action: null });
          setData({ ...project, ...updated });
        }
      }
    ]);
  };

  const toggleProjectNeedsReview = async () => {
    try {
      const updated = await updateProject(project.id, { needs_review: !project.needs_review });
      setData({ ...project, ...updated });
    } catch (err) {
      Alert.alert('Could not flag this', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const saveProjectDueDate = async () => {
    if (!projectDueDate.trim()) return;
    if (!DATE_RE.test(projectDueDate.trim())) {
      setProjectDueDateError('Due date should look like YYYY-MM-DD.');
      return;
    }
    setProjectDueDateError('');
    const updated = await updateProject(project.id, { due_at: new Date(`${projectDueDate.trim()}T00:00:00`).toISOString() });
    setData({ ...project, ...updated });
    setProjectDueDate('');
  };

  const clearProjectDueDate = async () => {
    const updated = await updateProject(project.id, { due_at: null });
    setData({ ...project, ...updated });
  };

  const addTask = async () => {
    if (!workspaceId || !session) return;
    if (!taskTitle.trim()) {
      setTaskError('Add a title first.');
      return;
    }
    if (!taskOwner) {
      setTaskError('Pick who this is for first.');
      return;
    }
    if (!taskDueDate.trim()) {
      setTaskError('Add a due date first.');
      return;
    }
    if (!DATE_RE.test(taskDueDate.trim())) {
      setTaskError('Due date should look like YYYY-MM-DD.');
      return;
    }
    setAddingTask(true);
    setTaskError('');
    try {
      await createTask({
        workspace_id: workspaceId,
        project_id: project.id,
        title: taskTitle.trim(),
        owner_user_id: taskOwner,
        priority: taskPriority,
        due_at: new Date(`${taskDueDate.trim()}T00:00:00`).toISOString(),
        created_by: session.user.id
      });
      setTaskTitle('');
      setTaskOwner(null);
      setTaskPriority('Medium');
      setTaskDueDate('');
      refresh();
    } finally {
      setAddingTask(false);
    }
  };

  const startEditTask = (task: ProjectTaskRow) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskOwner(task.owner_user_id);
    setEditTaskPriority(task.priority);
    setEditTaskStatus(task.status);
    setEditTaskDueDate(task.due_at ? toDateInputValue(task.due_at) : '');
    setEditTaskError('');
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditTaskTitle('');
    setEditTaskError('');
  };

  const saveEditTask = async (taskId: string) => {
    if (!editTaskTitle.trim()) return;
    if (!editTaskOwner) {
      setEditTaskError('Pick who this is for first.');
      return;
    }
    if (!editTaskDueDate.trim()) {
      setEditTaskError('Add a due date first.');
      return;
    }
    if (!DATE_RE.test(editTaskDueDate.trim())) {
      setEditTaskError('Due date should look like YYYY-MM-DD.');
      return;
    }
    setSavingTaskEdit(true);
    setEditTaskError('');
    try {
      await updateTask(taskId, {
        title: editTaskTitle.trim(),
        owner_user_id: editTaskOwner,
        priority: editTaskPriority,
        status: editTaskStatus,
        due_at: new Date(`${editTaskDueDate.trim()}T00:00:00`).toISOString()
      });
      setEditingTaskId(null);
      setEditTaskTitle('');
      refresh();
    } finally {
      setSavingTaskEdit(false);
    }
  };

  const confirmDeleteTask = (taskId: string, title: string) => {
    Alert.alert(`Delete "${title}"?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(taskId);
          refresh();
        }
      }
    ]);
  };

  const renderTaskRow = (task: ProjectTaskRow) => {
    // Done overrides the owner tint with green — "finished" is a stronger,
    // more useful signal at a glance than whose task it was.
    const accent = task.status === 'Done' ? theme.colors.completedGreen : ownerAccentColor(task.owner_user_id, me, partner);
    if (editingTaskId === task.id) {
      return (
        <View key={task.id} style={[styles.taskRowEditing, { backgroundColor: accent ?? theme.colors.background }]}>
          <TextInput value={editTaskTitle} onChangeText={setEditTaskTitle} style={styles.input} autoFocus />
          <TextInput
            value={editTaskDueDate}
            onChangeText={setEditTaskDueDate}
            placeholder="Due date, e.g. 2026-09-01"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Progress</Text>
          <View style={styles.ownerPicker}>
            {TASK_STATUSES.map(status => (
              <Pressable key={status} onPress={() => setEditTaskStatus(status)}>
                <Pill label={editTaskStatus === status ? `● ${TASK_STATUS_LABEL[status]}` : TASK_STATUS_LABEL[status]} />
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Who's this for?</Text>
          <View style={styles.ownerPicker}>
            {[me ? { label: me.display_name.charAt(0).toUpperCase(), value: me.user_id } : null,
              partner ? { label: partner.display_name.charAt(0).toUpperCase(), value: partner.user_id } : null]
              .filter((o): o is { label: string; value: string } => o !== null)
              .map(option => (
                <Pressable key={option.label} onPress={() => setEditTaskOwner(option.value)}>
                  <Pill label={editTaskOwner === option.value ? `● ${option.label}` : option.label} />
                </Pressable>
              ))}
          </View>
          <Text style={styles.fieldLabel}>How important?</Text>
          <View style={styles.ownerPicker}>
            {PRIORITY_LEVELS.map(level => (
              <Pressable key={level} onPress={() => setEditTaskPriority(level)}>
                <Pill label={editTaskPriority === level ? `● ${level}` : level} />
              </Pressable>
            ))}
          </View>
          {editTaskError ? <Text style={styles.taskError}>{editTaskError}</Text> : null}
          <View style={styles.taskControls}>
            <Pressable style={styles.primarySmall} onPress={() => saveEditTask(task.id)} disabled={savingTaskEdit}>
              <Text style={styles.primaryText}>{savingTaskEdit ? '…' : 'Save'}</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={cancelEditTask}>
              <Text style={styles.meta}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return (
      <View key={task.id} style={[styles.taskRow, { backgroundColor: accent ?? theme.colors.background }]}>
        <Pressable onPress={() => router.push({ pathname: '/thread', params: { kind: 'task', id: task.id, title: task.title } })}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.meta}>
            {memberLabel(task.owner_user_id, me, partner)}
            {task.due_at ? ` · due ${toDateInputValue(task.due_at)}` : ' · no due date'}
          </Text>
          {task.needs_review ? <Text style={styles.needsReview}>🔍 Needs review</Text> : null}
        </Pressable>
        <View style={styles.taskControls}>
          <StatusBadge value={task.status} onChange={s => changeTaskStatus(task.id, s)} />
          <PriorityBadge value={task.priority} onChange={p => changeTaskPriority(task.id, p)} />
          <Pressable hitSlop={8} onPress={() => toggleNeedsReview(task.id, task.needs_review)}>
            <Ionicons
              name={task.needs_review ? 'flag' : 'flag-outline'}
              size={18}
              color={task.needs_review ? theme.colors.danger : theme.colors.muted}
            />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => startEditTask(task)}>
            <Ionicons name="pencil-outline" size={18} color={theme.colors.muted} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => confirmDeleteTask(task.id, task.title)}>
            <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderTaskGroups = (tasks: ProjectTaskRow[]) =>
    TASK_STATUSES.map(status => {
      const tasksInStatus = tasks.filter(t => t.status === status);
      if (tasksInStatus.length === 0) return null;
      return (
        <View key={status} style={styles.statusGroup}>
          <Text style={styles.statusGroupLabel}>
            {TASK_STATUS_LABEL[status]} · {tasksInStatus.length}
          </Text>
          {tasksInStatus.map(renderTaskRow)}
        </View>
      );
    });

  const confirmDeleteProject = () => {
    Alert.alert(`Delete "${project.title}"?`, "This removes it and all its tasks. This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProject(project.id);
          router.back();
        }
      }
    ]);
  };

  // Book-template tasks carry a section (Book Creation, ISBN, Props, …) so
  // they show as named collapsible groups instead of one flat 60-item list.
  // Ordinary projects have no section on any task and fall back to the
  // plain status grouping below.
  const presentSections = Array.from(new Set(project.project_tasks.map(t => t.section).filter((s): s is string => !!s)));
  const orderedSections = [
    ...BOOK_SECTION_ORDER.filter(s => presentSections.includes(s)),
    ...presentSections.filter(s => !BOOK_SECTION_ORDER.includes(s))
  ];
  const unsectionedTasks = project.project_tasks.filter(t => !t.section);

  return (
    <Screen>
      <Stack.Screen options={{ title: project.title }} />

      <Card style={{ backgroundColor: projectAccent }}>
        {editingTitle ? (
          <View style={styles.titleEditRow}>
            <TextInput value={titleDraft} onChangeText={setTitleDraft} style={[styles.input, { flex: 1, marginTop: 0 }]} autoFocus />
            <Pressable hitSlop={10} onPress={saveTitle} disabled={savingTitle}>
              <Text style={styles.saveText}>{savingTitle ? '…' : 'Save'}</Text>
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setEditingTitle(false)} disabled={savingTitle}>
              <Ionicons name="close-outline" size={20} color={theme.colors.muted} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.titleEditRow}>
            <Text style={[styles.label, { flex: 1, fontSize: 18 }]}>{project.title}</Text>
            <Pressable hitSlop={10} onPress={startEditTitle}>
              <Ionicons name="pencil-outline" size={18} color={theme.colors.muted} />
            </Pressable>
          </View>
        )}
      </Card>

      <View style={styles.statusRow}>
        {STATUSES.map(status => (
          <Pressable key={status} onPress={() => changeStatus(status)}>
            <Pill label={status === project.status ? `● ${status}` : status} />
          </Pressable>
        ))}
        <PriorityBadge value={project.priority} onChange={changePriority} />
      </View>

      <Card>
        <Text style={styles.label}>Progress</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressValue}>{progress}%</Text>
        </View>
        <Text style={styles.meta}>
          Calculated automatically — every task counts equally, and progress adds up as tasks are checked off Done.
        </Text>
      </Card>

      <Card>
        <View style={styles.titleEditRow}>
          <Text style={[styles.label, { flex: 1 }]}>Next action</Text>
          {project.next_action ? (
            <Pressable hitSlop={8} onPress={clearNextAction}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.nextAction}>{project.next_action ?? 'Not set yet.'}</Text>
        <TextInput
          value={nextAction}
          onChangeText={setNextAction}
          placeholder="Update the next action…"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        <Pressable
          style={[styles.primarySmall, !nextAction.trim() && styles.primarySmallDisabled]}
          onPress={saveNextAction}
          disabled={!nextAction.trim()}
        >
          <Text style={styles.primaryText}>Save next action</Text>
        </Pressable>

        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Due date</Text>
        <View style={styles.titleEditRow}>
          <Text style={[styles.nextAction, { flex: 1, marginTop: 0 }]}>
            {project.due_at ? toDateInputValue(project.due_at) : 'Not set yet.'}
          </Text>
          {project.due_at ? (
            <Pressable hitSlop={8} onPress={clearProjectDueDate}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <TextInput
          value={projectDueDate}
          onChangeText={setProjectDueDate}
          placeholder="Due date, e.g. 2026-09-01"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        {projectDueDateError ? <Text style={styles.taskError}>{projectDueDateError}</Text> : null}
        <Pressable
          style={[styles.primarySmall, !projectDueDate.trim() && styles.primarySmallDisabled]}
          onPress={saveProjectDueDate}
          disabled={!projectDueDate.trim()}
        >
          <Text style={styles.primaryText}>Save due date</Text>
        </Pressable>

        <Pressable style={styles.reviewToggle} onPress={toggleProjectNeedsReview} hitSlop={8}>
          <Text style={project.needs_review ? styles.needsReview : styles.fieldLabel}>
            {project.needs_review ? '🔍 Needs review — tap to clear' : '+ Flag for review'}
          </Text>
        </Pressable>
      </Card>

      {ganttTasks.length > 0 ? (
        <Card>
          <View style={styles.titleEditRow}>
            <Text style={[styles.label, { flex: 1 }]}>Timeline</Text>
            <Pressable hitSlop={8} onPress={() => setTimelineExpanded(v => !v)}>
              <Text style={styles.saveText}>
                {timelineExpanded ? 'Hide' : `Show (${ganttTasks.length} task${ganttTasks.length === 1 ? '' : 's'})`}
              </Text>
            </Pressable>
          </View>
          {timelineExpanded ? (
            <View style={{ marginTop: 14 }}>
              <Gantt tasks={ganttTasks} />
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.label}>Tasks</Text>
        {project.project_tasks.length === 0 ? (
          <Text style={styles.meta}>No tasks yet.</Text>
        ) : orderedSections.length === 0 ? (
          renderTaskGroups(project.project_tasks)
        ) : (
          <>
            {orderedSections.map(section => {
              const tasksInSection = project.project_tasks.filter(t => t.section === section);
              const isExpanded = expandedSections.has(section);
              return (
                <View key={section} style={styles.statusGroup}>
                  <Pressable onPress={() => toggleSection(section)} hitSlop={8}>
                    <Text style={styles.sectionHeader}>
                      {isExpanded ? '▾' : '▸'} {section} · {tasksInSection.length}
                    </Text>
                  </Pressable>
                  {isExpanded ? renderTaskGroups(tasksInSection) : null}
                </View>
              );
            })}
            {unsectionedTasks.length > 0 ? renderTaskGroups(unsectionedTasks) : null}
          </>
        )}
        <View style={styles.newTask}>
          <TextInput
            value={taskTitle}
            onChangeText={setTaskTitle}
            placeholder="New task title"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
          <TextInput
            value={taskDueDate}
            onChangeText={setTaskDueDate}
            placeholder="Due date, e.g. 2026-09-01"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Who's this for?</Text>
          <View style={styles.ownerPicker}>
            {[me ? { label: me.display_name.charAt(0).toUpperCase(), value: me.user_id } : null,
              partner ? { label: partner.display_name.charAt(0).toUpperCase(), value: partner.user_id } : null]
              .filter((o): o is { label: string; value: string } => o !== null)
              .map(option => (
                <Pressable key={option.label} onPress={() => setTaskOwner(option.value)}>
                  <Pill label={taskOwner === option.value ? `● ${option.label}` : option.label} />
                </Pressable>
              ))}
          </View>
          <Text style={styles.fieldLabel}>How important?</Text>
          <View style={styles.ownerPicker}>
            {PRIORITY_LEVELS.map(level => (
              <Pressable key={level} onPress={() => setTaskPriority(level)}>
                <Pill label={taskPriority === level ? `● ${level}` : level} />
              </Pressable>
            ))}
          </View>
          {taskError ? <Text style={styles.taskError}>{taskError}</Text> : null}
          <Pressable
            style={[styles.primarySmall, addingTask && styles.primarySmallDisabled]}
            onPress={addTask}
            disabled={addingTask}
          >
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

      <Pressable style={styles.deleteProjectButton} onPress={confirmDeleteProject}>
        <Text style={styles.deleteProjectText}>Delete project</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  titleEditRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  saveText: { color: theme.colors.navy, fontWeight: '600', fontSize: 13 },
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
  primarySmallDisabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  progressTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 99, backgroundColor: theme.colors.gold },
  progressValue: { color: theme.colors.navy, fontWeight: '700', width: 44, textAlign: 'right' },
  statusGroup: { marginTop: 16 },
  statusGroupLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  sectionHeader: { color: theme.colors.navy, fontSize: 16, fontWeight: '700' },
  // A slim list row, not a boxed card — rows sit directly one after another
  // (a hairline divider between them, not a gap), and the owner's color
  // fills the whole row rather than just a badge or edge accent.
  taskRow: {
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  needsReview: { color: theme.colors.danger, fontSize: 12, fontWeight: '700', marginTop: 4 },
  taskRowEditing: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  taskTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  // Its own row below the title, not squeezed beside it — a long task
  // title used to force this into a narrow column and wrap badly.
  taskControls: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  newTask: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  taskError: { color: theme.colors.danger, fontSize: 12, marginTop: 8 },
  fieldLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '600', marginTop: 12 },
  reviewToggle: { marginTop: 16 },
  ownerPicker: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  discussProject: { backgroundColor: theme.colors.surfaceMuted, padding: 16, borderRadius: theme.radius.md, alignItems: 'center' },
  deleteProjectButton: { padding: 16, borderRadius: theme.radius.md, alignItems: 'center' },
  deleteProjectText: { color: theme.colors.danger, fontWeight: '600' },
  discussProjectText: { color: theme.colors.navy, fontWeight: '600' }
});
