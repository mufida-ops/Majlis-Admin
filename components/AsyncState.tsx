import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';
import { Card } from '@/components/Card';

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.colors.navy} />
      {label ? <Text style={styles.muted}>{label}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ borderColor: theme.colors.danger }}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.muted}>{message}</Text>
      {onRetry ? (
        <Text onPress={onRetry} style={styles.retry}>
          Try again
        </Text>
      ) : null}
    </Card>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <Card>
      <Text style={styles.muted}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  muted: { color: theme.colors.muted, lineHeight: 20 },
  errorTitle: { color: theme.colors.danger, fontWeight: '700' },
  retry: { color: theme.colors.navy, fontWeight: '600', marginTop: 10 }
});
