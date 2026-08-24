import React from 'react';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { colors, radii, spacing } from '@/constants/theme';
import { roleLabel } from '@/lib/permissions';

function Row({ icon, label, sub, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.iconWrap}><Feather name={icon} size={18} color={colors.navy} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function More() {
  const { profile, roles, isAdmin, signOut } = useAuth();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={styles.profileCard}>
        <Text style={styles.name}>{profile?.full_name}</Text>
        <Text style={styles.roles}>{roles.length ? roles.map(roleLabel).join(' · ') : 'No roles assigned yet'}</Text>
      </View>

      <View style={styles.section}>
        <Row icon="archive" label="Published" sub="Completed content archive" onPress={() => router.push('/(tabs)/published')} />
        <Row icon="users" label="Team" sub="Members, roles, workload" onPress={() => router.push('/(tabs)/team')} />
        <Row icon="bar-chart-2" label="Dashboard" sub="Pipeline status and latest team activity" onPress={() => router.push('/(tabs)/insights')} />
        <Row icon="sun" label="Daily Inspiration" sub="A little motivation and happiness" onPress={() => router.push('/quotes')} />
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Row icon="tag" label="Campaigns & Tags" sub="Manage what content is organised by" onPress={() => router.push('/admin/campaigns-tags')} />
          <Row icon="shield" label="Manage Roles" sub="Grant or revoke team permissions" onPress={() => router.push('/admin/team')} />
        </View>
      )}

      <View style={styles.section}>
        <Row icon="settings" label="Settings" onPress={() => router.push('/settings')} />
        <Row icon="log-out" label="Sign out" onPress={signOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  profileCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  roles: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  section: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 }
});
