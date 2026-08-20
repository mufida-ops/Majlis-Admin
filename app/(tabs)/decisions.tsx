import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { decisions as seed } from '@/data/mock';
import { theme } from '@/constants/theme';

export default function DecisionsScreen() {
  const [items, setItems] = useState(seed);
  const update = (id: string, status: 'Agreed' | 'Discuss') => {
    setItems(prev => prev.map(d => d.id === id ? { ...d, status } : d));
  };

  return (
    <Screen>
      <SectionTitle title="Decisions" subtitle="A durable record of what you actually agreed." />
      {items.map(item => (
        <Card key={item.id}>
          <Text style={styles.meta}>{item.date} · {item.project}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.status}>{item.status}</Text>
          {item.status === 'Waiting' ? (
            <View style={styles.actions}>
              <Pressable style={styles.primary} onPress={() => update(item.id, 'Agreed')}><Text style={styles.primaryText}>Agree</Text></Pressable>
              <Pressable style={styles.secondary} onPress={() => update(item.id, 'Discuss')}><Text style={styles.secondaryText}>Discuss</Text></Pressable>
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { color: theme.colors.muted, fontSize: 13 },
  title: { color: theme.colors.text, fontSize: 17, fontWeight: '600', marginTop: 7, lineHeight: 23 },
  status: { color: theme.colors.gold, fontWeight: '700', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primary: { backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, paddingHorizontal: 16, paddingVertical: 10 },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.sm, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryText: { color: theme.colors.text, fontWeight: '600' }
});
