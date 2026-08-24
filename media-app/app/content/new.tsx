import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { listCampaigns, listContentTypes } from '@/lib/repositories/campaigns';
import { listTeam } from '@/lib/repositories/team';
import { createContentItem } from '@/lib/repositories/contentItems';
import { colors, radii, spacing } from '@/constants/theme';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { Feather } from '@expo/vector-icons';

export default function NewContentItem() {
  const { session } = useAuth();
  const { data: team } = useAsync(() => listTeam(), []);
  const { data: campaigns } = useAsync(() => listCampaigns(), []);
  const { data: contentTypes } = useAsync(() => listContentTypes(), []);

  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(session?.user.id ?? null);
  const [approverId, setApproverId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [contentTypeId, setContentTypeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [picker, setPicker] = useState<'owner' | 'approver' | 'campaign' | 'type' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamOptions: PickerOption[] = (team ?? []).map((p) => ({ id: p.id, label: p.full_name }));
  const campaignOptions: PickerOption[] = (campaigns ?? []).map((c) => ({ id: c.id, label: c.name }));
  const typeOptions: PickerOption[] = (contentTypes ?? []).map((t) => ({ id: t.id, label: t.label }));

  const ownerName = teamOptions.find((o) => o.id === ownerId)?.label ?? 'Select who will action this';
  const approverName = teamOptions.find((o) => o.id === approverId)?.label ?? 'Select approver (optional)';
  const campaignName = campaignOptions.find((o) => o.id === campaignId)?.label ?? 'No campaign';
  const typeName = typeOptions.find((o) => o.id === contentTypeId)?.label ?? 'Select content type';

  async function submit() {
    if (!title.trim()) return setError('Give this idea a title.');
    if (!ownerId) return setError('Every content item needs someone assigned to action it.');
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const item = await createContentItem({
        title: title.trim(),
        owner_id: ownerId,
        approver_id: approverId,
        campaign_id: campaignId,
        content_type_id: contentTypeId,
        due_date: dueDate || null,
        created_by: session.user.id
      });
      router.replace(`/content/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'New idea', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Teachers React to Salim" placeholderTextColor={colors.textSecondary} />

        <Field label="Content type" value={typeName} onPress={() => setPicker('type')} />
        <Field label="Campaign" value={campaignName} onPress={() => setPicker('campaign')} />
        <Field label="Assigned To" value={ownerName} onPress={() => setPicker('owner')} required />
        <Field label="Approver" value={approverName} onPress={() => setPicker('approver')} />

        <Text style={styles.label}>Due date</Text>
        <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.submit} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Add to Ideas</Text>}
        </Pressable>
      </ScrollView>

      <PickerSheet visible={picker === 'owner'} title="Assigned To" options={teamOptions} selectedId={ownerId} onClose={() => setPicker(null)} onSelect={(id) => { setOwnerId(id); setPicker(null); }} />
      <PickerSheet visible={picker === 'approver'} title="Approver" options={teamOptions} selectedId={approverId} allowClear onClose={() => setPicker(null)} onSelect={(id) => { setApproverId(id); setPicker(null); }} />
      <PickerSheet visible={picker === 'campaign'} title="Campaign" options={campaignOptions} selectedId={campaignId} allowClear onClose={() => setPicker(null)} onSelect={(id) => { setCampaignId(id); setPicker(null); }} />
      <PickerSheet visible={picker === 'type'} title="Content type" options={typeOptions} selectedId={contentTypeId} allowClear onClose={() => setPicker(null)} onSelect={(id) => { setContentTypeId(id); setPicker(null); }} />
    </View>
  );
}

function Field({ label, value, onPress, required }: { label: string; value: string; onPress: () => void; required?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <Pressable style={styles.fieldButton} onPress={onPress}>
        <Text style={styles.fieldValue}>{value}</Text>
        <Feather name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textPrimary
  },
  fieldButton: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  fieldValue: { fontSize: 15, color: colors.textPrimary },
  error: { color: colors.danger, fontSize: 13 },
  submit: { backgroundColor: colors.navy, borderRadius: radii.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 15 }
});
