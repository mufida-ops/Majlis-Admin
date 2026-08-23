import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { PageBanner } from '@/components/PageBanner';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listDecisions, createDecision, setDecisionStatus, deleteDecision } from '@/lib/repositories/decisions';
import { formatShortDate } from '@/lib/format';
import type { OwnerType } from '@/types/db';

const OWNERS: OwnerType[] = ['Mufida', 'Victoria', 'Both'];

export default function DecisionsScreen() {
  const { session } = useAuth();
  const { workspaceId } = useWorkspace();
  const { data: decisions, loading, error, refresh, setData } = useAsync(
    () => (workspaceId ? listDecisions(workspaceId) : Promise.resolve([])),
    [workspaceId]
  );

  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState<OwnerType>('Both');
  const [creating, setCreating] = useState(false);

  const update = async (id: string, status: 'Agreed' | 'Discuss') => {
    const updated = await setDecisionStatus(id, status);
    setData(prev => (prev ?? []).map(d => (d.id === id ? updated : d)));
  };

  const confirmDelete = (id: string, title: string) => {
    Alert.alert(`Delete "${title}"?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDecision(id);
          setData(prev => (prev ?? []).filter(d => d.id !== id));
        }
      }
    ]);
  };

  const create = async () => {
    if (!title.trim() || !workspaceId || !session) return;
    setCreating(true);
    try {
      await createDecision({ workspace_id: workspaceId, title: title.trim(), owner, created_by: session.user.id });
      setTitle('');
      setShowNew(false);
      refresh();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen>
      <SectionTitle title="Discussions" subtitle="A durable record of what you actually agreed." />
      <PageBanner image={require('@/assets/images/reading-together.jpg')} />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !decisions || decisions.length === 0 ? (
        <EmptyState label="No discussions logged yet." />
      ) : (
        decisions.map(item => (
          <Card key={item.id}>
            <View style={styles.headerRow}>
              <Text style={styles.meta}>{formatShortDate(item.created_at)}</Text>
              <Pressable hitSlop={10} onPress={() => confirmDelete(item.id, item.title)}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
              </Pressable>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.status}>{item.status}</Text>
            <View style={styles.actions}>
              {item.status === 'Waiting' ? (
                <>
                  <Pressable style={styles.primary} onPress={() => update(item.id, 'Agreed')}>
                    <Text style={styles.primaryText}>Agree</Text>
                  </Pressable>
                  <Pressable style={styles.secondary} onPress={() => update(item.id, 'Discuss')}>
                    <Text style={styles.secondaryText}>Discuss</Text>
                  </Pressable>
                </>
              ) : null}
              <Pressable
                style={styles.secondary}
                onPress={() => router.push({ pathname: '/thread', params: { kind: 'decision', id: item.id, title: item.title } })}
              >
                <Text style={styles.secondaryText}>Thread</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}

      {showNew ? (
        <Card>
          <Text style={styles.label}>Raise a discussion</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What needs deciding?"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
          <View style={styles.ownerPicker}>
            {OWNERS.map(o => (
              <Pressable key={o} onPress={() => setOwner(o)}>
                <Text style={[styles.ownerChip, owner === o && styles.ownerChipActive]}>{o}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.buttons}>
            <Pressable style={styles.primary} onPress={create} disabled={creating || !title.trim()}>
              <Text style={styles.primaryText}>{creating ? 'Raising…' : 'Raise discussion'}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setShowNew(false)}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <Pressable style={styles.newButton} onPress={() => setShowNew(true)}>
          <Text style={styles.newButtonText}>+ Raise a discussion</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { color: theme.colors.muted, fontSize: 13 },
  title: { color: theme.colors.text, fontSize: 17, fontWeight: '600', marginTop: 7, lineHeight: 23 },
  status: { color: theme.colors.gold, fontWeight: '700', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  primary: { backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, paddingHorizontal: 16, paddingVertical: 10 },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.sm, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryText: { color: theme.colors.text, fontWeight: '600' },
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  input: {
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  ownerPicker: { flexDirection: 'row', gap: 8, marginTop: 12 },
  ownerChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: theme.colors.text,
    fontSize: 13
  },
  ownerChipActive: { backgroundColor: theme.colors.navy, borderColor: theme.colors.navy, color: '#fff' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  newButton: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 16, alignItems: 'center' },
  newButtonText: { color: theme.colors.navy, fontWeight: '600' }
});
