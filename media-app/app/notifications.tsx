import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { listNotifications, markAllRead, markRead, groupNotifications } from '@/lib/repositories/notifications';
import { timeAgo } from '@/lib/format';
import type { AppNotification, NotificationType } from '@/types/db';

const ICON: Record<NotificationType, keyof typeof Feather.glyphMap> = {
  assigned: 'user-plus', mentioned: 'at-sign', approval_requested: 'check-circle', changes_requested: 'edit-3',
  approved: 'thumbs-up', deadline_approaching: 'clock', overdue: 'alert-triangle', publish_failed: 'x-circle',
  publish_succeeded: 'send', comment_reply: 'message-circle'
};

export default function Notifications() {
  const { session } = useAuth();
  const { data: items, loading, reload } = useAsync(() => (session ? listNotifications(session.user.id) : Promise.resolve([])), [session?.user.id]);
  const groups = groupNotifications(items ?? []);

  async function open(n: AppNotification) {
    if (!n.read_at) await markRead(n.id);
    if (n.content_item_id) router.push(`/content/${n.content_item_id}`);
    reload();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={async () => { if (session) { await markAllRead(session.user.id); reload(); } }}>
        <Text style={styles.markAll}>Mark all as read</Text>
      </Pressable>

      {loading && !items && <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />}
      {!loading && groups.length === 0 && <Text style={styles.empty}>Nothing yet — you'll see assignments, mentions, approvals and deadlines here.</Text>}

      {groups.map(({ key, items: group }) => {
        const n = group[0];
        return (
          <Pressable key={key} style={[styles.row, !n.read_at && styles.rowUnread]} onPress={() => open(n)}>
            <View style={styles.iconWrap}><Feather name={ICON[n.type]} size={16} color={colors.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{n.title}{group.length > 1 ? ` (+${group.length - 1} more)` : ''}</Text>
              {n.body && <Text style={styles.body} numberOfLines={2}>{n.body}</Text>}
              <Text style={styles.time}>{timeAgo(n.created_at)}</Text>
            </View>
            {!n.read_at && <View style={styles.unreadDot} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
  markAll: { fontSize: 12, fontWeight: '700', color: colors.info, textAlign: 'right', marginBottom: spacing.sm },
  empty: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  rowUnread: { backgroundColor: colors.goldSoft + '55' },
  iconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  time: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 6 }
});
