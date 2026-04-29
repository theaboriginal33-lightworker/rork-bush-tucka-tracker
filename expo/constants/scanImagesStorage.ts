import { Platform } from 'react-native';
import { supabase } from '@/constants/supabase';

/** Must match your Supabase Storage bucket id (usually lowercase). */
export const SCAN_IMAGES_BUCKET = 'scan-images';

type LegacyFileSystemModule = typeof import('expo-file-system/legacy');

let legacyFsPromise: Promise<LegacyFileSystemModule | null> | null = null;

async function getLegacyFileSystem(): Promise<LegacyFileSystemModule | null> {
  if (Platform.OS === 'web') return null;
  try {
    if (!legacyFsPromise) {
      legacyFsPromise = import('expo-file-system/legacy')
        .then((m) => m as LegacyFileSystemModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[scanImagesStorage] expo-file-system load failed', { message });
          return null;
        });
    }
    return await legacyFsPromise;
  } catch {
    return null;
  }
}

/** Hermes / RN: `new Blob([Uint8Array])` throws — use ArrayBuffer for uploads instead. */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  if (typeof atob !== 'function') throw new Error('atob not available');
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function bodyByteLength(body: Blob | ArrayBuffer): number {
  return body instanceof Blob ? body.size : body.byteLength;
}

/** Web: Blob (supported). Native: raw ArrayBuffer for supabase.upload. */
function bytesFromBase64(b64: string, mimeType: string): Blob | ArrayBuffer {
  if (Platform.OS === 'web') {
    const ab = base64ToArrayBuffer(b64);
    return new Blob([ab], { type: mimeType });
  }
  return base64ToArrayBuffer(b64);
}

function extFromMime(mime: string | undefined): 'jpg' | 'png' | 'webp' {
  const m = (mime ?? 'image/jpeg').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  return 'jpg';
}

function contentTypeForExt(ext: 'jpg' | 'png' | 'webp'): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function dataUriToUploadBody(dataUri: string): Blob | ArrayBuffer {
  const m = dataUri.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!m) throw new Error('Invalid data URI for upload');
  const mime = m[1];
  const b64 = m[2];
  return bytesFromBase64(b64, mime);
}

function uriScheme(uri: string): string {
  return uri.trim().split(':')[0]?.toLowerCase() ?? '';
}

/** iOS camera roll / screenshots (ph://) and Android content:// — fetch() returns an empty blob. */
function needsNativeAssetBridge(uri: string): boolean {
  if (Platform.OS === 'web') return false;
  const s = uriScheme(uri);
  return s === 'ph' || s === 'assets-library' || s === 'content';
}

type ResolvedUpload = {
  data: Blob | ArrayBuffer;
  /** Body is JPEG (e.g. expo-image-manipulator) — storage path should use .jpg */
  forceJpegPath?: boolean;
};

