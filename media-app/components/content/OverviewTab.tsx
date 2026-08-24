import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import type { ContentItem } from '@/types/db';
import { useAsync } from '@/lib/useAsync';
import { listCampaigns, listContentTypes, getTagsForContentItem, findOrCreateTag, tagContentItem, untagContentItem } from '@/lib/repositories/campaigns';
import { listTeam, listAssignments, addAssignment, removeAssignment } from '@/lib/repositories/team';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { Avatar } from '@/components/Avatar';
import { PriorityBadge } from '@/components/StatusBadge';
import { moveStage, ConflictError } from '@/lib/repositories/contentItems';
import { checkReadyForApproval } from '@/lib/stateMachine';
import { useAuth } from '@/lib/auth';

const PRIORITIES: ContentItem['priority'][] = ['low', 'normal', 'high', 'urgent'];

export function OverviewTab({ item, updateField, canEdit }: {
  item: ContentItem;
  updateField: <K extends keyof ContentItem>(key: K, value: ContentItem[K]) => void;
  canEdit: boolean;
}) {
  const { session } = useAuth();
  const { data: team } = useAsync(() => listTeam(), []);
  const { data: campaigns } = useAsync(() => listCampaigns(), []);
  const { data: contentTypes } = useAsync(() => listContentTypes(), []);
  const { data: itemTags, reload: reloadTags } = useAsync(() => getTagsForContentItem(item.id), [item.id]);
  const { data: assignments, reload: reloadAssignments } = useAsync(() => listAssignments(item.id), [item.id]);

  const [picker, setPicker] = useState<'owner' | 'approver' | 'publisher' | 'campaign' | 'type' | 'contributor' | null>(null);
  const [newTag, setNewTag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const teamOptions: PickerOption[] = (team ?? []).map((p) => ({ id: p.id, label: p.full_name }));
  const nameOf = (id: string | null) => (team ?? []).find((p) => p.id === id)?.full_name ?? 'Unassigned';

  const contributors = (assignments ?? []).filter((a) => a.role_on_item === 'contributor');

  async function submitForApproval() {
    // Heuristic readiness check for the UI; the state machine's true gate is
    // Section 20's approver action, this just avoids a doomed submission.
    const readiness = checkReadyForApproval({ hasFinalMedia: true, enabledPlatformsWithCaption: 1 });
    if (!readiness.ok) {
      showAlert('Not ready yet', readiness.reasons.join('\n'));
      return;
    }
    setSubmitting(true);
    try {
      await moveStage(item.id, item.version, 'approval');
    } catch (err) {
      showAlert('Could not submit', err instanceof ConflictError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function addTag() {
    if (!newTag.trim() || !session) return;
    const tag = await findOrCreateTag(newTag.trim(), session.user.id);
    await tagContentItem(item.id, tag.id);
    setNewTag('');
    reloadTags();
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TextInput
        style={styles.titleInput}
        value={item.title}
        editable={canEdit}
        onChangeText={(v) => updateField('title', v)}
        multiline
      />

      <Section label="Description">
        <TextInput
          style={styles.textArea}
          value={item.description ?? ''}
          editable={canEdit}
          placeholder="What is this piece of content about?"
          placeholderTextColor={colors.textSecondary}
          onChangeText={(v) => updateField('description', v)}
          multiline
        />
      </Section>

      <Section label="Script">
        <TextInput
          style={styles.textArea}
          value={item.script ?? ''}
          editable={canEdit}
          placeholder="Write or paste the script here…"
          placeholderTextColor={colors.textSecondary}
          onChangeText={(v) => updateField('script', v)}
          multiline
        />
      </Section>

      <View style={styles.row}>
        <FieldButton label="Owner" value={nameOf(item.owner_id)} icon="user" onPress={() => canEdit && setPicker('owner')} avatar />
        <FieldButton label="Approver" value={nameOf(item.approver_id)} icon="check-circle" onPress={() => canEdit && setPicker('approver')} avatar />
      </View>
      <View style={styles.row}>
        <FieldButton label="Publisher" value={nameOf(item.publisher_id)} icon="send" onPress={() => canEdit && setPicker('publisher')} avatar />
        <FieldButton
          label="Due date"
          value={item.due_date ?? 'Not set'}
          icon="calendar"
          onPress={() => {}}
          editableInline={canEdit}
          onChangeInline={(v) => updateField('due_date', v || null)}
        />
      </View>
      <View style={styles.row}>
        <FieldButton label="Campaign" value={campaigns?.find((c) => c.id === item.campaign_id)?.name ?? 'None'} icon="flag" onPress={() => canEdit && setPicker('campaign')} />
        <FieldButton label="Content type" value={contentTypes?.find((t) => t.id === item.content_type_id)?.label ?? 'None'} icon="film" onPress={() => canEdit && setPicker('type')} />
      </View>

      <Section label="Priority">
        <View style={styles.priorityRow}>
          {PRIORITIES.map((p) => (
            <Pressable key={p} disabled={!canEdit} onPress={() => updateField('priority', p)} style={[styles.priorityChip, item.priority === p && styles.priorityChipActive]}>
              <Text style={[styles.priorityChipText, item.priority === p && styles.priorityChipTextActive]}>{p[0].toUpperCase() + p.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section label="Contributors">
        <View style={styles.chipWrap}>
          {contributors.map((c) => (
            <View key={c.id} style={styles.personChip}>
              <Avatar name={nameOf(c.user_id)} size={18} />
              <Text style={styles.personChipText}>{nameOf(c.user_id)}</Text>
              {canEdit && (
                <Pressable onPress={async () => { await removeAssignment(c.id); reloadAssignments(); }}>
                  <Feather name="x" size={12} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          ))}
          {canEdit && (
            <Pressable style={styles.addChip} onPress={() => setPicker('contributor')}>
              <Feather name="plus" size={12} color={colors.navy} />
              <Text style={styles.addChipText}>Add</Text>
            </Pressable>
          )}
        </View>
      </Section>

      <Section label="Tags">
        <View style={styles.chipWrap}>
          {(itemTags ?? []).map((t) => (
            <View key={t.id} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{t.name}</Text>
              {canEdit && (
                <Pressable onPress={async () => { await untagContentItem(item.id, t.id); reloadTags(); }}>
                  <Feather name="x" size={12} color={colors.gold} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
        {canEdit && (
          <View style={styles.tagInputRow}>
            <TextInput style={styles.tagInput} value={newTag} onChangeText={setNewTag} placeholder="Add a tag…" placeholderTextColor={colors.textSecondary} onSubmitEditing={addTag} />
            <Pressable onPress={addTag} style={styles.tagAddButton}><Feather name="plus" size={16} color="#FFF" /></Pressable>
          </View>
        )}
      </Section>

      <Section label="Internal notes">
        <TextInput
          style={styles.textArea}
          value={item.internal_notes ?? ''}
          editable={canEdit}
          placeholder="Notes only the team sees — never published."
          placeholderTextColor={colors.textSecondary}
          onChangeText={(v) => updateField('internal_notes', v)}
          multiline
        />
      </Section>

      {canEdit && item.stage === 'producing' && (
        <Pressable style={styles.submitButton} onPress={submitForApproval} disabled={submitting}>
          <Text style={styles.submitButtonText}>Submit for Approval</Text>
        </Pressable>
      )}

      <PickerSheet visible={picker === 'owner'} title="Owner" options={teamOptions} selectedId={item.owner_id} onClose={() => setPicker(null)} onSelect={(id) => { if (id) updateField('owner_id', id); setPicker(null); }} />
      <PickerSheet visible={picker === 'approver'} title="Approver" options={teamOptions} selectedId={item.approver_id} allowClear onClose={() => setPicker(null)} onSelect={(id) => { updateField('approver_id', id); setPicker(null); }} />
      <PickerSheet visible={picker === 'publisher'} title="Publisher" options={teamOptions} selectedId={item.publisher_id} allowClear onClose={() => setPicker(null)} onSelect={(id) => { updateField('publisher_id', id); setPicker(null); }} />
      <PickerSheet visible={picker === 'campaign'} title="Campaign" options={(campaigns ?? []).map((c) => ({ id: c.id, label: c.name }))} selectedId={item.campaign_id} allowClear onClose={() => setPicker(null)} onSelect={(id) => { updateField('campaign_id', id); setPicker(null); }} />
      <PickerSheet visible={picker === 'type'} title="Content type" options={(contentTypes ?? []).map((t) => ({ id: t.id, label: t.label }))} selectedId={item.content_type_id} allowClear onClose={() => setPicker(null)} onSelect={(id) => { updateField('content_type_id', id); setPicker(null); }} />
      <PickerSheet
        visible={picker === 'contributor'} title="Add contributor" options={teamOptions} onClose={() => setPicker(null)}
        onSelect={async (id) => { if (id && session) { await addAssignment(item.id, id, 'contributor', session.user.id); reloadAssignments(); } setPicker(null); }}
      />
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function FieldButton({
  label, value, icon, onPress, avatar, editableInline, onChangeInline
}: {
  label: string; value: string; icon: keyof typeof Feather.glyphMap; onPress: () => void; avatar?: boolean;
  editableInline?: boolean; onChangeInline?: (v: string) => void;
}) {
  return (
    <View style={styles.fieldCol}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {editableInline ? (
        <View style={styles.fieldButton}>
          <TextInput style={styles.fieldInline} value={value === 'Not set' ? '' : value} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} onChangeText={onChangeInline} />
        </View>
      ) : (
        <Pressable style={styles.fieldButton} onPress={onPress}>
          {avatar && <Avatar name={value} size={18} />}
          <Text style={styles.fieldValue} numberOfLines={1}>{value}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 },
  titleInput: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  textArea: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    padding: spacing.md, fontSize: 14, color: colors.textPrimary, minHeight: 70, textAlignVertical: 'top'
  },
  row: { flexDirection: 'row', gap: spacing.md },
  fieldCol: { flex: 1, gap: 6 },
  fieldButton: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8
  },
  fieldValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', flexShrink: 1 },
  fieldInline: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', flex: 1 },
  priorityRow: { flexDirection: 'row', gap: spacing.sm },
  priorityChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  priorityChipActive: { backgroundColor: colors.navy },
  priorityChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  priorityChipTextActive: { color: '#FFF' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  personChipText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  addChipText: { fontSize: 12, fontWeight: '700', color: colors.navy },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.goldSoft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  tagChipText: { fontSize: 12, fontWeight: '700', color: colors.gold },
  tagInputRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  tagInput: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: 13 },
  tagAddButton: { backgroundColor: colors.navy, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', width: 36 },
  submitButton: { backgroundColor: colors.stageApproval, borderRadius: radii.md, paddingVertical: 14, alignItems: 'center' },
  submitButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 }
});
