import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { showAlert } from '@/lib/alert';
import { colors, radii, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { listAssetsForContentItem, listVersions, uploadMediaVersion } from '@/lib/repositories/media';
import { listTeam } from '@/lib/repositories/team';
import { MediaThumb } from '@/components/MediaThumb';
import { MediaViewer } from '@/components/MediaViewer';
import { useAuth } from '@/lib/auth';
import { timeAgo, bytesToSize } from '@/lib/format';
import type { MediaAsset, MediaSection, MediaVersion } from '@/types/db';

const SECTIONS: { key: MediaSection; label: string; hint: string }[] = [
  { key: 'raw', label: 'Raw Media', hint: 'Original footage and photographs' },
  { key: 'draft', label: 'Drafts', hint: 'Edited versions — Reel V1, V2, V3…' },
  { key: 'final', label: 'Final', hint: 'Approved / final media' }
];

export function MediaTab({ contentItemId, canEdit }: { contentItemId: string; canEdit: boolean }) {
  const { session } = useAuth();
  const { data: assets, reload } = useAsync(() => listAssetsForContentItem(contentItemId), [contentItemId]);
  const { data: team } = useAsync(() => listTeam(), []);
  const nameOf = (id: string | null) => (team ?? []).find((p) => p.id === id)?.full_name ?? 'Someone';

  const [viewer, setViewer] = useState<{ storagePath: string; kind: MediaAsset['kind'] } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  async function uploadNewAsset(section: MediaSection) {
    if (!session) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const title = section === 'draft' ? `Reel V1` : asset.fileName ?? 'Untitled';
    setUploading(section);
    try {
      await uploadMediaVersion({
        contentItemId, section, assetTitle: title,
        file: { uri: asset.uri, name: asset.fileName ?? `upload-${Date.now()}`, mimeType: asset.mimeType ?? 'application/octet-stream', size: asset.fileSize },
        uploadedBy: session.user.id
      });
      reload();
    } catch (err) {
      showAlert('Upload failed', err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
    }
  }

  async function uploadPdf(section: MediaSection) {
    if (!session) return;
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    setUploading(section);
    try {
      await uploadMediaVersion({
        contentItemId, section, assetTitle: file.name,
        file: { uri: file.uri, name: file.name, mimeType: file.mimeType ?? 'application/pdf', size: file.size ?? undefined },
        uploadedBy: session.user.id
      });
      reload();
    } catch (err) {
      showAlert('Upload failed', err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {SECTIONS.map((s) => (
        <View key={s.key} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{s.label}</Text>
              <Text style={styles.sectionHint}>{s.hint}</Text>
            </View>
            {canEdit && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={styles.uploadButton} onPress={() => uploadPdf(s.key)} hitSlop={6}>
                  <Feather name="file-text" size={16} color={colors.navy} />
                </Pressable>
                <Pressable style={styles.uploadButton} onPress={() => uploadNewAsset(s.key)} disabled={uploading === s.key}>
                  {uploading === s.key ? <ActivityIndicator size="small" color={colors.navy} /> : <Feather name="upload" size={16} color={colors.navy} />}
                </Pressable>
              </View>
            )}
          </View>

          {(assets ?? []).filter((a) => a.section === s.key).length === 0 ? (
            <Text style={styles.empty}>Nothing uploaded yet.</Text>
          ) : (
            (assets ?? []).filter((a) => a.section === s.key).map((asset) => (
              <AssetBlock
                key={asset.id}
                asset={asset}
                canEdit={canEdit}
                nameOf={nameOf}
                onPreview={(v) => setViewer({ storagePath: v.storage_path, kind: asset.kind })}
                onUploadVersion={async () => {
                  if (!session) return;
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.9 });
                  if (result.canceled || !result.assets[0]) return;
                  const picked = result.assets[0];
                  await uploadMediaVersion({
                    contentItemId, assetId: asset.id, assetTitle: asset.title, section: asset.section,
                    file: { uri: picked.uri, name: picked.fileName ?? `upload-${Date.now()}`, mimeType: picked.mimeType ?? 'application/octet-stream', size: picked.fileSize },
                    uploadedBy: session.user.id
                  });
                  reload();
                }}
              />
            ))
          )}
        </View>
      ))}

      <MediaViewer visible={!!viewer} storagePath={viewer?.storagePath ?? null} kind={viewer?.kind} onClose={() => setViewer(null)} />
    </ScrollView>
  );
}

function AssetBlock({ asset, canEdit, nameOf, onPreview, onUploadVersion }: {
  asset: MediaAsset; canEdit: boolean; nameOf: (id: string | null) => string;
  onPreview: (v: MediaVersion) => void; onUploadVersion: () => void;
}) {
  const { data: versions, reload } = useAsync(() => listVersions(asset.id), [asset.id]);
  const [expanded, setExpanded] = useState(false);
  const latest = versions?.[0];

  return (
    <View style={styles.assetBlock}>
      <Pressable style={styles.assetRow} onPress={() => latest && onPreview(latest)}>
        <MediaThumb storagePath={latest?.storage_path ?? null} kind={asset.kind} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.assetTitle}>{asset.title}</Text>
          <Text style={styles.assetMeta}>
            {latest ? `${latest.version_label} · ${nameOf(latest.uploaded_by)} · ${timeAgo(latest.uploaded_at)}` : 'No versions yet'}
          </Text>
        </View>
        <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8}>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
        </Pressable>
      </Pressable>

      {expanded && (
        <View style={styles.versionList}>
          {(versions ?? []).map((v) => (
            <Pressable key={v.id} style={styles.versionRow} onPress={() => onPreview(v)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.versionLabel}>{v.version_label}</Text>
                <Text style={styles.versionMeta}>{nameOf(v.uploaded_by)} · {timeAgo(v.uploaded_at)} · {bytesToSize(v.file_size_bytes)}</Text>
                {v.upload_comment && <Text style={styles.versionComment}>"{v.upload_comment}"</Text>}
              </View>
            </Pressable>
          ))}
          {canEdit && (
            <Pressable style={styles.newVersionButton} onPress={async () => { await onUploadVersion(); reload(); }}>
              <Feather name="plus" size={14} color={colors.navy} />
              <Text style={styles.newVersionText}>Upload new version</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sectionHint: { fontSize: 12, color: colors.textSecondary },
  uploadButton: { width: 34, height: 34, borderRadius: radii.sm, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  assetBlock: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  assetTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  assetMeta: { fontSize: 12, color: colors.textSecondary },
  versionList: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.sm },
  versionRow: { paddingVertical: 4 },
  versionLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  versionMeta: { fontSize: 11, color: colors.textSecondary },
  versionComment: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  newVersionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6 },
  newVersionText: { fontSize: 12, fontWeight: '700', color: colors.navy }
});
