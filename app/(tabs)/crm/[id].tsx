import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { LoadingState, ErrorState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { Ionicons } from '@expo/vector-icons';
import {
  getOrganisation,
  updatePipelineStage,
  updateOrganisation,
  addCrmNote,
  createFollowUp,
  deleteOrganisation
} from '@/lib/repositories/organisations';
import { listActivityForOrganisation } from '@/lib/repositories/activity';
import { memberLabel, ownerAccentColor } from '@/lib/ownerLabel';
import { formatRelative, formatShortDate } from '@/lib/format';

const STAGES = ['Lead', 'Contacted', 'Meeting Booked', 'Proposal Sent', 'Negotiating', 'Won', 'Onboarding', 'Active Partner', 'Follow-up'];

export default function OrganisationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, partner } = useWorkspace();
  const { data: org, loading, error, refresh, setData } = useAsync(() => getOrganisation(id), [id]);
  const { data: activity, loading: activityLoading, refresh: refreshActivity } = useAsync(
    () => listActivityForOrganisation(id),
    [id]
  );

  const [note, setNote] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  if (loading) return <LoadingState label="Loading organisation…" />;
  if (error || !org) return <ErrorState message={error ?? 'Not found.'} onRetry={refresh} />;

  const isOverdue = org.next_action_at && new Date(org.next_action_at).getTime() < Date.now();
  const accent = ownerAccentColor(org.owner_user_id, me, partner);

  const changeStage = async (stage: string) => {
    const updated = await updatePipelineStage(org.id, stage);
    setData({ ...org, ...updated });
  };

  const startEditName = () => {
    setEditingName(true);
    setNameDraft(org.name);
  };

  const saveName = async () => {
    if (!nameDraft.trim()) return;
    setSavingName(true);
    try {
      const updated = await updateOrganisation(org.id, { name: nameDraft.trim() });
      setData({ ...org, ...updated });
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      const updated = await addCrmNote(org.id, note.trim());
      setData({ ...org, ...updated });
      setNote('');
      refreshActivity();
    } finally {
      setSavingNote(false);
    }
  };

  const saveFollowUp = async () => {
    if (!followUp.trim()) return;
    setSavingFollowUp(true);
    try {
      const updated = await createFollowUp(org.id, followUp.trim());
      setData({ ...org, ...updated });
      setFollowUp('');
      refreshActivity();
    } finally {
      setSavingFollowUp(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete organisation?', `This removes "${org.name}" and its notes, contacts, and activity history. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteOrganisation(org.id);
          router.replace('/(tabs)/crm');
        }
      }
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: org.name }} />

      <Card style={accent ? { backgroundColor: accent } : undefined}>
        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput value={nameDraft} onChangeText={setNameDraft} style={[styles.input, { flex: 1, marginTop: 0 }]} autoFocus />
            <Pressable hitSlop={10} onPress={saveName} disabled={savingName}>
              <Text style={styles.saveText}>{savingName ? '…' : 'Save'}</Text>
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setEditingName(false)} disabled={savingName}>
              <Ionicons name="close-outline" size={20} color={theme.colors.muted} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.nameEditRow}>
            <Text style={[styles.label, { flex: 1, fontSize: 18 }]}>{org.name}</Text>
            <Pressable hitSlop={10} onPress={startEditName}>
              <Ionicons name="pencil-outline" size={18} color={theme.colors.muted} />
            </Pressable>
          </View>
        )}
      </Card>

      <Card style={accent ? { backgroundColor: accent } : undefined}>
        <Text style={styles.label}>Stage</Text>
        <View style={styles.stageRow}>
          {STAGES.map(stage => (
            <Pressable key={stage} onPress={() => changeStage(stage)}>
              <Text style={[styles.stageChip, stage === org.stage && styles.stageChipActive]}>{stage}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={isOverdue ? { borderColor: theme.colors.danger } : undefined}>
        <Text style={styles.label}>Next action{isOverdue ? ' · overdue' : ''}</Text>
        <Text style={styles.body}>{org.next_action ?? 'Nothing set.'}</Text>
        {org.next_action_at ? <Text style={styles.meta}>Due {formatShortDate(org.next_action_at)}</Text> : null}
        <TextInput
          value={followUp}
          onChangeText={setFollowUp}
          placeholder="Set the next action…"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        <Pressable style={styles.primarySmall} onPress={saveFollowUp} disabled={savingFollowUp || !followUp.trim()}>
          <Text style={styles.primaryText}>{savingFollowUp ? 'Saving…' : 'Save follow-up'}</Text>
        </Pressable>
      </Card>

      {org.contacts.length > 0 ? (
        <Card>
          <Text style={styles.label}>Contacts</Text>
          {org.contacts.map(c => (
            <Text key={c.id} style={styles.body}>
              {c.name}
              {c.role ? ` · ${c.role}` : ''}
            </Text>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.label}>Add a note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What happened in the last conversation?"
          placeholderTextColor={theme.colors.muted}
          multiline
          style={[styles.input, { minHeight: 80 }]}
        />
        <Pressable style={styles.primarySmall} onPress={saveNote} disabled={savingNote || !note.trim()}>
          <Text style={styles.primaryText}>{savingNote ? 'Saving…' : 'Save note'}</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.label}>Activity history</Text>
        {activityLoading ? (
          <LoadingState />
        ) : !activity || activity.length === 0 ? (
          <Text style={styles.meta}>Nothing logged yet.</Text>
        ) : (
          activity.map(event => (
            <View key={event.id} style={styles.activityRow}>
              <Text style={styles.body}>{event.summary}</Text>
              <Text style={styles.meta}>
                {memberLabel(event.actor_user_id, me, partner)} · {formatRelative(event.created_at)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Pressable
        style={styles.discuss}
        onPress={() => router.push({ pathname: '/thread', params: { kind: 'organisation', id: org.id, title: org.name } })}
      >
        <Text style={styles.discussText}>Discuss {org.name} →</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={confirmDelete}>
        <Text style={styles.deleteText}>Delete organisation</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  saveText: { color: theme.colors.navy, fontWeight: '600', fontSize: 13 },
  body: { color: theme.colors.text, marginTop: 8, lineHeight: 21 },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 6 },
  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  stageChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: theme.colors.text,
    fontSize: 13
  },
  stageChipActive: { backgroundColor: theme.colors.navy, borderColor: theme.colors.navy, color: '#fff' },
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
  primaryText: { color: '#fff', fontWeight: '600' },
  activityRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 10 },
  discuss: { backgroundColor: theme.colors.surfaceMuted, padding: 16, borderRadius: theme.radius.md, alignItems: 'center' },
  discussText: { color: theme.colors.navy, fontWeight: '600' },
  deleteButton: { padding: 16, alignItems: 'center' },
  deleteText: { color: theme.colors.danger, fontWeight: '600' }
});
