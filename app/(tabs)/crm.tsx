import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { Pill } from '@/components/Pill';
import { crmAccounts } from '@/data/mock';
import { theme } from '@/constants/theme';

export default function CrmScreen() {
  return (
    <Screen>
      <SectionTitle title="CRM" subtitle="Who are we talking to, what happened last, and what needs to happen next?" />
      {crmAccounts.map(account => (
        <Card key={account.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{account.organisation}</Text>
              <Text style={styles.meta}>{account.stage}{account.contact ? ` · ${account.contact}` : ''}</Text>
            </View>
            <Pill label={account.owner} />
          </View>
          <Text style={styles.next}>Next: {account.nextAction}</Text>
          <Text style={styles.last}>Last contact: {account.lastContact}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '600' },
  meta: { color: theme.colors.muted, marginTop: 4 },
  next: { color: theme.colors.text, marginTop: 14, lineHeight: 21 },
  last: { color: theme.colors.muted, marginTop: 5, fontSize: 13 }
});
