import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { Pill } from '@/components/Pill';
import { PageBanner } from '@/components/PageBanner';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listOrganisations, createOrganisation, updateOrganisation, deleteOrganisation } from '@/lib/repositories/organisations';
import { memberLabel, ownerAccentColor } from '@/lib/ownerLabel';
import { formatRelative } from '@/lib/format';

export default function CrmScreen() {
  const { session } = useAuth();
  const { workspaceId, me, partner } = useWorkspace();
  const { data: organisations, loading, error, refresh, setData } = useAsync(
    () => (workspaceId ? listOrganisations(workspaceId) : Promise.resolve([])),
    [workspaceId]
  );

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const create = async () => {
    if (!name.trim() || !workspaceId || !session) return;
    setCreating(true);
    try {
      await createOrganisation({ workspace_id: workspaceId, name: name.trim(), stage: 'Lead', created_by: session.user.id });
      setName('');
      setShowNew(false);
      refresh();
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await updateOrganisation(id, { name: editName.trim() });
      setData(prev => (prev ?? []).map(o => (o.id === id ? { ...o, ...updated } : o)));
      setEditingId(null);
      setEditName('');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = (id: string, orgName: string) => {
    Alert.alert('Delete organisation?', `This removes "${orgName}" and its notes, contacts, and activity history. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteOrganisation(id);
          refresh();
        }
      }
    ]);
  };

  return (
    <Screen>
      <SectionTitle title="CRM" subtitle="Who are we talking to, what happened last, and what needs to happen next?" />
      <PageBanner image={require('@/assets/images/sign-in-hero.jpg')} />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !organisations || organisations.length === 0 ? (
        <EmptyState label="No organisations yet. Add one below." />
      ) : (
        organisations.map(account => {
          const accent = ownerAccentColor(account.owner_user_id, me, partner);
          const isEditing = editingId === account.id;
          return (
            <Pressable key={account.id} onPress={() => !isEditing && router.push(`/(tabs)/crm/${account.id}`)}>
              <Card style={accent ? { backgroundColor: accent } : undefined}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    {isEditing ? (
                      <TextInput value={editName} onChangeText={setEditName} style={styles.editInput} autoFocus />
                    ) : (
                      <Text style={styles.title}>{account.name}</Text>
                    )}
                    <Text style={styles.meta}>
                      {account.stage}
                      {account.contacts[0] ? ` · ${account.contacts[0].name}` : ''}
                    </Text>
                  </View>
                  {!isEditing ? <Pill label={memberLabel(account.owner_user_id, me, partner)} /> : null}
                  {isEditing ? (
                    <>
                      <Pressable hitSlop={10} onPress={() => saveEdit(account.id)} disabled={savingEdit}>
                        <Text style={styles.saveText}>{savingEdit ? '…' : 'Save'}</Text>
                      </Pressable>
                      <Pressable hitSlop={10} onPress={cancelEdit} disabled={savingEdit}>
                        <Ionicons name="close-outline" size={20} color={theme.colors.muted} />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable hitSlop={10} onPress={() => startEdit(account.id, account.name)}>
                        <Ionicons name="pencil-outline" size={18} color={theme.colors.muted} />
                      </Pressable>
                      <Pressable hitSlop={10} onPress={() => confirmDelete(account.id, account.name)}>
                        <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
                      </Pressable>
                    </>
                  )}
                </View>
                {account.next_action ? <Text style={styles.next}>Next: {account.next_action}</Text> : null}
                <Text style={styles.last}>
                  {account.last_contact_at ? `Last contact: ${formatRelative(account.last_contact_at)}` : 'No contact logged yet'}
                </Text>
              </Card>
            </Pressable>
          );
        })
      )}

      {showNew ? (
        <Card>
          <Text style={styles.label}>New organisation</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Organisation name"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
          />
          <View style={styles.buttons}>
            <Pressable style={styles.primary} onPress={create} disabled={creating || !name.trim()}>
              <Text style={styles.primaryText}>{creating ? 'Adding…' : 'Add organisation'}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setShowNew(false)}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <Pressable style={styles.newButton} onPress={() => setShowNew(true)}>
          <Text style={styles.newButtonText}>+ New organisation</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '600' },
  editInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: 8,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  saveText: { color: theme.colors.navy, fontWeight: '600', fontSize: 13 },
  meta: { color: theme.colors.muted, marginTop: 4 },
  next: { color: theme.colors.text, marginTop: 14, lineHeight: 21 },
  last: { color: theme.colors.muted, marginTop: 5, fontSize: 13 },
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
  buttons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primary: { backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, paddingHorizontal: 16, paddingVertical: 10 },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.sm, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryText: { color: theme.colors.text, fontWeight: '600' },
  newButton: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 16, alignItems: 'center' },
  newButtonText: { color: theme.colors.navy, fontWeight: '600' }
});
