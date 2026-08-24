import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { ContentCard } from './ContentCard';
import type { ContentItemSummary } from '@/lib/repositories/contentItems';

/** Caller is expected to only render this for a non-empty `items` — Home filters
 * out any section with nothing in it rather than showing an empty state here. */
export function CardRow({
  title, items, thumbnails, accent
}: {
  title: string;
  items: ContentItemSummary[];
  thumbnails: Map<string, { storagePath: string; kind: 'video' | 'image' | 'pdf' | 'other' }>;
  accent?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        {accent && <View style={[styles.dot, { backgroundColor: accent }]} />}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>{items.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {items.map((item) => (
          <View key={item.id} style={styles.cardWrap}>
            <ContentCard item={item} thumb={thumbnails.get(item.id)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  count: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  scrollContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  cardWrap: { width: 260 }
});
