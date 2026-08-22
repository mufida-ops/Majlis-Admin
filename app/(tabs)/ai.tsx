import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { PageBanner } from '@/components/PageBanner';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listChatMessages, sendChatMessage } from '@/lib/repositories/aiChat';
import { listProposedActions, applyAiAction, dismissAiAction } from '@/lib/repositories/aiActions';
import { listProjects, createTask } from '@/lib/repositories/projects';
import { createDecision } from '@/lib/repositories/decisions';
import { listOrganisations, createFollowUp } from '@/lib/repositories/organisations';
import { createEvent } from '@/lib/repositories/events';
import { describeAiAction } from '@/lib/aiActionLabel';
import { localDateKey } from '@/lib/format';
import type { AiActionRow, AiChatMessageRow, OwnerType } from '@/types/db';

type RecatTarget = 'task' | 'decision' | 'crm' | 'calendar';

const RECAT_TARGETS: { key: RecatTarget; label: string }[] = [
  { key: 'task', label: 'Task' },
  { key: 'decision', label: 'Decision' },
  { key: 'crm', label: 'CRM follow-up' },
  { key: 'calendar', label: 'Calendar' }
];

function seedTitleFromAction(action: AiActionRow): string {
  const p = action.payload as Record<string, unknown>;
  const value = p.title ?? p.next_action ?? p.note ?? '';
  return typeof value === 'string' ? value : '';
}

