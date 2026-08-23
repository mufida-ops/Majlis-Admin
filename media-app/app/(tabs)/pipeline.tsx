import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { listContentItemSummaries, moveStage, ConflictError, type ContentItemSummary } from '@/lib/repositories/contentItems';
import { latestMediaThumbnails } from '@/lib/repositories/media';
import { useAsync } from '@/lib/useAsync';
import { colors, radii, spacing } from '@/constants/theme';
import { ContentCard } from '@/components/ContentCard';
import { StageMoveSheet } from '@/components/StageMoveSheet';
import { PIPELINE_STAGES, STAGE_LABELS, type ContentStage } from '@/types/db';
import { canEditContent } from '@/lib/permissions';

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
    return map;
  }, [items]);

  async function handlePick(stage: ContentStage) {
    if (!moveTarget) return;
    const ctx = { userId: session?.user.id ?? null, roles };
    if (!canEditContent(ctx, moveTarget)) {
      Alert.alert("Can't move this", "You don't have permission to move this item.");
      return;
    }
    try {
      await moveStage(moveTarget.id, moveTarget.version, stage);
      setMoveTarget(null);
      reload();
    } catch (err) {
      Alert.alert('Could not move', err instanceof ConflictError ? err.message : String(err));
    }
  }

  return (
    <View style={styles.screen}>
      {loading && !items ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
          {PIPELINE_STAGES.map((stage) => (
            <View key={stage} style={styles.column}>
              <View style={styles.columnHeader}>
                <Text style={styles.columnTitle}>{STAGE_LABELS[stage]}</Text>
                <Text style={styles.columnCount}>{columns.get(stage)?.length ?? 0}</Text>
              </View>
              <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}>
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
              </ScrollView>
            </View>
          ))}
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
  emptyColumn: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', paddingVertical: spacing.sm }
});
