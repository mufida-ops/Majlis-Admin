import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@/lib/alert';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { BookCoverLarge } from '@/components/BookCoverLarge';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listBooks, createBook, updateBook, deleteBook } from '@/lib/repositories/books';

export default function Fs2ListScreen() {
  const { session } = useAuth();
  const { workspaceId } = useWorkspace();
  const { data: books, loading, error, refresh, setData } = useAsync(
    () => (workspaceId ? listBooks(workspaceId) : Promise.resolve([])),
    [workspaceId]
  );

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const create = async () => {
    if (!title.trim() || !workspaceId || !session) return;
    setCreating(true);
    try {
      await createBook({ workspace_id: workspaceId, title: title.trim(), created_by: session.user.id });
      setTitle('');
      refresh();
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await updateBook(id, { title: editTitle.trim() });
      setData(prev => (prev ?? []).map(b => (b.id === id ? { ...b, ...updated } : b)));
      setEditingId(null);
      setEditTitle('');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = (id: string, bookTitle: string) => {
    showAlert(`Delete "${bookTitle}"?`, "This removes it and everything in it. This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBook(id);
          setData(prev => (prev ?? []).filter(b => b.id !== id));
        }
      }
    ]);
  };

  return (
    <Screen>
      <SectionTitle title="FS2" subtitle="Completed books — the Canva links and files each one needs, all in one place." />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !books || books.length === 0 ? (
        <EmptyState label="No books yet. Add the first one below." />
      ) : (
        books.map(book => {
          const isEditing = editingId === book.id;
          return (
            <Pressable key={book.id} onPress={() => !isEditing && router.push(`/(tabs)/fs2/${book.id}`)}>
              <Card style={{ gap: 10 }}>
                <BookCoverLarge storagePath={book.cover_image_path} />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    {isEditing ? (
                      <TextInput value={editTitle} onChangeText={setEditTitle} style={styles.editInput} autoFocus />
                    ) : (
                      <Text style={styles.title}>{book.title}</Text>
                    )}
                  </View>
                  {isEditing ? (
                    <View style={styles.iconRow}>
                      <Pressable hitSlop={10} onPress={() => saveEdit(book.id)} disabled={savingEdit}>
                        <Text style={styles.saveText}>{savingEdit ? '…' : 'Save'}</Text>
                      </Pressable>
                      <Pressable hitSlop={10} onPress={cancelEdit} disabled={savingEdit}>
                        <Ionicons name="close-outline" size={20} color={theme.colors.muted} />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.iconRow}>
                      <Pressable hitSlop={10} onPress={() => startEdit(book.id, book.title)}>
                        <Ionicons name="pencil-outline" size={18} color={theme.colors.muted} />
                      </Pressable>
                      <Pressable hitSlop={10} onPress={() => confirmDelete(book.id, book.title)}>
                        <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
                      </Pressable>
                    </View>
                  )}
                </View>
              </Card>
            </Pressable>
          );
        })
      )}

      <Card>
        <Text style={styles.label}>Add a book</Text>
        <View style={styles.addRow}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Book title"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable style={styles.addButton} onPress={create} disabled={creating || !title.trim()}>
            <Text style={styles.addButtonText}>{creating ? '…' : 'Add'}</Text>
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  editInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: 8,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    fontSize: 14,
    fontWeight: '600'
  },
  saveText: { color: theme.colors.navy, fontWeight: '600', fontSize: 13 },
  iconRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  addButton: { backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, paddingHorizontal: 18, paddingVertical: 12 },
  addButtonText: { color: '#fff', fontWeight: '600' }
});
