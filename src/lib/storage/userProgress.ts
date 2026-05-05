export type UserProgress = {
  username: string;
  wallet: string;
  lastCheckInDay: string | null;
  streak: number;
  totalXP: number;
  totalCheckIns: number;
  bestScore: number;
};

export function emptyUserProgress(wallet: string): UserProgress {
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
