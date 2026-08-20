import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { Gantt } from '@/components/Gantt';
import { projects } from '@/data/mock';
import { theme } from '@/constants/theme';

export default function ProjectsScreen() {
  return (
    <Screen>
      <SectionTitle title="Projects" subtitle="Shared work, owners, next actions and dependencies." />
      {projects.map(project => (
        <Card key={project.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{project.title}</Text>
              <Text style={styles.meta}>{project.owner} · {project.status}</Text>
            </View>
            <Text style={styles.progress}>{project.progress}%</Text>
          </View>
          <Text style={styles.next}>Next: {project.nextAction}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${project.progress}%` }]} />
          </View>
          <View style={{ marginTop: 18 }}>
            <Gantt tasks={project.tasks} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '600' },
  meta: { color: theme.colors.muted, marginTop: 4, fontSize: 13 },
  progress: { color: theme.colors.navy, fontWeight: '700' },
  next: { color: theme.colors.text, marginTop: 12 },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: theme.colors.surfaceMuted, marginTop: 10, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 99, backgroundColor: theme.colors.gold }
});
