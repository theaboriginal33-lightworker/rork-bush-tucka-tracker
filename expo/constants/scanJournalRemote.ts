import { supabase } from '@/constants/supabase';

export type ScanJournalRemoteRowInput = {
  id: string;
  storage_path: string | null;
  payload: Record<string, unknown>;
};

export async function fetchScanJournalRows(userId: string) {
  const { data, error } = await supabase
    .from('scan_journal_entries')
    .select('id, storage_path, payload, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.log('[scanJournalRemote] fetch error', error);
    throw error;
  }
  return data ?? [];
}

export async function upsertScanJournalRow(
  userId: string,
  row: ScanJournalRemoteRowInput
): Promise<boolean> {
  const { error } = await supabase.from('scan_journal_entries').upsert(
    {
      user_id: userId,
      id: row.id,
      storage_path: row.storage_path,
      payload: row.payload,
    },
    { onConflict: 'user_id,id' }
  );
  if (error) {
    console.log('[scanJournalRemote] upsert error', error);
    return false;
  }
  return true;
}

export async function bulkUpsertScanJournalRows(userId: string, rows: ScanJournalRemoteRowInput[]): Promise<boolean> {
  if (rows.length === 0) return true;
  const { error } = await supabase.from('scan_journal_entries').upsert(
    rows.map((r) => ({
      user_id: userId,
      id: r.id,
      storage_path: r.storage_path,
      payload: r.payload,
    })),
    { onConflict: 'user_id,id' }
  );
  if (error) {
    console.log('[scanJournalRemote] bulk upsert error', error);
    return false;
  }
  return true;
}

export async function deleteScanJournalRow(userId: string, entryId: string): Promise<boolean> {
  const { error } = await supabase.from('scan_journal_entries').delete().eq('user_id', userId).eq('id', entryId);
  if (error) {
    console.log('[scanJournalRemote] delete error', error);
    return false;
  }
  return true;
}

export async function deleteAllScanJournalRows(userId: string): Promise<boolean> {
  const { error } = await supabase.from('scan_journal_entries').delete().eq('user_id', userId);
  if (error) {
    console.log('[scanJournalRemote] delete all error', error);
    return false;
  }
  return true;
}
