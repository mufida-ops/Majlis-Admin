import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function SignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState(false);

  async function submit() {
    setError(null);
    if (!email || !password || (mode === 'sign_up' && !fullName)) {
      setError('Please fill in every field.');
      return;
    }
    setBusy(true);
    const err = mode === 'sign_in' ? await signIn(email, password) : await signUp(email, password, fullName);
    setBusy(false);
    if (err) {
      setError(err);
    } else if (mode === 'sign_up') {
      setJustSignedUp(true);
    } else {
      router.replace('/(tabs)/home');
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.brand}>The Majlis Academy</Text>
        <Text style={styles.title}>Media Studio</Text>
        <Text style={styles.subtitle}>
          {mode === 'sign_in' ? 'Sign in to your workspace' : 'Create your team account'}
        </Text>

        {justSignedUp ? (
          <Text style={styles.info}>
            Account created — check your email to confirm, then sign in. An admin may need to grant you a role
            before you can create or approve content.
          </Text>
        ) : (
          <>
            {mode === 'sign_up' && (
              <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.textSecondary}
                value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            )}
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textSecondary}
              value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.textSecondary}
              value={password} onChangeText={setPassword} secureTextEntry />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable style={styles.button} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#FFF" /> : (
                <Text style={styles.buttonText}>{mode === 'sign_in' ? 'Sign in' : 'Sign up'}</Text>
              )}
            </Pressable>
          </>
        )}

        <Pressable onPress={() => { setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in'); setJustSignedUp(false); setError(null); }}>
          <Text style={styles.switchText}>
            {mode === 'sign_in' ? "New to the team? Create an account" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 400, gap: spacing.sm },
  brand: { ...typography.caption, textAlign: 'center', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, fontWeight: '700' },
  title: { ...typography.h1, textAlign: 'center' },
  subtitle: { ...typography.caption, textAlign: 'center', marginBottom: spacing.lg },
  info: { ...typography.body, textAlign: 'center', backgroundColor: colors.surfaceMuted, padding: spacing.lg, borderRadius: radii.md },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.sm
  },
  button: {
    backgroundColor: colors.navy, borderRadius: radii.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.xs
  },
  buttonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.xs },
  switchText: { textAlign: 'center', color: colors.info, marginTop: spacing.lg, fontSize: 13, fontWeight: '600' }
});
