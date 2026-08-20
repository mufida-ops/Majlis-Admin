import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';
import { FloralFlourish } from '@/components/FloralFlourish';

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.row}>
      <View style={{ gap: 4, flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <FloralFlourish width={40} height={28} style={styles.flourish} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 19, fontWeight: '600', color: theme.colors.text },
  subtitle: { fontSize: 14, color: theme.colors.muted, lineHeight: 20 },
  flourish: { marginTop: -4 }
});
