import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { listCampaigns, listTags, listContentTypes, createCampaign, setCampaignActive, findOrCreateTag, createContentType } from '@/lib/repositories/campaigns';

export default function CampaignsTags() {
  const { session } = useAuth();
  const { data: campaigns, reload: reloadCampaigns } = useAsync(() => listCampaigns(true), []);
  const { data: tags, reload: reloadTags } = useAsync(() => listTags(), []);
  const { data: types, reload: reloadTypes } = useAsync(() => listContentTypes(), []);

  const [campaignName, setCampaignName] = useState('');
  const [tagName, setTagName] = useState('');
  const [typeLabel, setTypeLabel] = useState('');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Campaigns">
        {(campaigns ?? []).map((c) => (
          <View key={c.id} style={styles.row}>
            <Text style={[styles.rowText, !c.is_active && styles.inactive]}>{c.name}</Text>
            <Pressable onPress={() => setCampaignActive(c.id, !c.is_active).then(reloadCampaigns)}>
              <Text style={styles.action}>{c.is_active ? 'Archive' : 'Restore'}</Text>
            </Pressable>
          </View>
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
          {(tags ?? []).map((t) => <View key={t.id} style={styles.chip}><Text style={styles.chipText}>{t.name}</Text></View>)}
        </View>
        <AddRow value={tagName} onChange={setTagName} placeholder="New tag" onAdd={async () => {
          if (!tagName.trim() || !session) return;
          await findOrCreateTag(tagName.trim(), session.user.id);
          setTagName('');
          reloadTags();
        }} />
      </Section>

      <Section title="Content types">
        {(types ?? []).map((t) => <Text key={t.id} style={styles.rowText}>{t.label}</Text>)}
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowText: { fontSize: 14, color: colors.textPrimary, paddingVertical: 4 },
  inactive: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  action: { fontSize: 12, fontWeight: '700', color: colors.info },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.goldSoft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.gold },
  addRow: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  addInput: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: 13 },
  addButton: { backgroundColor: colors.navy, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', width: 36 }
});
