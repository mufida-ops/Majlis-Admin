import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { TASK_STATUSES, TASK_STATUS_COLOR } from '@/lib/taskStatus';
import type { TaskStatus } from '@/types/db';

// A real dropdown, not a cycle-on-tap — tapping it used to just advance one
// step, and since tasks are grouped by status, a successful tap instantly
// relocated the row to a different group, reading as "nothing happened."
// Tapping now opens all four options directly.
export function StatusBadge({ value, onChange }: { value: TaskStatus; onChange: (next: TaskStatus) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable style={styles.badge} onPress={() => setOpen(o => !o)} hitSlop={8}>
        <View style={[styles.dot, { backgroundColor: TASK_STATUS_COLOR[value] }]} />
        <Text style={styles.label}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={theme.colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.dropdown}>
          {TASK_STATUSES.map(status => (
            <Pressable
              key={status}
              style={styles.option}
              onPress={() => {
                setOpen(false);
                onChange(status);
              }}
            >
              <View style={[styles.dot, { backgroundColor: TASK_STATUS_COLOR[status] }]} />
              <Text style={[styles.optionText, status === value && styles.optionTextActive]}>{status}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
    top: '100%',
    left: 0,
    marginTop: 4,
    minWidth: 150,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingVertical: 4,
    zIndex: 20,
    elevation: 6
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  optionText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  optionTextActive: { color: theme.colors.navy }
});
