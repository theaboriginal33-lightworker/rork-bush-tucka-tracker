import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  bulkUpsertCommunityPinsRemote,
  deleteCommunityPinRemote,
  fetchCommunityPinsRemote,
  upsertCommunityPinRemote,
} from '@/constants/communityPinsRemote';
import { hasSupabaseConfig } from '@/constants/supabase';
import type { CommunityPin, PinCategory } from '@/types/communityPin';

export type { CommunityPin, PinCategory } from '@/types/communityPin';

const STORAGE_KEY = 'bush-tucka.community-pins.v1';

function safeParsePins(raw: string): CommunityPin[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CommunityPin[]) : [];
  } catch {
    return [];
  }
}

export const PIN_CATEGORY_META: Record<PinCategory, { label: string; emoji: string; color: string }> = {
  finding: { label: 'Finding', emoji: '🌿', color: '#38D989' },
  spot: { label: 'Spot', emoji: '📍', color: '#58A6FF' },
  recipe: { label: 'Recipe', emoji: '🍳', color: '#F6C445' },
};

export const [CommunityProvider, useCommunity] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const remoteEnabled = Boolean(hasSupabaseConfig && userId);

  const pinsQueryKey = useMemo(
    () => ['community-pins', remoteEnabled && userId ? userId : 'local'] as const,
    [remoteEnabled, userId],
  );

  const [pins, setPins] = useState<CommunityPin[]>([]);

  const pinsQuery = useQuery({
    queryKey: pinsQueryKey,
    queryFn: async () => {
      if (remoteEnabled && userId) {
        console.log('[CommunityProvider] Loading pins from Supabase');
        let fromCloud = await fetchCommunityPinsRemote(userId);
        if (fromCloud.length === 0) {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          const local: CommunityPin[] = stored ? safeParsePins(stored) : [];
          if (local.length > 0) {
            const ok = await bulkUpsertCommunityPinsRemote(userId, local);
            if (ok) {
              console.log('[CommunityProvider] Migrated local pins to Supabase', { count: local.length });
              fromCloud = await fetchCommunityPinsRemote(userId);
            }
          }
        }
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fromCloud));
        console.log('[CommunityProvider] Loaded pins (remote)', { count: fromCloud.length });
        return fromCloud;
      }

      console.log('[CommunityProvider] Loading pins from AsyncStorage');
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: CommunityPin[] = stored ? safeParsePins(stored) : [];
      console.log('[CommunityProvider] Loaded pins (local)', { count: parsed.length });
      return parsed;
    },
  });

  useEffect(() => {
    if (pinsQuery.data) {
      setPins(pinsQuery.data);
    }
  }, [pinsQuery.data]);

  const persistLocal = useCallback(async (updated: CommunityPin[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const syncReactQueryCache = useCallback(
    (next: CommunityPin[]) => {
      queryClient.setQueryData(pinsQueryKey, next);
    },
    [queryClient, pinsQueryKey],
  );

  const addPin = useCallback(
    (pin: Omit<CommunityPin, 'id' | 'createdAt'>) => {
      const newPin: CommunityPin = {
        ...pin,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        createdAt: new Date().toISOString(),
      };
      console.log('[CommunityProvider] Adding pin:', newPin.title);
      setPins((prev) => {
        const updated = [newPin, ...prev];
        void (async () => {
          await persistLocal(updated);
          syncReactQueryCache(updated);
          if (remoteEnabled && userId) {
            const ok = await upsertCommunityPinRemote(userId, newPin);
            if (!ok) {
              console.log('[CommunityProvider] Supabase upsert failed; data kept locally');
            }
          }
        })();
        return updated;
      });
      return newPin;
    },
    [persistLocal, remoteEnabled, syncReactQueryCache, userId],
  );

  const removePin = useCallback(
    (id: string) => {
      console.log('[CommunityProvider] Removing pin:', id);
      setPins((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        void (async () => {
          await persistLocal(updated);
          syncReactQueryCache(updated);
          if (remoteEnabled && userId) {
            const ok = await deleteCommunityPinRemote(userId, id);
            if (!ok) {
              console.log('[CommunityProvider] Supabase delete failed; data updated locally only');
            }
          }
        })();
        return updated;
      });
    },
    [persistLocal, remoteEnabled, syncReactQueryCache, userId],
  );

  const getPinsByCategory = useCallback((category: PinCategory) => {
    return pins.filter((p) => p.category === category);
  }, [pins]);

  return useMemo(() => ({
    pins,
    addPin,
    removePin,
    getPinsByCategory,
    isLoading: pinsQuery.isLoading,
  }), [pins, addPin, removePin, getPinsByCategory, pinsQuery.isLoading]);
});
