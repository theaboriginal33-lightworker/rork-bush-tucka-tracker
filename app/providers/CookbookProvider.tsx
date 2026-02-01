import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
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

const MANUAL_STORAGE_KEY = 'bush-tucka.cookbook.manual.v1';

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

  removeEntry: (id: string) => Promise<void>;
  clearAllManual: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const [CookbookProvider, useCookbook] = createContextHook<CookbookContextValue>(() => {
  const { entries: scanEntries, isLoading: scanIsLoading, errorMessage: scanErrorMessage } = useScanJournal();

  const [manualEntries, setManualEntries] = useState<CookRecipeEntry[]>([]);
  const [manualIsLoading, setManualIsLoading] = useState<boolean>(true);
  const [manualErrorMessage, setManualErrorMessage] = useState<string | null>(null);

  const loadManual = useCallback(async () => {
    console.log('[Cookbook] loading manual entries');
    setManualIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(MANUAL_STORAGE_KEY);
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

  useEffect(() => {
    void loadManual();
  }, [loadManual]);

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

  const derivedFromCollection = useMemo<CookRecipeEntry[]>(() => {
    const cooked = scanEntries
      .filter((e) => {
        const confidence = Number.isFinite(e.scan?.confidence) ? (e.scan.confidence as number) : 0;
        return e.scan?.safety?.status === 'safe' && confidence >= 0.75;
      })
      .map((e) => normalizeCookEntryFromScan(e))
      .sort((a, b) => b.createdAt - a.createdAt);

    console.log('[Cookbook] derived entries from collection', { scanCount: scanEntries.length, cookCount: cooked.length });
    return cooked;
  }, [scanEntries]);

  const entries = useMemo<CookRecipeEntry[]>(() => {
    const all = [...manualEntries, ...derivedFromCollection];
    all.sort((a, b) => b.createdAt - a.createdAt);
    return all;
  }, [derivedFromCollection, manualEntries]);

  const isLoading = scanIsLoading || manualIsLoading;
  const errorMessage = scanErrorMessage ?? manualErrorMessage;

  const refresh = useCallback(async () => {
    console.log('[Cookbook] refresh requested');
    await loadManual();
  }, [loadManual]);

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
      removeEntry,
      clearAllManual,
      refresh,
    }),
    [clearAllManual, entries, errorMessage, getEntryById, getEntryByScanId, isLoading, refresh, removeEntry, saveGuideEntry],
  );

  return value;
});
