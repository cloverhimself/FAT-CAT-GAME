// Supabase Edge Function: wallet-auth
// Verifies a Solana wallet signature and issues a short-lived wallet session token
// consumed by RLS via request header `x-wallet-session`.

import { createClient } from "npm:@supabase/supabase-js@2";
import bs58 from "npm:bs58@6";
import { ed25519 } from "npm:@noble/curves@1.9.2/ed25519";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  walletAddress: string;
  challenge: string;
  signature: string;
  sessionTtlMs?: number;
};

const WALLET_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const MIN_TTL_MS = 1000 * 60 * 5; // 5m

function b64ToBytes(base64: string): Uint8Array {
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Payload;
    const walletAddress = body.walletAddress?.trim();
    const challenge = body.challenge?.trim();
    const signatureBase64 = body.signature?.trim();
    const sessionTtlMs = Math.max(MIN_TTL_MS, Math.min(MAX_TTL_MS, body.sessionTtlMs ?? 1000 * 60 * 60 * 12));

    if (!walletAddress || !WALLET_REGEX.test(walletAddress)) {
      return new Response("Invalid wallet address.", { status: 400, headers: corsHeaders });
    }
    if (!challenge || challenge.length < 20 || challenge.length > 1024) {
      return new Response("Invalid challenge.", { status: 400, headers: corsHeaders });
    }
    if (!signatureBase64) {
      return new Response("Missing signature.", { status: 400, headers: corsHeaders });
    }
    if (!challenge.includes(walletAddress)) {
      return new Response("Challenge does not include wallet address.", { status: 400, headers: corsHeaders });
    }

    const publicKey = bs58.decode(walletAddress);
    const signature = b64ToBytes(signatureBase64);
    const message = new TextEncoder().encode(challenge);
    const isValid = ed25519.verify(signature, message, publicKey);

    if (!isValid) {
      return new Response("Invalid wallet signature.", { status: 401, headers: corsHeaders });
    }

    const sessionToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) {
      return new Response("Function secrets not configured.", { status: 500, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: upsertError } = await admin.from("wallet_sessions").upsert(
      {
        token_hash: tokenHash,
        wallet_address: walletAddress,
        expires_at: expiresAt,
      },
      { onConflict: "token_hash" },
    );
    if (upsertError) {
      return new Response(`Session write failed: ${upsertError.message}`, { status: 500, headers: corsHeaders });
    }

    await admin.from("wallet_sessions").delete().lt("expires_at", new Date().toISOString());

    return new Response(
      JSON.stringify({
        sessionToken,
        expiresAt,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    return new Response(`wallet-auth failed: ${error instanceof Error ? error.message : String(error)}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
