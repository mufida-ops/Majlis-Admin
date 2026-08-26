import { useState } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { localDateKey } from '@/lib/format';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/**
 * A tap-to-open calendar picker producing a plain YYYY-MM-DD string —
 * used everywhere a date is entered so nobody has to type or get the
 * format right by hand. Built from scratch (no date-picker dependency)
 * so it behaves identically on the web build and inside Expo Go, where a
 * native picker library isn't an option.
 */
export function DateField({
  value,
  onChange,
  placeholder = 'Select a date',
  style
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(0);
  const [viewMonth, setViewMonth] = useState(0);

  const openPicker = () => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setOpen(true);
  };

  const changeMonth = (delta: number) => {
    let month = viewMonth + delta;
    let year = viewYear;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    setViewMonth(month);
    setViewYear(year);
  };

  const selectDay = (day: number) => {
    onChange(dateKey(viewYear, viewMonth, day));
    setOpen(false);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  return (
    <>
      <Pressable style={[styles.field, style]} onPress={openPicker}>
        <Text style={value ? styles.valueText : styles.placeholderText}>{value || placeholder}</Text>
        <Ionicons name="calendar-outline" size={18} color={theme.colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.header}>
              <Pressable onPress={() => changeMonth(-1)} hitSlop={10}>
                <Ionicons name="chevron-back" size={20} color={theme.colors.navy} />
              </Pressable>
              <Text style={styles.headerText}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
              <Pressable onPress={() => changeMonth(1)} hitSlop={10}>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.navy} />
              </Pressable>
            </View>
            <View style={styles.weekRow}>
              {WEEKDAY_LABELS.map((label, i) => (
                <Text key={i} style={styles.weekday}>
                  {label}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={`blank-${i}`} style={styles.cell} />;
                const isSelected = dateKey(viewYear, viewMonth, day) === value;
                return (
                  <Pressable key={day} style={[styles.cell, isSelected && styles.cellSelected]} onPress={() => selectDay(day)}>
                    <Text style={[styles.cellText, isSelected && styles.cellTextSelected]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.footer}>
              <Pressable
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
                hitSlop={8}
              >
                <Text style={styles.footerLink}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onChange(localDateKey());
                  setOpen(false);
                }}
                hitSlop={8}
              >
                <Text style={styles.footerLink}>Today</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background
  },
  valueText: { color: theme.colors.text },
  placeholderText: { color: theme.colors.muted },
  backdrop: { flex: 1, backgroundColor: '#00000055', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 16, width: '100%', maxWidth: 340 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerText: { color: theme.colors.navy, fontWeight: '700', fontSize: 15 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  cellSelected: { backgroundColor: theme.colors.navy },
  cellText: { color: theme.colors.text, fontSize: 14 },
  cellTextSelected: { color: '#fff', fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  footerLink: { color: theme.colors.navy, fontWeight: '600', fontSize: 13 }
});
