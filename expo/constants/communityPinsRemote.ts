import { supabase } from '@/constants/supabase';
import type { CommunityPin, PinCategory } from '@/types/communityPin';

type CommunityPinRow = {
  id: string;
  payload: unknown;
  created_at: string;
};

function isPinCategory(x: unknown): x is PinCategory {
  return x === 'finding' || x === 'spot' || x === 'recipe';
}

export function communityPinFromRow(row: CommunityPinRow): CommunityPin | null {
  const p = row.payload;
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  if (!isPinCategory(o.category)) return null;
  const lat = Number(o.latitude);
  const lng = Number(o.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const tags = Array.isArray(o.tags) ? o.tags.map((t) => String(t)) : [];
  return {
    id: row.id,
    title: String(o.title ?? ''),
    description: String(o.description ?? ''),
    category: o.category,
    latitude: lat,
    longitude: lng,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : row.created_at,
    imageUri: typeof o.imageUri === 'string' ? o.imageUri : undefined,
    tags,
    author: String(o.author ?? ''),
  };
}

export async function fetchCommunityPinsRemote(userId: string): Promise<CommunityPin[]> {
  const { data, error } = await supabase
    .from('community_pins')
    .select('id, payload, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('[communityPinsRemote] fetch error', error);
    throw error;
  }

  const rows = (data ?? []) as CommunityPinRow[];
  return rows.map(communityPinFromRow).filter((p): p is CommunityPin => p !== null);
}

export async function upsertCommunityPinRemote(userId: string, pin: CommunityPin): Promise<boolean> {
  const { error } = await supabase.from('community_pins').upsert(
    {
      user_id: userId,
      id: pin.id,
      payload: pin as unknown as Record<string, unknown>,
    },
    { onConflict: 'user_id,id' }
  );
  if (error) {
    console.log('[communityPinsRemote] upsert error', error);
    return false;
  }
  return true;
}

export async function deleteCommunityPinRemote(userId: string, pinId: string): Promise<boolean> {
  const { error } = await supabase.from('community_pins').delete().eq('user_id', userId).eq('id', pinId);
  if (error) {
    console.log('[communityPinsRemote] delete error', error);
    return false;
  }
  return true;
}

export async function bulkUpsertCommunityPinsRemote(userId: string, pins: CommunityPin[]): Promise<boolean> {
  if (pins.length === 0) return true;
  const rows = pins.map((pin) => ({
    user_id: userId,
    id: pin.id,
    payload: pin as unknown as Record<string, unknown>,
  }));
  const { error } = await supabase.from('community_pins').upsert(rows, { onConflict: 'user_id,id' });
  if (error) {
    console.log('[communityPinsRemote] bulk upsert error', error);
    return false;
  }
  return true;
}
