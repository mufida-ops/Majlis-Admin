import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const { session, signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Redirect href="/" />;

  const submit = async () => {
    setError('');
    setInfo('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    const result =
      mode === 'sign-in' ? await signInWithPassword(email.trim(), password) : await signUpWithPassword(email.trim(), password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (mode === 'sign-up') {
      setInfo('Account created. Check your email to confirm it, then sign in below.');
      setMode('sign-in');
    }
  };

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Text style={styles.eyebrow}>Majlis</Text>
        <Text style={styles.title}>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</Text>
        <Text style={styles.sub}>A shared, quiet workspace for Mufida and Victoria.</Text>
      </View>

      <Card>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@majlis.com"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="••••••••"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
        <Pressable style={styles.primary} onPress={submit} disabled={submitting}>
          <Text style={styles.primaryText}>{submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError('');
            setInfo('');
          }}
        >
          <Text style={styles.switchText}>
            {mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </Card>

      {!supabase ? (
        <Card style={{ borderColor: theme.colors.danger }}>
          <Text style={styles.warnTitle}>Supabase is not configured</Text>
          <Text style={styles.warnText}>
            Copy .env.example to .env, add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart Expo.
          </Text>
        </Card>
      ) : null}

      <Text style={styles.footnote}>
        The first two people to sign in share this workspace automatically — no invite code needed.
      </Text>
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
  info: { color: theme.colors.success, marginTop: 14 },
  primary: { backgroundColor: theme.colors.navy, padding: 14, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 18 },
  primaryText: { color: '#fff', fontWeight: '600' },
  switchText: { color: theme.colors.navy, textAlign: 'center', marginTop: 16, fontSize: 13, fontWeight: '600' },
  warnTitle: { color: theme.colors.danger, fontWeight: '700' },
  warnText: { color: theme.colors.muted, marginTop: 6, lineHeight: 20 },
  footnote: { color: theme.colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 }
});
