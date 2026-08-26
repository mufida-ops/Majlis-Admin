import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@/lib/alert';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { LoadingState, ErrorState } from '@/components/AsyncState';
import { MessageImage } from '@/components/MessageImage';
import { VoiceMessage, formatClipDuration } from '@/components/VoiceMessage';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import {
  getOrCreateThread,
  listMessages,
  postMessage,
  deleteMessage,
  uploadMessageImage,
  uploadMessageAudio
} from '@/lib/repositories/threads';
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
  const [pendingImagePath, setPendingImagePath] = useState<string | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const [pendingAudioPath, setPendingAudioPath] = useState<string | null>(null);
  const [pendingAudioDuration, setPendingAudioDuration] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [preparingAudio, setPreparingAudio] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo access in your phone settings to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !thread) return;
    const asset = result.assets[0];
    setPickingImage(true);
    setPendingImagePreview(asset.uri);
    try {
      const path = await uploadMessageImage(thread.id, {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg'
      });
      setPendingImagePath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach that photo.');
      setPendingImagePreview(null);
    } finally {
      setPickingImage(false);
    }
  };

  const clearPendingImage = () => {
    setPendingImagePath(null);
    setPendingImagePreview(null);
  };

  const clearPendingAudio = () => {
    setPendingAudioPath(null);
    setPendingAudioDuration(null);
  };

  const startRecording = async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Allow microphone access in your phone settings to record a voice message.');
      return;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    recordingRef.current = recording;
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording || !thread) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setPreparingAudio(true);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('That recording did not save. Try again.');
      const path = await uploadMessageAudio(thread.id, { uri, mimeType: 'audio/m4a' });
      setPendingAudioPath(path);
      setPendingAudioDuration(status.durationMillis ? Math.round(status.durationMillis / 1000) : recordingSeconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach that voice message.');
    } finally {
      setPreparingAudio(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const send = async () => {
    if (!thread || !session || !workspaceId) return;
    if (!body.trim() && !pendingImagePath && !pendingAudioPath) return;
    setSending(true);
    try {
      const msg = await postMessage({
        workspace_id: workspaceId,
        thread_id: thread.id,
        author_user_id: session.user.id,
        body: body.trim(),
        image_path: pendingImagePath,
        audio_path: pendingAudioPath,
        audio_duration_seconds: pendingAudioDuration
      });
      setMessages(prev => [...prev, msg]);
      setBody('');
      clearPendingImage();
      clearPendingAudio();
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
            {task && workspaceId && session ? (
              <AttachmentsSection workspaceId={workspaceId} createdBy={session.user.id} scope={{ task_id: task.id }} />
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
                  {msg.body ? <Text style={styles.body}>{msg.body}</Text> : null}
                  {msg.image_path ? (
                    <View style={msg.body ? styles.imageWrap : undefined}>
                      <MessageImage storagePath={msg.image_path} />
                    </View>
                  ) : null}
                  {msg.audio_path ? (
                    <View style={msg.body || msg.image_path ? styles.imageWrap : undefined}>
                      <VoiceMessage storagePath={msg.audio_path} durationSeconds={msg.audio_duration_seconds} />
                    </View>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        )}
      </Screen>
      {pendingImagePreview ? (
        <View style={styles.pendingRow}>
          <Image source={{ uri: pendingImagePreview }} style={styles.pendingThumb} />
          {pickingImage ? <ActivityIndicator color={theme.colors.navy} style={{ marginLeft: 10 }} /> : null}
          <Pressable onPress={clearPendingImage} hitSlop={10} style={styles.pendingRemove}>
            <Ionicons name="close-circle" size={22} color={theme.colors.muted} />
          </Pressable>
        </View>
      ) : null}
      {pendingAudioPath ? (
        <View style={styles.pendingRow}>
          <Ionicons name="mic" size={22} color={theme.colors.navy} />
          <Text style={styles.pendingAudioLabel}>Voice message · {formatClipDuration(pendingAudioDuration)}</Text>
          <Pressable onPress={clearPendingAudio} hitSlop={10} style={styles.pendingRemove}>
            <Ionicons name="close-circle" size={22} color={theme.colors.muted} />
          </Pressable>
        </View>
      ) : null}
      {isRecording ? (
        <View style={styles.pendingRow}>
          <View style={styles.recordingDot} />
          <Text style={styles.pendingAudioLabel}>Recording… {formatClipDuration(recordingSeconds)}</Text>
        </View>
      ) : null}
      <View style={styles.composer}>
        <Pressable onPress={pickImage} hitSlop={10} style={styles.attachButton} disabled={pickingImage || isRecording}>
          <Ionicons name="image-outline" size={24} color={theme.colors.navy} />
        </Pressable>
        <Pressable
          onPress={isRecording ? stopRecording : startRecording}
          hitSlop={10}
          style={styles.attachButton}
          disabled={preparingAudio || !!pendingAudioPath}
        >
          {preparingAudio ? (
            <ActivityIndicator color={theme.colors.navy} size="small" />
          ) : (
            <Ionicons name={isRecording ? 'stop-circle' : 'mic-outline'} size={24} color={isRecording ? theme.colors.danger : theme.colors.navy} />
          )}
        </Pressable>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Add to the discussion…"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          multiline
        />
        <Pressable
          style={styles.send}
          onPress={send}
          disabled={sending || pickingImage || isRecording || (!body.trim() && !pendingImagePath && !pendingAudioPath)}
        >
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
  imageWrap: { marginTop: 8 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: theme.colors.surface
  },
  pendingThumb: { width: 56, height: 56, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted },
  pendingRemove: { marginLeft: 'auto' },
  pendingAudioLabel: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginLeft: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.danger },
  attachButton: { paddingBottom: 12 },
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
