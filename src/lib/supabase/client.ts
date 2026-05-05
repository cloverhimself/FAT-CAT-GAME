import { createClient } from "@supabase/supabase-js";
import { Database } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const WALLET_SESSION_KEY = "fat-cat-wallet-session-token";

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

let currentWalletSessionToken: string | null =
  typeof window !== "undefined" ? localStorage.getItem(WALLET_SESSION_KEY) : null;

let currentClientToken: string | null = null;
let cachedClient: ReturnType<typeof createClient<Database>> | null = null;

function createSupabaseClient(walletSessionToken: string | null) {
  const headers: Record<string, string> = {
    "X-Client-Info": "fat-cat-match3",
  };
  if (walletSessionToken) {
    headers["x-wallet-session"] = walletSessionToken;
  }

  return createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: { headers },
  });
}

export function setWalletSessionToken(token: string | null): void {
  currentWalletSessionToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem(WALLET_SESSION_KEY, token);
    } else {
      localStorage.removeItem(WALLET_SESSION_KEY);
    }
  }
}

export function getWalletSessionToken(): string | null {
  return currentWalletSessionToken;
}

export function assertSupabaseReady(): void {
  if (!hasSupabaseEnv) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local and restart dev server.",
    );
  }
}

export function getSupabase() {
  assertSupabaseReady();
  if (!cachedClient || currentClientToken !== currentWalletSessionToken) {
    cachedClient = createSupabaseClient(currentWalletSessionToken);
    currentClientToken = currentWalletSessionToken;
  }
  return cachedClient;
}
