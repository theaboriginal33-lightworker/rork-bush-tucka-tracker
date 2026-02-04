import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';

const STORAGE_KEY = 'bush-tucka.scan-journal.v1';

export type SafetyEdibility = {
  status: 'safe' | 'caution' | 'unknown';
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

  safety: SafetyEdibility;
  categories: string[];

  bushTuckerLikely: boolean;
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
  imagePreviewUri?: string;
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

function normalizeSafetyStatus(raw: unknown): SafetyEdibility['status'] {
  const s = String(raw ?? 'unknown');
  if (s === 'safe') return 'safe';
  if (s === 'caution') return 'caution';
  if (s === 'unknown') return 'unknown';
  if (s === 'unsafe') return 'caution';
  if (s === 'uncertain') return 'unknown';
  return 'unknown';
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

  const normalizedScan: GeminiScanResult = {
    ...input.scan,
    commonName: String(input.scan?.commonName ?? 'Unconfirmed Plant'),
    scientificName: input.scan?.scientificName ? String(input.scan.scientificName) : undefined,
    confidence: Number.isFinite(input.scan?.confidence) ? Math.max(0, Math.min(1, Number(input.scan.confidence))) : 0,
    safety: {
      status: normalizeSafetyStatus(input.scan?.safety?.status),
      summary: String(input.scan?.safety?.summary ?? ''),
      keyRisks: Array.isArray(input.scan?.safety?.keyRisks) ? input.scan.safety.keyRisks.map((r) => String(r)).filter((r) => r.trim().length > 0).slice(0, 12) : [],
    },
    categories: Array.isArray((input.scan as unknown as { categories?: unknown })?.categories)
      ? ((input.scan as unknown as { categories?: unknown })?.categories as unknown[]).map((c) => String(c)).filter((c) => c.trim().length > 0).slice(0, 12)
      : [],
    bushTuckerLikely: Boolean(input.scan?.bushTuckerLikely ?? false),
    preparation: {
      ease: (input.scan?.preparation?.ease ?? 'unknown') as Preparation['ease'],
      steps: Array.isArray(input.scan?.preparation?.steps) ? input.scan.preparation.steps.map((s) => String(s)).filter((s) => s.trim().length > 0).slice(0, 16) : [],
    },
    seasonality: {
      bestMonths: Array.isArray(input.scan?.seasonality?.bestMonths) ? input.scan.seasonality.bestMonths.map((m) => String(m)).filter((m) => m.trim().length > 0).slice(0, 12) : [],
      notes: String(input.scan?.seasonality?.notes ?? ''),
    },
    culturalKnowledge: {
      notes: String(input.scan?.culturalKnowledge?.notes ?? ''),
      respect: Array.isArray(input.scan?.culturalKnowledge?.respect) ? input.scan.culturalKnowledge.respect.map((r) => String(r)).filter((r) => r.trim().length > 0).slice(0, 12) : [],
    },
    warnings: Array.isArray(input.scan?.warnings) ? input.scan.warnings.map((w) => String(w)).filter((w) => w.trim().length > 0).slice(0, 16) : [],
    suggestedUses: Array.isArray(input.scan?.suggestedUses) ? input.scan.suggestedUses.map((u) => String(u)).filter((u) => u.trim().length > 0).slice(0, 16) : [],
  };

  return {
    id: String(input.id),
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : Date.now(),
    title: String(input.title ?? normalizedScan.commonName ?? 'Unconfirmed Plant'),
    locationName: input.locationName ? String(input.locationName) : undefined,
    location,
    imageUri: input.imageUri ? String(input.imageUri) : undefined,
    imagePreviewUri: input.imagePreviewUri ? String(input.imagePreviewUri) : undefined,
    notes: typeof input.notes === 'string' ? input.notes : undefined,
    chatHistory,
    scan: normalizedScan,
  };
}

const MAX_WEB_DATA_URI_LENGTH = 650_000;
const WEB_IDB_DB = 'bush-tucka-tracka';
const WEB_IDB_STORE = 'scan-journal';

function stripLargeWebImages(entry: ScanJournalEntry): ScanJournalEntry {
  if (Platform.OS !== 'web') return entry;

  const stripIfTooLarge = (uri?: string) => {
    if (!uri) return uri;
    const trimmed = uri.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('blob:')) return undefined;
    if (trimmed.startsWith('data:') && trimmed.length > MAX_WEB_DATA_URI_LENGTH) return undefined;
    return trimmed;
  };

  return {
    ...entry,
    imageUri: stripIfTooLarge(entry.imageUri),
    imagePreviewUri: stripIfTooLarge(entry.imagePreviewUri),
  };
}

