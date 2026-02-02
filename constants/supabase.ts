import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = https://vynorjorxebyvuyxnntd.supabase.co;
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
console.log("SUPABASE_URL:", process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log("SUPABASE_ANON:", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10));

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

if (!hasSupabaseConfig) {
  console.log('[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}
