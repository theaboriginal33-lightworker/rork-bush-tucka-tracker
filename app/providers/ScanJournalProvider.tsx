import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

const STORAGE_KEY = 'bush-tucka.scan-journal.v1';

export type SafetyEdibility = {
  status: 'safe' | 'unsafe' | 'uncertain';
  summary: string;
  keyRisks: string[];
};

export type Preparation = {
  ease: 'easy' | 'medium' | 'hard' | 'unknown';
  steps: string[];
};

export type Seasonality = {
  bestMonths: string[];
  notes: string;
};

export type CulturalKnowledge = {
  notes: string;
  respect: string[];
};

export type GeminiScanResult = {
  commonName: string;
  scientificName?: string;
  confidence: number;

  bushTuckerLikely: boolean;
  safety: SafetyEdibility;
  preparation: Preparation;
  seasonality: Seasonality;
  culturalKnowledge: CulturalKnowledge;

  warnings: string[];
  suggestedUses: string[];
};

export type ScanJournalChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
};

export type ScanJournalLocation = {
  latitude: number;
  longitude: number;
};

export type ScanJournalEntry = {
  id: string;
  createdAt: number;
  title: string;
  locationName?: string;
  location?: ScanJournalLocation;
  imageUri?: string;
  notes?: string;
  chatHistory?: ScanJournalChatMessage[];
  scan: GeminiScanResult;
};

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[ScanJournal] safeParseJson failed', { message });
    return null;
  }
}

function normalizeEntry(input: ScanJournalEntry): ScanJournalEntry {
  const rawChat = Array.isArray(input.chatHistory) ? input.chatHistory : [];
  const chatHistory: ScanJournalChatMessage[] = rawChat
    .map((m): ScanJournalChatMessage => {
      const role: ScanJournalChatMessage['role'] = (m as ScanJournalChatMessage).role === 'user' ? 'user' : 'assistant';
      return {
        id: String((m as ScanJournalChatMessage).id ?? `msg-${Math.random().toString(16).slice(2)}`),
        role,
        text: String((m as ScanJournalChatMessage).text ?? ''),
        createdAt: Number.isFinite((m as ScanJournalChatMessage).createdAt) ? (m as ScanJournalChatMessage).createdAt : Date.now(),
      };
    })
    .filter((m) => m.text.trim().length > 0);

  const loc = input.location;
  const location =
    loc &&
    typeof (loc as ScanJournalLocation).latitude === 'number' &&
    Number.isFinite((loc as ScanJournalLocation).latitude) &&
    typeof (loc as ScanJournalLocation).longitude === 'number' &&
    Number.isFinite((loc as ScanJournalLocation).longitude)
      ? { latitude: (loc as ScanJournalLocation).latitude, longitude: (loc as ScanJournalLocation).longitude }
      : undefined;

  return {
    id: String(input.id),
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : Date.now(),
    title: String(input.title ?? input.scan?.commonName ?? 'Unknown'),
    locationName: input.locationName ? String(input.locationName) : undefined,
    location,
    imageUri: input.imageUri ? String(input.imageUri) : undefined,
    notes: typeof input.notes === 'string' ? input.notes : undefined,
    chatHistory,
    scan: input.scan,
  };
}

