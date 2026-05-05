import { LeaderboardEntry } from "@/lib/state/leaderboard";
import { LeaderboardMode } from "@/lib/supabase/gameData";
import { FaBolt, FaChartLine, FaFire, FaMedal } from "react-icons/fa";

type Props = {
  entries: LeaderboardEntry[];
  mode: LeaderboardMode;
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  onModeChange: (mode: LeaderboardMode) => void;
  onLoadMore: () => void;
  onRetry: () => void;
};

const modeLabel: Record<LeaderboardMode, string> = {
  score: "Highest Score",
  streak: "Daily Streak",
  xp: "Total XP",
  checkins: "Check-ins",
};

const modeIcon: Record<LeaderboardMode, JSX.Element> = {
  score: <FaMedal />,
  streak: <FaFire />,
  xp: <FaBolt />,
  checkins: <FaChartLine />,
};

export function LeaderboardPanel({ entries, mode, isLoading, hasMore, error, onModeChange, onLoadMore, onRetry }: Props) {
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
          {(Object.keys(modeLabel) as LeaderboardMode[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 font-semibold transition ${
                mode === key
                  ? "border-cyan-200/80 bg-gradient-to-r from-[#ff8cc7] via-[#ff8f5f] to-[#4be5ff] text-white shadow-md"
                  : "border-white/20 bg-white/10 text-white/75 hover:bg-white/20"
              }`}
              onClick={() => onModeChange(key)}
            >
              <span className="text-[11px]">{modeIcon[key]}</span>
              {modeLabel[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {entries.map((entry, idx) => (
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

        {isLoading && <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/75">Loading leaderboard...</p>}
        {error && (
          <div className="rounded-lg border border-red-300/40 bg-red-500/15 p-3 text-sm text-red-100">
            <p>{error}</p>
            <button type="button" onClick={onRetry} className="mt-2 rounded bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30">
              Retry
            </button>
          </div>
        )}
        {!isLoading && !error && entries.length === 0 && <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/55">No submissions yet. Save a score to appear.</p>}
        {hasMore && !error && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoading}
            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Load More"}
          </button>
        )}
      </div>
    </section>
  );
}
