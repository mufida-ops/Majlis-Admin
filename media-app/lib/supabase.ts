import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Guarded access to `localStorage` — Supabase's client reads it synchronously
// on construction, and the web static export evaluates this module in Node
// while prerendering, where `localStorage` doesn't exist. Node falls back to
// a no-op; a real browser always has it.
const hasLocalStorage = typeof localStorage !== 'undefined';
const deferredStorage = {
  getItem: (k: string) => (hasLocalStorage ? localStorage.getItem(k) : null),
  setItem: (k: string, v: string) => {
    if (hasLocalStorage) localStorage.setItem(k, v);
  },
  removeItem: (k: string) => {
    if (hasLocalStorage) localStorage.removeItem(k);
  }
};

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        storage: deferredStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;

export const isSupabaseConfigured = !!supabase;
