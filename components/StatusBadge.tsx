import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { TASK_STATUS_COLOR, nextTaskStatus } from '@/lib/taskStatus';
import type { TaskStatus } from '@/types/db';

// Tapping cycles Not Started → Started → Ongoing → Done → Not Started, same
// interaction as PriorityBadge. The chevron is just a visual hint that this
// is tappable — the task's own edit form has the same 4 options as an
// explicit picker, for anyone who doesn't spot the cycling badge.
export function StatusBadge({ value, onChange }: { value: TaskStatus; onChange: (next: TaskStatus) => void }) {
  return (
    <Pressable style={styles.badge} onPress={() => onChange(nextTaskStatus(value))} hitSlop={8}>
      <View style={[styles.dot, { backgroundColor: TASK_STATUS_COLOR[value] }]} />
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
