import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';

export interface PickerOption {
  id: string;
  label: string;
  sub?: string;
}

export function PickerSheet({
  visible, title, options, selectedId, onClose, onSelect, allowClear
}: {
  visible: boolean; title: string; options: PickerOption[]; selectedId?: string | null;
  onClose: () => void; onSelect: (id: string | null) => void; allowClear?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={allowClear ? [{ id: '', label: 'Unassigned' }, ...options] : options}
            keyExtractor={(o) => o.id}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onSelect(item.id || null)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.sub && <Text style={styles.rowSub}>{item.sub}</Text>}
                </View>
                {(selectedId ?? '') === item.id && <Feather name="check" size={18} color={colors.navy} />}
              </Pressable>
            )}
          />
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, maxHeight: '80%' },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
  rowSub: { fontSize: 12, color: colors.textSecondary },
  cancel: { paddingVertical: 14, alignItems: 'center', marginTop: spacing.xs },
  cancelText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' }
});
