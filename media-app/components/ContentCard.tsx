import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, radii, shadow, spacing } from '@/constants/theme';
import { Avatar } from './Avatar';
import { MediaThumb } from './MediaThumb';
import { StageBadge, PriorityBadge, ApprovalBadge } from './StatusBadge';
import { PlatformRow } from './PlatformIcon';
import { formatDateOnly, todayInOrgTz } from '@/lib/timezone';
import type { ContentItemSummary } from '@/lib/repositories/contentItems';
import type { PlatformName } from '@/types/db';

export function ContentCard({
  item, thumb, showStage = true, onLongPress
}: {
  item: ContentItemSummary;
  thumb?: { storagePath: string; kind: 'video' | 'image' | 'pdf' | 'other' } | null;
  showStage?: boolean;
  onLongPress?: () => void;
}) {
  const platforms = (item.platform_posts ?? []).filter((p) => p.enabled).map((p) => p.platform as PlatformName);
  const isOverdue = !!item.due_date && item.due_date < todayInOrgTz() && item.stage !== 'published';

  return (
    <Pressable
      onPress={() => router.push(`/content/${item.id}`)}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, shadow.card, pressed && { opacity: 0.85 }]}
    >
      <View>
        <MediaThumb storagePath={thumb?.storagePath ?? null} kind={thumb?.kind} />
        {item.content_type?.icon && (
          <View style={styles.formatBadge}>
            <Feather name={item.content_type.icon as any} size={11} color="#FFF" />
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Avatar name={item.owner?.full_name} size={20} />
          <Text style={styles.metaText} numberOfLines={1}>{item.owner?.full_name ?? 'Unassigned'}</Text>
          {item.due_date && (
            <Text style={[styles.metaText, isOverdue && styles.overdue]}>
              {isOverdue ? 'Overdue · ' : ''}{formatDateOnly(item.due_date)}
            </Text>
          )}
        </View>
        <View style={styles.badgeRow}>
          {item.content_type?.label && (
            <View style={styles.formatPill}>
              {item.content_type.icon && <Feather name={item.content_type.icon as any} size={10} color={colors.navySoft} />}
              <Text style={styles.formatPillText} numberOfLines={1}>{item.content_type.label}</Text>
            </View>
          )}
          {showStage && <StageBadge stage={item.stage} />}
          <PriorityBadge priority={item.priority} />
          <ApprovalBadge state={item.approval_state} />
        </View>
        <View style={styles.footerRow}>
          <PlatformRow platforms={platforms} />
          {item.campaign?.name && (
            <Text style={styles.campaign} numberOfLines={1}>{item.campaign.name}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface,
    borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border
  },
  body: { flex: 1, gap: 6, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  overdue: { color: colors.danger, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  formatBadge: {
    position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.navySoft, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.surface
  },
  formatPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3
  },
  formatPillText: { fontSize: 11, fontWeight: '700', color: colors.navySoft },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  campaign: { fontSize: 11, color: colors.gold, fontWeight: '700', flexShrink: 1, textAlign: 'right' }
});
