import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { PRIORITY_COLOR, nextPriority } from '@/lib/priority';
import type { PriorityLevel } from '@/types/db';

// Tapping cycles Low → Medium → High → Low, same interaction as the
// status/stage pills elsewhere, so priority never needs a picker sheet.
export function PriorityBadge({ value, onChange }: { value: PriorityLevel; onChange: (next: PriorityLevel) => void }) {
  return (
    <Pressable style={styles.badge} onPress={() => onChange(nextPriority(value))} hitSlop={8}>
      <View style={[styles.dot, { backgroundColor: PRIORITY_COLOR[value] }]} />
      <Text style={styles.label}>{value}</Text>
      <Ionicons name="chevron-down" size={12} color={theme.colors.muted} />
    </Pressable>
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
  label: { color: theme.colors.text, fontSize: 12, fontWeight: '600' }
});
