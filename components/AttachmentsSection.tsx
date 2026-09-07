import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { showAlert } from '@/lib/alert';
import { Card } from '@/components/Card';
import { AttachmentThumb } from '@/components/AttachmentThumb';
import { theme } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import {
  listAttachments,
  addAttachmentLink,
  addAttachmentPhoto,
  addAttachmentFile,
  updateAttachment,
  deleteAttachment,
  getAttachmentFileUrl,
  type AttachmentScope
} from '@/lib/repositories/attachments';
import type { AttachmentRow } from '@/types/db';

const IMAGE_PATH_RE = /\.(jpe?g|png|gif|webp|heic)$/i;

function scopeKeyFor(scope: AttachmentScope): string {
  if ('project_id' in scope) return `p:${scope.project_id}`;
  if ('task_id' in scope) return `t:${scope.task_id}`;
  if ('document_id' in scope) return `d:${scope.document_id}`;
  return `g:${scope.drop_id}`;
}

/**
 * Links, photos, and documents attached to one project, task, document, or
 * drop — reused everywhere attachments show up.
 *
 * `scope` can be null when the thing being attached to doesn't exist yet
 * (e.g. a Quick Note that hasn't been saved — sometimes the attachment IS
 * the note, so waiting for a save first would block that). Pass
 * `onEnsureScope` to create it lazily the first time something is actually
 * added; every add action resolves the scope through that before uploading.
 */
