import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

console.log('[supabase] init', {
  hasSupabaseConfig,
  url: supabaseUrl ? `${supabaseUrl.slice(0, 20)}...` : '(missing)',
  anonKey: supabaseAnonKey ? `${supabaseAnonKey.slice(0, 8)}...` : '(missing)',
});

export const supabase: SupabaseClient = createClient(
  hasSupabaseConfig ? supabaseUrl : 'https://invalid.local',
  hasSupabaseConfig ? supabaseAnonKey : 'invalid',
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

if (!hasSupabaseConfig) {
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Supabase calls will fail until configured.'
  );
}
