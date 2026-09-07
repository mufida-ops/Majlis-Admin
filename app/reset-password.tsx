import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Supabase's "forgot password" email links here with the recovery tokens in
// the URL's hash fragment (never the query string) — parse them out and
// establish a session manually, since the client is configured with
// detectSessionInUrl: false everywhere else in the app.
function parseHashParams(): URLSearchParams | null {
  if (typeof window === 'undefined' || !window.location.hash) return null;
  return new URLSearchParams(window.location.hash.slice(1));
}

export default function ResetPasswordScreen() {
  const { session, updatePassword } = useAuth();
  const [status, setStatus] = useState<'checking' | 'ready' | 'link-error'>('checking');
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (session) {
      setStatus('ready');
      return;
    }
    if (!supabase) {
      setStatus('link-error');
      setLinkError('Supabase is not configured.');
      return;
    }
    const params = parseHashParams();
    const errorDescription = params?.get('error_description');
    if (errorDescription) {
      setStatus('link-error');
      setLinkError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
      return;
    }
    const accessToken = params?.get('access_token');
    const refreshToken = params?.get('refresh_token');
    if (!accessToken || !refreshToken) {
      setStatus('link-error');
      setLinkError('This reset link is missing or already used. Ask for a new one from the sign-in screen.');
      return;
    }
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error: sessionError }) => {
      if (sessionError) {
        setStatus('link-error');
        setLinkError(sessionError.message);
      } else {
        setStatus('ready');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setError('');
    if (password.length < 6) {
      setError('Use at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Those two passwords don't match.");
      return;
    }
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  };

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Text style={styles.eyebrow}>Majlis</Text>
        <Text style={styles.title}>Set a new password</Text>
      </View>

      <Card>
        {status === 'checking' ? (
          <Text style={styles.sub}>Checking your link…</Text>
        ) : status === 'link-error' ? (
          <>
            <Text style={styles.sub}>{linkError}</Text>
            <Pressable style={styles.primary} onPress={() => router.replace('/(auth)/sign-in')}>
              <Text style={styles.primaryText}>Back to sign in</Text>
            </Pressable>
          </>
        ) : done ? (
          <>
            <Text style={styles.sub}>Your password has been updated.</Text>
            <Pressable style={styles.primary} onPress={() => router.replace('/')}>
              <Text style={styles.primaryText}>Continue</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>New password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="••••••••"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
            <Text style={[styles.label, { marginTop: 16 }]}>Confirm new password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="••••••••"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.primary} onPress={submit} disabled={submitting}>
              <Text style={styles.primaryText}>{submitting ? 'Saving…' : 'Save new password'}</Text>
            </Pressable>
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: theme.colors.gold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: '600' },
  sub: { color: theme.colors.muted, fontSize: 15, lineHeight: 21 },
  label: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  input: {
    marginTop: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  error: { color: theme.colors.danger, marginTop: 14 },
  primary: { backgroundColor: theme.colors.navy, padding: 14, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 18 },
  primaryText: { color: '#fff', fontWeight: '600' }
});
