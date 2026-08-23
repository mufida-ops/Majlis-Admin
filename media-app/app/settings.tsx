import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, radii, spacing } from '@/constants/theme';
import { roleLabel } from '@/lib/permissions';

export default function Settings() {
  const { profile, roles, signOut } = useAuth();

  return (
    <View style={styles.screen}>
      <Text style={styles.name}>{profile?.full_name}</Text>
      <Text style={styles.email}>{profile?.email}</Text>
      <Text style={styles.roles}>{roles.length ? roles.map(roleLabel).join(' · ') : 'No roles assigned yet — ask an admin.'}</Text>

      <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.xs },
  name: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  email: { fontSize: 13, color: colors.textSecondary },
  roles: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  signOut: { backgroundColor: colors.danger, borderRadius: radii.md, paddingVertical: 14, alignItems: 'center' },
  signOutText: { color: '#FFF', fontWeight: '700', fontSize: 15 }
});
