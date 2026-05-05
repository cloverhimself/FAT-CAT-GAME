import { useMemo, useState } from "react";
import { LeaderboardEntry, sortByCheckIns, sortByHighestScore, sortByStreak, sortByXP } from "@/lib/state/leaderboard";
import { FaBolt, FaChartLine, FaFire, FaMedal } from "react-icons/fa";

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

const modeIcon: Record<Mode, JSX.Element> = {
  score: <FaMedal />,
  streak: <FaFire />,
  xp: <FaBolt />,
  checkins: <FaChartLine />,
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

  const renderValue = (entry: LeaderboardEntry): string => {
    if (mode === "score") return entry.score.toLocaleString();
    if (mode === "streak") return `${entry.streak}d`;
    if (mode === "xp") return entry.totalXP.toLocaleString();
    return entry.totalCheckIns.toLocaleString();
  };

  return (
    <section className="glass-panel grid gap-4 rounded-2xl p-4">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-black tracking-wide text-white">Leaderboard</h2>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {(Object.keys(modeLabel) as Mode[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 font-semibold transition ${
                mode === key
                  ? "border-cyan-200/80 bg-gradient-to-r from-[#ff8cc7] via-[#ff8f5f] to-[#4be5ff] text-white shadow-md"
                  : "border-white/20 bg-white/10 text-white/75 hover:bg-white/20"
              }`}
              onClick={() => setMode(key)}
            >
              <span className="text-[11px]">{modeIcon[key]}</span>
              {modeLabel[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.slice(0, 10).map((entry, idx) => (
          <div
            key={entry.id}
            className={`grid grid-cols-[40px,1fr,auto] items-center gap-2 rounded-xl border p-2 text-sm backdrop-blur ${
              idx < 3 ? "border-yellow-200/40 bg-yellow-100/10" : "border-white/10 bg-white/10"
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white/90">#{idx + 1}</span>
            <div className="truncate">
              <p className="truncate font-semibold text-white">{entry.username}</p>
              <p className="truncate text-[11px] text-white/55">{entry.wallet}</p>
            </div>
            <p className="font-black text-neon">{renderValue(entry)}</p>
          </div>
        ))}

        {sorted.length === 0 && <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/55">No submissions yet. Save a score to appear.</p>}
      </div>
    </section>
  );
}
