import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { listVersions, getTagsForAsset, tagMediaAsset, untagMediaAsset, attachBankAssetToContentItem } from '@/lib/repositories/media';
import { findOrCreateTag } from '@/lib/repositories/campaigns';
import { listContentItemSummaries } from '@/lib/repositories/contentItems';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { MediaThumb } from '@/components/MediaThumb';
import { MediaViewer } from '@/components/MediaViewer';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { timeAgo, bytesToSize } from '@/lib/format';
import type { MediaSection } from '@/types/db';

export default function BankAssetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { data: versions, reload: reloadVersions } = useAsync(() => listVersions(id), [id]);
  const { data: tags, reload: reloadTags } = useAsync(() => getTagsForAsset(id), [id]);
  const { data: contentItems } = useAsync(() => listContentItemSummaries(), []);
  const [newTag, setNewTag] = useState('');
  const [viewer, setViewer] = useState<string | null>(null);
  const [attachPicker, setAttachPicker] = useState(false);

  const { data: asset } = useAsync(async () => {
    const client = supabase;
    if (!client) return null;
    const { data } = await client.from('media_assets').select('*').eq('id', id).single();
    return data;
  }, [id]);

  const latest = versions?.[0];

  async function addTag() {
    if (!newTag.trim() || !session) return;
    const tag = await findOrCreateTag(newTag.trim(), session.user.id);
    await tagMediaAsset(id, tag.id);
    setNewTag('');
    reloadTags();
  }

  async function attach(contentItemId: string | null, section: MediaSection = 'raw') {
    if (!contentItemId) return;
    await attachBankAssetToContentItem(id, contentItemId, section);
    Alert.alert('Attached', 'This file is now part of that content item.');
    setAttachPicker(false);
  }

  const contentOptions: PickerOption[] = (contentItems ?? []).map((c) => ({ id: c.id, label: c.title }));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: asset?.title ?? 'Media' }} />

      <Pressable onPress={() => latest && setViewer(latest.storage_path)}>
        <MediaThumb storagePath={latest?.storage_path ?? null} kind={asset?.kind} size={220} radius={radii.lg} />
      </Pressable>

      <Text style={styles.title}>{asset?.title}</Text>

      <View style={styles.chipWrap}>
        {(tags ?? []).map((t: any) => (
          <View key={t.id} style={styles.tagChip}>
            <Text style={styles.tagChipText}>{t.name}</Text>
            <Pressable onPress={async () => { await untagMediaAsset(id, t.id); reloadTags(); }}>
              <Feather name="x" size={12} color={colors.gold} />
            </Pressable>
          </View>
        ))}
      </View>
      <View style={styles.tagInputRow}>
        <TextInput style={styles.tagInput} value={newTag} onChangeText={setNewTag} placeholder="Add a tag…" placeholderTextColor={colors.textSecondary} onSubmitEditing={addTag} />
        <Pressable onPress={addTag} style={styles.tagAddButton}><Feather name="plus" size={16} color="#FFF" /></Pressable>
      </View>

      <Pressable style={styles.attachButton} onPress={() => setAttachPicker(true)}>
        <Feather name="link" size={16} color={colors.navy} />
        <Text style={styles.attachText}>Attach to a content item</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Versions</Text>
      {(versions ?? []).map((v) => (
        <Pressable key={v.id} style={styles.versionRow} onPress={() => setViewer(v.storage_path)}>
          <Text style={styles.versionLabel}>{v.version_label}</Text>
          <Text style={styles.versionMeta}>{timeAgo(v.uploaded_at)} · {bytesToSize(v.file_size_bytes)}</Text>
        </Pressable>
      ))}

      <MediaViewer visible={!!viewer} storagePath={viewer} kind={asset?.kind} onClose={() => setViewer(null)} />
      <PickerSheet visible={attachPicker} title="Attach to content item" options={contentOptions} onClose={() => setAttachPicker(false)} onSelect={(id) => attach(id)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.goldSoft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  tagChipText: { fontSize: 12, fontWeight: '700', color: colors.gold },
  tagInputRow: { flexDirection: 'row', gap: 8, width: '100%' },
  tagInput: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: 13 },
  tagAddButton: { backgroundColor: colors.navy, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', width: 36 },
  attachButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  attachText: { fontSize: 13, fontWeight: '700', color: colors.navy },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.sm },
  versionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  versionLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  versionMeta: { fontSize: 11, color: colors.textSecondary }
});
