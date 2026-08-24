import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { showAlert } from '@/lib/alert';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { LoadingState, ErrorState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { getOrCreateThread, listMessages, postMessage, deleteMessage } from '@/lib/repositories/threads';
import { getTask, updateTask } from '@/lib/repositories/projects';
import { listActivityForTask } from '@/lib/repositories/activity';
import { memberLabel } from '@/lib/ownerLabel';
import { formatTime, formatShortDate, toDateInputValue } from '@/lib/format';
import { TASK_STATUSES } from '@/lib/taskStatus';
import type { MessageRow, ThreadRow, ProjectTaskRow, TaskStatus, PriorityLevel, ActivityEventRow } from '@/types/db';

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  'Not Started': 'Not Started',
  Started: 'Started',
  Ongoing: 'Ongoing',
  Done: 'Done'
};

type ThreadKind = 'project' | 'task' | 'organisation' | 'decision';

const anchorColumn: Record<ThreadKind, 'project_id' | 'task_id' | 'organisation_id' | 'decision_id'> = {
  project: 'project_id',
  task: 'task_id',
  organisation: 'organisation_id',
  decision: 'decision_id'
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function ThreadScreen() {
  const params = useLocalSearchParams<{ kind: ThreadKind; id: string; title?: string }>();
  const { session } = useAuth();
  const { workspaceId, me, partner } = useWorkspace();

  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [task, setTask] = useState<ProjectTaskRow | null>(null);
  const [taskHistory, setTaskHistory] = useState<ActivityEventRow[]>([]);
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [savingDueDate, setSavingDueDate] = useState(false);
  const [dueDateError, setDueDateError] = useState('');
  const [reviewError, setReviewError] = useState('');

  const load = useCallback(async () => {
    if (!workspaceId || !params.kind || !params.id) return;
    setLoading(true);
    setError(null);
    try {
      const column = anchorColumn[params.kind];
      const [t, taskRow, history] = await Promise.all([
        getOrCreateThread(workspaceId, { [column]: params.id } as never),
        params.kind === 'task' ? getTask(params.id) : Promise.resolve(null),
        params.kind === 'task' ? listActivityForTask(params.id) : Promise.resolve([])
      ]);
      setThread(t);
      const msgs = await listMessages(t.id);
      setMessages(msgs);
      setTask(taskRow);
      setTaskHistory(history);
      setDueDateDraft(taskRow?.due_at ? toDateInputValue(taskRow.due_at) : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this thread.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, params.kind, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!thread || !session || !body.trim() || !workspaceId) return;
    setSending(true);
    try {
      const msg = await postMessage({
        workspace_id: workspaceId,
        thread_id: thread.id,
        author_user_id: session.user.id,
        body: body.trim()
      });
      setMessages(prev => [...prev, msg]);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that message.');
    } finally {
      setSending(false);
    }
  };

  const changeTaskStatus = async (status: TaskStatus) => {
    if (!task) return;
    const updated = await updateTask(task.id, { status });
    setTask(updated);
    listActivityForTask(task.id).then(setTaskHistory).catch(() => {});
  };

  const changeTaskPriority = async (priority: PriorityLevel) => {
    if (!task) return;
    const updated = await updateTask(task.id, { priority });
    setTask(updated);
  };

  const changeTaskOwner = async (ownerUserId: string) => {
    if (!task) return;
    const updated = await updateTask(task.id, { owner_user_id: ownerUserId });
    setTask(updated);
  };

  const toggleNeedsReview = async () => {
    if (!task) return;
    try {
      const updated = await updateTask(task.id, { needs_review: !task.needs_review });
      setTask(updated);
      setReviewError('');
      listActivityForTask(task.id).then(setTaskHistory).catch(() => {});
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not flag that task.');
    }
  };

  const saveDueDate = async () => {
    if (!task) return;
    if (dueDateDraft.trim() && !DATE_RE.test(dueDateDraft.trim())) {
      setDueDateError('Due date should look like YYYY-MM-DD.');
      return;
    }
    setSavingDueDate(true);
    setDueDateError('');
    try {
      const due_at = dueDateDraft.trim() ? new Date(`${dueDateDraft.trim()}T00:00:00`).toISOString() : null;
      const updated = await updateTask(task.id, { due_at });
      setTask(updated);
    } catch (err) {
      setDueDateError(err instanceof Error ? err.message : 'Could not save that due date.');
    } finally {
      setSavingDueDate(false);
    }
  };

  const confirmDeleteMessage = (id: string) => {
    showAlert('Delete message?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setMessages(prev => prev.filter(m => m.id !== id));
          try {
            await deleteMessage(id);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete that message.');
            load();
          }
        }
      }
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title: params.title ?? 'Thread', headerStyle: { backgroundColor: theme.colors.background }, headerTintColor: theme.colors.navy }} />
      <Screen contentStyle={{ paddingBottom: 16 }}>
        {loading ? (
          <LoadingState label="Loading thread…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <View style={{ gap: 10 }}>
            {task ? (
              <Card>
                <View style={styles.taskControlsRow}>
                  <StatusBadge value={task.status} onChange={changeTaskStatus} />
                  <PriorityBadge value={task.priority} onChange={changeTaskPriority} />
                </View>
                <Text style={styles.dueLabel}>Assigned to</Text>
                <View style={styles.chipRow}>
                  {[me ? { label: me.display_name.charAt(0).toUpperCase(), value: me.user_id } : null,
                    partner ? { label: partner.display_name.charAt(0).toUpperCase(), value: partner.user_id } : null]
                    .filter((o): o is { label: string; value: string } => o !== null)
                    .map(option => (
                      <Pressable key={option.value} onPress={() => changeTaskOwner(option.value)}>
                        <Pill label={task.owner_user_id === option.value ? `● ${option.label}` : option.label} />
                      </Pressable>
                    ))}
                </View>
                <Text style={styles.dueLabel}>Progress</Text>
                <View style={styles.chipRow}>
                  {TASK_STATUSES.map(status => (
                    <Pressable key={status} onPress={() => changeTaskStatus(status)}>
                      <Pill label={task.status === status ? `● ${TASK_STATUS_LABEL[status]}` : TASK_STATUS_LABEL[status]} />
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.dueLabel}>Due date</Text>
                <View style={styles.dueRow}>
                  <TextInput
                    value={dueDateDraft}
                    onChangeText={setDueDateDraft}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, { flex: 1, marginTop: 0 }]}
                  />
                  <Pressable style={styles.dueSave} onPress={saveDueDate} disabled={savingDueDate}>
                    <Text style={styles.sendText}>{savingDueDate ? '…' : 'Save'}</Text>
                  </Pressable>
                </View>
                {dueDateError ? <Text style={styles.dueError}>{dueDateError}</Text> : null}
                <Pressable style={styles.reviewToggle} onPress={toggleNeedsReview} hitSlop={8}>
                  <Text style={task.needs_review ? styles.reviewOn : styles.reviewOff}>
                    {task.needs_review ? '🔍 Needs review — tap to clear' : '+ Flag for review'}
                  </Text>
                </Pressable>
                {reviewError ? <Text style={styles.dueError}>{reviewError}</Text> : null}
                {taskHistory.length > 0 ? (
                  <View style={styles.history}>
                    <Text style={styles.dueLabel}>History</Text>
                    {taskHistory.map(event => (
                      <Text key={event.id} style={styles.historyLine}>
                        {formatShortDate(event.created_at)} {formatTime(event.created_at)} — {event.summary}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : null}
            {messages.length === 0 ? (
              <Card>
                <Text style={styles.empty}>No messages yet. Start the discussion below.</Text>
              </Card>
            ) : (
              messages.map(msg => (
                <Card key={msg.id} style={msg.author_user_id === session?.user.id ? styles.mine : undefined}>
                  <View style={styles.messageHeader}>
                    <Text style={styles.author}>
                      {memberLabel(msg.author_user_id, me, partner)} · {formatShortDate(msg.created_at)} {formatTime(msg.created_at)}
                    </Text>
                    {msg.author_user_id === session?.user.id ? (
                      <Pressable hitSlop={10} onPress={() => confirmDeleteMessage(msg.id)}>
                        <Text style={styles.deleteMessage}>Delete</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.body}>{msg.body}</Text>
                </Card>
              ))
            )}
          </View>
        )}
      </Screen>
      <View style={styles.composer}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Add to the discussion…"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          multiline
        />
        <Pressable style={styles.send} onPress={send} disabled={sending || !body.trim()}>
          <Text style={styles.sendText}>{sending ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  empty: { color: theme.colors.muted },
  taskControlsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  dueLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '600', marginTop: 14 },
  dueRow: { flexDirection: 'row', gap: 10, marginTop: 8, alignItems: 'center' },
  dueSave: { backgroundColor: theme.colors.navy, paddingHorizontal: 16, paddingVertical: 12, borderRadius: theme.radius.md },
  dueError: { color: theme.colors.danger, fontSize: 12, marginTop: 8 },
  reviewToggle: { marginTop: 14 },
  reviewOn: { color: theme.colors.danger, fontSize: 13, fontWeight: '700' },
  reviewOff: { color: theme.colors.muted, fontSize: 13, fontWeight: '600' },
  history: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.colors.border },
  historyLine: { color: theme.colors.muted, fontSize: 12, marginTop: 6 },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  author: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  deleteMessage: { color: theme.colors.danger, fontSize: 12, fontWeight: '600' },
  body: { color: theme.colors.text, marginTop: 6, lineHeight: 21, fontSize: 15 },
  mine: { backgroundColor: theme.colors.surfaceMuted },
  composer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'flex-end'
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    maxHeight: 100,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  send: { backgroundColor: theme.colors.navy, paddingHorizontal: 18, paddingVertical: 12, borderRadius: theme.radius.md },
  sendText: { color: '#fff', fontWeight: '600' }
});
