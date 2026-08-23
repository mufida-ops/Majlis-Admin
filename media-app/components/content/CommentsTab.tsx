import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { listComments, postComment } from '@/lib/repositories/comments';
import { listTeam } from '@/lib/repositories/team';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/Avatar';
import { timeAgo } from '@/lib/format';

export function CommentsTab({ contentItemId }: { contentItemId: string }) {
  const { session } = useAuth();
  const { data: comments, reload } = useAsync(() => listComments(contentItemId), [contentItemId]);
  const { data: team } = useAsync(() => listTeam(), []);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.list}>
        {(comments ?? []).length === 0 && <Text style={styles.empty}>No comments yet — discussion for this content stays here, not in chat.</Text>}
        {(comments ?? []).map((c) => (
          <View key={c.id} style={styles.commentRow}>
            <Avatar name={nameOf(c.author_id)} size={30} />
            <View style={{ flex: 1 }}>
              <View style={styles.commentHeader}>
                <Text style={styles.author}>{nameOf(c.author_id)}</Text>
                <Text style={styles.time}>{timeAgo(c.created_at)}</Text>
              </View>
              <Text style={styles.body}>{renderMentions(c.body)}</Text>
            </View>
          </View>
        ))}
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

function renderMentions(body: string) {
  return body; // mentions are stored structurally (mentions table); this just displays the raw text with @Name intact
}

const styles = StyleSheet.create({
  list: { flex: 1, padding: spacing.lg, gap: spacing.md },
  empty: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
  commentRow: { flexDirection: 'row', gap: spacing.sm },
  commentHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  author: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  time: { fontSize: 11, color: colors.textSecondary },
  body: { fontSize: 14, color: colors.textPrimary, marginTop: 2 },
  composer: { flexDirection: 'row', gap: 8, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendButton: { backgroundColor: colors.navy, borderRadius: radii.md, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#FFF', fontWeight: '700', fontSize: 13 }
});
