import type { SupabaseClient } from "@supabase/supabase-js";

// Petit cache cloud : une ligne par clé dans la table market_cache.
export async function readCache<T>(sb: SupabaseClient, key: string): Promise<T | null> {
  const { data, error } = await sb.from("market_cache").select("data").eq("key", key).maybeSingle();
  if (error || !data) return null;
  return data.data as T;
}

export async function writeCache(sb: SupabaseClient, key: string, value: unknown): Promise<string | null> {
  const { error } = await sb
    .from("market_cache")
    .upsert({ key, data: value, updated_at: new Date().toISOString() });
  return error ? `Cloud save failed (${error.message})` : null;
}
