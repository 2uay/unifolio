import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If env vars are missing, create a no-op stub so the app loads in demo mode
const isConfigured = url && key;

export const supabase = isConfigured
  ? createClient(url, key)
  : {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp: async () => ({ data: null, error: { message: 'Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local' } }),
        signInWithPassword: async () => ({ data: null, error: { message: 'Supabase not configured.' } }),
        exchangeCodeForSession: async () => ({ data: null, error: { message: 'Supabase not configured.' } }),
        verifyOtp: async () => ({ data: null, error: { message: 'Supabase not configured.' } }),
        signOut: async () => {},
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        upsert: async () => ({ error: null }),
      }),
      storage: {
        from: () => ({
          upload: async () => ({ error: { message: 'Storage not configured' } }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
          remove: async () => {},
        }),
      },
    };

export const supabaseConfigured = isConfigured;
