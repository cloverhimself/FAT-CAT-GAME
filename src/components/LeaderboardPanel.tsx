import { useMemo, useState } from "react";
import { LeaderboardEntry, sortByCheckIns, sortByHighestScore, sortByStreak, sortByXP } from "@/lib/state/leaderboard";

type Mode = "score" | "streak" | "xp" | "checkins";

type Props = {
  entries: LeaderboardEntry[];
};

const modeLabel: Record<Mode, string> = {
  score: "Highest Score",
  streak: "Daily Streak",
  xp: "Total XP",
  checkins: "Check-ins",
};

export function LeaderboardPanel({ entries }: Props) {
  const [mode, setMode] = useState<Mode>("score");

  const sorted = useMemo(() => {
    switch (mode) {
      case "streak":
        return sortByStreak(entries);
      case "xp":
        return sortByXP(entries);
      case "checkins":
        return sortByCheckIns(entries);
      default:
        return sortByHighestScore(entries);
    }
  }, [entries, mode]);

  return (
    <section className="grid gap-3 rounded-2xl border border-white/10 bg-panel/85 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Leaderboard</h2>
        <div className="flex gap-1 rounded-lg bg-black/25 p-1 text-xs">
          {(Object.keys(modeLabel) as Mode[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`rounded px-2 py-1 ${mode === key ? "bg-accent text-[#0e1116]" : "text-white/70"}`}
              onClick={() => setMode(key)}
            >
              {modeLabel[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.slice(0, 10).map((entry, idx) => (
          <div key={entry.id} className="grid grid-cols-[32px,1fr,auto] items-center gap-2 rounded-lg bg-black/20 p-2 text-sm">
            <span className="text-white/60">#{idx + 1}</span>
            <div className="truncate">
              <p className="truncate font-semibold text-white">{entry.username}</p>
              <p className="truncate text-xs text-white/55">{entry.wallet}</p>
            </div>
            <p className="font-bold text-neon">
              {mode === "score" && entry.score}
              {mode === "streak" && `${entry.streak}d`}
              {mode === "xp" && entry.totalXP}
              {mode === "checkins" && entry.totalCheckIns}
            </p>
          </div>
        ))}

        {sorted.length === 0 && <p className="text-sm text-white/55">No submissions yet. Submit a score to appear.</p>}
      </div>
    </section>
  );
}