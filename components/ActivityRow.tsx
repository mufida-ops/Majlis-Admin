import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MessageImage } from '@/components/MessageImage';
import { theme } from '@/constants/theme';
import { formatRelative } from '@/lib/format';
import type { ActivityEventRow } from '@/types/db';
import type { ActivityHref } from '@/lib/catchUp';

export function ActivityRow({ event, href }: { event: ActivityEventRow; href?: ActivityHref }) {
  const imagePath = event.entity_type === 'message' ? (event.metadata?.image_path as string | undefined) : undefined;
  const content = (
    <View style={[styles.itemRow, imagePath && styles.itemRowWithImage]}>
      {imagePath ? <MessageImage storagePath={imagePath} size={44} /> : null}
      <View style={styles.itemText}>
        <Text style={styles.item}>{event.summary}</Text>
        <Text style={styles.itemMeta}>{formatRelative(event.created_at)}</Text>
      </View>
    </View>
  );
  if (!href) return content;
  return <Pressable onPress={() => router.push(href as never)}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  itemRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  itemRowWithImage: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  itemText: { flex: 1 },
  item: { color: theme.colors.text, lineHeight: 21 },
  itemMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 4 }
});
