import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Platform } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScanJournalEntry } from '@/app/providers/ScanJournalProvider';
import { useScanJournal } from '@/app/providers/ScanJournalProvider';

export type CookRecipeEntrySource = 'collection' | 'tucka-guide';

export type CookRecipeEntry = {
  id: string;
  createdAt: number;

  source: CookRecipeEntrySource;

  scanEntryId?: string;
  chatMessageId?: string;

  title: string;
  imageUri?: string;

  commonName: string;
  scientificName?: string;
  confidence: number;
  safetyStatus: 'safe' | 'caution' | 'unknown';

  suggestedUses: string[];

  guideText?: string;
};

export type CookbookImageInput = {
  uri: string;
  base64?: string;
  mimeType?: string;
};

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
          console.log('[Cookbook] failed to load expo-file-system/legacy', { message });
          return null;
        });
    }

    return await legacyFsPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Cookbook] getLegacyFileSystem unexpected error', { message });
    return null;
  }
}

const MANUAL_STORAGE_KEY = 'bush-tucka.cookbook.manual.v1';
const IMAGE_OVERRIDE_KEY = 'bush-tucka.cookbook.imageOverrides.v1';
const TITLE_OVERRIDE_KEY = 'bush-tucka.cookbook.titleOverrides.v1';

function normalizeCookEntryFromScan(scanEntry: ScanJournalEntry): CookRecipeEntry {
  const scan = scanEntry.scan;
  return {
    id: scanEntry.id,
    createdAt: scanEntry.createdAt,
    source: 'collection',
    scanEntryId: scanEntry.id,
    title: String(scanEntry.title ?? scan.commonName ?? 'Unconfirmed Plant'),
    imageUri: scanEntry.imagePreviewUri ?? scanEntry.imageUri,
    commonName: String(scan.commonName ?? 'Unconfirmed Plant'),
    scientificName: scan.scientificName ? String(scan.scientificName) : undefined,
    confidence: Number.isFinite(scan.confidence) ? Math.max(0, Math.min(1, Number(scan.confidence))) : 0,
    safetyStatus: scan.safety?.status ?? 'unknown',
    suggestedUses: Array.isArray(scan.suggestedUses) ? scan.suggestedUses.map((u) => String(u)).filter((u) => u.trim().length > 0).slice(0, 16) : [],
  };
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Cookbook] safeParseJson failed', { message });
    return null;
  }
}

function normalizeManualEntry(input: CookRecipeEntry): CookRecipeEntry {
  const sRaw = String((input as CookRecipeEntry).safetyStatus ?? 'unknown');
  const safetyStatus: CookRecipeEntry['safetyStatus'] = sRaw === 'safe' || sRaw === 'caution' || sRaw === 'unknown' ? sRaw : 'unknown';

  const sourceRaw = String((input as CookRecipeEntry).source ?? 'tucka-guide');
  const source: CookRecipeEntrySource = sourceRaw === 'collection' || sourceRaw === 'tucka-guide' ? sourceRaw : 'tucka-guide';

  return {
    id: String((input as CookRecipeEntry).id ?? `guide-${Math.random().toString(16).slice(2)}`),
    createdAt: Number.isFinite((input as CookRecipeEntry).createdAt) ? (input as CookRecipeEntry).createdAt : Date.now(),
    source,
    scanEntryId: (input as CookRecipeEntry).scanEntryId ? String((input as CookRecipeEntry).scanEntryId) : undefined,
    chatMessageId: (input as CookRecipeEntry).chatMessageId ? String((input as CookRecipeEntry).chatMessageId) : undefined,
    title: String((input as CookRecipeEntry).title ?? 'Saved guide'),
    imageUri: (input as CookRecipeEntry).imageUri ? String((input as CookRecipeEntry).imageUri) : undefined,
    commonName: String((input as CookRecipeEntry).commonName ?? 'Unconfirmed Plant'),
    scientificName: (input as CookRecipeEntry).scientificName ? String((input as CookRecipeEntry).scientificName) : undefined,
    confidence: Number.isFinite((input as CookRecipeEntry).confidence)
      ? Math.max(0, Math.min(1, Number((input as CookRecipeEntry).confidence)))
      : 0,
    safetyStatus,
    suggestedUses: Array.isArray((input as CookRecipeEntry).suggestedUses)
      ? (input as CookRecipeEntry).suggestedUses.map((u) => String(u)).filter((u) => u.trim().length > 0).slice(0, 24)
      : [],
    guideText: typeof (input as CookRecipeEntry).guideText === 'string' ? (input as CookRecipeEntry).guideText : undefined,
  };
}

