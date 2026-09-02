import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { formatShortDate } from '@/lib/format';
import { listDocuments, createDocument, updateDocument, deleteDocument } from '@/lib/repositories/documents';
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
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const addDocument = async () => {
    const name = nameDraft.trim();
    if (!name || !workspaceId || !session) return;
    setAdding(true);
    try {
      const doc = await createDocument({ workspace_id: workspaceId, name, note: noteDraft.trim() || undefined, created_by: session.user.id });
      setData(prev => [doc, ...(prev ?? [])]);
      setNameDraft('');
      setNoteDraft('');
    } catch (err) {
      showAlert('Could not add that', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setAdding(false);
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
    showAlert('Remove this document?', `${doc.name} — this also removes everything attached to it.`, [
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

  return (
    <Screen>
      <SectionTitle title="Documents" subtitle="IDs, certificates, contracts — each can hold as many links, photos, or files as you need." />

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
        <Pressable style={styles.primary} onPress={addDocument} disabled={adding || !nameDraft.trim()}>
          <Text style={styles.primaryText}>{adding ? 'Adding…' : 'Add document'}</Text>
        </Pressable>
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (documents ?? []).length === 0 ? (
        <EmptyState label="Nothing added yet." />
      ) : (
        <View style={{ gap: 16 }}>
          {(documents ?? []).map(doc => (
            <View key={doc.id} style={{ gap: 10 }}>
              <Card>
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
                )}
              </Card>
              {workspaceId && session ? (
                <AttachmentsSection
                  workspaceId={workspaceId}
                  createdBy={session.user.id}
                  scope={{ document_id: doc.id }}
                  title="Links & files"
                />
              ) : null}
            </View>
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
  primary: { backgroundColor: theme.colors.navy, padding: 14, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontWeight: '600' },
  docHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  docName: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  docNote: { color: theme.colors.text, fontSize: 14, marginTop: 4, lineHeight: 19 },
  docMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 6 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 4 },
  cancelText: { color: theme.colors.muted, fontWeight: '600' },
  saveText: { color: theme.colors.navy, fontWeight: '600' }
});
