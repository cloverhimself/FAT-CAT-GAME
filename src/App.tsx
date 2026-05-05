import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SolanaAppProvider } from "@/components/SolanaAppProvider";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { WalletStatusBanner } from "@/components/WalletStatusBanner";
import { GameBoard } from "@/components/GameBoard";
import { GameHud } from "@/components/GameHud";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { canSwap, clearAndDrop, createBoard, scoreForMatch, swapTiles } from "@/lib/game/gameLogic";
import { Coord } from "@/lib/game/types";
import { findMatches } from "@/lib/game/tileMatching";
import { getNetworkLabel } from "@/lib/config/network";
import { submitDailyCheckInTx, toUtcDay } from "@/lib/solana/dailyCheckIn";
import { submitScoreTx } from "@/lib/solana/scoreSubmission";
import { SolanaTxState, checkRpcHealth, classifyTxError, toErrorMessage } from "@/lib/solana/txHelpers";
import { LeaderboardEntry, getLeaderboard, isSameDay, upsertLeaderboardEntry } from "@/lib/state/leaderboard";
import { UserProgress, getUserProgress, saveUserProgress } from "@/lib/storage/userProgress";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_MOVES = 30;
const MAX_SCORE = 1_000_000;

function sanitizeUsername(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 18);
}

