import { StyleSheet, Text, View } from 'react-native';
import { ProjectTask } from '@/types';
import { theme } from '@/constants/theme';

const WINDOW_START = new Date('2026-08-20T00:00:00');
const WINDOW_END = new Date('2026-09-05T00:00:00');
const total = WINDOW_END.getTime() - WINDOW_START.getTime();

function pct(date: string) {
  const n = new Date(date + 'T00:00:00').getTime() - WINDOW_START.getTime();
  return Math.max(0, Math.min(100, (n / total) * 100));
}

export function Gantt({ tasks }: { tasks: ProjectTask[] }) {
  return (
    <View style={{ gap: 12 }}>
      {tasks.map(task => {
        const left = pct(task.start);
        const right = pct(task.end);
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
