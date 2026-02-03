import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'bush-tucka.learn.imageOverrides.v1';

type LearnImageContextValue = {
  isReady: boolean;
  isLoading: boolean;
  errorMessage: string | null;

  getPlantImageUrl: (slug: string | null | undefined) => string | undefined;
  setPlantImageUrl: (slug: string, uri: string) => Promise<void>;
  clearPlantImageUrl: (slug: string) => Promise<void>;
  refresh: () => Promise<void>;
};

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[LearnImages] safeParseJson failed', { message });
    return null;
  }
}

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
}

export const [LearnImageProvider, useLearnImages] = createContextHook<LearnImageContextValue>(() => {
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    console.log('[LearnImages] load start');
    setIsLoading(true);

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = safeParseJson<Record<string, string | null>>(raw) ?? {};

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setOverrides(parsed);
        console.log('[LearnImages] load ok', { count: Object.keys(parsed).length });
      } else {
        setOverrides({});
        console.log('[LearnImages] load empty');
      }
      setErrorMessage(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[LearnImages] load failed', { message });
      setOverrides({});
      setErrorMessage('Could not load your image settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async (next: Record<string, string | null>) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      console.log('[LearnImages] persisted', { count: Object.keys(next).length });
      setErrorMessage(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[LearnImages] persist failed', { message });
      setErrorMessage('Could not save your image.');
    }
  }, []);

  const getPlantImageUrl = useCallback(
    (slug: string | null | undefined) => {
      const key = slug ? normalizeKey(slug) : '';
      if (!key) return undefined;
      const value = overrides[key];
      return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
    },
    [overrides]
  );

  const setPlantImageUrl = useCallback(
    async (slug: string, uri: string) => {
      const key = normalizeKey(slug);
      const nextUri = String(uri ?? '').trim();
      if (!key || !nextUri) throw new Error('Missing slug or image URI');

      const next = { ...overrides, [key]: nextUri };
      setOverrides(next);
      await persist(next);
    },
    [overrides, persist]
  );

  const clearPlantImageUrl = useCallback(
    async (slug: string) => {
      const key = normalizeKey(slug);
      if (!key) return;

      const next = { ...overrides };
      delete next[key];
      setOverrides(next);
      await persist(next);
    },
    [overrides, persist]
  );

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const isReady = useMemo(() => !isLoading, [isLoading]);

  return {
    isReady,
    isLoading,
    errorMessage,
    getPlantImageUrl,
    setPlantImageUrl,
    clearPlantImageUrl,
    refresh,
  };
});
