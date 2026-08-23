import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { listTeam, listRolesByUser, grantRole, revokeRole } from '@/lib/repositories/team';
import { Avatar } from '@/components/Avatar';
import { roleLabel } from '@/lib/permissions';
import type { AppRole } from '@/types/db';

const ALL_ROLES: AppRole[] = ['admin', 'approver', 'creator', 'publisher'];

export default function ManageRoles() {
  const { session } = useAuth();
  const { data: team } = useAsync(() => listTeam(), []);
  const { data: rolesByUser, reload } = useAsync(() => listRolesByUser(), []);

  async function toggle(userId: string, role: AppRole, has: boolean) {
    if (!session) return;
    if (has) await revokeRole(userId, role);
    else await grantRole(userId, role, session.user.id);
    reload();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Roles aren't tied to any one person — grant or revoke whichever combination fits how each teammate actually works.</Text>
      {(team ?? []).map((p) => {
        const roles = rolesByUser?.get(p.id) ?? [];
        return (
          <View key={p.id} style={styles.card}>
            <View style={styles.headerRow}>
              <Avatar name={p.full_name} size={32} />
              <Text style={styles.name}>{p.full_name}</Text>
            </View>
            <View style={styles.chipRow}>
              {ALL_ROLES.map((r) => {
                const has = roles.includes(r);
                return (
                  <Pressable key={r} onPress={() => toggle(p.id, r, has)} style={[styles.chip, has && styles.chipActive]}>
                    <Text style={[styles.chipText, has && styles.chipTextActive]}>{roleLabel(r)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  intro: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.navy },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: '#FFF' }
});
