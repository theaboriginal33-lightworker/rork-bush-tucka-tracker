import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

export type ShareLinkOptions = {
  path: string;
  queryParams?: Record<string, string | number | boolean | null | undefined>;
};

function normalizePath(path: string): string {
  const trimmed = String(path ?? '').trim();
  if (trimmed.length === 0) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function getWebOrigin(): string | null {
  try {
    const w = typeof window !== 'undefined' ? window : undefined;
    const origin = w?.location?.origin;
    if (typeof origin === 'string' && origin.length > 0) return origin;
    return null;
  } catch {
    return null;
  }
}

export function buildShareUrl({ path, queryParams }: ShareLinkOptions): string {
  const normalizedPath = normalizePath(path);

  const cleanedParams: Record<string, string> = {};
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value === null || value === undefined) continue;
      cleanedParams[key] = String(value);
    }
  }

  try {
    if (Platform.OS === 'web') {
      const origin = getWebOrigin();
      if (origin) {
        const url = new URL(origin);
        url.pathname = normalizedPath;
        for (const [k, v] of Object.entries(cleanedParams)) {
          url.searchParams.set(k, v);
        }
        const out = url.toString();
        console.log('[ShareLinks] buildShareUrl(web)', { normalizedPath, out });
        return out;
      }
    }

    const out = Linking.createURL(normalizedPath, Object.keys(cleanedParams).length > 0 ? { queryParams: cleanedParams } : undefined);
    console.log('[ShareLinks] buildShareUrl(native)', { normalizedPath, out });
    return out;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[ShareLinks] buildShareUrl failed', { normalizedPath, message });
    return normalizedPath;
  }
}
