type Props = {
  username: string;
  score: number;
  level: number;
  streak: number;
  totalXP: number;
  totalCheckIns: number;
  movesRemaining: number;
  onCheckIn: () => void;
  onSubmitScore: () => void;
  canCheckIn: boolean;
  checkInBusy: boolean;
  submitBusy: boolean;
  outOfMoves: boolean;
};

export function GameHud({
  username,
  score,
  level,
  streak,
  totalXP,
  totalCheckIns,
  movesRemaining,
  onCheckIn,
  onSubmitScore,
  canCheckIn,
  checkInBusy,
  submitBusy,
  outOfMoves,
}: Props) {
  return (
    <section className="grid gap-3 rounded-2xl border border-white/10 bg-panel/85 p-4 shadow-glow">
      <div className="grid grid-cols-2 gap-2 text-sm text-white/80 sm:grid-cols-4">
        <div className="rounded-lg bg-black/25 p-2">User: {username}</div>
        <div className="rounded-lg bg-black/25 p-2">Score: {score}</div>
        <div className="rounded-lg bg-black/25 p-2">Level: {level}</div>
        <div className="rounded-lg bg-black/25 p-2">Moves: {movesRemaining}</div>
        <div className="rounded-lg bg-black/25 p-2">Streak: {streak} days</div>
        <div className="rounded-lg bg-black/25 p-2">XP: {totalXP}</div>
        <div className="rounded-lg bg-black/25 p-2">Check-ins: {totalCheckIns}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCheckIn}
          disabled={!canCheckIn || checkInBusy}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#0e1116] disabled:opacity-45"
        >
          {checkInBusy ? "Checking in..." : canCheckIn ? "Daily Check-in" : "Checked-in Today"}
        </button>

        <button
          type="button"
          onClick={onSubmitScore}
          disabled={submitBusy}
          className="rounded-lg bg-accent2 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#0e1116] disabled:opacity-45"
        >
          {submitBusy ? "Submitting..." : "Submit Score On-Chain"}
        </button>
      </div>

      {outOfMoves && <p className="text-xs text-accent2">Out of moves. Submit this run or restart from onboarding.</p>}
      <p className="text-xs text-white/60">Rewards are manual only. No token distributions are automated in-app.</p>
    </section>
  );
}