export default function AiChatScreen() {
  const { session } = useAuth();
  const { workspaceId } = useWorkspace();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [recategorizing, setRecategorizing] = useState<{ actionId: string; target: RecatTarget } | null>(null);
  const [recatTitle, setRecatTitle] = useState('');
  const [recatDate, setRecatDate] = useState('');
  const [recatTime, setRecatTime] = useState('');
  const [recatProjectId, setRecatProjectId] = useState('');
  const [recatOrgId, setRecatOrgId] = useState('');
  const [recatOwner, setRecatOwner] = useState<OwnerType>('Both');
  const [recatSaving, setRecatSaving] = useState(false);

  const {
    data: messages,
    loading: messagesLoading,
    error: messagesError,
    refresh: refreshMessages,
    setData: setMessages
  } = useAsync(
    () => (workspaceId && session ? listChatMessages(workspaceId, session.user.id) : Promise.resolve([])),
    [workspaceId, session?.user.id]
  );

  const { data: proposedActions, setData: setProposedActions } = useAsync(
    () => (workspaceId ? listProposedActions(workspaceId) : Promise.resolve([])),
    [workspaceId]
  );

  // Loaded only to power the project/organisation pickers when reclassifying
  // a suggestion — not shown anywhere else on this screen.
  const { data: projectsList } = useAsync(() => (workspaceId ? listProjects(workspaceId) : Promise.resolve([])), [workspaceId]);
  const { data: orgsList } = useAsync(() => (workspaceId ? listOrganisations(workspaceId) : Promise.resolve([])), [workspaceId]);

  const send = async () => {
    const text = input.trim();
    if (!text || !session || !workspaceId) return;
    setInput('');
    setSending(true);
    setError('');

    const optimisticId = `pending-${Date.now()}`;
    const optimisticUser: AiChatMessageRow = {
      id: optimisticId,
      workspace_id: workspaceId,
      user_id: session.user.id,
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...(prev ?? []), optimisticUser]);

    try {
      const { userMessage, assistantMessage, action } = await sendChatMessage(workspaceId, session.user.id, text);
      setMessages(prev => [...(prev ?? []).filter(m => m.id !== optimisticId), userMessage, assistantMessage]);
      if (action) setProposedActions(prev => [...(prev ?? []), action]);
    } catch (err) {
      setMessages(prev => (prev ?? []).filter(m => m.id !== optimisticId));
      setError(err instanceof Error ? err.message : 'Could not send that — try again.');
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const accept = async (actionId: string) => {
    if (!session || !proposedActions) return;
    const action = proposedActions.find(a => a.id === actionId);
    if (!action) return;
    setBusyActionId(actionId);
    try {
      await applyAiAction(action, session.user.id);
      setProposedActions(prev => (prev ?? []).filter(a => a.id !== actionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply that suggestion.');
    } finally {
      setBusyActionId(null);
    }
  };

  const dismiss = async (actionId: string) => {
    setBusyActionId(actionId);
    try {
      await dismissAiAction(actionId);
      setProposedActions(prev => (prev ?? []).filter(a => a.id !== actionId));
    } finally {
      setBusyActionId(null);
    }
  };

  const startRecategorize = (action: AiActionRow, target: RecatTarget) => {
    setRecategorizing({ actionId: action.id, target });
    setRecatTitle(seedTitleFromAction(action));
    setRecatDate(localDateKey());
    setRecatTime('');
    setRecatProjectId('');
    setRecatOrgId('');
    setRecatOwner('Both');
    setError('');
  };

  const cancelRecategorize = () => setRecategorizing(null);

  const targetLabel = (target: RecatTarget) =>
    target === 'calendar' ? 'Calendar' : target === 'decision' ? 'Decisions' : target === 'task' ? 'Projects' : 'CRM';

  const saveRecategorize = async () => {
    if (!recategorizing || !session || !workspaceId) return;
    const { actionId, target } = recategorizing;
    if (!recatTitle.trim()) {
      setError('Add a title first.');
      return;
    }
    if (target === 'task' && !recatProjectId) {
      setError('Pick a project first.');
      return;
    }
    if (target === 'crm' && !recatOrgId) {
      setError('Pick an organisation first.');
      return;
    }
    setRecatSaving(true);
    try {
      if (target === 'calendar') {
        const allDay = !recatTime.trim();
        const startAt = new Date(`${recatDate}T${allDay ? '00:00' : recatTime}:00`);
        await createEvent({
          workspace_id: workspaceId,
          title: recatTitle.trim(),
          start_at: startAt.toISOString(),
          all_day: allDay,
          created_by: session.user.id
        });
      } else if (target === 'decision') {
        await createDecision({ workspace_id: workspaceId, title: recatTitle.trim(), owner: recatOwner, created_by: session.user.id });
      } else if (target === 'task') {
        await createTask({ workspace_id: workspaceId, project_id: recatProjectId, title: recatTitle.trim(), created_by: session.user.id });
      } else {
        await createFollowUp(recatOrgId, recatTitle.trim());
      }
      await dismissAiAction(actionId);
      setProposedActions(prev => (prev ?? []).filter(a => a.id !== actionId));
      setRecategorizing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.');
    } finally {
      setRecatSaving(false);
    }
  };

  const actionFor = (messageId: string) => (proposedActions ?? []).find(a => a.chat_message_id === messageId);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ flex: 1, paddingBottom: 16 }}>
        <SectionTitle title="AI Chat" subtitle="Talk it through with AI — ask it to add a task, log a decision, or update the CRM." />
        <PageBanner image={require('@/assets/images/sign-in-hero.jpg')} />

        {messagesLoading ? (
          <LoadingState label="Loading your chat…" />
        ) : messagesError ? (
          <ErrorState message={messagesError} onRetry={refreshMessages} />
        ) : !messages || messages.length === 0 ? (
          <EmptyState label="Say hello — try 'remind me to call Khaled tomorrow at 3pm' or 'add Brighton School to CRM'." />
        ) : (
          <View style={{ gap: 10 }}>
            {messages.map(message => {
              const action = message.role === 'assistant' ? actionFor(message.id) : undefined;
              return (
                <View key={message.id}>
                  <View style={[styles.bubble, message.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <Text style={message.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
                      {message.content}
                    </Text>
                  </View>

                  {action ? (
                    recategorizing?.actionId === action.id ? (
                      <View style={styles.actionCard}>
                        <Text style={styles.recatLabel}>Add to {targetLabel(recategorizing.target)} instead</Text>
                        <TextInput
                          value={recatTitle}
                          onChangeText={setRecatTitle}
                          placeholder="Title"
                          placeholderTextColor={theme.colors.muted}
                          style={styles.recatInput}
                        />
                        {recategorizing.target === 'calendar' ? (
                          <View style={styles.recatRow}>
                            <TextInput
                              value={recatDate}
                              onChangeText={setRecatDate}
                              placeholder="YYYY-MM-DD"
                              placeholderTextColor={theme.colors.muted}
                              style={[styles.recatInput, { flex: 1 }]}
                            />
                            <TextInput
                              value={recatTime}
                              onChangeText={setRecatTime}
                              placeholder="HH:MM (optional)"
                              placeholderTextColor={theme.colors.muted}
                              style={[styles.recatInput, { flex: 1 }]}
                            />
                          </View>
                        ) : null}
                        {recategorizing.target === 'task' ? (
                          <View style={styles.chipRow}>
                            {(projectsList ?? []).map(p => (
                              <Pressable
                                key={p.id}
                                style={[styles.chip, recatProjectId === p.id && styles.chipActive]}
                                onPress={() => setRecatProjectId(p.id)}
                              >
                                <Text style={[styles.chipText, recatProjectId === p.id && styles.chipTextActive]}>{p.title}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                        {recategorizing.target === 'crm' ? (
                          <View style={styles.chipRow}>
                            {(orgsList ?? []).map(o => (
                              <Pressable
                                key={o.id}
                                style={[styles.chip, recatOrgId === o.id && styles.chipActive]}
                                onPress={() => setRecatOrgId(o.id)}
                              >
                                <Text style={[styles.chipText, recatOrgId === o.id && styles.chipTextActive]}>{o.name}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                        {recategorizing.target === 'decision' ? (
                          <View style={styles.chipRow}>
                            {(['Both', 'Mufida', 'Victoria'] as OwnerType[]).map(owner => (
                              <Pressable
                                key={owner}
                                style={[styles.chip, recatOwner === owner && styles.chipActive]}
                                onPress={() => setRecatOwner(owner)}
                              >
                                <Text style={[styles.chipText, recatOwner === owner && styles.chipTextActive]}>{owner}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                        <View style={styles.actionButtons}>
                          <Pressable style={styles.primary} onPress={saveRecategorize} disabled={recatSaving}>
                            <Text style={styles.primaryText}>{recatSaving ? 'Saving…' : 'Save'}</Text>
                          </Pressable>
                          <Pressable style={styles.secondary} onPress={cancelRecategorize} disabled={recatSaving}>
                            <Text style={styles.secondaryText}>Cancel</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.actionCard}>
                        <Text style={styles.suggestion}>{describeAiAction(action)}</Text>
                        <View style={styles.actionButtons}>
                          <Pressable style={styles.primary} onPress={() => accept(action.id)} disabled={busyActionId === action.id}>
                            <Text style={styles.primaryText}>{busyActionId === action.id ? '…' : 'Accept'}</Text>
                          </Pressable>
                          <Pressable style={styles.secondary} onPress={() => dismiss(action.id)} disabled={busyActionId === action.id}>
                            <Text style={styles.secondaryText}>Dismiss</Text>
                          </Pressable>
                        </View>
                        <Text style={styles.recatPrompt}>Wrong category? Move it to:</Text>
                        <View style={styles.chipRow}>
                          {RECAT_TARGETS.map(t => (
                            <Pressable key={t.key} style={styles.chipSmall} onPress={() => startRecategorize(action, t.key)}>
                              <Text style={styles.chipSmallText}>{t.label}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Screen>

      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask AI to add a task, decision, CRM update, or event…"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          multiline
        />
        <Pressable style={styles.send} onPress={send} disabled={sending || !input.trim()}>
          <Text style={styles.sendText}>{sending ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', padding: 14, borderRadius: theme.radius.md },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: theme.colors.navy },
  bubbleAssistant: { alignSelf: 'flex-start', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  bubbleTextUser: { color: '#fff', lineHeight: 21, fontSize: 15 },
  bubbleTextAssistant: { color: theme.colors.text, lineHeight: 21, fontSize: 15 },
  actionCard: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    marginTop: 8,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted
  },
  suggestion: { color: theme.colors.text, lineHeight: 21, fontSize: 15 },
  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primary: { backgroundColor: theme.colors.navy, paddingVertical: 10, paddingHorizontal: 16, borderRadius: theme.radius.md, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  secondary: { borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 10, paddingHorizontal: 16, borderRadius: theme.radius.md, alignItems: 'center' },
  secondaryText: { color: theme.colors.text, fontWeight: '600', fontSize: 13 },
  recatPrompt: { color: theme.colors.muted, fontSize: 12, marginTop: 12 },
  recatLabel: { color: theme.colors.navy, fontWeight: '600', fontSize: 14 },
  recatInput: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  recatRow: { flexDirection: 'row', gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: theme.colors.navy, borderColor: theme.colors.navy },
  chipText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipSmall: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipSmallText: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  error: { color: theme.colors.danger },
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
