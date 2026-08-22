import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { PageBanner } from '@/components/PageBanner';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { LinkPicker, AI_LINK_TARGETS, GIVE_LINK_TARGETS, type LinkTarget, type LinkPickerResult } from '@/components/LinkPicker';
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
import type { AiActionRow, AiChatMessageRow } from '@/types/db';

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
  const [recategorizing, setRecategorizing] = useState<{ actionId: string; target: LinkTarget } | null>(null);
  const [recatSaving, setRecatSaving] = useState(false);
  const [recatError, setRecatError] = useState('');
  const [linkingMessageId, setLinkingMessageId] = useState<string | null>(null);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState('');

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

  const startRecategorize = (action: AiActionRow, target: LinkTarget) => {
    setRecategorizing({ actionId: action.id, target });
    setRecatError('');
  };

  const cancelRecategorize = () => setRecategorizing(null);

  const saveRecategorize = async (result: LinkPickerResult) => {
    if (!recategorizing || !session || !workspaceId) return;
    const { actionId } = recategorizing;
    setRecatSaving(true);
    setRecatError('');
    try {
      await applyLink(result, session.user.id, workspaceId);
      await dismissAiAction(actionId);
      setProposedActions(prev => (prev ?? []).filter(a => a.id !== actionId));
      setRecategorizing(null);
    } catch (err) {
      setRecatError(err instanceof Error ? err.message : 'Could not save that.');
    } finally {
      setRecatSaving(false);
    }
  };

  const startLink = (messageId: string) => {
    setLinkingMessageId(messageId);
    setLinkError('');
  };

  const cancelLink = () => setLinkingMessageId(null);

  const saveLink = async (result: LinkPickerResult) => {
    if (!session || !workspaceId) return;
    setLinkSaving(true);
    setLinkError('');
    try {
      await applyLink(result, session.user.id, workspaceId);
      setLinkingMessageId(null);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Could not link that.');
    } finally {
      setLinkSaving(false);
    }
  };

  const applyLink = async (result: LinkPickerResult, userId: string, wsId: string) => {
    if (result.target === 'calendar') {
      await createEvent({ workspace_id: wsId, title: result.title, start_at: result.startAt, all_day: result.allDay, created_by: userId });
    } else if (result.target === 'discussion') {
      await createDecision({ workspace_id: wsId, title: result.title, owner: result.owner, created_by: userId });
    } else if (result.target === 'task') {
      await createTask({ workspace_id: wsId, project_id: result.projectId, title: result.title, created_by: userId });
    } else {
      await createFollowUp(result.organisationId, result.note);
    }
  };

  const actionFor = (messageId: string) => (proposedActions ?? []).find(a => a.chat_message_id === messageId);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ paddingBottom: 16 }}>
        <SectionTitle
          title="Your AI Assistant"
          subtitle="Ask a question, think out loud, or have it add a task, discussion, CRM update, calendar event, or message to your co-founder."
        />
        <PageBanner image={require('@/assets/images/sign-in-hero.jpg')} />

        {messagesLoading ? (
          <LoadingState label="Loading your chat…" />
        ) : messagesError ? (
          <ErrorState message={messagesError} onRetry={refreshMessages} />
        ) : !messages || messages.length === 0 ? (
          <EmptyState label="Say hello — ask a question, think something through, or try 'remind me to call Khaled tomorrow at 3pm'." />
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

                  {!message.id.startsWith('pending-') ? (
                    linkingMessageId === message.id ? (
                      <LinkPicker
                        targets={GIVE_LINK_TARGETS}
                        organisations={(orgsList ?? []).map(o => ({ id: o.id, name: o.name }))}
                        seedTitle={message.content}
                        saving={linkSaving}
                        error={linkError}
                        onSave={saveLink}
                        onCancel={cancelLink}
                      />
                    ) : (
                      <Pressable style={styles.linkRow} onPress={() => startLink(message.id)} hitSlop={6}>
                        <Ionicons name="link-outline" size={14} color={theme.colors.muted} />
                        <Text style={styles.linkRowText}>Link to calendar, CRM, or discussion</Text>
                      </Pressable>
                    )
                  ) : null}

                  {action ? (
                    recategorizing?.actionId === action.id ? (
                      <LinkPicker
                        targets={AI_LINK_TARGETS}
                        initialTarget={recategorizing.target}
                        organisations={(orgsList ?? []).map(o => ({ id: o.id, name: o.name }))}
                        projects={(projectsList ?? []).map(p => ({ id: p.id, title: p.title }))}
                        seedTitle={seedTitleFromAction(action)}
                        saving={recatSaving}
                        error={recatError}
                        onSave={saveRecategorize}
                        onCancel={cancelRecategorize}
                      />
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
                          {AI_LINK_TARGETS.map(t => (
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
          placeholder="Ask, think out loud, or add a task, discussion, CRM update, event…"
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chipSmall: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipSmallText: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, alignSelf: 'flex-start' },
  linkRowText: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
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
