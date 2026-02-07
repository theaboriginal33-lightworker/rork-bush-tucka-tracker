import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

const STORAGE_KEY = 'bush-tucka.scan-journal.v1';
const MAX_WEB_DATA_URI_LENGTH = 650_000;
const WEB_IDB_DB = 'bush-tucka-tracka';
const WEB_IDB_STORE = 'scan-journal';

let webMemoryCache: ScanJournalEntry[] | null = null;

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

export type ScanJournalEntry = {
  id: string;
  createdAt: number;
  title: string;
  locationName?: string;
  imageUri?: string;
  imagePreviewUri?: string;
  notes?: string;
  scan: GeminiScanResult;
};

type ScanJournalContextValue = {
  entries: ScanJournalEntry[];
  isLoading: boolean;
  errorMessage: string | null;
  addEntry: (entry: Omit<ScanJournalEntry, 'createdAt'> & { createdAt?: number }) => Promise<ScanJournalEntry>;
  removeEntry: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
};

const ScanJournalContext = createContext<ScanJournalContextValue | null>(null);

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeSafetyStatus(raw: unknown): SafetyEdibility['status'] {
  const s = String(raw ?? 'unknown');
  if (s === 'safe') return 'safe';
  if (s === 'caution') return 'caution';
  if (s === 'unsafe' || s === 'not_edible') return 'caution';
  return 'unknown';
}

function normalizeEntry(input: ScanJournalEntry): ScanJournalEntry {
  const safeArray = (value: unknown, max: number): string[] => {
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v)).filter((v) => v.trim().length > 0).slice(0, max);
  };

  const scan = input.scan ?? ({} as GeminiScanResult);
  const normalizedScan: GeminiScanResult = {
    commonName: String(scan.commonName ?? 'Unconfirmed Plant'),
    scientificName: scan.scientificName ? String(scan.scientificName) : undefined,
    confidence: Number.isFinite(scan.confidence) ? Math.max(0, Math.min(1, Number(scan.confidence))) : 0,
    safety: {
      status: normalizeSafetyStatus(scan.safety?.status),
      summary: String(scan.safety?.summary ?? ''),
      keyRisks: safeArray(scan.safety?.keyRisks, 12),
    },
    categories: safeArray(scan.categories, 12),
    bushTuckerLikely: Boolean(scan.bushTuckerLikely ?? false),
    preparation: {
      ease: (scan.preparation?.ease ?? 'unknown') as Preparation['ease'],
      steps: safeArray(scan.preparation?.steps, 16),
    },
    seasonality: {
      bestMonths: safeArray(scan.seasonality?.bestMonths, 12),
      notes: String(scan.seasonality?.notes ?? ''),
    },
    culturalKnowledge: {
      notes: String(scan.culturalKnowledge?.notes ?? ''),
      respect: safeArray(scan.culturalKnowledge?.respect, 12),
    },
    warnings: safeArray(scan.warnings, 16),
    suggestedUses: safeArray(scan.suggestedUses, 16),
  };

  return {
    id: String(input.id ?? ''),
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : Date.now(),
    title: String(input.title ?? normalizedScan.commonName ?? 'Unconfirmed Plant'),
    locationName: input.locationName ? String(input.locationName) : undefined,
    imageUri: input.imageUri ? String(input.imageUri) : undefined,
    imagePreviewUri: input.imagePreviewUri ? String(input.imagePreviewUri) : undefined,
    notes: typeof input.notes === 'string' ? input.notes : undefined,
    scan: normalizedScan,
  };
}

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

function getIndexedDb(): IDBFactory | null {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as unknown as { indexedDB?: IDBFactory };
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
    } catch {
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
    } catch {
      resolve(false);
    }
  });
}

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    const storage = globalThis?.localStorage ?? null;
    return storage ?? null;
  } catch {
    return null;
  }
}

