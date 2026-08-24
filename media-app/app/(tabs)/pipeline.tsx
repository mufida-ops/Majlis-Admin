import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { showAlert } from '@/lib/alert';
import { listContentItemSummaries, moveStage, ConflictError, type ContentItemSummary } from '@/lib/repositories/contentItems';
import { latestMediaThumbnails } from '@/lib/repositories/media';
import { useAsync } from '@/lib/useAsync';
import { colors, radii, spacing } from '@/constants/theme';
import { ContentCard } from '@/components/ContentCard';
import { StageMoveSheet } from '@/components/StageMoveSheet';
import { PIPELINE_STAGES, STAGE_LABELS, type ContentStage } from '@/types/db';
import { canEditContent } from '@/lib/permissions';

const ACTIVE_STAGES = PIPELINE_STAGES.filter((s) => s !== 'published');

/** Chronological by day-of-month (1 → 30), not by when the card was last touched. Undated items sort last. */
function byDueDateAsc(a: ContentItemSummary, b: ContentItemSummary): number {
  if (!a.due_date && !b.due_date) return a.title.localeCompare(b.title);
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
}

export default function Pipeline() {
  const { session, roles } = useAuth();
  const { data: items, loading, reload } = useAsync(() => listContentItemSummaries(), []);
  const { data: thumbnails } = useAsync(
    () => latestMediaThumbnails((items ?? []).map((i) => i.id)),
    [items?.map((i) => i.id).join(',')]
  );
  const [moveTarget, setMoveTarget] = useState<ContentItemSummary | null>(null);

  const columns = useMemo(() => {
    const map = new Map<ContentStage, ContentItemSummary[]>(PIPELINE_STAGES.map((s) => [s, []]));
    for (const item of items ?? []) map.get(item.stage)?.push(item);
    for (const list of map.values()) list.sort(byDueDateAsc);
    return map;
  }, [items]);

  const published = columns.get('published') ?? [];

  async function handlePick(stage: ContentStage) {
    if (!moveTarget) return;
    const ctx = { userId: session?.user.id ?? null, roles };
    if (!canEditContent(ctx, moveTarget)) {
      showAlert("Can't move this", "You don't have permission to move this item.");
      return;
    }
    try {
      await moveStage(moveTarget.id, moveTarget.version, stage);
      setMoveTarget(null);
      reload();
    } catch (err) {
      showAlert('Could not move', err instanceof ConflictError ? err.message : String(err));
    }
  }

  return (
    <View style={styles.screen}>
      {loading && !items ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
            {ACTIVE_STAGES.map((stage) => (
              <View key={stage} style={styles.column}>
                <View style={styles.columnHeader}>
                  <Text style={styles.columnTitle}>{STAGE_LABELS[stage]}</Text>
                  <Text style={styles.columnCount}>{columns.get(stage)?.length ?? 0}</Text>
                </View>
                <View style={{ gap: spacing.sm, paddingBottom: spacing.xl }}>
                  {(columns.get(stage) ?? []).map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      thumb={thumbnails?.get(item.id)}
                      showStage={false}
                      onLongPress={() => setMoveTarget(item)}
                    />
                  ))}
                  {(columns.get(stage) ?? []).length === 0 && <Text style={styles.emptyColumn}>Nothing here</Text>}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.archiveSection}>
            <View style={styles.archiveHeader}>
              <View style={styles.archiveDot} />
              <Text style={styles.archiveTitle}>Published</Text>
              <Text style={styles.archiveCount}>{published.length}</Text>
            </View>
            {published.length === 0 ? (
              <Text style={styles.emptyColumn}>Nothing published yet.</Text>
            ) : (
              <View style={styles.archiveGrid}>
                {published.map((item) => (
                  <View key={item.id} style={styles.archiveCard}>
                    <ContentCard item={item} thumb={thumbnails?.get(item.id)} showStage={false} />
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <StageMoveSheet
        visible={!!moveTarget}
        current={moveTarget?.stage ?? 'idea'}
        title={moveTarget?.title ?? ''}
        onClose={() => setMoveTarget(null)}
        onPick={handlePick}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  board: { padding: spacing.lg, gap: spacing.md },
  column: { width: 280 },
  columnHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceMuted, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 8, marginBottom: spacing.sm
  },
  columnTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.4 },
  columnCount: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  emptyColumn: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', paddingVertical: spacing.sm },
  archiveSection: {
    marginTop: spacing.lg, marginHorizontal: spacing.lg, backgroundColor: colors.success + '14',
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.success + '3D', padding: spacing.lg, gap: spacing.md
  },
  archiveHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  archiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  archiveTitle: { fontSize: 14, fontWeight: '700', color: colors.success, flex: 1 },
  archiveCount: { fontSize: 13, fontWeight: '700', color: colors.success },
  archiveGrid: { gap: spacing.sm },
  archiveCard: { opacity: 0.92 }
});
