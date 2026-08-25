import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAnchoredMenu } from '@/lib/useAnchoredMenu';
import { PRIORITY_COLOR, PRIORITY_LEVELS } from '@/lib/priority';
import type { PriorityLevel } from '@/types/db';

// A real dropdown, not a cycle-on-tap — see StatusBadge for why that
// interaction was confusing, and why this renders via a Modal (useAnchoredMenu)
// instead of a plain position:absolute sibling.
export function PriorityBadge({ value, onChange }: { value: PriorityLevel; onChange: (next: PriorityLevel) => void }) {
  const { anchorRef, open, position, toggle, close } = useAnchoredMenu();
  return (
    <View>
      <Pressable ref={anchorRef} style={styles.badge} onPress={toggle} hitSlop={8}>
        <View style={[styles.dot, { backgroundColor: PRIORITY_COLOR[value] }]} />
        <Text style={styles.label}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={theme.colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        {position ? (
          <View style={[styles.dropdown, { top: position.top, left: position.left }]}>
            {PRIORITY_LEVELS.map(level => (
              <Pressable
                key={level}
                style={styles.option}
                onPress={() => {
                  close();
                  onChange(level);
                }}
              >
                <View style={[styles.dot, { backgroundColor: PRIORITY_COLOR[level] }]} />
                <Text style={[styles.optionText, level === value && styles.optionTextActive]}>{level}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  dropdown: {
    position: 'absolute',
    minWidth: 130,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingVertical: 4,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  optionText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  optionTextActive: { color: theme.colors.navy }
});
