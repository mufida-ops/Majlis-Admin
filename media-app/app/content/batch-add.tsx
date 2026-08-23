import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { parseContentBatch, type ProposedContentItem } from '@/lib/repositories/contentBatch';
import { createContentItem } from '@/lib/repositories/contentItems';
import { todayInOrgTz } from '@/lib/timezone';
import { colors, radii, spacing } from '@/constants/theme';

type ReviewItem = ProposedContentItem & { include: boolean };

export default function BatchAddContent() {
  const { session } = useAuth();
  const [text, setText] = useState('');
  const [items, setItems] = useState<ReviewItem[] | null>(null);
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
      setItems(proposed.map(p => ({ ...p, include: true })));
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
      for (const item of toCreate) {
        await createContentItem({
          title: item.title.trim(),
          owner_id: session.user.id,
          due_date: item.due_date || null,
          priority: item.priority,
          created_by: session.user.id
        });
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
              Write it however you'd normally think about it — a few sentences or a rough list. We'll split it into
              separate content items for you to check over before anything is created.
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
            <Text style={styles.hint}>Edit anything that's off, untick anything you don't want, or remove it entirely.</Text>
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
                <TextInput
                  style={styles.dueDateInput}
                  value={item.due_date ?? ''}
                  onChangeText={v => updateItem(index, { due_date: v || null })}
                  placeholder="Due date, e.g. 2026-09-05 (optional)"
                  placeholderTextColor={colors.textSecondary}
                />
                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
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
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg,
    padding: spacing.md, gap: 8
  },
  cardExcluded: { opacity: 0.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitleInput: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary, paddingVertical: 4 },
  dueDateInput: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, color: colors.textPrimary
  },
  notes: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }
});
