import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import {
  listCampaigns, listTags, listContentTypes, createCampaign, setCampaignActive, renameCampaign,
  findOrCreateTag, deleteTag, renameTag, createContentType, renameContentType, setContentTypeActive
} from '@/lib/repositories/campaigns';
import type { Campaign, ContentType, Tag } from '@/types/db';

export default function CampaignsTags() {
  const { session } = useAuth();
  const { data: campaigns, reload: reloadCampaigns } = useAsync(() => listCampaigns(true), []);
  const { data: tags, reload: reloadTags } = useAsync(() => listTags(), []);
  const { data: types, reload: reloadTypes } = useAsync(() => listContentTypes(true), []);

  const [campaignName, setCampaignName] = useState('');
  const [tagName, setTagName] = useState('');
  const [typeLabel, setTypeLabel] = useState('');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Campaigns">
        {(campaigns ?? []).map((c) => (
          <CampaignRow key={c.id} campaign={c} onChanged={reloadCampaigns} />
        ))}
        <AddRow value={campaignName} onChange={setCampaignName} placeholder="New campaign name" onAdd={async () => {
          if (!campaignName.trim() || !session) return;
          await createCampaign(campaignName.trim(), session.user.id);
          setCampaignName('');
          reloadCampaigns();
        }} />
      </Section>

      <Section title="Tags">
        <View style={styles.chipWrap}>
          {(tags ?? []).map((t) => (
            <TagChip key={t.id} tag={t} onChanged={reloadTags} />
          ))}
        </View>
        <AddRow value={tagName} onChange={setTagName} placeholder="New tag" onAdd={async () => {
          if (!tagName.trim() || !session) return;
          await findOrCreateTag(tagName.trim(), session.user.id);
          setTagName('');
          reloadTags();
        }} />
      </Section>

      <Section title="Content types">
        {(types ?? []).map((t) => (
          <ContentTypeRow key={t.id} type={t} onChanged={reloadTypes} />
        ))}
        <AddRow value={typeLabel} onChange={setTypeLabel} placeholder="New content type" onAdd={async () => {
          if (!typeLabel.trim()) return;
          await createContentType(typeLabel.trim().toLowerCase().replace(/\s+/g, '_'), typeLabel.trim());
          setTypeLabel('');
          reloadTypes();
        }} />
      </Section>
    </ScrollView>
  );
}

function CampaignRow({ campaign, onChanged }: { campaign: Campaign; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(campaign.name);

  async function save() {
    if (!name.trim() || name.trim() === campaign.name) {
      setEditing(false);
      setName(campaign.name);
      return;
    }
    await renameCampaign(campaign.id, name.trim());
    setEditing(false);
    onChanged();
  }

  if (editing) {
    return (
      <View style={styles.editRow}>
        <TextInput style={styles.editInput} value={name} onChangeText={setName} autoFocus onSubmitEditing={save} />
        <Pressable onPress={save}><Feather name="check" size={16} color={colors.success} /></Pressable>
        <Pressable onPress={() => { setEditing(false); setName(campaign.name); }}><Feather name="x" size={16} color={colors.textSecondary} /></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.rowText, !campaign.is_active && styles.inactive]} numberOfLines={1}>{campaign.name}</Text>
      <View style={styles.rowActions}>
        <Pressable onPress={() => setEditing(true)} hitSlop={8}><Feather name="edit-2" size={15} color={colors.textSecondary} /></Pressable>
        <Pressable onPress={() => setCampaignActive(campaign.id, !campaign.is_active).then(onChanged)}>
          <Text style={styles.action}>{campaign.is_active ? 'Archive' : 'Restore'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TagChip({ tag, onChanged }: { tag: Tag; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);

  async function save() {
    if (!name.trim() || name.trim() === tag.name) {
      setEditing(false);
      setName(tag.name);
      return;
    }
    await renameTag(tag.id, name.trim());
    setEditing(false);
    onChanged();
  }

  function confirmDelete() {
    Alert.alert('Delete tag', `Remove "${tag.name}" from everything it's tagged on?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTag(tag.id).then(onChanged) }
    ]);
  }

  if (editing) {
    return (
      <View style={styles.editChip}>
        <TextInput style={styles.editChipInput} value={name} onChangeText={setName} autoFocus onSubmitEditing={save} onBlur={save} />
        <Pressable onPress={save}><Feather name="check" size={12} color={colors.gold} /></Pressable>
      </View>
    );
  }

  return (
    <Pressable style={styles.chip} onPress={() => setEditing(true)} onLongPress={confirmDelete}>
      <Text style={styles.chipText}>{tag.name}</Text>
      <Pressable onPress={confirmDelete} hitSlop={6}><Feather name="x" size={12} color={colors.gold} /></Pressable>
    </Pressable>
  );
}

function ContentTypeRow({ type, onChanged }: { type: ContentType; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(type.label);

  async function save() {
    if (!label.trim() || label.trim() === type.label) {
      setEditing(false);
      setLabel(type.label);
      return;
    }
    await renameContentType(type.id, label.trim());
    setEditing(false);
    onChanged();
  }

  if (editing) {
    return (
      <View style={styles.editRow}>
        <TextInput style={styles.editInput} value={label} onChangeText={setLabel} autoFocus onSubmitEditing={save} />
        <Pressable onPress={save}><Feather name="check" size={16} color={colors.success} /></Pressable>
        <Pressable onPress={() => { setEditing(false); setLabel(type.label); }}><Feather name="x" size={16} color={colors.textSecondary} /></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.rowText, !type.is_active && styles.inactive]} numberOfLines={1}>{type.label}</Text>
      <View style={styles.rowActions}>
        <Pressable onPress={() => setEditing(true)} hitSlop={8}><Feather name="edit-2" size={15} color={colors.textSecondary} /></Pressable>
        <Pressable onPress={() => setContentTypeActive(type.id, !type.is_active).then(onChanged)}>
          <Text style={styles.action}>{type.is_active ? 'Archive' : 'Restore'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function AddRow({ value, onChange, placeholder, onAdd }: { value: string; onChange: (v: string) => void; placeholder: string; onAdd: () => void }) {
  return (
    <View style={styles.addRow}>
      <TextInput style={styles.addInput} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textSecondary} onSubmitEditing={onAdd} />
      <Pressable style={styles.addButton} onPress={onAdd}><Feather name="plus" size={16} color="#FFF" /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: spacing.sm },
  rowText: { fontSize: 14, color: colors.textPrimary, paddingVertical: 4, flex: 1 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  inactive: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  action: { fontSize: 12, fontWeight: '700', color: colors.info },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  editInput: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.goldSoft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.gold },
  editChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 4 },
  editChipInput: { fontSize: 12, minWidth: 60, color: colors.textPrimary },
  addRow: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  addInput: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: 13 },
  addButton: { backgroundColor: colors.navy, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', width: 36 }
});