async function readFileUriAsUploadBody(uri: string, mimeType: string): Promise<ResolvedUpload | null> {
  const fs = await getLegacyFileSystem();
  if (!fs) return null;
  try {
    const b64 = await fs.readAsStringAsync(uri, { encoding: fs.EncodingType.Base64 });
    if (!b64 || b64.length === 0) return null;
    const data = bytesFromBase64(b64, mimeType);
    if (bodyByteLength(data) === 0) return null;
    return { data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[scanImagesStorage] readFileUriAsUploadBody failed', { message });
    return null;
  }
}

async function uploadBodyViaCopyToCache(uri: string, mimeType: string): Promise<ResolvedUpload | null> {
  const fs = await getLegacyFileSystem();
  if (!fs) return null;
  const base = fs.cacheDirectory ?? fs.documentDirectory;
  if (!base) return null;
  const dir = base.endsWith('/') ? base : `${base}/`;
  const dest = `${dir}scan_supabase_upload_${Date.now()}.img`;
  try {
    await fs.copyAsync({ from: uri, to: dest });
    const b64 = await fs.readAsStringAsync(dest, { encoding: fs.EncodingType.Base64 });
    await fs.deleteAsync(dest, { idempotent: true }).catch(() => undefined);
    if (!b64 || b64.length === 0) return null;
    const data = bytesFromBase64(b64, mimeType);
    if (bodyByteLength(data) === 0) return null;
    return { data };
  } catch (e) {
    await fs.deleteAsync(dest, { idempotent: true }).catch(() => undefined);
    const message = e instanceof Error ? e.message : String(e);
    console.log('[scanImagesStorage] copy-to-cache failed', { message, scheme: uriScheme(uri) });
    return null;
  }
}

/** Normalize to JPEG via manipulator (handles HEIC screenshots, stubborn ph://, etc.). */
async function uploadBodyViaManipulatorJpeg(uri: string): Promise<ResolvedUpload | null> {
  try {
    const IM = await import('expo-image-manipulator');
    const result = await IM.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.85, format: IM.SaveFormat.JPEG }
    );
    const inner = await readFileUriAsUploadBody(result.uri, 'image/jpeg');
    if (!inner) return null;
    return { data: inner.data, forceJpegPath: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[scanImagesStorage] manipulator JPEG fallback failed', { message });
    return null;
  }
}

async function resolveNativeLibraryOrContentUri(uri: string, contentType: string): Promise<ResolvedUpload | null> {
  const fromCopy = await uploadBodyViaCopyToCache(uri, contentType);
  if (fromCopy) return fromCopy;
  return uploadBodyViaManipulatorJpeg(uri);
}

/**
 * React Native: fetch(file://...) often returns status 200 and an empty blob.
 * ph:// / content:// need FileSystem or manipulator.
 * RN Hermes: do not build Blob from Uint8Array — use ArrayBuffer for uploads.
 */
async function resolveUploadBody(localUri: string, contentType: string): Promise<ResolvedUpload | null> {
  const uri = localUri.trim();

  if (uri.startsWith('data:')) {
    try {
      const data = dataUriToUploadBody(uri);
      if (bodyByteLength(data) === 0) {
        console.log('[scanImagesStorage] data URI decoded to empty body');
        return null;
      }
      return { data };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[scanImagesStorage] data URI failed', { message });
      return null;
    }
  }

  if (needsNativeAssetBridge(uri)) {
    const resolved = await resolveNativeLibraryOrContentUri(uri, contentType);
    if (resolved && bodyByteLength(resolved.data) > 0) return resolved;
    console.log('[scanImagesStorage] native asset bridge failed', { scheme: uriScheme(uri) });
    return null;
  }

  if (Platform.OS !== 'web' && /^file:\/\//i.test(uri)) {
    const a = await readFileUriAsUploadBody(uri, contentType);
    if (a) return a;
    const b = await uploadBodyViaCopyToCache(uri, contentType);
    if (b) return b;
    const c = await uploadBodyViaManipulatorJpeg(uri);
    if (c) return c;
    console.log('[scanImagesStorage] file URI read failed after fallbacks');
    return null;
  }

  try {
    const res = await fetch(uri);
    if (!res.ok) {
      console.log('[scanImagesStorage] fetch localUri failed', { status: res.status });
      return null;
    }
    if (Platform.OS !== 'web') {
      const ab = await res.arrayBuffer();
      if (ab.byteLength === 0) {
        console.log('[scanImagesStorage] fetch arrayBuffer empty', { scheme: uriScheme(uri) });
        return null;
      }
      return { data: ab };
    }
    const blob = await res.blob();
    if (blob.size === 0) {
      console.log('[scanImagesStorage] fetch blob empty', { scheme: uriScheme(uri) });
      return null;
    }
    return { data: blob };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[scanImagesStorage] fetch error', { message });
    return null;
  }
}

