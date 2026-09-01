import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { DocumentThumb } from '@/components/DocumentThumb';
import { theme } from '@/constants/theme';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { formatShortDate } from '@/lib/format';
import {
  listDocuments,
  addDocumentLink,
  addDocumentPhoto,
  addDocumentFile,
  updateDocument,
  deleteDocument,
  getDocumentFileUrl
} from '@/lib/repositories/documents';
import type { DocumentRow } from '@/types/db';

export default function DocumentsScreen() {
  const { session } = useAuth();
  const { workspaceId } = useWorkspace();
  const { data: documents, loading, error, refresh, setData } = useAsync(
    () => (workspaceId ? listDocuments(workspaceId) : Promise.resolve([])),
    [workspaceId]
  );

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const [nameDraft, setNameDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [linkDraft, setLinkDraft] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [addingDocument, setAddingDocument] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const resetAddForm = () => {
    setNameDraft('');
    setNoteDraft('');
    setLinkDraft('');
  };

  const requireName = () => {
    if (nameDraft.trim()) return true;
    showAlert('Give it a name first', 'Add a name so you can find this again later.');
    return false;
  };

  const submitLink = async () => {
    const url = linkDraft.trim();
    if (!url || !requireName() || !workspaceId || !session) return;
    setAddingLink(true);
    try {
      const doc = await addDocumentLink({
        workspace_id: workspaceId,
        name: nameDraft.trim(),
        note: noteDraft.trim() || undefined,
        url,
        created_by: session.user.id
      });
      setData(prev => [doc, ...(prev ?? [])]);
      resetAddForm();
    } catch (err) {
      showAlert('Could not add that link', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setAddingLink(false);
    }
  };

  const pickPhoto = async () => {
    if (!requireName() || !workspaceId || !session) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Photo access needed', 'Allow photo access in your phone settings to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAddingPhoto(true);
    try {
      const doc = await addDocumentPhoto(
        { workspace_id: workspaceId, name: nameDraft.trim(), note: noteDraft.trim() || undefined, created_by: session.user.id },
        { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' }
      );
      setData(prev => [doc, ...(prev ?? [])]);
      resetAddForm();
    } catch (err) {
      showAlert('Could not attach that photo', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setAddingPhoto(false);
    }
  };

  const pickDocument = async () => {
    if (!requireName() || !workspaceId || !session) return;
    const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAddingDocument(true);
    try {
      const doc = await addDocumentFile(
        { workspace_id: workspaceId, name: nameDraft.trim(), note: noteDraft.trim() || undefined, created_by: session.user.id },
        { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' }
      );
      setData(prev => [doc, ...(prev ?? [])]);
      resetAddForm();
    } catch (err) {
      showAlert('Could not attach that file', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setAddingDocument(false);
    }
  };

  const startEdit = (doc: DocumentRow) => {
    setEditingId(doc.id);
    setEditName(doc.name);
    setEditNote(doc.note ?? '');
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await updateDocument(id, { name: editName.trim(), note: editNote.trim() || null });
      setData(prev => (prev ?? []).map(d => (d.id === id ? updated : d)));
      setEditingId(null);
    } catch (err) {
      showAlert("Couldn't save that", err instanceof Error ? err.message : undefined);
    } finally {
      setSavingEdit(false);
    }
  };

  const removeDocument = (doc: DocumentRow) => {
    showAlert('Remove this document?', doc.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setData(prev => (prev ?? []).filter(d => d.id !== doc.id));
          await deleteDocument(doc.id).catch(() => {});
        }
      }
    ]);
  };

  const openLink = (doc: DocumentRow) => {
    if (doc.url) Linking.openURL(doc.url).catch(() => showAlert("Couldn't open that link"));
  };

  const openFile = async (doc: DocumentRow) => {
    if (!doc.file_path) return;
    try {
      const url = await getDocumentFileUrl(doc.file_path);
      Linking.openURL(url).catch(() => {});
    } catch (err) {
      showAlert("Couldn't open that", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <Screen>
      <SectionTitle title="Documents" subtitle="IDs, certificates, contracts — kept safe and easy to find." />

      <Card>
        <Text style={styles.sectionTitle}>Add a document</Text>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Name (e.g. Passport copy)"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder="Note (optional)"
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, styles.noteInput]}
          multiline
        />
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
          <Pressable style={styles.iconButton} onPress={pickPhoto} disabled={addingPhoto}>
            {addingPhoto ? <ActivityIndicator size="small" color={theme.colors.navy} /> : <Ionicons name="image-outline" size={20} color={theme.colors.navy} />}
          </Pressable>
          <Pressable style={styles.iconButton} onPress={pickDocument} disabled={addingDocument}>
            {addingDocument ? (
              <ActivityIndicator size="small" color={theme.colors.navy} />
            ) : (
              <Ionicons name="document-attach-outline" size={20} color={theme.colors.navy} />
            )}
          </Pressable>
        </View>
        <Text style={styles.hint}>Paste a link and tap Add, or use the icons to attach a photo or a file instead.</Text>
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (documents ?? []).length === 0 ? (
        <EmptyState label="Nothing added yet." />
      ) : (
        <View style={{ gap: 10 }}>
          {(documents ?? []).map(doc => (
            <Card key={doc.id}>
              {editingId === doc.id ? (
                <View style={{ gap: 8 }}>
                  <TextInput value={editName} onChangeText={setEditName} style={styles.input} autoFocus />
                  <TextInput
                    value={editNote}
                    onChangeText={setEditNote}
                    placeholder="Note (optional)"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, styles.noteInput]}
                    multiline
                  />
                  <View style={styles.editActions}>
                    <Pressable onPress={cancelEdit} hitSlop={10}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={() => saveEdit(doc.id)} disabled={savingEdit || !editName.trim()} hitSlop={10}>
                      <Text style={styles.saveText}>{savingEdit ? 'Saving…' : 'Save'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.docHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docName}>{doc.name}</Text>
                      {doc.note ? <Text style={styles.docNote}>{doc.note}</Text> : null}
                      <Text style={styles.docMeta}>Added {formatShortDate(doc.created_at)}</Text>
                    </View>
                    <Pressable hitSlop={10} onPress={() => startEdit(doc)}>
                      <Ionicons name="pencil-outline" size={16} color={theme.colors.muted} />
                    </Pressable>
                    <Pressable hitSlop={10} onPress={() => removeDocument(doc)}>
                      <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
                    </Pressable>
                  </View>
                  {doc.file_path && doc.file_path.match(/\.(jpe?g|png|gif|webp|heic)$/i) ? (
                    <Pressable style={styles.linkRow} onPress={() => openFile(doc)}>
                      <DocumentThumb storagePath={doc.file_path} />
                      <Text style={styles.linkText}>Open photo</Text>
                    </Pressable>
                  ) : doc.file_path ? (
                    <Pressable style={styles.linkRow} onPress={() => openFile(doc)}>
                      <Ionicons name="document-attach-outline" size={20} color={theme.colors.navy} />
                      <Text style={styles.linkText}>Open file</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.linkRow} onPress={() => openLink(doc)}>
                      <Ionicons name="link-outline" size={18} color={theme.colors.navy} />
                      <Text style={styles.linkText} numberOfLines={1}>{doc.url}</Text>
                    </Pressable>
                  )}
                </>
              )}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    marginTop: 10
  },
  noteInput: { minHeight: 60, textAlignVertical: 'top' },
  addLinkRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  smallButton: { backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, paddingHorizontal: 14, paddingVertical: 10 },
  smallButtonText: { color: '#fff', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  hint: { color: theme.colors.muted, fontSize: 12, marginTop: 10, lineHeight: 17 },
  docHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  docName: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  docNote: { color: theme.colors.text, fontSize: 14, marginTop: 4, lineHeight: 19 },
  docMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 6 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  linkText: { color: theme.colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 4 },
  cancelText: { color: theme.colors.muted, fontWeight: '600' },
  saveText: { color: theme.colors.navy, fontWeight: '600' }
});
