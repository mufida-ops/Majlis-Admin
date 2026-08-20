import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

export type GanttTask = {
  id: string;
  title: string;
  owner: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  status: string;
};

const DAY_MS = 86400000;

function pct(date: string, windowStart: number, windowTotal: number) {
  const n = new Date(date + 'T00:00:00').getTime() - windowStart;
  return Math.max(0, Math.min(100, (n / windowTotal) * 100));
}

export function Gantt({ tasks }: { tasks: GanttTask[] }) {
  if (tasks.length === 0) return null;

  // Window is derived from the tasks themselves (with a little padding) so
  // the chart stays correct for whatever dates real projects happen to use,
  // instead of a fixed range tuned to one set of seed data.
  const starts = tasks.map(t => new Date(t.start + 'T00:00:00').getTime());
  const ends = tasks.map(t => new Date(t.end + 'T00:00:00').getTime());
  const windowStart = Math.min(...starts) - DAY_MS;
  const windowEnd = Math.max(...ends) + DAY_MS;
  const windowTotal = Math.max(windowEnd - windowStart, DAY_MS);

  return (
    <View style={{ gap: 12 }}>
      {tasks.map(task => {
        const left = pct(task.start, windowStart, windowTotal);
        const right = pct(task.end, windowStart, windowTotal);
        const width = Math.max(7, right - left);
        return (
          <View key={task.id} style={{ gap: 7 }}>
            <View style={styles.row}>
              <Text style={styles.task}>{task.title}</Text>
              <Text style={styles.owner}>{task.owner}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { left: `${left}%`, width: `${width}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  task: { fontSize: 14, color: theme.colors.text, flex: 1 },
  owner: { fontSize: 12, color: theme.colors.muted },
  track: { height: 10, borderRadius: 99, backgroundColor: theme.colors.surfaceMuted, position: 'relative', overflow: 'hidden' },
  bar: { position: 'absolute', height: 10, backgroundColor: theme.colors.navy, borderRadius: 99 }
});
