import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useContentEditor } from '@/lib/hooks/useContentEditor';
import { colors, radii, spacing } from '@/constants/theme';
import { StageBadge } from '@/components/StatusBadge';
import { SaveIndicator } from '@/components/SaveIndicator';
import { canEditContent, canDeleteContent } from '@/lib/permissions';
import { softDeleteContentItem, ConflictError } from '@/lib/repositories/contentItems';
import { OverviewTab } from '@/components/content/OverviewTab';
import { MediaTab } from '@/components/content/MediaTab';
import { PlatformsTab } from '@/components/content/PlatformsTab';
import { CommentsTab } from '@/components/content/CommentsTab';
import { ActivityTab } from '@/components/content/ActivityTab';
import { ApprovalBar } from '@/components/content/ApprovalBar';

const TABS = ['Overview', 'Media', 'Platforms', 'Comments', 'Activity'] as const;
type Tab = (typeof TABS)[number];

export default function ContentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, roles } = useAuth();
  const { item, loading, saveState, conflict, updateField, reload } = useContentEditor(id);
  const [tab, setTab] = useState<Tab>('Overview');

  if (loading || !item) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  const ctx = { userId: session?.user.id ?? null, roles };
  const canEdit = canEditContent(ctx, item);
  const canDelete = canDeleteContent(ctx);

  function confirmDelete() {
    showAlert('Delete this content?', `"${item!.title}" will be removed from the pipeline. This can't be undone from the app.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await softDeleteContentItem(item!.id, item!.version);
            router.back();
          } catch (err) {
            showAlert('Could not delete', err instanceof ConflictError ? err.message : String(err));
          }
        }
      }
    ]);
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{
        title: '',
        headerRight: canDelete ? () => (
          <Pressable onPress={confirmDelete} hitSlop={10}>
            <Feather name="trash-2" size={19} color={colors.danger} />
          </Pressable>
        ) : undefined
      }} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <StageBadge stage={item.stage} />
          <SaveIndicator state={saveState} />
        </View>
        {item.needs_reapproval && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>Approval required — this content changed after approval.</Text>
          </View>
        )}
        {conflict && (
          <View style={styles.conflictBanner}>
            <Text style={styles.conflictText}>This item was updated by another team member. Review the latest version before saving.</Text>
            <Pressable onPress={reload}><Text style={styles.conflictAction}>Reload latest</Text></Pressable>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabPill, tab === t && styles.tabPillActive]}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>
        {tab === 'Overview' && <OverviewTab item={item} updateField={updateField} canEdit={canEdit} />}
        {tab === 'Media' && <MediaTab contentItemId={item.id} canEdit={canEdit} />}
        {tab === 'Platforms' && <PlatformsTab item={item} canEdit={canEdit} isAdmin={roles.includes('admin')} />}
        {tab === 'Comments' && <CommentsTab contentItemId={item.id} />}
        {tab === 'Activity' && <ActivityTab contentItemId={item.id} />}
      </View>

      <ApprovalBar item={item} canEdit={canEdit} onChanged={reload} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  warningBanner: { backgroundColor: colors.danger + '18', borderRadius: radii.sm, padding: spacing.sm },
  warningText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  conflictBanner: { backgroundColor: colors.warning + '18', borderRadius: radii.sm, padding: spacing.sm, gap: 4 },
  conflictText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
  conflictAction: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  tabBar: { marginTop: spacing.sm, flexGrow: 0 },
  tabPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  tabPillActive: { backgroundColor: colors.navy },
  tabLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabLabelActive: { color: '#FFF' }
});
