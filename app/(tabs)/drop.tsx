import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { Card } from '@/components/Card';
import { LoadingState, EmptyState } from '@/components/AsyncState';
import { PageBanner } from '@/components/PageBanner';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { createDrop, listDrops, updateDropText, deleteDrop } from '@/lib/repositories/drops';
import { requestDropParse } from '@/lib/repositories/aiActions';
import { isInQuietHours, formatQuietHoursRange } from '@/lib/quietHours';
import { formatRelative } from '@/lib/format';
import { listOrganisations, createFollowUp } from '@/lib/repositories/organisations';
import { createDecision } from '@/lib/repositories/decisions';
import { createEvent } from '@/lib/repositories/events';
import { LinkPicker, GIVE_LINK_TARGETS, type LinkPickerResult } from '@/components/LinkPicker';
import { ownerAccentColor } from '@/lib/ownerLabel';

export default function DropScreen() {
  const { session } = useAuth();
  const { workspaceId, me, partner } = useWorkspace();
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingDropId, setEditingDropId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [linkingDropId, setLinkingDropId] = useState<string | null>(null);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState('');

  const {
    data: myDrops,
    loading: dropsLoading,
    refresh: refreshDrops
  } = useAsync(() => (workspaceId ? listDrops(workspaceId) : Promise.resolve([])), [workspaceId]);

  // Loaded only to power the CRM picker when linking a drop to a follow-up.
  const { data: orgsList } = useAsync(() => (workspaceId ? listOrganisations(workspaceId) : Promise.resolve([])), [workspaceId]);

  const startEdit = (dropId: string, currentText: string) => {
    setEditingDropId(dropId);
    setEditText(currentText);
  };

  const cancelEdit = () => {
    setEditingDropId(null);
    setEditText('');
  };

  const saveEdit = async (dropId: string) => {
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      await updateDropText(dropId, editText.trim());
      setEditingDropId(null);
      setEditText('');
      await refreshDrops();
      // Refresh the catch-up summary against the corrected text — never
      // proposes AI actions, that only happens from the AI Actions tab.
      requestDropParse(dropId, false)
        .then(() => refreshDrops())
        .catch(() => {});
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Could not save that edit.');
    } finally {
      setSavingEdit(false);
    }
  };

  const startLink = (dropId: string) => {
    setLinkingDropId(dropId);
    setLinkError('');
  };

  const cancelLink = () => {
    setLinkingDropId(null);
    setLinkError('');
  };

  const saveLink = async (result: LinkPickerResult) => {
    if (!session || !workspaceId) return;
    setLinkSaving(true);
    setLinkError('');
    try {
      if (result.target === 'calendar') {
        await createEvent({
          workspace_id: workspaceId,
          title: result.title,
          start_at: result.startAt,
          all_day: result.allDay,
          created_by: session.user.id
        });
      } else if (result.target === 'crm') {
        await createFollowUp(result.organisationId, result.note);
      } else if (result.target === 'discussion') {
        await createDecision({ workspace_id: workspaceId, title: result.title, owner: result.owner, created_by: session.user.id });
      }
      setLinkingDropId(null);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Could not link that.');
    } finally {
      setLinkSaving(false);
    }
  };

  const confirmDeleteDrop = (dropId: string) => {
    Alert.alert('Delete this?', "This removes it from your sent list. It won't undo anything it already created.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDrop(dropId);
          refreshDrops();
        }
      }
    ]);
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

      // This screen is purely conversation with your co-founder: this call
      // only writes a clean catch-up summary (best-effort — the drop is
      // fully saved either way). It never proposes AI actions — that's the
      // separate AI Actions tab, on purpose.
      requestDropParse(drop.id, false)
        .then(() => refreshDrops())
        .catch(() => {});
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Could not save that drop.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <SectionTitle title="Give" subtitle="Capture first. Organise later." />
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
        won't see the raw text: it's condensed into a short summary for their catch-up feed. Normal ones wait for their
        next catch-up; urgent ones bypass quiet hours.
      </Text>

      <Pressable style={styles.aiLink} onPress={() => router.push('/(tabs)/ai')}>
        <Text style={styles.aiLinkTitle}>Want to talk it through?</Text>
        <Text style={styles.aiLinkText}>Open Your AI Assistant — ask questions, get advice, or have it action things →</Text>
      </Pressable>

      <SectionTitle title="What you've sent" subtitle={`Your recent drops, in your own words.`} />
      <PageBanner image={require('@/assets/images/sign-in-hero.jpg')} />
      {dropsLoading ? (
        <LoadingState label="Loading your drops…" />
      ) : (
        (() => {
          const mine = (myDrops ?? []).filter(d => d.created_by === session?.user.id);
          if (mine.length === 0) {
            return (
              <EmptyState
                label="Nothing sent yet — whatever you give above will show up here."
              />
            );
          }
          return (
            <View style={{ gap: 10 }}>
              {mine.map(drop =>
                editingDropId === drop.id ? (
                  <Card key={drop.id}>
                    <TextInput
                      value={editText}
                      onChangeText={setEditText}
                      multiline
                      style={styles.editInput}
                      placeholderTextColor={theme.colors.muted}
                      autoFocus
                    />
                    <View style={styles.buttons}>
                      <Pressable style={styles.primary} onPress={() => saveEdit(drop.id)} disabled={savingEdit}>
                        <Text style={styles.primaryText}>{savingEdit ? 'Saving…' : 'Save'}</Text>
                      </Pressable>
                      <Pressable style={styles.secondary} onPress={cancelEdit} disabled={savingEdit}>
                        <Text style={styles.secondaryText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </Card>
                ) : (
                  <Card key={drop.id} style={{ backgroundColor: ownerAccentColor(drop.created_by, me, partner) ?? theme.colors.surface }}>
                    <View style={styles.sentHeader}>
                      <Text style={[styles.sentText, { flex: 1 }]}>{drop.raw_text}</Text>
                      <View style={styles.sentIcons}>
                        <Pressable hitSlop={10} onPress={() => startLink(drop.id)}>
                          <Ionicons name="link-outline" size={18} color={theme.colors.muted} />
                        </Pressable>
                        <Pressable hitSlop={10} onPress={() => startEdit(drop.id, drop.raw_text)}>
                          <Ionicons name="pencil-outline" size={18} color={theme.colors.muted} />
                        </Pressable>
                        <Pressable hitSlop={10} onPress={() => confirmDeleteDrop(drop.id)}>
                          <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.meta}>
                      {formatRelative(drop.created_at)}
                      {drop.urgent ? ' · Urgent' : ''}
                      {drop.summary ? ` · ${partner?.display_name ?? 'They'} saw: "${drop.summary}"` : ' · Not processed yet'}
                    </Text>
                    {linkingDropId === drop.id ? (
                      <LinkPicker
                        targets={GIVE_LINK_TARGETS}
                        organisations={(orgsList ?? []).map(o => ({ id: o.id, name: o.name }))}
                        seedTitle={drop.raw_text}
                        saving={linkSaving}
                        error={linkError}
                        onSave={saveLink}
                        onCancel={cancelLink}
                      />
                    ) : null}
                  </Card>
                )
              )}
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
  aiLink: { backgroundColor: theme.colors.surfaceMuted, padding: 16, borderRadius: theme.radius.md },
  aiLinkTitle: { color: theme.colors.navy, fontSize: 16, fontWeight: '600' },
  aiLinkText: { color: theme.colors.muted, marginTop: 4 },
  sentText: { color: theme.colors.text, lineHeight: 21, fontSize: 15 },
  sentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sentIcons: { flexDirection: 'row', gap: 14, paddingTop: 2 },
  meta: { color: theme.colors.muted, fontSize: 12, marginTop: 8 },
  editInput: {
    minHeight: 100,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    textAlignVertical: 'top',
    backgroundColor: theme.colors.background
  }
});
