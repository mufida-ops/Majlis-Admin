import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

export function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', backgroundColor: theme.colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  text: { color: theme.colors.navy, fontSize: 12, fontWeight: '600' }
});