function utcYesterdayOf(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getSubmittedSessionKey(wallet: string): string {
  return `meme-match3-submitted-sessions:${wallet}`;
}

function loadSubmittedSessions(wallet: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  const raw = localStorage.getItem(getSubmittedSessionKey(wallet));
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveSubmittedSessions(wallet: string, sessions: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getSubmittedSessionKey(wallet), JSON.stringify(Array.from(sessions).slice(-100)));
}

function isValidScore(score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= MAX_SCORE;
}

function AppShell() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [usernameInput, setUsernameInput] = useState("");
  const [username, setUsername] = useState("");
  const [started, setStarted] = useState(false);

  const [board, setBoard] = useState<number[][]>(() => createBoard());
  const [clearingSet, setClearingSet] = useState<Set<string>>(new Set());
  const [isResolving, setIsResolving] = useState(false);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [movesRemaining, setMovesRemaining] = useState(MAX_MOVES);
  const [sessionId, setSessionId] = useState(crypto.randomUUID());

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [rpcHealthy, setRpcHealthy] = useState(true);
  const [rpcReason, setRpcReason] = useState<string | null>(null);

  const [checkInState, setCheckInState] = useState<SolanaTxState>("idle");
  const [submitState, setSubmitState] = useState<SolanaTxState>("idle");
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setLeaderboard(getLeaderboard());
  }, []);

  useEffect(() => {
    if (!wallet.publicKey) {
      setProgress(null);
      return;
    }

    const current = getUserProgress(wallet.publicKey.toBase58());
    setProgress(current);
    if (current.username) setUsernameInput(current.username);
  }, [wallet.publicKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const health = await checkRpcHealth(connection);
      if (cancelled) return;
      setRpcHealthy(health.ok);
      setRpcReason(health.reason ?? null);
    };

    void run();
    const timer = setInterval(() => void run(), 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [connection]);

  const canStart = wallet.connected && usernameInput.trim().length >= 3 && rpcHealthy;
  const canCheckIn = !!progress && !isSameDay(progress.lastCheckInDay) && checkInState !== "loading";
  const boardLocked = isResolving || movesRemaining <= 0;

  const startGame = () => {
    if (!wallet.publicKey || !canStart) return;

    const clean = sanitizeUsername(usernameInput.trim());
    if (clean.length < 3) {
      setFeedback("Username must be at least 3 valid characters.");
      return;
    }

    const walletKey = wallet.publicKey.toBase58();
    const base =
      progress ?? {
        username: clean,
        wallet: walletKey,
        lastCheckInDay: null,
        streak: 0,
        totalXP: 0,
        totalCheckIns: 0,
        bestScore: 0,
      };

    const nextProgress = { ...base, username: clean };
    saveUserProgress(nextProgress);

    setProgress(nextProgress);
    setUsername(clean);
    setBoard(createBoard());
    setScore(0);
    setLevel(1);
    setMovesRemaining(MAX_MOVES);
    setSessionId(crypto.randomUUID());
    setStarted(true);
    setSubmitState("idle");
    setFeedback("");
  };

  const resolveMatches = async (initialBoard: number[][]) => {
    let next = initialBoard;
    let totalMatched = 0;
    let cascadeSteps = 0;

    while (true) {
      const result = findMatches(next);
      if (result.groups.length === 0) break;

      cascadeSteps += 1;
      totalMatched += result.matchedSet.size;
      setClearingSet(new Set(result.matchedSet));
      await delay(160);

      next = clearAndDrop(next, result.matchedSet);
      setBoard(next);
      setClearingSet(new Set());
      await delay(110);
    }

    if (totalMatched > 0) {
      const gained = scoreForMatch(totalMatched, cascadeSteps);
      setScore((prev) => {
        const updated = Math.min(prev + gained, MAX_SCORE);
        const nextLevel = Math.floor(updated / 500) + 1;
        if (nextLevel > level) {
          setMovesRemaining((moves) => moves + (nextLevel - level) * 5);
          setLevel(nextLevel);
        }
        return updated;
      });
    }
  };

  const handleSwap = async (a: Coord, b: Coord) => {
    if (boardLocked) return;
    if (!canSwap(board, a, b)) return;

    setMovesRemaining((prev) => Math.max(0, prev - 1));
    const swapped = swapTiles(board, a, b);
    setBoard(swapped);
    setIsResolving(true);

    try {
      await resolveMatches(swapped);
    } finally {
      setIsResolving(false);
    }
  };

  const handleCheckIn = async () => {
    if (!wallet.publicKey || !progress) return;

    try {
      setCheckInState("loading");
      setFeedback("");

      const result = await submitDailyCheckInTx({
        connection,
        wallet,
        username: progress.username || username,
      });

      const today = toUtcDay();
      const wasYesterday = progress.lastCheckInDay ? utcYesterdayOf(today) === progress.lastCheckInDay : false;
      const nextStreak = progress.lastCheckInDay === today ? progress.streak : wasYesterday ? progress.streak + 1 : 1;
      const xpGain = 40 + Math.min(nextStreak * 5, 60);

      const nextProgress: UserProgress = {
        ...progress,
        lastCheckInDay: today,
        streak: nextStreak,
        totalXP: progress.totalXP + xpGain,
        totalCheckIns: progress.totalCheckIns + 1,
      };

      saveUserProgress(nextProgress);
      setProgress(nextProgress);
      setCheckInState("success");
      setLastSignature(result.signature);
      setFeedback(`Daily check-in confirmed. +${xpGain} XP`);
    } catch (error) {
      setCheckInState(classifyTxError(error));
      setFeedback(toErrorMessage(error));
    }
  };

  const handleScoreSubmit = async () => {
    if (!wallet.publicKey || !progress) return;

    if (!isValidScore(score)) {
      setSubmitState("failed");
      setFeedback("Invalid score data.");
      return;
    }

    const walletKey = wallet.publicKey.toBase58();
    const submittedSessions = loadSubmittedSessions(walletKey);
    if (submittedSessions.has(sessionId)) {
      setSubmitState("failed");
      setFeedback("This session score is already submitted.");
      return;
    }

    try {
      setSubmitState("loading");
      setFeedback("");

      const result = await submitScoreTx({
        connection,
        wallet,
        username: progress.username || username,
        score,
        level,
        sessionId,
      });

      submittedSessions.add(sessionId);
      saveSubmittedSessions(walletKey, submittedSessions);

      const xpFromRun = Math.floor(score / 25);
      const nextProgress: UserProgress = {
        ...progress,
        bestScore: Math.max(progress.bestScore, score),
        totalXP: progress.totalXP + xpFromRun,
      };
      saveUserProgress(nextProgress);
      setProgress(nextProgress);

      const entry: LeaderboardEntry = {
        id: walletKey,
        username: nextProgress.username,
        wallet: walletKey,
        score: Math.max(score, progress.bestScore),
        level,
        submittedAt: new Date().toISOString(),
        streak: nextProgress.streak,
        totalXP: nextProgress.totalXP,
        totalCheckIns: nextProgress.totalCheckIns,
      };

      setLeaderboard(upsertLeaderboardEntry(entry));
      setSubmitState("success");
      setLastSignature(result.signature);
      setFeedback(`Score submitted on-chain. +${xpFromRun} XP`);
    } catch (error) {
      setSubmitState(classifyTxError(error));
      setFeedback(toErrorMessage(error));
    }
  };

  const badge = useMemo(() => {
    const streak = progress?.streak ?? 0;
    if (streak >= 30) return "Legendary Grinder";
    if (streak >= 14) return "Diamond Paws";
    if (streak >= 7) return "Viral Streak";
    if (streak >= 3) return "Growing Hype";
    return "Fresh Holder";
  }, [progress?.streak]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-4 pb-10 sm:p-6">
      <header className="rounded-2xl border border-white/10 bg-panel/75 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-black text-white">Solana Meme Match-3</h1>
            <p className="text-xs uppercase tracking-[0.16em] text-accent2">Network: {getNetworkLabel()}</p>
          </div>
          <p className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-neon">Badge: {badge}</p>
        </div>
        <p className="mt-2 text-xs text-white/65">This app never moves user funds. Transactions only store memo records for check-ins and score submissions.</p>
      </header>

      <WalletStatusBanner
        walletConnected={wallet.connected}
        walletConnecting={wallet.connecting}
        rpcHealthy={rpcHealthy}
        rpcReason={rpcReason}
        checkInState={checkInState}
        submitState={submitState}
        lastSignature={lastSignature}
      />

      {!started ? (
        <OnboardingScreen
          username={usernameInput}
          onUsernameChange={(value) => setUsernameInput(sanitizeUsername(value))}
          onStart={startGame}
          canStart={canStart}
          rpcHealthy={rpcHealthy}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <GameHud
              username={username}
              score={score}
              level={level}
              streak={progress?.streak ?? 0}
              totalXP={progress?.totalXP ?? 0}
              totalCheckIns={progress?.totalCheckIns ?? 0}
              movesRemaining={movesRemaining}
              onCheckIn={handleCheckIn}
              onSubmitScore={handleScoreSubmit}
              canCheckIn={canCheckIn}
              checkInBusy={checkInState === "loading"}
              submitBusy={submitState === "loading"}
              outOfMoves={movesRemaining <= 0}
            />

            <GameBoard board={board} clearingSet={clearingSet} locked={boardLocked} onSwap={handleSwap} />
            {feedback && <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85">{feedback}</p>}
          </div>

          <LeaderboardPanel entries={leaderboard} />
        </div>
      )}
    </main>
  );
}

export default function App() {
  return (
    <SolanaAppProvider>
      <AppShell />
    </SolanaAppProvider>
  );
}