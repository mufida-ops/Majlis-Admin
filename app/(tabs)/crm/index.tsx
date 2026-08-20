import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { Pill } from '@/components/Pill';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listOrganisations, createOrganisation } from '@/lib/repositories/organisations';
import { memberLabel } from '@/lib/ownerLabel';
import { formatRelative } from '@/lib/format';

export default function CrmScreen() {
  const { session } = useAuth();
  const { workspaceId, me, partner } = useWorkspace();
  const { data: organisations, loading, error, refresh } = useAsync(
    () => (workspaceId ? listOrganisations(workspaceId) : Promise.resolve([])),
    [workspaceId]
  );

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

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

  return (
    <Screen>
      <SectionTitle title="CRM" subtitle="Who are we talking to, what happened last, and what needs to happen next?" />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !organisations || organisations.length === 0 ? (
        <EmptyState label="No organisations yet. Add one below." />
      ) : (
        organisations.map(account => (
          <Pressable key={account.id} onPress={() => router.push(`/(tabs)/crm/${account.id}`)}>
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{account.name}</Text>
                  <Text style={styles.meta}>
                    {account.stage}
                    {account.contacts[0] ? ` · ${account.contacts[0].name}` : ''}
                  </Text>
                </View>
                <Pill label={memberLabel(account.owner_user_id, me, partner)} />
              </View>
              {account.next_action ? <Text style={styles.next}>Next: {account.next_action}</Text> : null}
              <Text style={styles.last}>
                {account.last_contact_at ? `Last contact: ${formatRelative(account.last_contact_at)}` : 'No contact logged yet'}
              </Text>
            </Card>
          </Pressable>
        ))
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
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '600' },
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
