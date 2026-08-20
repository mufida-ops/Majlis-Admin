import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const { session, loading: authLoading } = useAuth();
  const { loading: workspaceLoading, error: workspaceError } = useWorkspace();

  if (!supabase) {
    return (
      <Screen>
        <Card style={{ borderColor: theme.colors.danger }}>
          <Text style={styles.warnTitle}>Supabase is not configured</Text>
          <Text style={styles.warnText}>
            Copy .env.example to .env, add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart
            Expo.
          </Text>
        </Card>
      </Screen>
    );
  }

  if (authLoading) {
    return <Loading />;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (workspaceLoading) {
    return <Loading label="Setting up your shared workspace…" />;
  }

  if (workspaceError) {
    return (
      <Screen>
        <Card style={{ borderColor: theme.colors.danger }}>
          <Text style={styles.warnTitle}>Couldn't load your workspace</Text>
          <Text style={styles.warnText}>{workspaceError}</Text>
        </Card>
      </Screen>
    );
  }

  return <Redirect href="/(tabs)/home" />;
}

function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.colors.navy} />
      {label ? <Text style={styles.loadingText}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: theme.colors.background },
  loadingText: { color: theme.colors.muted },
  warnTitle: { color: theme.colors.danger, fontWeight: '700' },
  warnText: { color: theme.colors.muted, marginTop: 6, lineHeight: 20 }
});
