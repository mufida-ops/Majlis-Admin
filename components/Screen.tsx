import { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '@/constants/theme';

export function Screen({ children, contentStyle }: PropsWithChildren<{ contentStyle?: ViewStyle }>) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.content, contentStyle]}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, gap: 18, paddingBottom: 100 }
});