function getIndexedDb(): any | null {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as unknown as { indexedDB?: unknown };
  return g?.indexedDB ?? null;
}

async function readFromIndexedDb(key: string): Promise<string | null> {
  const indexedDb = getIndexedDb();
  if (!indexedDb) return null;

  return await new Promise((resolve) => {
    try {
      const request = indexedDb.open(WEB_IDB_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WEB_IDB_STORE)) {
          db.createObjectStore(WEB_IDB_STORE);
        }
      };
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(WEB_IDB_STORE, 'readonly');
        const store = tx.objectStore(WEB_IDB_STORE);
        const getReq = store.get(key);
        getReq.onsuccess = () => {
          const value = getReq.result;
          resolve(typeof value === 'string' ? value : null);
        };
        getReq.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      };
    } catch (e) {
      resolve(null);
    }
  });
}

async function writeToIndexedDb(key: string, value: string): Promise<boolean> {
  const indexedDb = getIndexedDb();
  if (!indexedDb) return false;

  return await new Promise((resolve) => {
    try {
      const request = indexedDb.open(WEB_IDB_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WEB_IDB_STORE)) {
          db.createObjectStore(WEB_IDB_STORE);
        }
      };
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(WEB_IDB_STORE, 'readwrite');
        const store = tx.objectStore(WEB_IDB_STORE);
        const putReq = store.put(value, key);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => resolve(false);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      };
    } catch (e) {
      resolve(false);
    }
  });
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
    retry: 0,
    queryFn: async () => {
      console.log('[ScanJournal] loading from AsyncStorage');

      const timeoutMs = 2500;
      const startedAt = Date.now();

      const raw = await Promise.race<string | null>([
        AsyncStorage.getItem(STORAGE_KEY),
        new Promise<string | null>((resolve) => {
          setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);

      const durationMs = Date.now() - startedAt;
      console.log('[ScanJournal] load finished', { durationMs, timedOut: raw === null });

      let rawPayload = raw;
      if ((rawPayload === null || rawPayload === '') && Platform.OS === 'web') {
        const idbPayload = await readFromIndexedDb(STORAGE_KEY);
        if (idbPayload) {
          rawPayload = idbPayload;
          console.log('[ScanJournal] loaded from indexedDB', { length: idbPayload.length });
        }
      }

      const parsed = safeParseJson<ScanJournalEntry[]>(rawPayload) ?? [];
      const normalized = Array.isArray(parsed) ? parsed.map((e) => normalizeEntry(e)).filter(Boolean) : [];
      const cleaned = Platform.OS === 'web' ? normalized.map((entry) => stripLargeWebImages(entry)) : normalized;
      return cleaned.sort((a, b) => {
        const aT = Number.isFinite(a.createdAt) ? a.createdAt : 0;
        const bT = Number.isFinite(b.createdAt) ? b.createdAt : 0;
        if (bT !== aT) return bT - aT;
        return String(b.id).localeCompare(String(a.id));
      });
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

    if (!Array.isArray(data)) {
      console.log('[ScanJournal] loadQuery no data (continuing)', { hasData: Boolean(data) });
      return;
    }

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

      const merged = Array.from(byId.values()).sort((a, b) => {
        const aT = Number.isFinite(a.createdAt) ? a.createdAt : 0;
        const bT = Number.isFinite(b.createdAt) ? b.createdAt : 0;
        if (bT !== aT) return bT - aT;
        return String(b.id).localeCompare(String(a.id));
      });
      console.log('[ScanJournal] merged initial load with optimistic entries', { fromStorage: data.length, existing: prev.length, merged: merged.length });
      return merged;
    });
    setErrorMessage(null);
  }, [data, error, isLoading]);

  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());

  const { mutateAsync: persistMutateAsync } = useMutation({
    mutationFn: async (nextEntries: ScanJournalEntry[]) => {
      const normalizedForStorage =
        Platform.OS === 'web' ? nextEntries.map((entry) => stripLargeWebImages(entry)) : nextEntries;
      const payload = JSON.stringify(normalizedForStorage);
      let didPersist = false;

      try {
        await AsyncStorage.setItem(STORAGE_KEY, payload);
        didPersist = true;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[ScanJournal] AsyncStorage.setItem failed', { message });
      }

      if (Platform.OS === 'web') {
        const ok = await writeToIndexedDb(STORAGE_KEY, payload);
        if (ok) didPersist = true;
      }

      if (!didPersist) {
        throw new Error('Storage unavailable');
      }

      return normalizedForStorage;
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[ScanJournal] persistMutation error', { message });
      setErrorMessage('Could not save your collection.');
    },
  });

  const persist = useCallback(
    (nextEntries: ScanJournalEntry[]) => {
      persistQueueRef.current = persistQueueRef.current
        .catch(() => {
          return;
        })
        .then(async () => {
          console.log('[ScanJournal] persist queued', { count: nextEntries.length });
          await persistMutateAsync(nextEntries);
        })
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[ScanJournal] persist queue error', { message });
        });
    },
    [persistMutateAsync],
  );

  const refresh = useCallback(async () => {
    console.log('[ScanJournal] refresh');
    setErrorMessage(null);
    loadedOnceRef.current = false;
    await refetch();
  }, [refetch]);

  const sortEntries = useCallback((list: ScanJournalEntry[]): ScanJournalEntry[] => {
    return [...list].sort((a, b) => {
      const aT = Number.isFinite(a.createdAt) ? a.createdAt : 0;
      const bT = Number.isFinite(b.createdAt) ? b.createdAt : 0;
      if (bT !== aT) return bT - aT;
      return String(b.id).localeCompare(String(a.id));
    });
  }, []);

  const addEntry = useCallback(
    async (entryInput: Omit<ScanJournalEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => {
      loadedOnceRef.current = true;
      const id = String(entryInput.id ?? `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const inputCreatedAt = Number.isFinite(entryInput.createdAt) ? (entryInput.createdAt as number) : Date.now();

      let resolvedEntry: ScanJournalEntry | null = null;

      setErrorMessage(null);
      setEntries((prev) => {
        const entry: ScanJournalEntry = normalizeEntry({
          id,
          createdAt: inputCreatedAt,
          title: entryInput.title,
          locationName: entryInput.locationName,
          location: entryInput.location,
          imageUri: entryInput.imageUri,
          imagePreviewUri: entryInput.imagePreviewUri,
          notes: entryInput.notes,
          chatHistory: entryInput.chatHistory,
          scan: entryInput.scan,
        });

        resolvedEntry = entry;

        const next = sortEntries([entry, ...prev.filter((e) => e.id !== entry.id)]);
        persist(next);
        return next;
      });

      const out =
        resolvedEntry ??
        normalizeEntry({
          id,
          createdAt: inputCreatedAt,
          title: entryInput.title,
          locationName: entryInput.locationName,
          location: entryInput.location,
          imageUri: entryInput.imageUri,
          imagePreviewUri: entryInput.imagePreviewUri,
          notes: entryInput.notes,
          chatHistory: entryInput.chatHistory,
          scan: entryInput.scan,
        });

      console.log('[ScanJournal] addEntry', { id: out.id, title: out.title, createdAt: out.createdAt });
      return out;
    },
    [persist, sortEntries],
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

        const sorted = sortEntries(next);
        persist(sorted);
        return sorted;
      });

      return updated;
    },
    [persist, sortEntries],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      loadedOnceRef.current = true;
      setErrorMessage(null);
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        persist(next);
        return next;
      });
      console.log('[ScanJournal] removeEntry', { id });
    },
    [persist],
  );

  const clearAll = useCallback(async () => {
    loadedOnceRef.current = true;
    setErrorMessage(null);
    setEntries(() => {
      const next: ScanJournalEntry[] = [];
      persist(next);
      return next;
    });
    console.log('[ScanJournal] clearAll');
  }, [persist]);

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
  const base = [
    params.commonName.trim().toLowerCase(),
    (params.scientificName ?? '').trim().toLowerCase(),
    String(Math.round(params.confidence * 1000)),
  ]
    .filter((p) => p.length > 0)
    .join('|');

  const entropySeed =
    (params.imageBase64 ? `b64:${params.imageBase64.slice(0, 120)}` : '') +
    (params.imageUri ? `|uri:${params.imageUri.slice(0, 240)}` : '');

  let hash = 5381;
  const combined = `${base}|${entropySeed}`;
  for (let i = 0; i < combined.length; i += 1) {
    hash = (hash * 33) ^ combined.charCodeAt(i);
  }

  const safeHash = (hash >>> 0).toString(16);
  const safeBase = base
    .replace(/[^a-z0-9|]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-|]+|[-|]+$/g, '')
    .slice(0, 72);

  return `scan-${safeBase}-${safeHash}`;
}