type ScanJournalContextValue = {
  entries: ScanJournalEntry[];
  isLoading: boolean;
  errorMessage: string | null;

  getEntryById: (id: string) => ScanJournalEntry | undefined;

  addEntry: (entry: Omit<ScanJournalEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => Promise<ScanJournalEntry>;
  updateEntry: (id: string, patch: Partial<Omit<ScanJournalEntry, 'id' | 'createdAt' | 'scan'>>) => Promise<ScanJournalEntry | null>;
  removeEntry: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const [ScanJournalProvider, useScanJournal] = createContextHook<ScanJournalContextValue>(() => {
  const [entries, setEntries] = useState<ScanJournalEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadedOnceRef = useRef<boolean>(false);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['scanJournal', 'entries'],
    queryFn: async () => {
      console.log('[ScanJournal] loading from AsyncStorage');
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = safeParseJson<ScanJournalEntry[]>(raw) ?? [];
      const normalized = Array.isArray(parsed) ? parsed.map((e) => normalizeEntry(e)).filter(Boolean) : [];
      return normalized.sort((a, b) => b.createdAt - a.createdAt);
    },
  });

  useEffect(() => {
    if (isLoading) return;
    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log('[ScanJournal] loadQuery error', { message });
      setErrorMessage('Could not load your collection.');
      return;
    }

    if (!Array.isArray(data)) return;

    if (loadedOnceRef.current) {
      return;
    }

    loadedOnceRef.current = true;
    setEntries((prev) => {
      if (prev.length === 0) {
        return data;
      }

      const byId = new Map<string, ScanJournalEntry>();
      for (const e of data) byId.set(e.id, e);
      for (const e of prev) byId.set(e.id, e);

      const merged = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
      console.log('[ScanJournal] merged initial load with optimistic entries', { fromStorage: data.length, existing: prev.length, merged: merged.length });
      return merged;
    });
    setErrorMessage(null);
  }, [data, error, isLoading]);

  const { mutate: persistMutate } = useMutation({
    mutationFn: async (nextEntries: ScanJournalEntry[]) => {
      const payload = JSON.stringify(nextEntries);
      await AsyncStorage.setItem(STORAGE_KEY, payload);
      return nextEntries;
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[ScanJournal] persistMutation error', { message });
      setErrorMessage('Could not save your collection.');
    },
  });

  const refresh = useCallback(async () => {
    console.log('[ScanJournal] refresh');
    setErrorMessage(null);
    loadedOnceRef.current = false;
    await refetch();
  }, [refetch]);

  const addEntry = useCallback(
    async (entryInput: Omit<ScanJournalEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => {
      loadedOnceRef.current = true;
      const id = String(entryInput.id ?? `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const createdAt = Number.isFinite(entryInput.createdAt) ? (entryInput.createdAt as number) : Date.now();

      const entry: ScanJournalEntry = normalizeEntry({
        id,
        createdAt,
        title: entryInput.title,
        locationName: entryInput.locationName,
        location: entryInput.location,
        imageUri: entryInput.imageUri,
        notes: entryInput.notes,
        chatHistory: entryInput.chatHistory,
        scan: entryInput.scan,
      });

      setErrorMessage(null);
      setEntries((prev) => {
        const next = [entry, ...prev.filter((e) => e.id !== entry.id)];
        persistMutate(next);
        return next;
      });

      console.log('[ScanJournal] addEntry', { id: entry.id, title: entry.title });
      return entry;
    },
    [persistMutate],
  );

  const getEntryById = useCallback(
    (id: string) => {
      return entries.find((e) => e.id === id);
    },
    [entries],
  );

  const updateEntry = useCallback(
    async (id: string, patch: Partial<Omit<ScanJournalEntry, 'id' | 'createdAt' | 'scan'>>) => {
      loadedOnceRef.current = true;
      console.log('[ScanJournal] updateEntry', { id, keys: Object.keys(patch) });
      setErrorMessage(null);

      let updated: ScanJournalEntry | null = null;
      setEntries((prev) => {
        const next = prev.map((e) => {
          if (e.id !== id) return e;
          updated = normalizeEntry({
            ...e,
            title: typeof patch.title === 'string' ? patch.title : e.title,
            locationName: typeof patch.locationName === 'string' ? patch.locationName : e.locationName,
            location: patch.location ?? e.location,
            imageUri: typeof patch.imageUri === 'string' ? patch.imageUri : e.imageUri,
            notes: typeof patch.notes === 'string' ? patch.notes : e.notes,
            chatHistory: Array.isArray(patch.chatHistory) ? patch.chatHistory : e.chatHistory,
            scan: e.scan,
          });
          return updated;
        });

        if (!next.some((e) => e.id === id)) {
          console.log('[ScanJournal] updateEntry did not find entry', { id });
          return prev;
        }

        persistMutate(next);
        return next;
      });

      return updated;
    },
    [persistMutate],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      loadedOnceRef.current = true;
      setErrorMessage(null);
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        persistMutate(next);
        return next;
      });
      console.log('[ScanJournal] removeEntry', { id });
    },
    [persistMutate],
  );

  const clearAll = useCallback(async () => {
    loadedOnceRef.current = true;
    setErrorMessage(null);
    setEntries(() => {
      const next: ScanJournalEntry[] = [];
      persistMutate(next);
      return next;
    });
    console.log('[ScanJournal] clearAll');
  }, [persistMutate]);

  const value = useMemo<ScanJournalContextValue>(
    () => ({
      entries,
      isLoading,
      errorMessage,
      getEntryById,
      addEntry,
      updateEntry,
      removeEntry,
      clearAll,
      refresh,
    }),
    [addEntry, clearAll, entries, errorMessage, getEntryById, isLoading, refresh, removeEntry, updateEntry],
  );

  return value;
});

export function createScanEntryId(params: {
  commonName: string;
  scientificName?: string;
  confidence: number;
  imageBase64?: string | null;
  imageUri?: string | null;
}): string {
  const keyParts = [
    params.commonName.trim().toLowerCase(),
    (params.scientificName ?? '').trim().toLowerCase(),
    String(Math.round(params.confidence * 1000)),
    params.imageBase64 ? `b64:${params.imageBase64.slice(0, 40)}` : null,
    params.imageUri ? `uri:${params.imageUri}` : null,
  ].filter(Boolean);

  return `scan-${keyParts.join('|')}`;
}
