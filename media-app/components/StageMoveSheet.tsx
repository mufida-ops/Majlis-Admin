import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';
import { STAGE_LABELS, type ContentStage } from '@/types/db';
import { MANUAL_TRANSITIONS } from '@/lib/stateMachine';

export function StageMoveSheet({
  visible, current, title, onClose, onPick
}: { visible: boolean; current: ContentStage; title: string; onClose: () => void; onPick: (stage: ContentStage) => void }) {
  const options = MANUAL_TRANSITIONS[current] ?? [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.hint}>Currently in {STAGE_LABELS[current]}</Text>
          {options.length === 0 ? (
            <Text style={styles.hint}>No further manual moves from here.</Text>
          ) : (
            options.map((s) => (
              <Pressable key={s} style={styles.option} onPress={() => onPick(s)}>
                <Text style={styles.optionText}>Move to {STAGE_LABELS[s]}</Text>
              </Pressable>
            ))
          )}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  option: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border },
  optionText: { fontSize: 15, fontWeight: '600', color: colors.navy },
  cancel: { paddingVertical: 14, alignItems: 'center', marginTop: spacing.xs },
  cancelText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' }
});
