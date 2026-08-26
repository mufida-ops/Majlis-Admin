import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { LoadingState, ErrorState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { showAlert } from '@/lib/alert';
import { useWorkspace } from '@/lib/workspace';
import {
  getTodo,
  updateTodoBody,
  setTodoDone,
  deleteTodo,
  updateTodoDetails,
  parkTodo,
  resumeTodo,
  listProgressUpdates,
  addProgressUpdate,
  listTodoLinks,
  addTodoLink,
  deleteTodoLink
} from '@/lib/repositories/todos';
import { formatShortDate, formatRelative } from '@/lib/format';
import type { TodoItemRow, TodoProgressUpdateRow, TodoLinkRow, TodoLinkType } from '@/types/db';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const LINK_TYPES: { value: TodoLinkType; label: string }[] = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'claude', label: 'Claude' },
  { value: 'document', label: 'Document' },
  { value: 'canva', label: 'Canva' },
  { value: 'website', label: 'Website' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' }
];

export default function TodoItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, workspaceId } = useWorkspace();

  const [todo, setTodo] = useState<TodoItemRow | null>(null);
  const [history, setHistory] = useState<TodoProgressUpdateRow[]>([]);
  const [links, setLinks] = useState<TodoLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [item, progress, itemLinks] = await Promise.all([getTodo(id), listProgressUpdates(id), listTodoLinks(id)]);
      setTodo(item);
      setHistory(progress);
      setLinks(itemLinks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this to-do.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // --- Title ---
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  const startEditTitle = () => {
    if (!todo) return;
    setTitleDraft(todo.body);
    setEditingTitle(true);
  };
  const saveTitle = async () => {
    if (!todo || !titleDraft.trim()) return;
    setSavingTitle(true);
    try {
      const updated = await updateTodoBody(todo.id, titleDraft.trim());
      setTodo(updated);
      setEditingTitle(false);
    } finally {
      setSavingTitle(false);
    }
  };

  const toggleDone = async () => {
    if (!todo) return;
    const updated = await setTodoDone(todo.id, !todo.done);
    setTodo(updated);
  };

  const confirmDelete = () => {
    if (!todo) return;
    showAlert(`Delete "${todo.body}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTodo(todo.id); router.back(); } }
    ]);
  };

  // --- Why this matters / estimate ---
  const [whyDraft, setWhyDraft] = useState('');
  const [estimateDraft, setEstimateDraft] = useState('');
  const [detailsTouched, setDetailsTouched] = useState(false);

  useEffect(() => {
    if (!todo || detailsTouched) return;
    setWhyDraft(todo.why_it_matters ?? '');
    setEstimateDraft(todo.estimated_minutes_remaining != null ? String(todo.estimated_minutes_remaining / 60) : '');
  }, [todo, detailsTouched]);

  const saveDetails = async () => {
    if (!todo) return;
    const hours = parseFloat(estimateDraft);
    const updated = await updateTodoDetails(todo.id, {
      why_it_matters: whyDraft.trim() || null,
      estimated_minutes_remaining: estimateDraft.trim() && !isNaN(hours) ? Math.round(hours * 60) : null
    });
    setTodo(updated);
  };

  // --- Safely park ---
  const [parking, setParking] = useState(false);
  const [returnDateDraft, setReturnDateDraft] = useState('');
  const [restartPointDraft, setRestartPointDraft] = useState('');
  const [parkError, setParkError] = useState('');
  const [savingPark, setSavingPark] = useState(false);

  const beginPark = () => {
    setReturnDateDraft(todo?.return_at ?? '');
    setRestartPointDraft(todo?.restart_point ?? '');
    setParkError('');
    setParking(true);
  };

  const confirmPark = async () => {
    if (!todo) return;
    if (returnDateDraft.trim() && !DATE_RE.test(returnDateDraft.trim())) {
      setParkError('Return date should look like YYYY-MM-DD.');
      return;
    }
    setSavingPark(true);
    try {
      const updated = await parkTodo(todo.id, {
        return_at: returnDateDraft.trim() || null,
        restart_point: restartPointDraft.trim()
      });
      setTodo(updated);
      setParking(false);
    } catch (err) {
      setParkError(err instanceof Error ? err.message : 'Could not park this.');
    } finally {
      setSavingPark(false);
    }
  };

  const doResume = async () => {
    if (!todo) return;
    const updated = await resumeTodo(todo.id);
    setTodo(updated);
  };

  // --- Progress updates ---
  const [progressDraft, setProgressDraft] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);

  const saveProgress = async () => {
    if (!todo || !progressDraft.trim() || !workspaceId || !me) return;
    setSavingProgress(true);
    try {
      const { item, entry } = await addProgressUpdate(workspaceId, todo.id, me.user_id, progressDraft.trim());
      setTodo(item);
      setHistory(prev => [entry, ...prev]);
      setProgressDraft('');
    } finally {
      setSavingProgress(false);
    }
  };

  // --- Links ---
  const [linkType, setLinkType] = useState<TodoLinkType>('website');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  const addLink = async () => {
    if (!todo || !linkUrl.trim() || !workspaceId || !me) return;
    setAddingLink(true);
    try {
      const link = await addTodoLink(workspaceId, todo.id, me.user_id, {
        link_type: linkType,
        label: linkLabel.trim() || null,
        url: linkUrl.trim()
      });
      setLinks(prev => [...prev, link]);
      setLinkLabel('');
      setLinkUrl('');
    } finally {
      setAddingLink(false);
    }
  };

  const removeLink = async (link: TodoLinkRow) => {
    setLinks(prev => prev.filter(l => l.id !== link.id));
    try {
      await deleteTodoLink(link.id);
    } catch {
      load();
    }
  };

  if (loading) return <LoadingState label="Loading…" />;
  if (error || !todo) return <ErrorState message={error ?? 'Not found.'} onRetry={load} />;

  const readyToPickUp = todo.status === 'parked' && !!todo.return_at && new Date(todo.return_at) <= new Date();

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'To-do',
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.navy
        }}
      />

      <Card style={{ gap: 10 }}>
        {editingTitle ? (
          <View style={styles.row}>
            <TextInput value={titleDraft} onChangeText={setTitleDraft} style={[styles.input, { flex: 1 }]} autoFocus />
            <Pressable onPress={saveTitle} disabled={savingTitle} hitSlop={10}>
              <Text style={styles.saveText}>{savingTitle ? '…' : 'Save'}</Text>
            </Pressable>
            <Pressable onPress={() => setEditingTitle(false)} hitSlop={10}>
              <Ionicons name="close-outline" size={20} color={theme.colors.muted} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.row}>
            <Pressable onPress={toggleDone} hitSlop={10}>
              <Ionicons
                name={todo.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={todo.done ? theme.colors.gold : theme.colors.muted}
              />
            </Pressable>
            <Text style={[styles.title, todo.done && styles.titleDone, { flex: 1 }]}>{todo.body}</Text>
            <Pressable onPress={startEditTitle} hitSlop={10}>
              <Ionicons name="pencil-outline" size={18} color={theme.colors.muted} />
            </Pressable>
            <Pressable onPress={confirmDelete} hitSlop={10}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
            </Pressable>
          </View>
        )}
        {readyToPickUp ? <Text style={styles.readyBadge}>Ready to pick up</Text> : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={styles.label}>Why this matters</Text>
        <TextInput
          value={whyDraft}
          onChangeText={text => { setDetailsTouched(true); setWhyDraft(text); }}
          onBlur={saveDetails}
          placeholder="Why is this worth finishing?"
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, styles.textArea]}
          multiline
        />
        <Text style={styles.label}>Estimated time remaining</Text>
        <View style={styles.row}>
          <TextInput
            value={estimateDraft}
            onChangeText={text => { setDetailsTouched(true); setEstimateDraft(text); }}
            onBlur={saveDetails}
            placeholder="Hours"
            placeholderTextColor={theme.colors.muted}
            keyboardType="decimal-pad"
            style={[styles.input, { width: 90 }]}
          />
          <Text style={styles.meta}>hours</Text>
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={styles.label}>Update progress</Text>
        <View style={styles.row}>
          <TextInput
            value={progressDraft}
            onChangeText={setProgressDraft}
            placeholder="What did you just do?"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable style={styles.smallButton} onPress={saveProgress} disabled={savingProgress || !progressDraft.trim()}>
            <Text style={styles.smallButtonText}>{savingProgress ? '…' : 'Save'}</Text>
          </Pressable>
        </View>
        {history.length > 0 ? (
          <View style={{ gap: 2 }}>
            <Text style={styles.label}>Progress history</Text>
            {history.map((entry, index) => (
              <View key={entry.id} style={[styles.historyRow, index > 0 && styles.divider]}>
                <Text style={styles.item}>{entry.note}</Text>
                <Text style={styles.meta}>{formatRelative(entry.created_at)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={styles.label}>Safely park</Text>
        {todo.status === 'parked' ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.item}>
              Parked {todo.parked_at ? formatRelative(todo.parked_at) : ''}
              {todo.return_at ? ` · Back around ${formatShortDate(todo.return_at)}` : ''}
            </Text>
            {todo.restart_point ? (
              <View>
                <Text style={styles.label}>Restart point</Text>
                <Text style={styles.item}>{todo.restart_point}</Text>
              </View>
            ) : null}
            <Pressable style={styles.smallButton} onPress={doResume}>
              <Text style={styles.smallButtonText}>Resume</Text>
            </Pressable>
          </View>
        ) : parking ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Restart point — where to pick up from</Text>
            <TextInput
              value={restartPointDraft}
              onChangeText={setRestartPointDraft}
              placeholder="What's the very next step, so future-you doesn't have to figure it out again"
              placeholderTextColor={theme.colors.muted}
              style={[styles.input, styles.textArea]}
              multiline
            />
            <Text style={styles.label}>Return date</Text>
            <TextInput
              value={returnDateDraft}
              onChangeText={setReturnDateDraft}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
            {parkError ? <Text style={styles.errorText}>{parkError}</Text> : null}
            <View style={styles.row}>
              <Pressable style={styles.smallButton} onPress={confirmPark} disabled={savingPark}>
                <Text style={styles.smallButtonText}>{savingPark ? '…' : 'Park it'}</Text>
              </Pressable>
              <Pressable onPress={() => setParking(false)} hitSlop={10}>
                <Text style={styles.meta}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.smallButton} onPress={beginPark}>
            <Text style={styles.smallButtonText}>{todo.restart_point ? 'Park again' : 'Safely park this'}</Text>
          </Pressable>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={styles.label}>Related links</Text>
        {links.length > 0 ? (
          <View style={{ gap: 2 }}>
            {links.map((link, index) => (
              <View key={link.id} style={[styles.row, index > 0 && styles.divider]}>
                <Pressable style={{ flex: 1 }} onPress={() => Linking.openURL(link.url)}>
                  <Text style={styles.linkText} numberOfLines={1}>
                    {link.label?.trim() || LINK_TYPES.find(t => t.value === link.link_type)?.label || link.url}
                  </Text>
                </Pressable>
                <Pressable onPress={() => removeLink(link)} hitSlop={10}>
                  <Ionicons name="close" size={18} color={theme.colors.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>No links yet.</Text>
        )}

        <View style={styles.chipRow}>
          {LINK_TYPES.map(t => (
            <Pressable key={t.value} onPress={() => setLinkType(t.value)}>
              <Pill label={linkType === t.value ? `● ${t.label}` : t.label} />
            </Pressable>
          ))}
        </View>
        <TextInput
          value={linkLabel}
          onChangeText={setLinkLabel}
          placeholder="Label (optional)"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        <View style={styles.row}>
          <TextInput
            value={linkUrl}
            onChangeText={setLinkUrl}
            placeholder="Paste a link…"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable style={styles.smallButton} onPress={addLink} disabled={addingLink || !linkUrl.trim()}>
            <Text style={styles.smallButtonText}>{addingLink ? '…' : 'Add'}</Text>
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  titleDone: { textDecorationLine: 'line-through', color: theme.colors.muted },
  readyBadge: { color: theme.colors.gold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  item: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  meta: { color: theme.colors.muted, fontSize: 13 },
  errorText: { color: theme.colors.danger, fontSize: 13 },
  linkText: { color: theme.colors.navy, fontSize: 14, fontWeight: '600' },
  historyRow: { paddingVertical: 6, gap: 2 },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  saveText: { color: theme.colors.navy, fontWeight: '600', fontSize: 13 },
  smallButton: { backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start' },
  smallButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 }
});
