import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'bush-tucka.community-pins.v1';

export type PinCategory = 'finding' | 'spot' | 'recipe';

export type CommunityPin = {
  id: string;
  title: string;
  description: string;
  category: PinCategory;
  latitude: number;
  longitude: number;
  createdAt: string;
  imageUri?: string;
  tags: string[];
  author: string;
};

export const PIN_CATEGORY_META: Record<PinCategory, { label: string; emoji: string; color: string }> = {
  finding: { label: 'Finding', emoji: '🌿', color: '#38D989' },
  spot: { label: 'Spot', emoji: '📍', color: '#58A6FF' },
  recipe: { label: 'Recipe', emoji: '🍳', color: '#F6C445' },
};

export const [CommunityProvider, useCommunity] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [pins, setPins] = useState<CommunityPin[]>([]);

  const pinsQuery = useQuery({
    queryKey: ['community-pins'],
    queryFn: async () => {
      console.log('[CommunityProvider] Loading pins from storage');
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: CommunityPin[] = stored ? JSON.parse(stored) : [];
      console.log('[CommunityProvider] Loaded', parsed.length, 'pins');
      return parsed;
    },
  });

  useEffect(() => {
    if (pinsQuery.data) {
      setPins(pinsQuery.data);
    }
  }, [pinsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (updated: CommunityPin[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['community-pins'], data);
    },
  });

  const addPin = useCallback((pin: Omit<CommunityPin, 'id' | 'createdAt'>) => {
    const newPin: CommunityPin = {
      ...pin,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      createdAt: new Date().toISOString(),
    };
    console.log('[CommunityProvider] Adding pin:', newPin.title);
    const updated = [newPin, ...pins];
    setPins(updated);
    saveMutation.mutate(updated);
    return newPin;
  }, [pins, saveMutation]);

  const removePin = useCallback((id: string) => {
    console.log('[CommunityProvider] Removing pin:', id);
    const updated = pins.filter((p) => p.id !== id);
    setPins(updated);
    saveMutation.mutate(updated);
  }, [pins, saveMutation]);

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
