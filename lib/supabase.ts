import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Guarded access to the `localStorage` global instead of passing it
// directly — Supabase's client reads it synchronously as soon as it's
// constructed (to try restoring a cached session), and the web build's
// static export constructs this module while prerendering routes in Node,
// where `localStorage` doesn't exist at all. Node.js falls back to a no-op
// so that render step succeeds; a real browser always has `localStorage`.
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
