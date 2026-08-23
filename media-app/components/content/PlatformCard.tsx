import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import { PlatformIcon } from '@/components/PlatformIcon';
import { ApprovalBadge, PublicationBadge } from '@/components/StatusBadge';
import { SaveIndicator } from '@/components/SaveIndicator';
import { MediaThumb } from '@/components/MediaThumb';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { usePlatformPostEditor } from '@/lib/hooks/usePlatformPostEditor';
import { useAsync } from '@/lib/useAsync';
import { listVersionsForContentItem } from '@/lib/repositories/media';
import { getSelectedMedia, setSelectedMedia, reorderCarousel } from '@/lib/repositories/platformPosts';
import { upsertSchedule, publishNow, retryPublish } from '@/lib/repositories/schedules';
import { useAuth } from '@/lib/auth';
import { orgLocalToUtcIso, formatDateTime, ORG_TIMEZONE } from '@/lib/timezone';
import { PLATFORM_LABELS, type ContentItem, type PlatformName, type PostType } from '@/types/db';

const POST_TYPE_OPTIONS: Record<PlatformName, PostType[]> = {
  instagram: ['reel', 'image', 'carousel', 'story'],
  tiktok: ['video'],
  linkedin: ['post', 'image']
};

export function PlatformCard({ contentItem, platform, canEdit, isAdmin, isConnected }: {
  contentItem: ContentItem; platform: PlatformName; canEdit: boolean; isAdmin: boolean; isConnected: boolean;
}) {
  const { session } = useAuth();
  const { post, saveState, conflict, updateField, reload } = usePlatformPostEditor(contentItem.id, platform);
  const { data: allVersions } = useAsync(() => listVersionsForContentItem(contentItem.id), [contentItem.id]);
  const { data: selected, reload: reloadSelected } = useAsync(
    () => (post ? getSelectedMedia(post.id) : Promise.resolve([])),
    [post?.id]
  );

  const [hashtagsText, setHashtagsText] = useState('');
  const [mediaPicker, setMediaPicker] = useState(false);
  const [coverPicker, setCoverPicker] = useState(false);
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');

  useEffect(() => {
    if (post) setHashtagsText((post.hashtags ?? []).join(' '));
  }, [post?.id]);

  useEffect(() => {
    if (post?.scheduled_at) {
      const local = new Intl.DateTimeFormat('en-CA', { timeZone: ORG_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(post.scheduled_at));
      const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: ORG_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(post.scheduled_at));
      setDateText(local);
      setTimeText(localTime);
    }
  }, [post?.scheduled_at]);

  if (!post) return null;

  const selectedIds = (selected ?? []).map((m) => m.media_version_id);
  const selectedVersions = selectedIds.map((id) => allVersions?.find((v) => v.id === id)).filter(Boolean) as NonNullable<typeof allVersions>;
  const coverVersion = allVersions?.find((v) => v.id === post.cover_media_version_id);
  const mediaOptions: PickerOption[] = (allVersions ?? []).map((v) => ({ id: v.id, label: `${v.version_label}`, sub: v.file_name }));

  function toggleMedia(versionId: string) {
    const next = selectedIds.includes(versionId) ? selectedIds.filter((id) => id !== versionId) : [...selectedIds, versionId];
    setSelectedMedia(post!.id, next).then(reloadSelected);
  }

  function moveMedia(index: number, dir: -1 | 1) {
    const arr = [...selectedIds];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    reorderCarousel(post!.id, arr).then(reloadSelected);
  }

  function applySchedule() {
    if (!dateText || !timeText || !session) {
      showAlert('Missing date/time', 'Enter both a date (YYYY-MM-DD) and time (HH:MM) in Asia/Dubai.');
      return;
    }
    const iso = orgLocalToUtcIso(dateText, timeText);
    updateField('scheduled_at', iso, true);
    upsertSchedule({ platformPostId: post!.id, contentItemId: contentItem.id, platform, scheduledAt: iso, createdBy: session.user.id })
      .then(() => updateField('publication_status', isConnected ? 'scheduled' : 'ready_to_post_manually', true));
  }

  async function handlePublishNow() {
    if (!session) return;
    if (!isConnected) {
      updateField('publication_status', 'ready_to_post_manually', true);
      return;
    }
    await publishNow(post!.id, session.user.id);
    showAlert('Queued', `${PLATFORM_LABELS[platform]} publish has been queued — status updates once the publishing job runs.`);
  }

  async function handleRetry() {
    if (!session) return;
    await retryPublish(post!.id, session.user.id);
    showAlert('Retry queued', `A new attempt for ${PLATFORM_LABELS[platform]} has been queued, independent of the other platforms.`);
  }

  const showManualFallback = post.enabled && post.approval_state === 'approved' && !isConnected;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <PlatformIcon platform={platform} size={20} />
          <Text style={styles.platformName}>{PLATFORM_LABELS[platform]}</Text>
          {!isConnected && <Text style={styles.notConnected}>Not Connected</Text>}
        </View>
        <Switch value={post.enabled} disabled={!canEdit} onValueChange={(v) => updateField('enabled', v, true)} />
      </View>

      {post.enabled && (
        <>
          <View style={styles.badgeRow}>
            <ApprovalBadge state={post.approval_state} />
            <PublicationBadge status={post.publication_status} />
            <SaveIndicator state={saveState} />
          </View>

          {conflict && <Text style={styles.conflict}>This platform version was updated by another team member. Pull to refresh before saving again.</Text>}
          {post.approval_state === 'revoked' && (
            <Text style={styles.revokedBanner}>Approval required — this content changed after approval.</Text>
          )}

          <Text style={styles.label}>Caption</Text>
          <TextInput
            style={styles.textArea}
            value={post.caption ?? ''}
            editable={canEdit}
            multiline
            placeholder={`Write the ${PLATFORM_LABELS[platform]} caption…`}
            placeholderTextColor={colors.textSecondary}
            onChangeText={(v) => updateField('caption', v)}
          />

          <Text style={styles.label}>Hashtags</Text>
          <TextInput
            style={styles.input}
            value={hashtagsText}
            editable={canEdit}
            placeholder="#majlis #teachercpd"
            placeholderTextColor={colors.textSecondary}
            onChangeText={setHashtagsText}
            onBlur={() => updateField('hashtags', hashtagsText.split(/\s+/).filter(Boolean), true)}
          />

          <Text style={styles.label}>Post type</Text>
          <View style={styles.chipRow}>
            {POST_TYPE_OPTIONS[platform].map((pt) => (
              <Pressable key={pt} disabled={!canEdit} onPress={() => updateField('post_type', pt, true)} style={[styles.chip, post.post_type === pt && styles.chipActive]}>
                <Text style={[styles.chipText, post.post_type === pt && styles.chipTextActive]}>{pt}</Text>
              </Pressable>
            ))}
          </View>

          {platform === 'tiktok' && (
            <>
              <Text style={styles.label}>Publishing method</Text>
              <View style={styles.chipRow}>
                {(['direct', 'send_to_finish'] as const).map((m) => (
                  <Pressable key={m} disabled={!canEdit} onPress={() => updateField('publishing_method', m, true)} style={[styles.chip, post.publishing_method === m && styles.chipActive]}>
                    <Text style={[styles.chipText, post.publishing_method === m && styles.chipTextActive]}>
                      {m === 'direct' ? 'Publish directly' : 'Send to TikTok to finish'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>Selected media {post.post_type === 'carousel' ? '(drag order with ↑↓)' : ''}</Text>
          <View style={styles.mediaRow}>
            {selectedVersions.map((v, i) => (
              <View key={v.id} style={styles.mediaChip}>
                <MediaThumb storagePath={v.storage_path} kind="image" size={44} radius={8} />
                {post.post_type === 'carousel' && canEdit && (
                  <View style={styles.reorderCol}>
                    <Pressable onPress={() => moveMedia(i, -1)}><Feather name="chevron-up" size={12} color={colors.navy} /></Pressable>
                    <Pressable onPress={() => moveMedia(i, 1)}><Feather name="chevron-down" size={12} color={colors.navy} /></Pressable>
                  </View>
                )}
              </View>
            ))}
            {canEdit && (
              <Pressable style={styles.addMediaButton} onPress={() => setMediaPicker(true)}>
                <Feather name="plus" size={16} color={colors.navy} />
              </Pressable>
            )}
          </View>

          <Text style={styles.label}>Cover</Text>
          <Pressable style={styles.coverButton} disabled={!canEdit} onPress={() => setCoverPicker(true)}>
            {coverVersion ? <MediaThumb storagePath={coverVersion.storage_path} kind="image" size={40} radius={8} /> : <Feather name="image" size={18} color={colors.textSecondary} />}
            <Text style={styles.fieldValue}>{coverVersion ? coverVersion.version_label : 'Choose a cover image'}</Text>
          </Pressable>

          <Text style={styles.label}>Scheduled ({ORG_TIMEZONE})</Text>
          <View style={styles.scheduleRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={dateText} editable={canEdit} onChangeText={setDateText} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />
            <TextInput style={[styles.input, { width: 90 }]} value={timeText} editable={canEdit} onChangeText={setTimeText} placeholder="HH:MM" placeholderTextColor={colors.textSecondary} />
          </View>
          {post.scheduled_at && <Text style={styles.scheduledPreview}>Currently: {formatDateTime(post.scheduled_at)}</Text>}

          {canEdit && post.approval_state === 'approved' && (
            <View style={styles.actionRow}>
              <Pressable style={styles.actionButton} onPress={applySchedule}>
                <Text style={styles.actionButtonText}>Save Schedule</Text>
              </Pressable>
              {(post.publication_status === 'scheduled' || post.publication_status === 'ready_to_post_manually') && (
                <Pressable style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handlePublishNow}>
                  <Text style={styles.actionButtonTextPrimary}>{isConnected ? 'Publish Now' : 'Mark Ready to Post'}</Text>
                </Pressable>
              )}
              {post.publication_status === 'failed' && (
                <Pressable style={[styles.actionButton, styles.actionButtonDanger]} onPress={handleRetry}>
                  <Text style={styles.actionButtonTextPrimary}>Retry</Text>
                </Pressable>
              )}
            </View>
          )}

          {post.publication_status === 'failed' && post.error_message && (
            <Text style={styles.errorText}>{post.error_message}</Text>
          )}
          {post.publication_status === 'published' && post.live_url && (
            <Text style={styles.liveUrl}>Live: {post.live_url}</Text>
          )}

          {showManualFallback && (
            <View style={styles.manualPanel}>
              <Text style={styles.manualTitle}>Ready to Post Manually</Text>
              <Text style={styles.manualBody}>
                {PLATFORM_LABELS[platform]} isn't connected yet — here's everything needed to post this by hand:
              </Text>
              <Text style={styles.manualLine}>Caption: {post.caption || '—'}</Text>
              <Text style={styles.manualLine}>Hashtags: {(post.hashtags ?? []).join(' ') || '—'}</Text>
              <Text style={styles.manualLine}>Posting time: {post.scheduled_at ? formatDateTime(post.scheduled_at) : 'Not scheduled'}</Text>
              <Text style={styles.manualLine}>Media: {selectedVersions.length} file(s) selected above</Text>
            </View>
          )}
        </>
      )}

      <PickerSheet
        visible={mediaPicker} title="Select media" options={mediaOptions} onClose={() => setMediaPicker(false)}
        onSelect={(id) => { if (id) toggleMedia(id); setMediaPicker(false); }}
      />
      <PickerSheet
        visible={coverPicker} title="Choose cover" options={mediaOptions} selectedId={post.cover_media_version_id} allowClear
        onClose={() => setCoverPicker(false)}
        onSelect={(id) => { updateField('cover_media_version_id', id, true); setCoverPicker(false); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  platformName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  notConnected: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, backgroundColor: colors.surfaceMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  conflict: { fontSize: 12, color: colors.warning, fontWeight: '600' },
  revokedBanner: { fontSize: 12, color: colors.danger, fontWeight: '700', backgroundColor: colors.danger + '18', padding: 8, borderRadius: radii.sm },
  label: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginTop: 4 },
  textArea: { backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, padding: spacing.sm, fontSize: 13, color: colors.textPrimary, minHeight: 60, textAlignVertical: 'top' },
  input: { backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, padding: spacing.sm, fontSize: 13, color: colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.navy },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: '#FFF' },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  mediaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reorderCol: { gap: 2 },
  addMediaButton: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  coverButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, padding: spacing.sm },
  fieldValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  scheduleRow: { flexDirection: 'row', gap: 8 },
  scheduledPreview: { fontSize: 11, color: colors.textSecondary },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: spacing.xs, flexWrap: 'wrap' },
  actionButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  actionButtonPrimary: { backgroundColor: colors.navy },
  actionButtonDanger: { backgroundColor: colors.danger },
  actionButtonText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  actionButtonTextPrimary: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  errorText: { fontSize: 12, color: colors.danger },
  liveUrl: { fontSize: 12, color: colors.info },
  manualPanel: { backgroundColor: colors.goldSoft, borderRadius: radii.md, padding: spacing.md, gap: 4, marginTop: spacing.xs },
  manualTitle: { fontSize: 13, fontWeight: '700', color: colors.gold },
  manualBody: { fontSize: 11, color: colors.textPrimary },
  manualLine: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' }
});
