import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { searchBankAssets, uploadMediaVersion } from '@/lib/repositories/media';
import { listTags } from '@/lib/repositories/campaigns';
import { useAuth } from '@/lib/auth';
import { MediaThumb } from '@/components/MediaThumb';
import { useThumbnail } from '@/lib/useThumbnail';
import { listVersions } from '@/lib/repositories/media';
import type { MediaAsset } from '@/types/db';

export default function ContentBank() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const { data: assets, loading, reload } = useAsync(() => searchBankAssets(query), [query]);
  const { data: tags } = useAsync(() => listTags(), []);
  const [uploading, setUploading] = useState(false);

  async function upload() {
    if (!session) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    const picked = result.assets[0];
    setUploading(true);
    try {
      await uploadMediaVersion({
        contentItemId: null,
        section: 'raw',
        isBankItem: true,
        assetTitle: picked.fileName ?? `Untitled ${new Date().toLocaleDateString()}`,
        file: { uri: picked.uri, name: picked.fileName ?? `upload-${Date.now()}`, mimeType: picked.mimeType ?? 'application/octet-stream', size: picked.fileSize },
        uploadedBy: session.user.id
      });
      reload();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.textSecondary} />
        <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search the Content Bank…" placeholderTextColor={colors.textSecondary} />
      </View>

      {tags && tags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
          {tags.map((t) => (
            <Pressable key={t.id} style={styles.tagChip} onPress={() => setQuery(t.name)}>
              <Text style={styles.tagChipText}>{t.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {loading && !assets ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {(assets ?? []).length === 0 && <Text style={styles.empty}>Nothing here yet — upload raw footage, photos, B-roll or graphics to reuse later.</Text>}
          {(assets ?? []).map((asset) => <BankCard key={asset.id} asset={asset} />)}
        </ScrollView>
      )}

      <Pressable style={styles.fab} onPress={upload} disabled={uploading}>
        {uploading ? <ActivityIndicator color="#FFF" /> : <Feather name="plus" size={22} color="#FFF" />}
      </Pressable>
    </View>
  );
}

function BankCard({ asset }: { asset: MediaAsset }) {
  const { data: versions } = useAsync(() => listVersions(asset.id), [asset.id]);
  const latest = versions?.[0];
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/bank/${asset.id}`)}>
      <MediaThumb storagePath={latest?.storage_path ?? null} kind={asset.kind} size={150} radius={radii.md} />
      <Text style={styles.cardTitle} numberOfLines={2}>{asset.title}</Text>
    </Pressable>
  );
}

const shadowFab = {
  shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg, marginTop: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.textPrimary },
  tagRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 8 },
  tagChip: { backgroundColor: colors.goldSoft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  tagChipText: { fontSize: 11, fontWeight: '700', color: colors.gold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, padding: spacing.lg, paddingBottom: 100 },
  card: { width: 150, gap: 6 },
  cardTitle: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  empty: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', padding: spacing.lg },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', ...shadowFab
  }
});
