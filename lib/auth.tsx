import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

// GitHub Pages serves this app from a sub-path, not the domain root, so the
// reset-password link Supabase emails has to spell that out — and it must
// exactly match an entry in the project's Authentication > URL Configuration
// > Redirect URLs allow-list, or Supabase silently ignores it.
const PASSWORD_RESET_REDIRECT_URL = 'https://mufida-ops.github.io/Majlis-Admin/reset-password';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      signInWithPassword: async (email, password) => {
        if (!supabase) return { error: 'Supabase is not configured.' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message };
      },
      signUpWithPassword: async (email, password) => {
        if (!supabase) return { error: 'Supabase is not configured.' };
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error?.message };
      },
      sendPasswordReset: async email => {
        if (!supabase) return { error: 'Supabase is not configured.' };
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: PASSWORD_RESET_REDIRECT_URL });
        return { error: error?.message };
      },
      updatePassword: async password => {
        if (!supabase) return { error: 'Supabase is not configured.' };
        const { error } = await supabase.auth.updateUser({ password });
        return { error: error?.message };
      },
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      }
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
