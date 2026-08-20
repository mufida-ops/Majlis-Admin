import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { Card } from '@/components/Card';
import { LoadingState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { createDrop, listDrops } from '@/lib/repositories/drops';
import { requestDropParse, listProposedActions, applyAiAction, dismissAiAction } from '@/lib/repositories/aiActions';
import { describeAiAction } from '@/lib/aiActionLabel';
import { isInQuietHours, formatQuietHoursRange } from '@/lib/quietHours';
import { formatRelative } from '@/lib/format';

export default function DropScreen() {
  const { session } = useAuth();
  const { workspaceId, partner } = useWorkspace();
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const {
    data: proposedActions,
    loading: actionsLoading,
    refresh: refreshActions,
    setData: setProposedActions
  } = useAsync(() => (workspaceId ? listProposedActions(workspaceId) : Promise.resolve([])), [workspaceId]);

  const {
    data: myDrops,
    loading: dropsLoading,
    refresh: refreshDrops
  } = useAsync(() => (workspaceId ? listDrops(workspaceId) : Promise.resolve([])), [workspaceId]);

  const accept = async (actionId: string) => {
    if (!session || !proposedActions) return;
    const action = proposedActions.find(a => a.id === actionId);
    if (!action) return;
    setBusyActionId(actionId);
    try {
      await applyAiAction(action, session.user.id);
      setProposedActions(prev => (prev ?? []).filter(a => a.id !== actionId));
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

  const save = async (urgent = false) => {
    if (!text.trim()) {
      setFeedback('Type or say something first.');
      return;
    }
    if (!session || !workspaceId) {
      setFeedback('Still setting up your workspace — try again in a moment.');
      return;
    }

    setSaving(true);
    setFeedback('');
    try {
      const drop = await createDrop({
        workspace_id: workspaceId,
        created_by: session.user.id,
        raw_text: text.trim(),
        urgent
      });

      const partnerName = partner?.display_name ?? 'your co-founder';
      if (urgent) {
        setFeedback(`Marked urgent — this bypasses ${partnerName}'s quiet hours.`);
      } else if (partner && isInQuietHours(partner)) {
        setFeedback(`Saved quietly. ${partnerName} is in quiet hours until ${formatQuietHoursRange(partner)} — they'll see it at their next catch-up.`);
      } else {
        setFeedback(`Saved for ${partnerName}'s next catch-up.`);
      }
      setText('');
      refreshDrops();

      // Structured-action parsing is best-effort: a Drop is fully saved
      // either way, this just tries to pre-fill suggested follow-ups.
      requestDropParse(drop.id)
        .then(() => {
          refreshActions();
          refreshDrops();
        })
        .catch(() => {});
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Could not save that drop.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <SectionTitle title="Drop" subtitle="Capture first. Organise later." />
      <Card>
        <Text style={styles.label}>What's on your mind?</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="e.g. We should change Phase 2 so the cultural box comes before teacher CPD"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        <View style={styles.buttons}>
          <Pressable style={styles.primary} onPress={() => save(false)} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save for catch-up'}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => save(true)} disabled={saving}>
            <Text style={styles.secondaryText}>Mark urgent</Text>
          </Pressable>
        </View>
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      </Card>
      <Text style={styles.note}>
        Talk or type freely — tap the microphone on your keyboard to dictate. {partner?.display_name ?? 'Your co-founder'}{' '}
        won't see the raw text: it's condensed into a short summary for their catch-up feed. Normal drops wait for their
        next catch-up; urgent drops bypass quiet hours. A structured suggestion (task, decision, follow-up) may also show
        up for review below once it's processed.
      </Text>

      {actionsLoading ? (
        <LoadingState label="Checking for suggestions…" />
      ) : proposedActions && proposedActions.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionTitle title="Suggested from your drops" subtitle="Review before anything is created or changed." />
          {proposedActions.map(action => (
            <Card key={action.id}>
              <Text style={styles.suggestion}>{describeAiAction(action)}</Text>
              <View style={styles.buttons}>
                <Pressable
                  style={styles.primary}
                  onPress={() => accept(action.id)}
                  disabled={busyActionId === action.id}
                >
                  <Text style={styles.primaryText}>{busyActionId === action.id ? '…' : 'Accept'}</Text>
                </Pressable>
                <Pressable
                  style={styles.secondary}
                  onPress={() => dismiss(action.id)}
                  disabled={busyActionId === action.id}
                >
                  <Text style={styles.secondaryText}>Dismiss</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <Pressable onPress={refreshActions}>
          <Text style={styles.refresh}>Check for suggestions</Text>
        </Pressable>
      )}

      <SectionTitle title="What you've sent" subtitle={`Your recent drops, in your own words.`} />
      {dropsLoading ? (
        <LoadingState label="Loading your drops…" />
      ) : (
        (() => {
          const mine = (myDrops ?? []).filter(d => d.created_by === session?.user.id);
          if (mine.length === 0) {
            return <Text style={styles.note}>Nothing sent yet — whatever you drop above will show up here.</Text>;
          }
          return (
            <View style={{ gap: 10 }}>
              {mine.map(drop => (
                <Card key={drop.id}>
                  <Text style={styles.sentText}>{drop.raw_text}</Text>
                  <Text style={styles.meta}>
                    {formatRelative(drop.created_at)}
                    {drop.urgent ? ' · Urgent' : ''}
                    {drop.summary ? ` · ${partner?.display_name ?? 'They'} saw: "${drop.summary}"` : ' · Not processed yet'}
                  </Text>
                </Card>
              ))}
            </View>
          );
        })()
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  input: {
    minHeight: 150,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    textAlignVertical: 'top',
    backgroundColor: theme.colors.background
  },
  buttons: { marginTop: 14, gap: 10 },
  primary: { backgroundColor: theme.colors.navy, padding: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: theme.colors.border, padding: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  secondaryText: { color: theme.colors.text, fontWeight: '600' },
  feedback: { color: theme.colors.success, marginTop: 14 },
  note: { color: theme.colors.muted, lineHeight: 21 },
  suggestion: { color: theme.colors.text, lineHeight: 21, fontSize: 15 },
  refresh: { color: theme.colors.navy, fontWeight: '600', textAlign: 'center' },
  sentText: { color: theme.colors.text, lineHeight: 21, fontSize: 15 },
  meta: { color: theme.colors.muted, fontSize: 12, marginTop: 8 }
});
