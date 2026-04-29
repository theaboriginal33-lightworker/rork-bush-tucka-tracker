import { useEffect, useState } from 'react';
import { hasSupabaseConfig } from '@/constants/supabase';
import { getSignedScanImageUrl } from '@/constants/scanImagesStorage';

/** Signed URLs for in-app thumbnails (Supabase allows long-lived signed URLs for private buckets). */
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7;

function safeLocalImageUri(uri: string | undefined): string | null {
  const raw0 = typeof uri === 'string' ? uri.trim() : '';
  if (raw0.length === 0 || raw0 === 'null' || raw0 === 'undefined') return null;

  let raw = raw0;
  const scheme = raw.split(':')[0] ?? '';

  if (scheme === 'ph' || scheme === 'assets-library') return null;

  if (raw.startsWith('/')) {
    raw = `file://${raw}`;
  }

  if (raw.startsWith('file:/') && !raw.startsWith('file://')) {
    raw = `file:///${raw.replace(/^file:\/*/i, '')}`;
  }

  if (raw.includes(' ')) {
    raw = raw.replace(/ /g, '%20');
  }

  try {
    return encodeURI(raw);
  } catch {
    return raw;
  }
}

function schemeOf(uri: string): string {
  return uri.split(':')[0]?.toLowerCase() ?? '';
}

/**
 * Prefer portable local URIs (`data:`, `https:`). If `storagePath` is set and Supabase is configured,
 * ignore device-only `file:` / `content:` strings from synced payloads (they point at another
 * device's sandbox, so images would never load on this phone).
 */
export function useResolvedScanImageUri(opts: {
  storagePath?: string;
  imagePreviewUri?: string;
  imageUri?: string;
}): string | null {
  const storagePathTrimmed = opts.storagePath?.trim() ?? '';
  const useRemoteFile = Boolean(storagePathTrimmed && hasSupabaseConfig);

  const pickPortableLocal = (raw: string | null): string | null => {
    if (!raw) return null;
    const s = schemeOf(raw);
    if (useRemoteFile && (s === 'file' || s === 'content')) {
      return null;
    }
    return raw;
  };

  const local =
    pickPortableLocal(safeLocalImageUri(opts.imagePreviewUri)) ??
    pickPortableLocal(safeLocalImageUri(opts.imageUri));

  const [signed, setSigned] = useState<string | null>(null);

  useEffect(() => {
    if (local) {
      setSigned(null);
      return;
    }
    if (!storagePathTrimmed || !hasSupabaseConfig) {
      setSigned(null);
      return;
    }

    let cancelled = false;
    void getSignedScanImageUrl(storagePathTrimmed, SIGNED_URL_TTL_SEC).then((url) => {
      if (!cancelled && url) setSigned(url);
    });
    return () => {
      cancelled = true;
    };
  }, [local, storagePathTrimmed]);

  return local ?? signed ?? null;
}
