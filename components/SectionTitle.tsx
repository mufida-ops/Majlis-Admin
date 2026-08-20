import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '600', color: theme.colors.text },
  subtitle: { fontSize: 14, color: theme.colors.muted, lineHeight: 20 }
});
