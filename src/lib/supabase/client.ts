import { createClient } from "@supabase/supabase-js";
import { Database } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseEnv
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          "X-Client-Info": "fat-cat-match3",
        },
      },
    })
  : null;

export function assertSupabaseReady(): void {
  if (!hasSupabaseEnv || !supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local and restart dev server.",
    );
  }
}

export function getSupabase() {
  assertSupabaseReady();
  return supabase!;
}
