import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

const FALLBACK_WEB_ORIGIN = 'https://bush-tucka-tracka.rork.app';

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
    if (typeof origin === 'string' && origin.length > 0) {
      const lower = origin.toLowerCase();
      if (lower.includes('localhost') || lower.includes('127.0.0.1')) {
        return null;
      }
      return origin;
    }
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
    const webOrigin = getWebOrigin() ?? FALLBACK_WEB_ORIGIN;

    const url = new URL(webOrigin);
    url.pathname = normalizedPath;
    for (const [k, v] of Object.entries(cleanedParams)) {
      url.searchParams.set(k, v);
    }

    const out = url.toString();
    console.log('[ShareLinks] buildShareUrl(https)', { normalizedPath, out, webOrigin, platform: Platform.OS });
    return out;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[ShareLinks] buildShareUrl failed', { normalizedPath, message });

    try {
      const out = Linking.createURL(
        normalizedPath,
        Object.keys(cleanedParams).length > 0 ? { queryParams: cleanedParams } : undefined,
      );
      console.log('[ShareLinks] buildShareUrl fallback deep link', { normalizedPath, out, platform: Platform.OS });
      return out;
    } catch (e2) {
      const message2 = e2 instanceof Error ? e2.message : String(e2);
      console.log('[ShareLinks] buildShareUrl deep link failed', { normalizedPath, message2 });
      return normalizedPath;
    }
  }
}
