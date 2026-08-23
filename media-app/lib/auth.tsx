import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AppRole, Profile } from '@/types/db';

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);

  async function loadProfile(userId: string) {
    if (!supabase) return;
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId)
    ]);
    setProfile(p ?? null);
    setRoles((r ?? []).map((row) => row.role as AppRole));
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    session,
    profile,
    roles,
    hasRole: (role) => roles.includes(role),
    isAdmin: roles.includes('admin'),
    refreshProfile: async () => {
      if (session) await loadProfile(session.user.id);
    },
    signIn: async (email, password) => {
      if (!supabase) return 'Supabase is not configured.';
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error?.message ?? null;
    },
    signUp: async (email, password, fullName) => {
      if (!supabase) return 'Supabase is not configured.';
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });
      return error?.message ?? null;
    },
    signOut: async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
    }
  }), [loading, session, profile, roles]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
