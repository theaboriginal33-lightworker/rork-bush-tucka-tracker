import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useMemo } from 'react';
import type { ScanJournalEntry } from '@/app/providers/ScanJournalProvider';
import { useScanJournal } from '@/app/providers/ScanJournalProvider';

export type CookRecipeEntry = {
  id: string;
  createdAt: number;
  scanEntryId: string;

  title: string;
  imageUri?: string;

  commonName: string;
  scientificName?: string;
  confidence: number;
  safetyStatus: 'safe' | 'caution' | 'unknown';

  suggestedUses: string[];
};

function normalizeCookEntryFromScan(scanEntry: ScanJournalEntry): CookRecipeEntry {
  const scan = scanEntry.scan;
  return {
    id: scanEntry.id,
    createdAt: scanEntry.createdAt,
    scanEntryId: scanEntry.id,
    title: String(scanEntry.title ?? scan.commonName ?? 'Unconfirmed Plant'),
    imageUri: scanEntry.imageUri,
    commonName: String(scan.commonName ?? 'Unconfirmed Plant'),
    scientificName: scan.scientificName ? String(scan.scientificName) : undefined,
    confidence: Number.isFinite(scan.confidence) ? Math.max(0, Math.min(1, Number(scan.confidence))) : 0,
    safetyStatus: scan.safety?.status ?? 'unknown',
    suggestedUses: Array.isArray(scan.suggestedUses) ? scan.suggestedUses.map((u) => String(u)).filter((u) => u.trim().length > 0).slice(0, 16) : [],
  };
}

type CookbookContextValue = {
  entries: CookRecipeEntry[];
  isLoading: boolean;
  errorMessage: string | null;

  getEntryById: (id: string) => CookRecipeEntry | undefined;
  getEntryByScanId: (scanEntryId: string) => CookRecipeEntry | undefined;

  addFromScanEntry: (scanEntry: ScanJournalEntry) => Promise<CookRecipeEntry>;
  removeEntry: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const [CookbookProvider, useCookbook] = createContextHook<CookbookContextValue>(() => {
  const { entries: scanEntries, isLoading, errorMessage: scanErrorMessage } = useScanJournal();

  const entries = useMemo<CookRecipeEntry[]>(() => {
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

  const errorMessage = scanErrorMessage;

  const refresh = useCallback(async () => {
    console.log('[Cookbook] refresh requested (noop - derived from collection)');
  }, []);

  const getEntryById = useCallback((id: string) => entries.find((e) => e.id === id), [entries]);

  const getEntryByScanId = useCallback((scanEntryId: string) => entries.find((e) => e.scanEntryId === scanEntryId), [entries]);

  const addFromScanEntry = useCallback(async (_scanEntry: ScanJournalEntry) => {
    console.log('[Cookbook] addFromScanEntry called (noop - Cook is derived from Collection)');
    throw new Error('Cook is now automatic from your Collection.');
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    console.log('[Cookbook] removeEntry called (noop - Cook is derived)', { id });
  }, []);

  const clearAll = useCallback(async () => {
    console.log('[Cookbook] clearAll called (noop - Cook is derived)');
  }, []);

  const value = useMemo<CookbookContextValue>(
    () => ({
      entries,
      isLoading,
      errorMessage,
      getEntryById,
      getEntryByScanId,
      addFromScanEntry,
      removeEntry,
      clearAll,
      refresh,
    }),
    [addFromScanEntry, clearAll, entries, errorMessage, getEntryById, getEntryByScanId, isLoading, refresh, removeEntry],
  );

  return value;
});
