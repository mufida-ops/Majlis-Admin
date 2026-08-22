import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { formatQuietHoursRange } from '@/lib/quietHours';

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function toClock(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 5);
}

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { me, partner, updateMyMembership } = useWorkspace();

  const [start, setStart] = useState(toClock(me?.quiet_hours_start ?? null));
  const [end, setEnd] = useState(toClock(me?.quiet_hours_end ?? null));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [icon, setIcon] = useState(me?.avatar_emoji ?? '');
  const [savingIcon, setSavingIcon] = useState(false);
  const [iconSaved, setIconSaved] = useState(false);

  const saveIcon = async () => {
    setSavingIcon(true);
    setIconSaved(false);
    try {
      await updateMyMembership({ avatar_emoji: icon.trim() || null });
      setIconSaved(true);
    } finally {
      setSavingIcon(false);
    }
  };

  const save = async () => {
    setError('');
    setSaved(false);
    if (!start.trim() && !end.trim()) {
      setSaving(true);
      await updateMyMembership({ quiet_hours_start: null, quiet_hours_end: null });
      setSaving(false);
      setSaved(true);
      return;
    }
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
      setError('Use 24-hour HH:MM, e.g. 22:00 and 07:00.');
      return;
    }
    setSaving(true);
    try {
      await updateMyMembership({ quiet_hours_start: `${start}:00`, quiet_hours_end: `${end}:00` });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Settings',
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.navy
        }}
      />

      <Card>
        <Text style={styles.label}>Your icon</Text>
        <Text style={styles.sub}>A small emoji shown next to your name — tap the text box and use your keyboard's emoji key.</Text>
        <View style={styles.row}>
          <TextInput
            value={icon}
            onChangeText={setIcon}
            placeholder="🦋"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, styles.iconInput]}
          />
          <Pressable style={[styles.primary, { marginTop: 0, flex: 1 }]} onPress={saveIcon} disabled={savingIcon}>
            <Text style={styles.primaryText}>{savingIcon ? 'Saving…' : 'Save icon'}</Text>
          </Pressable>
        </View>
        {iconSaved ? <Text style={styles.success}>Saved.</Text> : null}
      </Card>

      <Card>
        <Text style={styles.label}>Your quiet hours</Text>
        <Text style={styles.sub}>Non-urgent messages wait for {partner?.display_name ?? 'your co-founder'} until these hours end. Leave both blank to turn quiet hours off.</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Starts</Text>
            <TextInput
              value={start}
              onChangeText={setStart}
              placeholder="22:00"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Ends</Text>
            <TextInput
              value={end}
              onChangeText={setEnd}
              placeholder="07:00"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.success}>Saved.</Text> : null}
        <Pressable style={styles.primary} onPress={save} disabled={saving}>
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save quiet hours'}</Text>
        </Pressable>
      </Card>

      {partner ? (
        <Card>
          <Text style={styles.label}>{partner.display_name}'s quiet hours</Text>
          <Text style={styles.sub}>{formatQuietHoursRange(partner) ?? 'No quiet hours set.'}</Text>
        </Card>
      ) : null}

      <Pressable
        style={styles.signOut}
        onPress={async () => {
          await signOut();
          router.replace('/');
        }}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  sub: { color: theme.colors.muted, marginTop: 6, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12, marginTop: 14 },
  fieldLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  iconInput: { width: 64, textAlign: 'center', fontSize: 20 },
  error: { color: theme.colors.danger, marginTop: 12 },
  success: { color: theme.colors.success, marginTop: 12 },
  primary: { backgroundColor: theme.colors.navy, padding: 14, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#fff', fontWeight: '600' },
  signOut: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 16, alignItems: 'center' },
  signOutText: { color: theme.colors.danger, fontWeight: '600' }
});
