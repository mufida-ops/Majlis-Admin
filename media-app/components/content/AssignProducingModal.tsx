import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import { Avatar } from '@/components/Avatar';
import { useAsync } from '@/lib/useAsync';
import { listTeam } from '@/lib/repositories/team';
import type { Profile } from '@/types/db';

/** Idea -> Producing: pick exactly one main producer (becomes Assigned To) and,
 * optionally, anyone else helping (added as contributors) — in one step, so a
 * two-person job doesn't need a second trip to the card to add a helper. */
export function AssignProducingModal({
  visible, defaultOwnerId, onClose, onConfirm
}: {
  visible: boolean;
  defaultOwnerId: string | null | undefined;
  onClose: () => void;
  onConfirm: (mainOwnerId: string, helperIds: string[]) => void;
}) {
  const { data: team } = useAsync(() => listTeam(), []);
  const [mainId, setMainId] = useState<string | null>(defaultOwnerId ?? null);
  const [helperIds, setHelperIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (visible) {
      setMainId(defaultOwnerId ?? null);
      setHelperIds(new Set());
    }
  }, [visible, defaultOwnerId]);

  function pickMain(id: string) {
    setMainId(id);
    setHelperIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleHelper(id: string) {
    if (id === mainId) return;
    setHelperIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    if (!mainId) return;
    onConfirm(mainId, Array.from(helperIds));
  }

  const people: Profile[] = team ?? [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Who will produce this?</Text>

          <Text style={styles.sectionLabel}>Main producer</Text>
          <ScrollView style={styles.list} contentContainerStyle={{ gap: 2 }}>
            {people.map((p) => (
              <Pressable key={p.id} style={styles.row} onPress={() => pickMain(p.id)}>
                <Avatar name={p.full_name} size={28} />
                <Text style={styles.rowName} numberOfLines={1}>{p.full_name}</Text>
                <Feather name={mainId === p.id ? 'check-circle' : 'circle'} size={18} color={mainId === p.id ? colors.navy : colors.border} />
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>Also helping (optional)</Text>
          <ScrollView style={styles.list} contentContainerStyle={{ gap: 2 }}>
            {people.filter((p) => p.id !== mainId).map((p) => {
              const isSelected = helperIds.has(p.id);
              return (
                <Pressable key={p.id} style={styles.row} onPress={() => toggleHelper(p.id)}>
                  <Avatar name={p.full_name} size={28} />
                  <Text style={styles.rowName} numberOfLines={1}>{p.full_name}</Text>
                  <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                    {isSelected && <Feather name="check" size={13} color="#FFF" />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.confirm, !mainId && styles.confirmDisabled]} onPress={confirm} disabled={!mainId}>
              <Text style={styles.confirmText}>Assign & Move</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, gap: spacing.xs, maxHeight: '85%' },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.sm },
  list: { maxHeight: 150 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  rowName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center'
  },
  checkboxOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  confirm: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radii.md, backgroundColor: colors.navy },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' }
});
