import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';
import { useAsync } from '@/lib/useAsync';
import { listTeam, listRolesByUser, workloadForUser } from '@/lib/repositories/team';
import { Avatar } from '@/components/Avatar';
import { roleLabel } from '@/lib/permissions';
import { todayInOrgTz } from '@/lib/timezone';
import type { Profile, ContentItem } from '@/types/db';

function MemberRow({ profile, roles }: { profile: Profile; roles: string[] }) {
  const { data: workload } = useAsync(() => workloadForUser(profile.id), [profile.id]);
  const today = todayInOrgTz();
  const items = (workload?.direct ?? []) as ContentItem[];
  const overdue = items.filter((i) => !!i.due_date && i.due_date < today);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Avatar name={profile.full_name} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.roles}>{roles.length ? roles.map((r) => roleLabel(r as any)).join(' · ') : 'No roles assigned'}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <Stat label="Active items" value={items.length} />
        <Stat label="Overdue" value={overdue.length} danger={overdue.length > 0} />
      </View>
    </View>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, danger && { color: colors.danger }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function Team() {
  const { data: team, loading } = useAsync(() => listTeam(), []);
  const { data: rolesByUser } = useAsync(() => listRolesByUser(), []);

  if (loading && !team) return <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {(team ?? []).map((p) => (
        <MemberRow key={p.id} profile={p} roles={rolesByUser?.get(p.id) ?? []} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  roles: { fontSize: 12, color: colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: spacing.xl },
  stat: { alignItems: 'flex-start' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary }
});
