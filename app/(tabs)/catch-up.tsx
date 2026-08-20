import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { theme } from '@/constants/theme';

export default function CatchUpScreen() {
  return (
    <Screen>
      <SectionTitle title="Catch-up" subtitle="What changed since you last checked — without reading a wall of chat." />
      <Card>
        <Text style={styles.lead}>Since you last checked</Text>
        <Text style={styles.body}>Victoria updated the website structure, moved the resource grouping task to Friday, and left one decision for you on Phase 2.</Text>
      </Card>
      <Card>
        <Text style={styles.label}>Needs you</Text>
        <Text style={styles.item}>Phase 2 pricing structure · decision waiting</Text>
        <Text style={styles.item}>Magrudy’s · clarify stock / distribution model</Text>
      </Card>
      <Card>
        <Text style={styles.label}>FYI</Text>
        <Text style={styles.item}>Website resource architecture updated</Text>
        <Text style={styles.item}>Regent review moved to next week</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: theme.colors.navy, fontSize: 18, fontWeight: '600' },
  body: { color: theme.colors.text, marginTop: 10, lineHeight: 23, fontSize: 16 },
  label: { color: theme.colors.gold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  item: { color: theme.colors.text, marginTop: 10, lineHeight: 21 }
});
