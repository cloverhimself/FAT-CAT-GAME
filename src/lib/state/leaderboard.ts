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