export function AttachmentsSection({
  workspaceId,
  createdBy,
  scope,
  onEnsureScope,
  title = 'Links & files'
}: {
  workspaceId: string;
  createdBy: string;
  scope: AttachmentScope | null;
  onEnsureScope?: () => Promise<AttachmentScope>;
  title?: string;
}) {
  const scopeKey = scope ? scopeKeyFor(scope) : null;
  const { data: attachments, loading, setData } = useAsync(() => (scope ? listAttachments(scope) : Promise.resolve([])), [scopeKey]);

  const resolveScope = async (): Promise<AttachmentScope | null> => scope ?? (onEnsureScope ? onEnsureScope() : null);

  const [linkDraft, setLinkDraft] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [addingDocument, setAddingDocument] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const submitLink = async () => {
    const url = linkDraft.trim();
    if (!url) return;
    setAddingLink(true);
    try {
      const activeScope = await resolveScope();
      if (!activeScope) return;
      const link = await addAttachmentLink(activeScope, { workspace_id: workspaceId, url, created_by: createdBy });
      setData(prev => [...(prev ?? []), link]);
      setLinkDraft('');
    } catch (err) {
      showAlert('Could not add that link', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setAddingLink(false);
    }
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Photo access needed', 'Allow photo access in your phone settings to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true
    });
    if (result.canceled || result.assets.length === 0) return;
    setAddingPhoto(true);
    try {
      const activeScope = await resolveScope();
      if (!activeScope) return;
      const outcomes = await Promise.allSettled(
        result.assets.map(asset =>
          addAttachmentPhoto(
            activeScope,
            { workspace_id: workspaceId, created_by: createdBy },
            { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' }
          )
        )
      );
      const uploaded = outcomes.filter((o): o is PromiseFulfilledResult<AttachmentRow> => o.status === 'fulfilled').map(o => o.value);
      if (uploaded.length > 0) setData(prev => [...(prev ?? []), ...uploaded]);
      if (uploaded.length < outcomes.length) {
        showAlert("Some photos didn't attach", `${outcomes.length - uploaded.length} of ${outcomes.length} couldn't be added — try those again.`);
      }
    } finally {
      setAddingPhoto(false);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (result.canceled || result.assets.length === 0) return;
    setAddingDocument(true);
    try {
      const activeScope = await resolveScope();
      if (!activeScope) return;
      const outcomes = await Promise.allSettled(
        result.assets.map(asset =>
          addAttachmentFile(
            activeScope,
            { workspace_id: workspaceId, created_by: createdBy },
            { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' }
          )
        )
      );
      const uploaded = outcomes.filter((o): o is PromiseFulfilledResult<AttachmentRow> => o.status === 'fulfilled').map(o => o.value);
      if (uploaded.length > 0) setData(prev => [...(prev ?? []), ...uploaded]);
      if (uploaded.length < outcomes.length) {
        showAlert("Some files didn't attach", `${outcomes.length - uploaded.length} of ${outcomes.length} couldn't be added — try those again.`);
      }
    } finally {
      setAddingDocument(false);
    }
  };

  const startEdit = (attachment: AttachmentRow) => {
    setEditingId(attachment.id);
    setEditLabel(attachment.label ?? '');
    setEditUrl(attachment.url ?? '');
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (attachment: AttachmentRow) => {
    if (attachment.url && !editUrl.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await updateAttachment(attachment.id, {
        label: editLabel.trim() || null,
        ...(attachment.url ? { url: editUrl.trim() } : {})
      });
      setData(prev => (prev ?? []).map(a => (a.id === attachment.id ? updated : a)));
      setEditingId(null);
    } catch (err) {
      showAlert("Couldn't save that", err instanceof Error ? err.message : undefined);
    } finally {
      setSavingEdit(false);
    }
  };

  const removeAttachment = (attachment: AttachmentRow) => {
    showAlert('Remove this?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setData(prev => (prev ?? []).filter(a => a.id !== attachment.id));
          await deleteAttachment(attachment.id).catch(() => {});
        }
      }
    ]);
  };

  const openLink = (attachment: AttachmentRow) => {
    if (attachment.url) Linking.openURL(attachment.url).catch(() => showAlert("Couldn't open that link"));
  };

  const openFile = async (attachment: AttachmentRow) => {
    if (!attachment.file_path) return;
    try {
      const url = await getAttachmentFileUrl(attachment.file_path);
      Linking.openURL(url).catch(() => {});
    } catch (err) {
      showAlert("Couldn't open that", err instanceof Error ? err.message : undefined);
    }
  };

  const photoAttachments = (attachments ?? []).filter(a => a.file_path && IMAGE_PATH_RE.test(a.file_path));
  const otherAttachments = (attachments ?? []).filter(a => !(a.file_path && IMAGE_PATH_RE.test(a.file_path)));

  return (
    <Card>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!loading && (attachments ?? []).length === 0 ? <Text style={styles.meta}>Nothing added yet.</Text> : null}

      {photoAttachments.length > 0 ? (
        <View style={styles.photoGrid}>
          {photoAttachments.map(attachment => (
            <View key={attachment.id} style={styles.photoGridItem}>
              <Pressable onPress={() => openFile(attachment)}>
                <AttachmentThumb storagePath={attachment.file_path!} size={72} />
              </Pressable>
              <Pressable style={styles.photoRemoveBadge} hitSlop={8} onPress={() => removeAttachment(attachment)}>
                <Ionicons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {otherAttachments.map(attachment =>
        editingId === attachment.id ? (
          <View key={attachment.id} style={[styles.linkRow, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
            <TextInput
              value={editLabel}
              onChangeText={setEditLabel}
              placeholder="Name (optional)"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
            {attachment.url ? (
              <TextInput
                value={editUrl}
                onChangeText={setEditUrl}
                placeholder="Link"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="url"
              />
            ) : null}
            <View style={styles.editActions}>
              <Pressable onPress={cancelEdit} hitSlop={10}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => saveEdit(attachment)} disabled={savingEdit} hitSlop={10}>
                <Text style={styles.saveText}>{savingEdit ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View key={attachment.id} style={styles.linkRow}>
            {attachment.file_path ? (
              <Pressable style={styles.linkTapArea} onPress={() => openFile(attachment)}>
                <Ionicons name="document-attach-outline" size={20} color={theme.colors.navy} />
                <Text style={styles.linkText} numberOfLines={1}>{attachment.label || 'File'}</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.linkTapArea} onPress={() => openLink(attachment)}>
                <Ionicons name="link-outline" size={18} color={theme.colors.navy} />
                <Text style={styles.linkText} numberOfLines={1}>{attachment.label || attachment.url}</Text>
              </Pressable>
            )}
            <Pressable hitSlop={10} onPress={() => startEdit(attachment)}>
              <Ionicons name="pencil-outline" size={16} color={theme.colors.muted} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => removeAttachment(attachment)}>
              <Ionicons name="close-circle-outline" size={20} color={theme.colors.muted} />
            </Pressable>
          </View>
        )
      )}
      <View style={styles.addLinkRow}>
        <TextInput
          value={linkDraft}
          onChangeText={setLinkDraft}
          placeholder="Paste a link…"
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, { flex: 1 }]}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Pressable style={styles.smallButton} onPress={submitLink} disabled={addingLink || !linkDraft.trim()}>
          <Text style={styles.smallButtonText}>{addingLink ? '…' : 'Add'}</Text>
        </Pressable>
        <Pressable style={styles.photoButton} onPress={pickPhoto} disabled={addingPhoto}>
          {addingPhoto ? <ActivityIndicator size="small" color={theme.colors.navy} /> : <Ionicons name="image-outline" size={20} color={theme.colors.navy} />}
        </Pressable>
        <Pressable style={styles.photoButton} onPress={pickDocument} disabled={addingDocument}>
          {addingDocument ? (
            <ActivityIndicator size="small" color={theme.colors.navy} />
          ) : (
            <Ionicons name="document-attach-outline" size={20} color={theme.colors.navy} />
          )}
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 6 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  photoGridItem: { position: 'relative' },
  photoRemoveBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center'
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  linkTapArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkText: { color: theme.colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  addLinkRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  input: {
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  smallButton: { backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, paddingHorizontal: 14, paddingVertical: 10 },
  smallButtonText: { color: '#fff', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  photoButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  cancelText: { color: theme.colors.muted, fontWeight: '600' },
  saveText: { color: theme.colors.navy, fontWeight: '600' }
});
