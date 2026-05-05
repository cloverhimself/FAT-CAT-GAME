import { WalletContextState } from "@solana/wallet-adapter-react";
import { getWalletSessionToken, setWalletSessionToken } from "./client";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const SESSION_EXPIRES_KEY = "fat-cat-wallet-session-expires-at";
const SESSION_WALLET_KEY = "fat-cat-wallet-session-wallet";

type WalletAuthResponse = {
  sessionToken: string;
  expiresAt: string;
};

function getSupabaseFunctionUrl(path: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) throw new Error("Supabase URL is missing.");
  return `${base.replace(/\/$/, "")}/functions/v1/${path}`;
}

function isSessionValidForWallet(walletAddress: string): boolean {
  if (typeof window === "undefined") return false;
  const token = getWalletSessionToken();
  const wallet = localStorage.getItem(SESSION_WALLET_KEY);
  const expiresRaw = localStorage.getItem(SESSION_EXPIRES_KEY);
  if (!token || !wallet || !expiresRaw) return false;
  if (wallet !== walletAddress) return false;
  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs)) return false;
  return expiresAtMs > Date.now();
}

function buildChallenge(walletAddress: string): string {
  const nonce = crypto.randomUUID();
  const now = new Date().toISOString();
  return `FAT CAT Wallet Session\nWallet: ${walletAddress}\nNonce: ${nonce}\nIssued At: ${now}`;
}

function decodeSignature(signature: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < signature.length; i += 1) {
    binary += String.fromCharCode(signature[i]);
  }
  return btoa(binary);
}

export function clearWalletSession(): void {
  setWalletSessionToken(null);
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_EXPIRES_KEY);
    localStorage.removeItem(SESSION_WALLET_KEY);
  }
}

export async function ensureWalletSession(wallet: WalletContextState): Promise<void> {
  const walletAddress = wallet.publicKey?.toBase58();
  if (!walletAddress) {
    clearWalletSession();
    throw new Error("Connect your wallet first.");
  }

  if (isSessionValidForWallet(walletAddress)) {
    return;
  }

  if (!wallet.signMessage) {
    throw new Error("Selected wallet does not support message signing.");
  }

  const challenge = buildChallenge(walletAddress);
  const signature = await wallet.signMessage(new TextEncoder().encode(challenge));
  const signatureBase64 = decodeSignature(signature);

  const response = await fetch(getSupabaseFunctionUrl("wallet-auth"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      walletAddress,
      challenge,
      signature: signatureBase64,
      sessionTtlMs: SESSION_TTL_MS,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404) {
      throw new Error("Supabase wallet auth function is not deployed yet.");
    }
    if (response.status === 401) {
      throw new Error("Wallet signature verification failed.");
    }
    throw new Error(text || "Wallet authentication failed.");
  }

  const data = (await response.json()) as WalletAuthResponse;
  if (!data.sessionToken || !data.expiresAt) {
    throw new Error("Invalid wallet session response.");
  }

  setWalletSessionToken(data.sessionToken);
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_WALLET_KEY, walletAddress);
    localStorage.setItem(SESSION_EXPIRES_KEY, String(new Date(data.expiresAt).getTime()));
  }
}
