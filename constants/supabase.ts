import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const rawSupabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_URL_KEY ??
  '';

type SupabaseConfig = {
  url: string;
  anonKey: string;
  isValid: boolean;
  reason?: string;
  keySource?: 'EXPO_PUBLIC_SUPABASE_ANON_KEY' | 'EXPO_PUBLIC_SUPABASE_URL_KEY' | 'missing';
};

export type SupabasePublicDebugInfo = {
  hasConfig: boolean;
  url: string;
  keySource: SupabaseConfig['keySource'];
  anonKeyPrefix: string;
  anonKeyLen: number;
  reason?: string;
};

function normalizeSupabaseUrl(input: string): string {
  const v = input.trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.includes('.')) return `https://${v}`;
  return `https://${v}.supabase.co`;
}

function getSupabaseConfig(): SupabaseConfig {
  const url = normalizeSupabaseUrl(rawSupabaseUrl);

  const anonKey = rawSupabaseAnonKey.trim();
  const keySource: SupabaseConfig['keySource'] = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ? 'EXPO_PUBLIC_SUPABASE_ANON_KEY'
    : process.env.EXPO_PUBLIC_SUPABASE_URL_KEY
      ? 'EXPO_PUBLIC_SUPABASE_URL_KEY'
      : 'missing';

  if (!url) return { url: '', anonKey: '', isValid: false, reason: 'Missing URL', keySource };
  if (!anonKey) return { url, anonKey: '', isValid: false, reason: 'Missing anon key', keySource };

  const looksLikeJwt = anonKey.startsWith('eyJ') && anonKey.length > 50;
  if (!looksLikeJwt) {
    return {
      url,
      anonKey,
      isValid: false,
      reason: 'Anon key does not look like a Supabase JWT (should start with "eyJ")',
      keySource,
    };
  }

  return { url, anonKey, isValid: true, keySource };
}

const supabaseConfig = getSupabaseConfig();

export const hasSupabaseConfig = supabaseConfig.isValid;

export const supabasePublicDebugInfo: SupabasePublicDebugInfo = {
  hasConfig: hasSupabaseConfig,
  url: supabaseConfig.url,
  keySource: supabaseConfig.keySource,
  anonKeyPrefix: supabaseConfig.anonKey ? supabaseConfig.anonKey.slice(0, 8) : '',
  anonKeyLen: supabaseConfig.anonKey.length,
  reason: supabaseConfig.reason,
};

console.log('[supabase] init', {
  hasSupabaseConfig,
  url: supabaseConfig.url ? `${supabaseConfig.url.slice(0, 28)}...` : '(missing)',
  anonKey: supabaseConfig.anonKey ? `${supabaseConfig.anonKey.slice(0, 8)}...` : '(missing)',
  keySource: supabaseConfig.keySource,
  reason: supabaseConfig.reason,
});

export const supabase: SupabaseClient = createClient(
  supabaseConfig.url || 'https://invalid.local',
  supabaseConfig.anonKey || 'invalid',
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
  console.warn('[supabase] Supabase config invalid', {
    reason: supabaseConfig.reason,
    urlProvided: Boolean(rawSupabaseUrl.trim()),
    anonKeyProvided: Boolean(rawSupabaseAnonKey.trim()),
    keySource: supabaseConfig.keySource,
  });
}