async function readFromLocalStorage(key: string): Promise<string | null> {
  const storage = getWebStorage();
  if (!storage) return null;
  try {
    const value = storage.getItem(key);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

async function writeToLocalStorage(key: string, value: string): Promise<boolean> {
  const storage = getWebStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function ScanJournalProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ScanJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const storageInitRef = useRef<boolean>(false);

  useEffect(() => {
    if (storageInitRef.current) return;
    storageInitRef.current = true;

    if (Platform.OS === 'web') {
      const nav = globalThis?.navigator as unknown as { storage?: { persist?: () => Promise<boolean> } } | undefined;
      const persist = nav?.storage?.persist;
      if (typeof persist === 'function') {
        persist().catch(() => {
          return;
        });
      }
    }
  }, []);

  const sortEntries = useCallback((list: ScanJournalEntry[]): ScanJournalEntry[] => {
    return [...list].sort((a, b) => {
      const aT = Number.isFinite(a.createdAt) ? a.createdAt : 0;
      const bT = Number.isFinite(b.createdAt) ? b.createdAt : 0;
      if (bT !== aT) return bT - aT;
      return String(b.id).localeCompare(String(a.id));
    });
  }, []);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      let rawPayload: string | null = null;

      if (Platform.OS === 'web') {
        if (webMemoryCache && webMemoryCache.length > 0) {
          rawPayload = JSON.stringify(webMemoryCache);
        }
        const idbPayload = await readFromIndexedDb(STORAGE_KEY);
        if (idbPayload) rawPayload = idbPayload;
        if (!rawPayload) {
          const localPayload = await readFromLocalStorage(STORAGE_KEY);
          if (localPayload) rawPayload = localPayload;
        }
      }

      if (!rawPayload) {
        rawPayload = await AsyncStorage.getItem(STORAGE_KEY);
      }

      const parsed = safeParseJson<ScanJournalEntry[]>(rawPayload) ?? [];
      const normalized = Array.isArray(parsed) ? parsed.map((e) => normalizeEntry(e)).filter(Boolean) : [];
      const cleaned = Platform.OS === 'web' ? normalized.map((entry) => stripLargeWebImages(entry)) : normalized;
      if (Platform.OS === 'web') {
        webMemoryCache = cleaned;
      }
      setEntries(sortEntries(cleaned));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[ScanJournal] load failed', { message });
      setErrorMessage('Could not load your collection.');
    } finally {
      setIsLoading(false);
    }
  }, [sortEntries]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const persist = useCallback(
    async (nextEntries: ScanJournalEntry[]) => {
      const normalizedForStorage =
        Platform.OS === 'web' ? nextEntries.map((entry) => stripLargeWebImages(entry)) : nextEntries;
      const payload = JSON.stringify(normalizedForStorage);
      let didPersist = false;

      if (Platform.OS === 'web') {
        webMemoryCache = normalizedForStorage;
        const idbOk = await writeToIndexedDb(STORAGE_KEY, payload);
        if (idbOk) didPersist = true;
        const localOk = await writeToLocalStorage(STORAGE_KEY, payload);
        if (localOk) didPersist = true;
      }

      try {
        await AsyncStorage.setItem(STORAGE_KEY, payload);
        didPersist = true;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[ScanJournal] AsyncStorage.setItem failed', { message });
      }

      if (!didPersist) {
        setErrorMessage('Could not save your collection.');
      }
    },
    [],
  );

  const addEntry = useCallback(
    async (entryInput: Omit<ScanJournalEntry, 'createdAt'> & { createdAt?: number }) => {
      const entry: ScanJournalEntry = normalizeEntry({
        ...entryInput,
        createdAt: Number.isFinite(entryInput.createdAt) ? (entryInput.createdAt as number) : Date.now(),
      } as ScanJournalEntry);

      setEntries((prev) => {
        const next = sortEntries([entry, ...prev.filter((e) => e.id !== entry.id)]);
        if (Platform.OS === 'web') {
          webMemoryCache = next;
        }
        void persist(next);
        return next;
      });

      return entry;
    },
    [persist, sortEntries],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        if (Platform.OS === 'web') {
          webMemoryCache = next;
        }
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearAll = useCallback(async () => {
    setEntries(() => {
      const next: ScanJournalEntry[] = [];
      if (Platform.OS === 'web') {
        webMemoryCache = next;
      }
      void persist(next);
      return next;
    });
  }, [persist]);

  const refresh = useCallback(async () => {
    await loadEntries();
  }, [loadEntries]);

  const value = useMemo<ScanJournalContextValue>(
    () => ({
      entries,
      isLoading,
      errorMessage,
      addEntry,
      removeEntry,
      clearAll,
      refresh,
    }),
    [addEntry, clearAll, entries, errorMessage, isLoading, refresh, removeEntry],
  );

  return <ScanJournalContext.Provider value={value}>{children}</ScanJournalContext.Provider>;
}

export function useScanJournal() {
  const ctx = useContext(ScanJournalContext);
  if (!ctx) {
    throw new Error('useScanJournal must be used within ScanJournalProvider');
  }
  return ctx;
}

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
