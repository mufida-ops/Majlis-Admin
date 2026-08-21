import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';
import { localDateKey } from '@/lib/format';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function buildWeeks(year: number, month: number): (Date | null)[][] {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = new Array(firstOfMonth.getDay()).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function MonthGrid({
  year,
  month,
  selectedDay,
  datesWithEvents,
  onSelectDay
}: {
  year: number;
  month: number;
  selectedDay: string;
  datesWithEvents: Set<string>;
  onSelectDay: (dateKey: string) => void;
}) {
  const weeks = buildWeeks(year, month);
  const todayKey = localDateKey();

  return (
    <View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={styles.cell} />;
            const key = localDateKey(date);
            const isToday = key === todayKey;
            const isSelected = key === selectedDay;
            return (
              <Pressable key={di} style={styles.cell} onPress={() => onSelectDay(key)}>
                <View style={[styles.cellInner, isSelected && styles.cellSelected, !isSelected && isToday && styles.cellToday]}>
                  <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{date.getDate()}</Text>
                  {datesWithEvents.has(key) ? <View style={[styles.dot, isSelected && styles.dotSelected]} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  weekdayRow: { flexDirection: 'row' },
  weekdayLabel: { flex: 1, textAlign: 'center', color: theme.colors.muted, fontSize: 12, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginTop: 6 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellInner: { width: '78%', height: '78%', borderRadius: 999, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cellSelected: { backgroundColor: theme.colors.navy },
  cellToday: { borderWidth: 1, borderColor: theme.colors.gold },
  dayText: { color: theme.colors.text, fontSize: 14 },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.gold },
  dotSelected: { backgroundColor: '#fff' }
});
