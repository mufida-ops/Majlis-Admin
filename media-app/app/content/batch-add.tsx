import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { parseContentBatch, type ProposedContentItem } from '@/lib/repositories/contentBatch';
import { createContentItem } from '@/lib/repositories/contentItems';
import { findOrCreateCampaign, findOrCreateTag, tagContentItem, listContentTypes } from '@/lib/repositories/campaigns';
import { useAsync } from '@/lib/useAsync';
import { todayInOrgTz } from '@/lib/timezone';
import { colors, radii, spacing } from '@/constants/theme';
import type { ContentPriority } from '@/types/db';

type ReviewItem = ProposedContentItem & { include: boolean; expanded: boolean; tagsText: string };

const PRIORITIES: ContentPriority[] = ['low', 'normal', 'high', 'urgent'];

export default function BatchAddContent() {
  const { session } = useAuth();
  const { data: contentTypes } = useAsync(() => listContentTypes(), []);
  const [text, setText] = useState('');
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function organize() {
    if (!text.trim()) return;
    setParsing(true);
    setError(null);
    try {
      const proposed = await parseContentBatch(text.trim(), todayInOrgTz());
      if (proposed.length === 0) {
        setError("Couldn't find any separate pieces of content in that — try describing each one a bit more.");
        return;
      }
      setItems(proposed.map(p => ({ ...p, include: true, expanded: false, tagsText: p.tags.join(', ') })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
    }
  }

  function updateItem(index: number, patch: Partial<ReviewItem>) {
    setItems(prev => (prev ? prev.map((it, i) => (i === index ? { ...it, ...patch } : it)) : prev));
  }

  function removeItem(index: number) {
    setItems(prev => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  async function createAll() {
    if (!items || !session) return;
    const toCreate = items.filter(it => it.include && it.title.trim());
    if (toCreate.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const campaignCache = new Map<string, string>();
      for (const item of toCreate) {
        let campaignId: string | null = null;
        const campaignName = item.campaign?.trim();
        if (campaignName) {
          const cached = campaignCache.get(campaignName.toLowerCase());
          if (cached) {
            campaignId = cached;
          } else {
            const campaign = await findOrCreateCampaign(campaignName, session.user.id);
            campaignCache.set(campaignName.toLowerCase(), campaign.id);
            campaignId = campaign.id;
          }
        }

        const contentTypeId = contentTypes?.find(t => t.key === item.content_type)?.id ?? null;

        const created = await createContentItem({
          title: item.title.trim(),
          description: item.description?.trim() || null,
          script: item.script?.trim() || null,
          internal_notes: item.notes?.trim() || null,
          content_type_id: contentTypeId,
          campaign_id: campaignId,
          owner_id: session.user.id,
          due_date: item.due_date || null,
          priority: item.priority,
          created_by: session.user.id
        });

        const tagNames = item.tagsText.split(',').map(t => t.trim()).filter(Boolean);
        for (const tagName of tagNames) {
          const tag = await findOrCreateTag(tagName, session.user.id);
          await tagContentItem(created.id, tag.id);
        }
      }
      router.replace('/(tabs)/pipeline');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  const includedCount = items?.filter(it => it.include).length ?? 0;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Batch add', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        {!items ? (
          <>
            <Text style={styles.label}>What's happening this month?</Text>
            <Text style={styles.hint}>
              Write it however you'd normally think about it — a rough list, or a fully written brief with scripts
              and captions already in it. We'll split it into separate content items, keeping the detail you wrote,
              for you to check over before anything is created.
            </Text>
            <TextInput
              style={styles.textArea}
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={8}
              placeholder={'e.g. A reel showing behind the scenes of the summer camp, due the 5th. Three Instagram posts about the new book launch, one a week starting the 10th. A TikTok about...'}
              placeholderTextColor={colors.textSecondary}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={[styles.primary, !text.trim() && styles.primaryDisabled]} onPress={organize} disabled={parsing || !text.trim()}>
              {parsing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Organize it</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Here's what we found — check it over</Text>
            <Text style={styles.hint}>Edit anything that's off, untick anything you don't want, or remove it entirely. Tap a card to see and edit the full detail.</Text>

            <Pressable style={styles.originalToggle} onPress={() => setShowOriginal(v => !v)}>
              <Feather name={showOriginal ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
              <Text style={styles.originalToggleText}>{showOriginal ? 'Hide' : 'Show'} what you originally wrote</Text>
            </Pressable>
            {showOriginal && (
              <View style={styles.originalBox}>
                <Text style={styles.originalText}>{text}</Text>
              </View>
            )}

            {items.map((item, index) => (
              <View key={index} style={[styles.card, !item.include && styles.cardExcluded]}>
                <View style={styles.cardHeader}>
                  <Pressable onPress={() => updateItem(index, { include: !item.include })} hitSlop={8}>
                    <Feather name={item.include ? 'check-square' : 'square'} size={20} color={item.include ? colors.navy : colors.textSecondary} />
                  </Pressable>
                  <TextInput
                    style={styles.cardTitleInput}
                    value={item.title}
                    onChangeText={v => updateItem(index, { title: v })}
                  />
                  <Pressable onPress={() => removeItem(index)} hitSlop={8}>
                    <Feather name="x" size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>

                {item.description ? <Text style={styles.preview} numberOfLines={item.expanded ? undefined : 2}>{item.description}</Text> : null}

                <View style={styles.metaRow}>
                  <TextInput
                    style={styles.dueDateInput}
                    value={item.due_date ?? ''}
                    onChangeText={v => updateItem(index, { due_date: v || null })}
                    placeholder="Due date, e.g. 2026-09-05"
                    placeholderTextColor={colors.textSecondary}
                  />
                  {item.campaign ? <Text style={styles.campaignChip}>{item.campaign}</Text> : null}
                </View>

                <Pressable style={styles.expandToggle} onPress={() => updateItem(index, { expanded: !item.expanded })}>
                  <Feather name={item.expanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.info} />
                  <Text style={styles.expandToggleText}>{item.expanded ? 'Hide details' : 'Show / edit full details'}</Text>
                </Pressable>

                {item.expanded && (
                  <View style={styles.detailsBlock}>
                    <FieldLabel text="Content type" />
                    <View style={styles.priorityRow}>
                      {(contentTypes ?? []).map(t => (
                        <Pressable key={t.id} onPress={() => updateItem(index, { content_type: t.key })} style={[styles.priorityChip, item.content_type === t.key && styles.priorityChipActive]}>
                          {t.icon && <Feather name={t.icon as any} size={11} color={item.content_type === t.key ? '#FFF' : colors.textSecondary} />}
                          <Text style={[styles.priorityChipText, item.content_type === t.key && styles.priorityChipTextActive]}>{t.label}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <FieldLabel text="Priority" />
                    <View style={styles.priorityRow}>
                      {PRIORITIES.map(p => (
                        <Pressable key={p} onPress={() => updateItem(index, { priority: p })} style={[styles.priorityChip, item.priority === p && styles.priorityChipActive]}>
                          <Text style={[styles.priorityChipText, item.priority === p && styles.priorityChipTextActive]}>{p[0].toUpperCase() + p.slice(1)}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <FieldLabel text="Campaign" />
                    <TextInput
                      style={styles.fieldInput}
                      value={item.campaign ?? ''}
                      onChangeText={v => updateItem(index, { campaign: v || null })}
                      placeholder="Campaign name (optional)"
                      placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel text="Description" />
                    <TextInput
                      style={styles.fieldTextArea}
                      value={item.description ?? ''}
                      onChangeText={v => updateItem(index, { description: v || null })}
                      multiline
                      placeholder="What this content is about"
                      placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel text="Script" />
                    <TextInput
                      style={[styles.fieldTextArea, styles.scriptArea]}
                      value={item.script ?? ''}
                      onChangeText={v => updateItem(index, { script: v || null })}
                      multiline
                      placeholder="Script, carousel slides, hook, caption..."
                      placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel text="Tags" />
                    <TextInput
                      style={styles.fieldInput}
                      value={item.tagsText}
                      onChangeText={v => updateItem(index, { tagsText: v })}
                      placeholder="Comma-separated, e.g. BackToSchool, UAEEducation"
                      placeholderTextColor={colors.textSecondary}
                    />

                    <FieldLabel text="Other notes" />
                    <TextInput
                      style={styles.fieldTextArea}
                      value={item.notes ?? ''}
                      onChangeText={v => updateItem(index, { notes: v || null })}
                      multiline
                      placeholder="Audience, assets needed, people needed, anything else"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                )}
              </View>
            ))}

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable style={[styles.primary, includedCount === 0 && styles.primaryDisabled]} onPress={createAll} disabled={creating || includedCount === 0}>
              {creating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Create {includedCount} item{includedCount === 1 ? '' : 's'}</Text>}
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setItems(null)} disabled={creating}>
              <Text style={styles.secondaryText}>Start over</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  label: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  hint: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  textArea: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textPrimary,
    minHeight: 160, textAlignVertical: 'top'
  },
  error: { color: colors.danger, fontSize: 13 },
  primary: { backgroundColor: colors.navy, borderRadius: radii.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  secondary: { alignItems: 'center', paddingVertical: 10 },
  secondaryText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  originalToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  originalToggleText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  originalBox: { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing.md, maxHeight: 220 },
  originalText: { fontSize: 12, color: colors.textPrimary, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg,
    padding: spacing.md, gap: 8
  },
  cardExcluded: { opacity: 0.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitleInput: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary, paddingVertical: 4 },
  preview: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dueDateInput: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, color: colors.textPrimary, flexGrow: 1
  },
  campaignChip: { fontSize: 11, fontWeight: '700', color: colors.gold, backgroundColor: colors.goldSoft, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  expandToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  expandToggleText: { fontSize: 12, fontWeight: '700', color: colors.info },
  detailsBlock: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: 2 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginTop: 6 },
  fieldInput: { backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: colors.textPrimary },
  fieldTextArea: { backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, padding: 10, fontSize: 13, color: colors.textPrimary, minHeight: 70, textAlignVertical: 'top' },
  scriptArea: { minHeight: 160 },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  priorityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  priorityChipActive: { backgroundColor: colors.navy },
  priorityChipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  priorityChipTextActive: { color: '#FFF' }
});
