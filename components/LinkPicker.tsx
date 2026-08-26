import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { theme } from '@/constants/theme';
import { localDateKey } from '@/lib/format';
import type { OwnerType } from '@/types/db';

// Shared "link this to Calendar / CRM / Discussion (/ Task)" mini-form —
// used both on Give (per drop-in) and Your AI Assistant (per message, and
// to reclassify a wrong AI suggestion), so linking works the same way in
// both places instead of two divergent implementations.
export type LinkTarget = 'task' | 'calendar' | 'crm' | 'discussion';

export type LinkTargetChoice = { key: LinkTarget; label: string };

export const GIVE_LINK_TARGETS: LinkTargetChoice[] = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'crm', label: 'CRM follow-up' },
  { key: 'discussion', label: 'Discussion' }
];

export const AI_LINK_TARGETS: LinkTargetChoice[] = [
  { key: 'task', label: 'Task' },
  { key: 'discussion', label: 'Discussion' },
  { key: 'crm', label: 'CRM follow-up' },
  { key: 'calendar', label: 'Calendar' }
];

export type LinkPickerResult =
  | { target: 'calendar'; title: string; startAt: string; allDay: boolean; owner: OwnerType }
  | { target: 'crm'; organisationId: string; note: string }
  | { target: 'discussion'; title: string; owner: OwnerType }
  | { target: 'task'; projectId: string; title: string };

export function LinkPicker({
  targets,
  initialTarget,
  organisations,
  projects,
  seedTitle,
  saving,
  error,
  onSave,
  onCancel
}: {
  targets: LinkTargetChoice[];
  initialTarget?: LinkTarget;
  organisations: { id: string; name: string }[];
  projects?: { id: string; title: string }[];
  seedTitle: string;
  saving: boolean;
  error?: string;
  onSave: (result: LinkPickerResult) => void;
  onCancel: () => void;
}) {
  const [target, setTarget] = useState<LinkTarget>(initialTarget ?? targets[0].key);
  const [title, setTitle] = useState(seedTitle);
  const [date, setDate] = useState(localDateKey());
  const [time, setTime] = useState('');
  const [orgId, setOrgId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [owner, setOwner] = useState<OwnerType>('Both');
  const [localError, setLocalError] = useState('');

  const save = () => {
    setLocalError('');
    if (target === 'calendar') {
      if (!title.trim()) return setLocalError('Add a title first.');
      const allDay = !time.trim();
      const startAt = new Date(`${date}T${allDay ? '00:00' : time}:00`).toISOString();
      onSave({ target: 'calendar', title: title.trim(), startAt, allDay, owner });
    } else if (target === 'crm') {
      if (!orgId) return setLocalError('Pick an organisation first.');
      if (!title.trim()) return setLocalError('Add a note first.');
      onSave({ target: 'crm', organisationId: orgId, note: title.trim() });
    } else if (target === 'task') {
      if (!projectId) return setLocalError('Pick a project first.');
      if (!title.trim()) return setLocalError('Add a title first.');
      onSave({ target: 'task', projectId, title: title.trim() });
    } else {
      if (!title.trim()) return setLocalError('Add a title first.');
      onSave({ target: 'discussion', title: title.trim(), owner });
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.chipRow}>
        {targets.map(t => (
          <Pressable key={t.key} style={[styles.chip, target === t.key && styles.chipActive]} onPress={() => setTarget(t.key)}>
            <Text style={[styles.chipText, target === t.key && styles.chipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={target === 'crm' ? 'Follow-up note' : 'Title'}
        placeholderTextColor={theme.colors.muted}
        style={styles.input}
      />
      {target === 'calendar' ? (
        <View style={styles.row}>
          <DateField value={date} onChange={setDate} style={{ flex: 1, marginTop: 10 }} />
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM (optional)"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { flex: 1 }]}
          />
        </View>
      ) : null}
      {target === 'crm' ? (
        <View style={styles.chipRow}>
          {organisations.map(o => (
            <Pressable key={o.id} style={[styles.chip, orgId === o.id && styles.chipActive]} onPress={() => setOrgId(o.id)}>
              <Text style={[styles.chipText, orgId === o.id && styles.chipTextActive]}>{o.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {target === 'task' ? (
        <View style={styles.chipRow}>
          {(projects ?? []).map(p => (
            <Pressable key={p.id} style={[styles.chip, projectId === p.id && styles.chipActive]} onPress={() => setProjectId(p.id)}>
              <Text style={[styles.chipText, projectId === p.id && styles.chipTextActive]}>{p.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {target === 'calendar' || target === 'discussion' ? (
        <View style={styles.chipRow}>
          {(['Both', 'Mufida', 'Victoria'] as OwnerType[]).map(o => (
            <Pressable key={o} style={[styles.chip, owner === o && styles.chipActive]} onPress={() => setOwner(o)}>
              <Text style={[styles.chipText, owner === o && styles.chipTextActive]}>{o}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {localError || error ? <Text style={styles.error}>{localError || error}</Text> : null}
      <View style={styles.buttons}>
        <Pressable style={styles.primary} onPress={save} disabled={saving}>
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onCancel} disabled={saving}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, padding: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: theme.colors.navy, borderColor: theme.colors.navy },
  chipText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  input: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  row: { flexDirection: 'row', gap: 10 },
  error: { color: theme.colors.danger, marginTop: 8, fontSize: 13 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primary: { backgroundColor: theme.colors.navy, paddingVertical: 10, paddingHorizontal: 16, borderRadius: theme.radius.md, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  secondary: { borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 10, paddingHorizontal: 16, borderRadius: theme.radius.md, alignItems: 'center' },
  secondaryText: { color: theme.colors.text, fontWeight: '600', fontSize: 13 }
});