export function buildScanImageStoragePath(userId: string, entryId: string, ext: 'jpg' | 'png' | 'webp'): string {
  const safeId = entryId.replace(/[^a-z0-9-_]+/gi, '-');
  return `${userId}/${safeId}.${ext}`;
}

/**
 * Upload scan image to private bucket path: `{userId}/{entryId}.ext`
 * RLS should require first folder segment === auth.uid().
 */
export async function uploadScanJournalImage(params: {
  userId: string;
  entryId: string;
  localUri: string;
  mimeType?: string;
}): Promise<{ path: string } | null> {
  const ext = extFromMime(params.mimeType);
  let path = buildScanImageStoragePath(params.userId, params.entryId, ext);
  let contentType = contentTypeForExt(ext);

  const resolved = await resolveUploadBody(params.localUri, contentType);
  if (!resolved || bodyByteLength(resolved.data) === 0) {
    console.log('[scanImagesStorage] no upload body; skip upload');
    return null;
  }

  let body: Blob | ArrayBuffer = resolved.data;
  if (resolved.forceJpegPath || (body instanceof Blob && body.type === 'image/jpeg' && ext !== 'jpg')) {
    contentType = 'image/jpeg';
    path = buildScanImageStoragePath(params.userId, params.entryId, 'jpg');
  }

  const { error } = await supabase.storage.from(SCAN_IMAGES_BUCKET).upload(path, body, {
    contentType,
    upsert: true,
  });

  if (error) {
    console.log('[scanImagesStorage] upload error', error);
    return null;
  }

  return { path };
}

export async function getSignedScanImageUrl(
  storagePath: string,
  expiresInSec = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(SCAN_IMAGES_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error || !data?.signedUrl) {
    console.log('[scanImagesStorage] signed URL error', error);
    return null;
  }
  return data.signedUrl;
}

export async function deleteScanJournalImage(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(SCAN_IMAGES_BUCKET).remove([storagePath]);
  if (error) {
    console.log('[scanImagesStorage] delete error', error);
  }
}

type StorageListItem = {
  name: string;
  metadata: Record<string, unknown> | null;
};

/**
 * Remove every object under `scan-images/{userId}/` (matches RLS prefix).
 * Lists recursively for subfolders; removes in batches of 100.
 */
export async function deleteAllUserScanImages(userId: string): Promise<void> {
  const uid = userId.trim();
  if (!uid) return;

  async function collectFilePaths(prefix: string): Promise<string[]> {
    const paths: string[] = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase.storage.from(SCAN_IMAGES_BUCKET).list(prefix, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });

      if (error) {
        console.log('[scanImagesStorage] deleteAll list failed', { prefix, message: error.message });
        return paths;
      }

      const items = (data ?? []) as StorageListItem[];
      if (items.length === 0) break;

      for (const item of items) {
        const child = `${prefix}/${item.name}`;
        const isFile = item.metadata !== null && typeof item.metadata === 'object';
        if (isFile) {
          paths.push(child);
          continue;
        }
        const nested = await collectFilePaths(child);
        if (nested.length > 0) {
          paths.push(...nested);
        } else if (/\.(jpe?g|png|webp|heic|gif)$/i.test(item.name)) {
          paths.push(child);
        }
      }

      if (items.length < limit) break;
      offset += limit;
    }

    return paths;
  }

  const allPaths = await collectFilePaths(uid);
  if (allPaths.length === 0) {
    console.log('[scanImagesStorage] deleteAll: no objects under user prefix', { uid: uid.slice(0, 8) });
    return;
  }

  const chunkSize = 100;
  for (let i = 0; i < allPaths.length; i += chunkSize) {
    const chunk = allPaths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(SCAN_IMAGES_BUCKET).remove(chunk);
    if (error) {
      console.log('[scanImagesStorage] deleteAll batch failed', { message: error.message, count: chunk.length });
    }
  }
  console.log('[scanImagesStorage] deleteAll user scan images done', { count: allPaths.length });
}
