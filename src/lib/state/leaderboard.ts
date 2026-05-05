import { toUtcDay } from "../solana/dailyCheckIn";

export type LeaderboardEntry = {
  id: string;
  username: string;
  wallet: string;
  score: number;
  level: number;
  submittedAt: string;
  streak: number;
  totalXP: number;
  totalCheckIns: number;
};

const LEADERBOARD_KEY = "meme-match3-leaderboard";

export function getLeaderboard(): LeaderboardEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LEADERBOARD_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries.slice(0, 100)));
}

export function upsertLeaderboardEntry(entry: LeaderboardEntry): LeaderboardEntry[] {
  const current = getLeaderboard();
  const updated = [entry, ...current.filter((item) => item.id !== entry.id)];
  saveLeaderboard(updated);
  return updated;
}

export function sortByHighestScore(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => b.score - a.score);
}

export function sortByStreak(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => b.streak - a.streak || b.totalXP - a.totalXP);
}

export function sortByXP(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => b.totalXP - a.totalXP || b.score - a.score);
}

export function sortByCheckIns(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => b.totalCheckIns - a.totalCheckIns || b.streak - a.streak);
}

export function isSameDay(isoDay: string | null): boolean {
  if (!isoDay) return false;
  return isoDay === toUtcDay();
}