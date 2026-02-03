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
  urlRef?: string;
  keyRef?: string;
  keyRole?: string;
};

export type SupabasePublicDebugInfo = {
  hasConfig: boolean;
  url: string;
  urlRef?: string;
  keySource: SupabaseConfig['keySource'];
  anonKeyPrefix: string;
  anonKeyLen: number;
  keyRef?: string;
  keyRole?: string;
  reason?: string;
};

function normalizeSupabaseUrl(input: string): string {
  const v = input.trim();
  if (!v) return '';
  const cleaned = v.replace(/\s+/g, '');
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) return cleaned;
  if (cleaned.includes('.')) return `https://${cleaned}`;
  return `https://${cleaned}.supabase.co`;
}

function getUrlRef(url: string): string | undefined {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const parts = host.split('.');
    if (parts.length >= 3 && host.endsWith('.supabase.co')) return parts[0];
    if (parts.length >= 2 && host.endsWith('.supabase.co')) return parts[0];
    return parts[0];
  } catch {
    return undefined;
  }
}

type JwtPayloadLike = {
  ref?: string;
  role?: string;
};

function decodeJwtPayload(token: string): JwtPayloadLike | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const raw = parts[1];
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLen);

    const atobFn = typeof globalThis.atob === 'function' ? globalThis.atob : undefined;
    if (!atobFn) return null;

    const json = atobFn(padded);
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const p = parsed as JwtPayloadLike;
    return {
      ref: typeof p.ref === 'string' ? p.ref : undefined,
      role: typeof p.role === 'string' ? p.role : undefined,
    };
  } catch {
    return null;
  }
}

function getSupabaseConfig(): SupabaseConfig {
  const url = normalizeSupabaseUrl(rawSupabaseUrl);

  const anonKey = rawSupabaseAnonKey.trim();
  const keySource: SupabaseConfig['keySource'] = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ? 'EXPO_PUBLIC_SUPABASE_ANON_KEY'
    : process.env.EXPO_PUBLIC_SUPABASE_URL_KEY
      ? 'EXPO_PUBLIC_SUPABASE_URL_KEY'
      : 'missing';

  const urlRef = url ? getUrlRef(url) : undefined;
  const payload = anonKey ? decodeJwtPayload(anonKey) : null;
  const keyRef = payload?.ref;
  const keyRole = payload?.role;

  if (!url) return { url: '', anonKey: '', isValid: false, reason: 'Missing URL', keySource, urlRef, keyRef, keyRole };
  if (!anonKey) return { url, anonKey: '', isValid: false, reason: 'Missing anon key', keySource, urlRef, keyRef, keyRole };

  const looksLikeJwt = anonKey.startsWith('eyJ') && anonKey.length > 50;
  if (!looksLikeJwt) {
    return {
      url,
      anonKey,
      isValid: false,
      reason: 'Anon key does not look like a Supabase JWT (should start with "eyJ")',
      keySource,
      urlRef,
      keyRef,
      keyRole,
    };
  }

  if (urlRef && keyRef && urlRef !== keyRef) {
    return {
      url,
      anonKey,
      isValid: false,
      reason: `Supabase URL project ref ("${urlRef}") does not match anon key ref ("${keyRef}")`,
      keySource,
      urlRef,
      keyRef,
      keyRole,
    };
  }

  return { url, anonKey, isValid: true, keySource, urlRef, keyRef, keyRole };
}

const supabaseConfig = getSupabaseConfig();

export const hasSupabaseConfig = supabaseConfig.isValid;

export const supabasePublicDebugInfo: SupabasePublicDebugInfo = {
  hasConfig: hasSupabaseConfig,
  url: supabaseConfig.url,
  urlRef: supabaseConfig.urlRef,
  keySource: supabaseConfig.keySource,
  anonKeyPrefix: supabaseConfig.anonKey ? supabaseConfig.anonKey.slice(0, 8) : '',
  anonKeyLen: supabaseConfig.anonKey.length,
  keyRef: supabaseConfig.keyRef,
  keyRole: supabaseConfig.keyRole,
  reason: supabaseConfig.reason,
};

console.log('[supabase] init', {
  hasSupabaseConfig,
  url: supabaseConfig.url ? `${supabaseConfig.url.slice(0, 28)}...` : '(missing)',
  urlRef: supabaseConfig.urlRef,
  anonKey: supabaseConfig.anonKey ? `${supabaseConfig.anonKey.slice(0, 8)}...` : '(missing)',
  keySource: supabaseConfig.keySource,
  keyRef: supabaseConfig.keyRef,
  keyRole: supabaseConfig.keyRole,
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
