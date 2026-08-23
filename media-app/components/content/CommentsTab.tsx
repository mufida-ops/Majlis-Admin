import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { listComments, postComment, updateComment, deleteComment } from '@/lib/repositories/comments';
import { listTeam } from '@/lib/repositories/team';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/Avatar';
import { timeAgo } from '@/lib/format';
import type { Comment } from '@/types/db';

export function CommentsTab({ contentItemId }: { contentItemId: string }) {
  const { session, isAdmin } = useAuth();
  const { data: comments, reload } = useAsync(() => listComments(contentItemId), [contentItemId]);
  const { data: team } = useAsync(() => listTeam(), []);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const nameOf = (id: string) => (team ?? []).find((p) => p.id === id)?.full_name ?? 'Someone';

  async function send() {
    if (!body.trim() || !session || !team) return;
    setSending(true);
    try {
      await postComment({ contentItemId, authorId: session.user.id, body: body.trim(), team });
      setBody('');
      reload();
    } finally {
      setSending(false);
    }
  }

  function startEdit(c: Comment) {
    setEditingId(c.id);
    setEditBody(c.body);
  }

  async function saveEdit() {
    if (!editingId || !editBody.trim()) return;
    await updateComment(editingId, editBody.trim());
    setEditingId(null);
    reload();
  }

  function confirmDelete(c: Comment) {
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteComment(c.id).then(reload) }
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.list}>
        {(comments ?? []).length === 0 && <Text style={styles.empty}>No comments yet — discussion for this content stays here, not in chat.</Text>}
        {(comments ?? []).map((c) => {
          const canManage = c.author_id === session?.user.id || isAdmin;
          const isEditing = editingId === c.id;
          return (
            <View key={c.id} style={styles.commentRow}>
              <Avatar name={nameOf(c.author_id)} size={30} />
              <View style={{ flex: 1 }}>
                <View style={styles.commentHeader}>
                  <Text style={styles.author}>{nameOf(c.author_id)}</Text>
                  <Text style={styles.time}>{timeAgo(c.created_at)}{c.updated_at !== c.created_at ? ' · edited' : ''}</Text>
                  {canManage && !isEditing && (
                    <View style={styles.commentActions}>
                      <Pressable onPress={() => startEdit(c)} hitSlop={8}><Feather name="edit-2" size={13} color={colors.textSecondary} /></Pressable>
                      <Pressable onPress={() => confirmDelete(c)} hitSlop={8}><Feather name="trash-2" size={13} color={colors.danger} /></Pressable>
                    </View>
                  )}
                </View>
                {isEditing ? (
                  <View style={styles.editRow}>
                    <TextInput style={styles.editInput} value={editBody} onChangeText={setEditBody} multiline autoFocus />
                    <View style={styles.editButtons}>
                      <Pressable onPress={() => setEditingId(null)}><Text style={styles.editCancel}>Cancel</Text></Pressable>
                      <Pressable onPress={saveEdit}><Text style={styles.editSave}>Save</Text></Pressable>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.body}>{c.body}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="Comment, or @mention a teammate…"
          placeholderTextColor={colors.textSecondary}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={send} disabled={sending || !body.trim()}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, padding: spacing.lg, gap: spacing.md },
  empty: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
  commentRow: { flexDirection: 'row', gap: spacing.sm },
  commentHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  author: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  time: { fontSize: 11, color: colors.textSecondary, flex: 1 },
  commentActions: { flexDirection: 'row', gap: 12 },
  body: { fontSize: 14, color: colors.textPrimary, marginTop: 2 },
  editRow: { gap: 6, marginTop: 2 },
  editInput: { backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, padding: spacing.sm, fontSize: 14, minHeight: 50, textAlignVertical: 'top' },
  editButtons: { flexDirection: 'row', gap: 16, justifyContent: 'flex-end' },
  editCancel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  editSave: { fontSize: 12, color: colors.navy, fontWeight: '700' },
  composer: { flexDirection: 'row', gap: 8, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendButton: { backgroundColor: colors.navy, borderRadius: radii.md, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#FFF', fontWeight: '700', fontSize: 13 }
});
