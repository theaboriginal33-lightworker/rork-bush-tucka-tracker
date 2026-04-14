import { supabase } from '@/constants/supabase';

function stripUriForRemote(u: unknown): string | undefined {
  if (typeof u !== 'string') return undefined;
  const t = u.trim();
  if (!t) return undefined;
  if (t.startsWith('file:')) return undefined;
  if (t.startsWith('data:')) return undefined;
  if (t.startsWith('blob:')) return undefined;
  return t;
}

/** Strip non-portable URIs before upsert; keep `storagePath` for images across devices. */
export function cookRecipeEntryToRemotePayload(entry: Record<string, unknown>): Record<string, unknown> {
  const createdAt = typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now();
  const clientUpdatedAt =
    typeof entry.clientUpdatedAt === 'number' && Number.isFinite(entry.clientUpdatedAt) ? entry.clientUpdatedAt : createdAt;
  return {
    ...entry,
    clientUpdatedAt,
    imageUri: stripUriForRemote(entry.imageUri),
    imagePreviewUri: stripUriForRemote(entry.imagePreviewUri),
  };
}

export type CookbookManualRemoteRowInput = {
  id: string;
  payload: Record<string, unknown>;
};

export type CookbookManualRemoteRow = {
  id: string;
  payload: unknown;
  updated_at: string;
};

export async function fetchCookbookManualRows(userId: string): Promise<CookbookManualRemoteRow[]> {
  const { data, error } = await supabase
    .from('cookbook_manual_entries')
    .select('id, payload, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.log('[cookbookRemote] fetch error', error);
    throw error;
  }
  return (data ?? []) as CookbookManualRemoteRow[];
}

export async function upsertCookbookManualRow(userId: string, row: CookbookManualRemoteRowInput): Promise<boolean> {
  const { error } = await supabase.from('cookbook_manual_entries').upsert(
    {
      user_id: userId,
      id: row.id,
      payload: row.payload,
    },
    { onConflict: 'user_id,id' },
  );
  if (error) {
    console.log('[cookbookRemote] upsert error', error);
    return false;
  }
  return true;
}

export async function bulkUpsertCookbookManualRows(userId: string, rows: CookbookManualRemoteRowInput[]): Promise<boolean> {
  if (rows.length === 0) return true;
  const { error } = await supabase.from('cookbook_manual_entries').upsert(
    rows.map((r) => ({
      user_id: userId,
      id: r.id,
      payload: r.payload,
    })),
    { onConflict: 'user_id,id' },
  );
  if (error) {
    console.log('[cookbookRemote] bulk upsert error', error);
    return false;
  }
  return true;
}

export async function deleteCookbookManualRow(userId: string, entryId: string): Promise<boolean> {
  const { error } = await supabase.from('cookbook_manual_entries').delete().eq('user_id', userId).eq('id', entryId);
  if (error) {
    console.log('[cookbookRemote] delete error', error);
    return false;
  }
  return true;
}

export async function deleteAllCookbookManualRows(userId: string): Promise<boolean> {
  const { error } = await supabase.from('cookbook_manual_entries').delete().eq('user_id', userId);
  if (error) {
    console.log('[cookbookRemote] delete all error', error);
    return false;
  }
  return true;
}