type CookbookContextValue = {
  entries: CookRecipeEntry[];
  isLoading: boolean;
  errorMessage: string | null;

  getEntryById: (id: string) => CookRecipeEntry | undefined;
  getEntryByScanId: (scanEntryId: string) => CookRecipeEntry | undefined;

  saveGuideEntry: (input: {
    title: string;
    guideText: string;
    commonName?: string;
    scientificName?: string;
    imageUri?: string;
    confidence?: number;
    safetyStatus?: CookRecipeEntry['safetyStatus'];
    scanEntryId?: string;
    chatMessageId?: string;
    suggestedUses?: string[];
  }) => Promise<CookRecipeEntry>;

  setEntryImage: (id: string, image: CookbookImageInput) => Promise<void>;
  clearEntryImage: (id: string) => Promise<void>;
  canEditImageForEntry: (entry: CookRecipeEntry | undefined) => boolean;
  updateEntryTitle: (id: string, title: string) => Promise<void>;
  canEditTitleForEntry: (entry: CookRecipeEntry | undefined) => boolean;

  removeEntry: (id: string) => Promise<void>;
  clearAllManual: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const [CookbookProvider, useCookbook] = createContextHook<CookbookContextValue>(() => {
  const { entries: scanEntries, isLoading: scanIsLoading, errorMessage: scanErrorMessage } = useScanJournal();

  const [manualEntries, setManualEntries] = useState<CookRecipeEntry[]>([]);
  const [manualIsLoading, setManualIsLoading] = useState<boolean>(true);
  const [manualErrorMessage, setManualErrorMessage] = useState<string | null>(null);

  const [imageOverrides, setImageOverrides] = useState<Record<string, string | null>>({});
  const [imageOverridesIsLoading, setImageOverridesIsLoading] = useState<boolean>(true);
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string | null>>({});
  const [titleOverridesIsLoading, setTitleOverridesIsLoading] = useState<boolean>(true);

  const loadManual = useCallback(async () => {
    console.log('[Cookbook] loading manual entries');
    setManualIsLoading(true);
    try {
      const timeoutMs = 2500;
      const startedAt = Date.now();

      const raw = await Promise.race<string | null>([
        AsyncStorage.getItem(MANUAL_STORAGE_KEY),
        new Promise<string | null>((resolve) => {
          setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);

      const durationMs = Date.now() - startedAt;
      console.log('[Cookbook] loadManual finished', { durationMs, timedOut: raw === null });

      const parsed = safeParseJson<CookRecipeEntry[]>(raw) ?? [];
      const normalized = Array.isArray(parsed) ? parsed.map((e) => normalizeManualEntry(e)) : [];
      normalized.sort((a, b) => b.createdAt - a.createdAt);
      console.log('[Cookbook] loaded manual entries', { count: normalized.length });
      setManualEntries(normalized);
      setManualErrorMessage(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[Cookbook] loadManual failed', { message });
      setManualErrorMessage('Could not load saved guide items.');
    } finally {
      setManualIsLoading(false);
    }
  }, []);

  const loadImageOverrides = useCallback(async () => {
    console.log('[Cookbook] loading image overrides');
    setImageOverridesIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(IMAGE_OVERRIDE_KEY);
      const parsed = safeParseJson<Record<string, string | null>>(raw) ?? {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setImageOverrides(parsed);
        console.log('[Cookbook] loaded image overrides', { count: Object.keys(parsed).length });
      } else {
        setImageOverrides({});
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[Cookbook] loadImageOverrides failed', { message });
      setImageOverrides({});
    } finally {
      setImageOverridesIsLoading(false);
    }
  }, []);

  const loadTitleOverrides = useCallback(async () => {
    console.log('[Cookbook] loading title overrides');
    setTitleOverridesIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(TITLE_OVERRIDE_KEY);
      const parsed = safeParseJson<Record<string, string | null>>(raw) ?? {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setTitleOverrides(parsed);
        console.log('[Cookbook] loaded title overrides', { count: Object.keys(parsed).length });
      } else {
        setTitleOverrides({});
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[Cookbook] loadTitleOverrides failed', { message });
      setTitleOverrides({});
    } finally {
      setTitleOverridesIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadManual();
    void loadImageOverrides();
    void loadTitleOverrides();
  }, [loadImageOverrides, loadManual, loadTitleOverrides]);

  const persistManual = useCallback(async (next: CookRecipeEntry[]) => {
    try {
      await AsyncStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(next));
      console.log('[Cookbook] persisted manual entries', { count: next.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[Cookbook] persistManual failed', { message });
      setManualErrorMessage('Could not save your guide item.');
    }
  }, []);

  const applyImageOverride = useCallback(
    (entry: CookRecipeEntry): CookRecipeEntry => {
      const override = imageOverrides[entry.id];
      if (override === undefined) return entry;
      if (override === null) return { ...entry, imageUri: undefined };
      return { ...entry, imageUri: override };
    },
    [imageOverrides],
  );

  const applyTitleOverride = useCallback(
    (entry: CookRecipeEntry): CookRecipeEntry => {
      const override = titleOverrides[entry.id];
      if (typeof override !== 'string') return entry;
      const trimmed = override.trim();
      if (!trimmed) return entry;
      return { ...entry, title: trimmed };
    },
    [titleOverrides],
  );

  const applyOverrides = useCallback(
    (entry: CookRecipeEntry): CookRecipeEntry => {
      return applyTitleOverride(applyImageOverride(entry));
    },
    [applyImageOverride, applyTitleOverride],
  );

  const canEditImageForEntry = useCallback((entry: CookRecipeEntry | undefined): boolean => {
    if (!entry) return false;
    return entry.source === 'collection' || entry.source === 'tucka-guide';
  }, []);

  const canEditTitleForEntry = useCallback((entry: CookRecipeEntry | undefined): boolean => {
    if (!entry) return false;
    return entry.source === 'collection' || entry.source === 'tucka-guide';
  }, []);

  const ensureImageDir = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === 'web') return null;

    const fs = await getLegacyFileSystem();
    const baseDir = fs?.documentDirectory ?? fs?.cacheDirectory;
    if (!fs || !baseDir) {
      console.log('[Cookbook] ensureImageDir no fs/baseDir', { hasFs: Boolean(fs), baseDir });
      return null;
    }

    const dir = `${baseDir}cook-images/`;

    try {
      const info = await fs.getInfoAsync(dir);
      if (!info.exists) {
        await fs.makeDirectoryAsync(dir, { intermediates: true });
        console.log('[Cookbook] created image directory', { dir });
      }
      return dir;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[Cookbook] ensureImageDir failed', { message, dir });
      return null;
    }
  }, []);

  const persistImageOverrides = useCallback(async (next: Record<string, string | null>) => {
    try {
      await AsyncStorage.setItem(IMAGE_OVERRIDE_KEY, JSON.stringify(next));
      console.log('[Cookbook] persisted image overrides', { count: Object.keys(next).length });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[Cookbook] persistImageOverrides failed', { message });
      setManualErrorMessage('Could not save your recipe photo.');
    }
  }, []);

  const persistTitleOverrides = useCallback(async (next: Record<string, string | null>) => {
    try {
      await AsyncStorage.setItem(TITLE_OVERRIDE_KEY, JSON.stringify(next));
      console.log('[Cookbook] persisted title overrides', { count: Object.keys(next).length });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[Cookbook] persistTitleOverrides failed', { message });
      setManualErrorMessage('Could not save your recipe title.');
    }
  }, []);

  const setEntryImage = useCallback(
    async (id: string, image: CookbookImageInput) => {
      console.log('[Cookbook] setEntryImage requested', { id, uriScheme: image.uri.split(':')[0] ?? 'none', hasBase64: Boolean(image.base64) });

      let storedUri = image.uri;

      if (Platform.OS === 'web') {
        if (image.base64 && image.base64.trim().length > 0) {
          const mime = image.mimeType && image.mimeType.trim().length > 0 ? image.mimeType.trim() : 'image/jpeg';
          storedUri = `data:${mime};base64,${image.base64.trim()}`;
        }
      } else {
        const fs = await getLegacyFileSystem();
        const dir = await ensureImageDir();
        if (fs && dir) {
          const fileUri = `${dir}${encodeURIComponent(id)}.jpg`;
          try {
            const from = image.uri;
            if (from.startsWith('file://')) {
              await fs.copyAsync({ from, to: fileUri });
              storedUri = fileUri;
              console.log('[Cookbook] copied image into app storage', { id, fileUri });
            } else if (image.base64 && image.base64.trim().length > 0) {
              await fs.writeAsStringAsync(fileUri, image.base64.trim(), { encoding: fs.EncodingType.Base64 });
              storedUri = fileUri;
              console.log('[Cookbook] wrote base64 image into app storage', { id, fileUri });
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.log('[Cookbook] setEntryImage file persistence failed; falling back to original uri', { id, message });
            storedUri = image.uri;
          }
        }
      }

      setImageOverrides((prev) => {
        const next = { ...(prev ?? {}), [id]: storedUri };
        void persistImageOverrides(next);
        return next;
      });
    },
    [ensureImageDir, persistImageOverrides],
  );

  const clearEntryImage = useCallback(
    async (id: string) => {
      console.log('[Cookbook] clearEntryImage requested', { id });

      const existing = imageOverrides[id];

      setImageOverrides((prev) => {
        const base = prev ?? {};
        const next: Record<string, string | null> = { ...base, [id]: null };
        void persistImageOverrides(next);
        return next;
      });

      if (Platform.OS !== 'web' && existing && existing.startsWith('file://')) {
        try {
          const fs = await getLegacyFileSystem();
          if (fs) {
            await fs.deleteAsync(existing, { idempotent: true });
            console.log('[Cookbook] deleted image file', { id, existing });
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[Cookbook] delete image file failed', { id, message, existing });
        }
      }
    },
    [imageOverrides, persistImageOverrides],
  );

  const updateEntryTitle = useCallback(
    async (id: string, title: string) => {
      const trimmed = String(title ?? '').trim();
      if (!trimmed) {
        throw new Error('Title cannot be empty.');
      }

      let updatedManual = false;
      setManualEntries((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const next = base.map((entry) => {
          if (entry.id !== id) return entry;
          updatedManual = true;
          return { ...entry, title: trimmed };
        });
        if (updatedManual) {
          void persistManual(next);
        }
        return next;
      });

      if (!updatedManual) {
        setTitleOverrides((prev) => {
          const next = { ...(prev ?? {}), [id]: trimmed };
          void persistTitleOverrides(next);
          return next;
        });
      }
    },
    [persistManual, persistTitleOverrides],
  );

  const derivedFromCollection = useMemo<CookRecipeEntry[]>(() => {
    const cooked = scanEntries
      .map((e) => applyOverrides(normalizeCookEntryFromScan(e)))
      .sort((a, b) => b.createdAt - a.createdAt);

    console.log('[Cookbook] derived entries from collection', { scanCount: scanEntries.length, cookCount: cooked.length });
    return cooked;
  }, [applyOverrides, scanEntries]);

  const manualWithOverrides = useMemo<CookRecipeEntry[]>(() => manualEntries.map((e) => applyOverrides(e)), [applyOverrides, manualEntries]);

  const entries = useMemo<CookRecipeEntry[]>(() => {
    const all = [...manualWithOverrides, ...derivedFromCollection];
    all.sort((a, b) => b.createdAt - a.createdAt);
    return all;
  }, [derivedFromCollection, manualWithOverrides]);

  const isLoading = scanIsLoading || manualIsLoading || imageOverridesIsLoading || titleOverridesIsLoading;
  const errorMessage = scanErrorMessage ?? manualErrorMessage;

  const refresh = useCallback(async () => {
    console.log('[Cookbook] refresh requested');
    await Promise.all([loadManual(), loadImageOverrides()]);
  }, [loadImageOverrides, loadManual]);

  const getEntryById = useCallback((id: string) => entries.find((e) => e.id === id), [entries]);

  const getEntryByScanId = useCallback(
    (scanEntryId: string) => entries.find((e) => e.source === 'collection' && e.scanEntryId === scanEntryId),
    [entries],
  );

  const saveGuideEntry = useCallback(
    async (input: {
      title: string;
      guideText: string;
      commonName?: string;
      scientificName?: string;
      imageUri?: string;
      confidence?: number;
      safetyStatus?: CookRecipeEntry['safetyStatus'];
      scanEntryId?: string;
      chatMessageId?: string;
      suggestedUses?: string[];
    }) => {
      const nextEntry: CookRecipeEntry = normalizeManualEntry({
        id: `guide-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: Date.now(),
        source: 'tucka-guide',
        scanEntryId: input.scanEntryId,
        chatMessageId: input.chatMessageId,
        title: input.title,
        imageUri: input.imageUri,
        commonName: input.commonName ?? 'Unconfirmed Plant',
        scientificName: input.scientificName,
        confidence: typeof input.confidence === 'number' ? input.confidence : 0,
        safetyStatus: input.safetyStatus ?? 'unknown',
        suggestedUses: Array.isArray(input.suggestedUses) ? input.suggestedUses : [],
        guideText: input.guideText,
      });

      setManualEntries((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const updated = [nextEntry, ...base];
        void persistManual(updated);
        return updated;
      });

      console.log('[Cookbook] saved guide entry', {
        id: nextEntry.id,
        scanEntryId: nextEntry.scanEntryId,
        chatMessageId: nextEntry.chatMessageId,
      });

      return nextEntry;
    },
    [persistManual],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      setManualEntries((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const updated = base.filter((e) => e.id !== id);
        if (updated.length !== base.length) {
          void persistManual(updated);
          console.log('[Cookbook] removed manual entry', { id });
        } else {
          console.log('[Cookbook] removeEntry noop (not manual)', { id });
        }
        return updated;
      });
    },
    [persistManual],
  );

  const clearAllManual = useCallback(async () => {
    setManualEntries([]);
    await persistManual([]);
    console.log('[Cookbook] cleared manual entries');
  }, [persistManual]);

  const value = useMemo<CookbookContextValue>(
    () => ({
      entries,
      isLoading,
      errorMessage,
      getEntryById,
      getEntryByScanId,
      saveGuideEntry,
      setEntryImage,
      clearEntryImage,
      canEditImageForEntry,
      updateEntryTitle,
      canEditTitleForEntry,
      removeEntry,
      clearAllManual,
      refresh,
    }),
    [
      canEditImageForEntry,
      canEditTitleForEntry,
      clearAllManual,
      clearEntryImage,
      entries,
      errorMessage,
      getEntryById,
      getEntryByScanId,
      isLoading,
      refresh,
      removeEntry,
      saveGuideEntry,
      setEntryImage,
      updateEntryTitle,
    ],
  );

  return value;
});
