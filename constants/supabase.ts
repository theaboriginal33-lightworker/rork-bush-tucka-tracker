import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = "https://vynorjorxebyvuyxnntd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bm9yam9yeGVieXZ1eXhubnRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzQ0NjYsImV4cCI6MjA4NTU1MDQ2Nn0.GtexN1CtNL2mkIbSwQOevwSPiLUSVC9IKXNI-B9AG3U";
console.log("https://vynorjorxebyvuyxnntd.supabase.co", SUPABASE_URL);
console.log("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bm9yam9yeGVieXZ1eXhubnRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzQ0NjYsImV4cCI6MjA4NTU1MDQ2Nn0.GtexN1CtNL2mkIbSwQOevwSPiLUSVC9IKXNI-B9AG3U", SUPABASE_ANON_KEY?.slice(0, 10));

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

if (!hasSupabaseConfig) {

}
