import { LeaderboardEntry } from "@/lib/state/leaderboard";
import { toUtcDay } from "@/lib/solana/dailyCheckIn";
import { getSupabase } from "./client";

export type UserProgress = {
  username: string;
  wallet: string;
  lastCheckInDay: string | null;
  streak: number;
  totalXP: number;
  totalCheckIns: number;
  bestScore: number;
};

function defaultProgress(wallet: string): UserProgress {
  return {
    username: "",
    wallet,
    lastCheckInDay: null,
    streak: 0,
    totalXP: 0,
    totalCheckIns: 0,
    bestScore: 0,
  };
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export function sanitizeUsername(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 18);
}

export async function fetchUserProgress(wallet: string): Promise<UserProgress> {
  const supabase = getSupabase();
  const [userRes, checkinRes] = await Promise.all([
    supabase.from("users").select("wallet_address,username,total_xp,current_streak,best_score,total_checkins").eq("wallet_address", wallet).maybeSingle(),
    supabase.from("checkins").select("checkin_date").eq("wallet_address", wallet).order("checkin_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (userRes.error) throw new Error(`Failed to load user: ${userRes.error.message}`);
  if (checkinRes.error) throw new Error(`Failed to load check-ins: ${checkinRes.error.message}`);

  if (!userRes.data) return defaultProgress(wallet);

  return {
    username: userRes.data.username,
    wallet: userRes.data.wallet_address,
    lastCheckInDay: checkinRes.data?.checkin_date ?? null,
    streak: userRes.data.current_streak,
    totalXP: userRes.data.total_xp,
    totalCheckIns: userRes.data.total_checkins,
    bestScore: userRes.data.best_score,
  };
}

export async function upsertUser(args: { wallet: string; username: string; progress?: Partial<UserProgress> }): Promise<UserProgress> {
  const supabase = getSupabase();
  const clean = sanitizeUsername(args.username);
  if (clean.length < 3) throw new Error("Username must be at least 3 valid characters.");

  const payload = {
    wallet_address: args.wallet,
    username: clean,
    total_xp: args.progress?.totalXP,
    current_streak: args.progress?.streak,
    best_score: args.progress?.bestScore,
    total_checkins: args.progress?.totalCheckIns,
  };

  const { error } = await supabase.from("users").upsert(payload, { onConflict: "wallet_address" });
  if (error) throw new Error(`Failed to save user: ${error.message}`);

  return fetchUserProgress(args.wallet);
}

export async function saveDailyCheckin(args: {
  wallet: string;
  username: string;
  txSignature: string;
  checkinDate?: string;
  xpAwarded: number;
  nextProgress: UserProgress;
}): Promise<void> {
  const supabase = getSupabase();
  const checkinDate = args.checkinDate ?? toUtcDay();
  const { error: checkinError } = await supabase.from("checkins").insert({
    wallet_address: args.wallet,
    username: sanitizeUsername(args.username),
    tx_signature: args.txSignature,
    checkin_date: checkinDate,
    xp_awarded: args.xpAwarded,
  });

  if (isUniqueViolation(checkinError)) {
    throw new Error("Already checked in today.");
  }
  if (checkinError) {
    throw new Error(`Failed to save check-in: ${checkinError.message}`);
  }

  const { error: userError } = await supabase.from("users").upsert(
    {
      wallet_address: args.wallet,
      username: sanitizeUsername(args.username),
      total_xp: args.nextProgress.totalXP,
      current_streak: args.nextProgress.streak,
      best_score: args.nextProgress.bestScore,
      total_checkins: args.nextProgress.totalCheckIns,
    },
    { onConflict: "wallet_address" },
  );

  if (userError) throw new Error(`Failed to update user totals: ${userError.message}`);
}

export async function saveScoreSubmission(args: {
  wallet: string;
  username: string;
  score: number;
  level: number;
  movesUsed: number;
  gameSessionId: string;
  txSignature: string;
  suspiciousScore: boolean;
  suspiciousReason: string | null;
  nextProgress: UserProgress;
}): Promise<void> {
  const supabase = getSupabase();
  const { error: scoreError } = await supabase.from("scores").insert({
    wallet_address: args.wallet,
    username: sanitizeUsername(args.username),
    score: args.score,
    level: args.level,
    moves_used: args.movesUsed,
    game_session_id: args.gameSessionId,
    tx_signature: args.txSignature,
    suspicious_score: args.suspiciousScore,
    suspicious_reason: args.suspiciousReason,
    reviewed: false,
  });

  if (isUniqueViolation(scoreError)) {
    throw new Error("This game session score has already been submitted.");
  }
  if (scoreError) {
    throw new Error(`Failed to save score: ${scoreError.message}`);
  }

  const { error: userError } = await supabase.from("users").upsert(
    {
      wallet_address: args.wallet,
      username: sanitizeUsername(args.username),
      total_xp: args.nextProgress.totalXP,
      current_streak: args.nextProgress.streak,
      best_score: args.nextProgress.bestScore,
      total_checkins: args.nextProgress.totalCheckIns,
    },
    { onConflict: "wallet_address" },
  );

  if (userError) throw new Error(`Failed to update user totals: ${userError.message}`);
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = getSupabase();
  const [usersRes, scoresRes] = await Promise.all([
    supabase.from("users").select("wallet_address,username,total_xp,current_streak,total_checkins,best_score,updated_at").order("best_score", { ascending: false }).limit(100),
    supabase.from("scores").select("wallet_address,level,created_at").order("created_at", { ascending: false }).limit(500),
  ]);

  if (usersRes.error) throw new Error(`Failed to load leaderboard users: ${usersRes.error.message}`);
  if (scoresRes.error) throw new Error(`Failed to load leaderboard scores: ${scoresRes.error.message}`);

  const latestScoreByWallet = new Map<string, { level: number; createdAt: string }>();
  for (const row of scoresRes.data ?? []) {
    if (!latestScoreByWallet.has(row.wallet_address)) {
      latestScoreByWallet.set(row.wallet_address, {
        level: row.level,
        createdAt: row.created_at,
      });
    }
  }

  return (usersRes.data ?? []).map((user) => {
    const latest = latestScoreByWallet.get(user.wallet_address);
    return {
      id: user.wallet_address,
      username: user.username,
      wallet: user.wallet_address,
      score: user.best_score,
      level: latest?.level ?? 1,
      submittedAt: latest?.createdAt ?? user.updated_at,
      streak: user.current_streak,
      totalXP: user.total_xp,
      totalCheckIns: user.total_checkins,
    };
  });
}

export async function hasSubmittedSession(gameSessionId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("scores")
    .select("id")
    .eq("game_session_id", gameSessionId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to verify session: ${error.message}`);
  return !!data;
}
