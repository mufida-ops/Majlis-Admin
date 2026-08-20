import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { LoadingState, ErrorState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { getOrCreateThread, listMessages, postMessage } from '@/lib/repositories/threads';
import { memberLabel } from '@/lib/ownerLabel';
import { formatTime, formatShortDate } from '@/lib/format';
import type { MessageRow, ThreadRow } from '@/types/db';

type ThreadKind = 'project' | 'task' | 'organisation' | 'decision';

const anchorColumn: Record<ThreadKind, 'project_id' | 'task_id' | 'organisation_id' | 'decision_id'> = {
  project: 'project_id',
  task: 'task_id',
  organisation: 'organisation_id',
  decision: 'decision_id'
};

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

  const load = useCallback(async () => {
    if (!workspaceId || !params.kind || !params.id) return;
    setLoading(true);
    setError(null);
    try {
      const column = anchorColumn[params.kind];
      const t = await getOrCreateThread(workspaceId, { [column]: params.id } as never);
      setThread(t);
      const msgs = await listMessages(t.id);
      setMessages(msgs);
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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title: params.title ?? 'Thread', headerStyle: { backgroundColor: theme.colors.background }, headerTintColor: theme.colors.navy }} />
      <Screen contentStyle={{ flex: 1, paddingBottom: 16 }}>
        {loading ? (
          <LoadingState label="Loading thread…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <View style={{ gap: 10 }}>
            {messages.length === 0 ? (
              <Card>
                <Text style={styles.empty}>No messages yet. Start the discussion below.</Text>
              </Card>
            ) : (
              messages.map(msg => (
                <Card key={msg.id} style={msg.author_user_id === session?.user.id ? styles.mine : undefined}>
                  <Text style={styles.author}>
                    {memberLabel(msg.author_user_id, me, partner)} · {formatShortDate(msg.created_at)} {formatTime(msg.created_at)}
                  </Text>
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
  author: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
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
