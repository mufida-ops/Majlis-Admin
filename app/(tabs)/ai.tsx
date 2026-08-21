import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { Card } from '@/components/Card';
import { LoadingState, EmptyState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listDrops } from '@/lib/repositories/drops';
import { requestDropParse, listProposedActions, applyAiAction, dismissAiAction } from '@/lib/repositories/aiActions';
import { listProjects, createTask } from '@/lib/repositories/projects';
import { createDecision } from '@/lib/repositories/decisions';
import { listOrganisations, createFollowUp } from '@/lib/repositories/organisations';
import { createEvent } from '@/lib/repositories/events';
import { describeAiAction } from '@/lib/aiActionLabel';
import { formatRelative, localDateKey } from '@/lib/format';
import type { AiActionRow, OwnerType } from '@/types/db';

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

export default function AiActionsScreen() {
  const { session } = useAuth();
  const { workspaceId } = useWorkspace();
  const [feedback, setFeedback] = useState('');
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [retryingDropId, setRetryingDropId] = useState<string | null>(null);
  const [recategorizing, setRecategorizing] = useState<{ actionId: string; target: RecatTarget } | null>(null);
  const [recatTitle, setRecatTitle] = useState('');
  const [recatDate, setRecatDate] = useState('');
  const [recatTime, setRecatTime] = useState('');
  const [recatProjectId, setRecatProjectId] = useState('');
  const [recatOrgId, setRecatOrgId] = useState('');
  const [recatOwner, setRecatOwner] = useState<OwnerType>('Both');
  const [recatSaving, setRecatSaving] = useState(false);

  const {
    data: proposedActions,
    refresh: refreshActions,
    setData: setProposedActions
  } = useAsync(() => (workspaceId ? listProposedActions(workspaceId) : Promise.resolve([])), [workspaceId]);

  const {
    data: myDrops,
    loading: dropsLoading,
    refresh: refreshDrops
  } = useAsync(() => (workspaceId ? listDrops(workspaceId) : Promise.resolve([])), [workspaceId]);

  // Loaded only to power the project/organisation pickers when reclassifying
  // a suggestion — not shown anywhere else on this screen.
  const { data: projectsList } = useAsync(() => (workspaceId ? listProjects(workspaceId) : Promise.resolve([])), [workspaceId]);
  const { data: orgsList } = useAsync(() => (workspaceId ? listOrganisations(workspaceId) : Promise.resolve([])), [workspaceId]);

  const accept = async (actionId: string) => {
    if (!session || !proposedActions) return;
    const action = proposedActions.find(a => a.id === actionId);
    if (!action) return;
    setBusyActionId(actionId);
    try {
      await applyAiAction(action, session.user.id);
      setProposedActions(prev => (prev ?? []).filter(a => a.id !== actionId));
      // Explicit confirmation, not just the card vanishing — a silent
      // disappearance reads as "did that actually do anything?" to someone
      // moving fast on a phone.
      setFeedback(`Done — ${describeAiAction(action)}`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Could not apply that suggestion.');
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

  const retryParse = async (dropId: string) => {
    setRetryingDropId(dropId);
    setFeedback('');
    try {
      await requestDropParse(dropId);
      await Promise.all([refreshActions(), refreshDrops()]);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Could not action that drop.');
    } finally {
      setRetryingDropId(null);
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
    setFeedback('');
  };

  const cancelRecategorize = () => setRecategorizing(null);

  const targetLabel = (target: RecatTarget) =>
    target === 'calendar' ? 'Calendar' : target === 'decision' ? 'Decisions' : target === 'task' ? 'Projects' : 'CRM';

  const saveRecategorize = async () => {
    if (!recategorizing || !session || !workspaceId) return;
    const { actionId, target } = recategorizing;
    if (!recatTitle.trim()) {
      setFeedback('Add a title first.');
      return;
    }
    if (target === 'task' && !recatProjectId) {
      setFeedback('Pick a project first.');
      return;
    }
    if (target === 'crm' && !recatOrgId) {
      setFeedback('Pick an organisation first.');
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
      setFeedback(`Done — added to ${targetLabel(target)}.`);
      setRecategorizing(null);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Could not save that.');
    } finally {
      setRecatSaving(false);
    }
  };

  const mine = (myDrops ?? []).filter(d => d.created_by === session?.user.id);

  return (
    <Screen>
      <SectionTitle title="AI Actions" subtitle="Turn your own drops into tasks, decisions, CRM updates, or calendar events." />
      <Text style={styles.note}>
        This is separate from the Drop tab, which is just conversation between you and your co-founder. Nothing here
        happens automatically — tap "Action it" on a note to have AI read it and propose something, then review it
        below before anything is created.
      </Text>
      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {dropsLoading ? (
        <LoadingState label="Loading your drops…" />
      ) : mine.length === 0 ? (
        <EmptyState label="Nothing to action yet — drop a note first, then come back here." image={require('@/assets/images/sign-in-hero.jpg')} />
      ) : (
        <View style={{ gap: 10 }}>
          {mine.map(drop => (
            <Card key={drop.id}>
              <Text style={styles.sentText}>{drop.raw_text}</Text>
              <Text style={styles.meta}>{formatRelative(drop.created_at)}</Text>

              {(proposedActions ?? [])
                .filter(action => action.drop_id === drop.id)
                .map(action =>
                  recategorizing?.actionId === action.id ? (
                    <View key={action.id} style={styles.suggestionBlock}>
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
                      <View style={styles.buttons}>
                        <Pressable style={styles.primary} onPress={saveRecategorize} disabled={recatSaving}>
                          <Text style={styles.primaryText}>{recatSaving ? 'Saving…' : 'Save'}</Text>
                        </Pressable>
                        <Pressable style={styles.secondary} onPress={cancelRecategorize} disabled={recatSaving}>
                          <Text style={styles.secondaryText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View key={action.id} style={styles.suggestionBlock}>
                      <Text style={styles.suggestion}>{describeAiAction(action)}</Text>
                      <View style={styles.buttons}>
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
                )}

              <Pressable style={styles.retry} onPress={() => retryParse(drop.id)} disabled={retryingDropId === drop.id}>
                <Text style={styles.retryText}>{retryingDropId === drop.id ? 'Actioning…' : 'Action it'}</Text>
              </Pressable>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { color: theme.colors.muted, lineHeight: 21 },
  feedback: { color: theme.colors.success },
  buttons: { marginTop: 14, gap: 10 },
  primary: { backgroundColor: theme.colors.navy, padding: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: theme.colors.border, padding: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  secondaryText: { color: theme.colors.text, fontWeight: '600' },
  sentText: { color: theme.colors.text, lineHeight: 21, fontSize: 15 },
  meta: { color: theme.colors.muted, fontSize: 12, marginTop: 8 },
  suggestion: { color: theme.colors.text, lineHeight: 21, fontSize: 15 },
  suggestionBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
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
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  chipActive: { backgroundColor: theme.colors.navy, borderColor: theme.colors.navy },
  chipText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipSmall: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  chipSmallText: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  retry: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    alignItems: 'center'
  },
  retryText: { color: theme.colors.text, fontWeight: '600', fontSize: 13 }
});
