import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { SectionTitle } from '@/components/SectionTitle';
import { theme } from '@/constants/theme';

const focus = [
  ['CRM · Magrudy’s', 'Clarify partner terms', 'Mufida · due tomorrow'],
  ['Decision', 'Phase 2 pricing structure', 'Victoria needs your input'],
  ['Project · Website', 'Resource architecture', 'Blocked by content grouping']
];

export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.date}>Thursday, 20 August</Text>
          <Text style={styles.greeting}>Good evening, Mufida</Text>
          <Text style={styles.sub}>Here’s what needs your attention — nothing more.</Text>
        </View>
        <Pill label="Victoria · quiet hours" />
      </View>

      <Pressable onPress={() => router.push('/(tabs)/drop')}>
        <Card style={styles.capture}>
          <Text style={styles.captureTitle}>Drop something in</Text>
          <Text style={styles.captureText}>Thought, task, decision, follow-up — organise it later.</Text>
          <Text style={styles.capturePrompt}>What’s on your mind?</Text>
        </Card>
      </Pressable>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Right now" subtitle="Only the things that genuinely need movement." />
        {focus.map(([eyebrow, title, meta]) => (
          <Card key={title}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.itemTitle}>{title}</Text>
            <Text style={styles.meta}>{meta}</Text>
          </Card>
        ))}
      </View>

      <Pressable style={styles.catchUp} onPress={() => router.push('/(tabs)/catch-up')}>
        <Text style={styles.catchUpTitle}>Catch me up</Text>
        <Text style={styles.catchUpText}>See what Victoria changed while you were away →</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  date: { color: theme.colors.muted, fontSize: 13 },
  greeting: { color: theme.colors.text, fontSize: 26, fontWeight: '600', marginTop: 4 },
  sub: { color: theme.colors.muted, fontSize: 15, marginTop: 6, lineHeight: 21 },
  capture: { backgroundColor: theme.colors.navy },
  captureTitle: { color: '#FFFDF7', fontSize: 20, fontWeight: '600' },
  captureText: { color: '#E8E1D6', marginTop: 5, lineHeight: 20 },
  capturePrompt: { color: '#FFFDF7', marginTop: 20, fontSize: 16 },
  eyebrow: { color: theme.colors.gold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  itemTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600', marginTop: 5 },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 6 },
  catchUp: { backgroundColor: theme.colors.surfaceMuted, padding: 16, borderRadius: theme.radius.md },
  catchUpTitle: { color: theme.colors.navy, fontSize: 18, fontWeight: '600' },
  catchUpText: { color: theme.colors.muted, marginTop: 4 }
});
