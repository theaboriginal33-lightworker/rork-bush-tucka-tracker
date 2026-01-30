import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ScanJournalEntry } from '@/app/providers/ScanJournalProvider';

const STORAGE_KEY = 'bush-tucka.cookbook.v1';

export type CookRecipeEntry = {
  id: string;
  createdAt: number;
  scanEntryId: string;

  title: string;
  imageUri?: string;

  commonName: string;
  scientificName?: string;
  confidence: number;
  safetyStatus: 'safe' | 'unsafe' | 'uncertain';

  suggestedUses: string[];
};

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

function normalizeCookEntry(input: CookRecipeEntry): CookRecipeEntry {
  return {
    id: String(input.id),
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : Date.now(),
    scanEntryId: String(input.scanEntryId),
    title: String(input.title ?? input.commonName ?? 'Untitled'),
    imageUri: input.imageUri ? String(input.imageUri) : undefined,
    commonName: String(input.commonName ?? 'Unknown'),
    scientificName: input.scientificName ? String(input.scientificName) : undefined,
    confidence: Number.isFinite(input.confidence) ? input.confidence : 0,
    safetyStatus: input.safetyStatus === 'safe' || input.safetyStatus === 'unsafe' ? input.safetyStatus : 'uncertain',
    suggestedUses: Array.isArray(input.suggestedUses) ? input.suggestedUses.map((u) => String(u)).filter((u) => u.trim().length > 0) : [],
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
  const [entries, setEntries] = useState<CookRecipeEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadedOnceRef = useRef<boolean>(false);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['cookbook', 'entries'],
    queryFn: async () => {
      console.log('[Cookbook] loading from AsyncStorage');
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = safeParseJson<CookRecipeEntry[]>(raw) ?? [];
      const normalized = Array.isArray(parsed) ? parsed.map((e) => normalizeCookEntry(e)).filter(Boolean) : [];
      return normalized.sort((a, b) => b.createdAt - a.createdAt);
    },
  });

  useEffect(() => {
    if (isLoading) return;
    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log('[Cookbook] loadQuery error', { message });
      setErrorMessage('Could not load your cookbook.');
      return;
    }

    if (!loadedOnceRef.current && Array.isArray(data)) {
      loadedOnceRef.current = true;
      setEntries(data);
      setErrorMessage(null);
    }
  }, [data, error, isLoading]);

  const { mutate: persistMutate } = useMutation({
    mutationFn: async (nextEntries: CookRecipeEntry[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
      return nextEntries;
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[Cookbook] persistMutation error', { message });
      setErrorMessage('Could not save your cookbook.');
    },
  });

  const refresh = useCallback(async () => {
    console.log('[Cookbook] refresh');
    setErrorMessage(null);
    loadedOnceRef.current = false;
    await refetch();
  }, [refetch]);

  const getEntryById = useCallback((id: string) => entries.find((e) => e.id === id), [entries]);

  const getEntryByScanId = useCallback((scanEntryId: string) => entries.find((e) => e.scanEntryId === scanEntryId), [entries]);

  const addFromScanEntry = useCallback(
    async (scanEntry: ScanJournalEntry) => {
      const id = `cook-${scanEntry.id}`;

      const scan = (scanEntry as ScanJournalEntry | undefined)?.scan;
      const commonName = scan?.commonName;
      if (!scan || typeof commonName !== 'string' || commonName.trim().length === 0) {
        console.log('[Cookbook] addFromScanEntry: missing scan data', { scanEntryId: scanEntry.id, title: scanEntry.title });
        throw new Error('Missing scan details for this collection item. Please re-scan it.');
      }

      const cookEntry: CookRecipeEntry = normalizeCookEntry({
        id,
        createdAt: Date.now(),
        scanEntryId: scanEntry.id,
        title: scanEntry.title ?? commonName ?? 'Untitled',
        imageUri: scanEntry.imageUri,
        commonName,
        scientificName: scan.scientificName,
        confidence: scan.confidence,
        safetyStatus: scan?.safety?.status ?? 'uncertain',
        suggestedUses: scan?.suggestedUses ?? [],
      });

      console.log('[Cookbook] addFromScanEntry', { scanEntryId: scanEntry.id, cookId: cookEntry.id, title: cookEntry.title });
      setErrorMessage(null);

      setEntries((prev) => {
        const next = [cookEntry, ...prev.filter((e) => e.id !== cookEntry.id && e.scanEntryId !== cookEntry.scanEntryId)];
        persistMutate(next);
        return next;
      });

      return cookEntry;
    },
    [persistMutate],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      setErrorMessage(null);
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        persistMutate(next);
        return next;
      });
      console.log('[Cookbook] removeEntry', { id });
    },
    [persistMutate],
  );

  const clearAll = useCallback(async () => {
    setErrorMessage(null);
    setEntries(() => {
      const next: CookRecipeEntry[] = [];
      persistMutate(next);
      return next;
    });
    console.log('[Cookbook] clearAll');
  }, [persistMutate]);

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
