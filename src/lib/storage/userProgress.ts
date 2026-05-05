export type UserProgress = {
  username: string;
  wallet: string;
  lastCheckInDay: string | null;
  streak: number;
  totalXP: number;
  totalCheckIns: number;
  bestScore: number;
};

const storageKey = (wallet: string): string => `meme-match3-progress:${wallet}`;

export function getUserProgress(wallet: string): UserProgress {
  if (typeof window === "undefined") {
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

  const raw = window.localStorage.getItem(storageKey(wallet));
  if (!raw) {
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

  try {
    return JSON.parse(raw) as UserProgress;
  } catch {
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
}

export function saveUserProgress(progress: UserProgress): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(progress.wallet), JSON.stringify(progress));
}