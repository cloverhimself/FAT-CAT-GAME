import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SolanaAppProvider } from "@/components/SolanaAppProvider";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { WalletStatusBanner } from "@/components/WalletStatusBanner";
import { GameBoard } from "@/components/GameBoard";
import { GameHud } from "@/components/GameHud";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { SocialLinks } from "@/components/SocialLinks";
import { clearAndDrop, createBoard, scoreForMatch, swapTiles } from "@/lib/game/gameLogic";
import { Coord } from "@/lib/game/types";
import { findMatches } from "@/lib/game/tileMatching";
import { getNetworkLabel } from "@/lib/config/network";
import { submitDailyCheckInTx, toUtcDay } from "@/lib/solana/dailyCheckIn";
import { submitScoreTx } from "@/lib/solana/scoreSubmission";
import { SolanaTxState, checkRpcHealth, classifyTxError, toErrorMessage } from "@/lib/solana/txHelpers";
import { LeaderboardEntry } from "@/lib/state/leaderboard";
import {
  UserProgress,
  fetchLeaderboard,
  fetchUserProgress,
  hasSubmittedSession,
  sanitizeUsername,
  saveDailyCheckin,
  saveScoreSubmission,
  upsertUser,
} from "@/lib/supabase/gameData";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_MOVES = 30;
const MAX_SCORE = 1_000_000;

function utcYesterdayOf(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function isSameDay(isoDay: string | null): boolean {
  if (!isoDay) return false;
  return isoDay === toUtcDay();
}

function getSubmittedSessionKey(wallet: string): string {
  return `fat-cat-match3-submitted-sessions:${wallet}`;
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
  const [pendingSwap, setPendingSwap] = useState<{ a: Coord; b: Coord } | null>(null);
  const [matchFxTick, setMatchFxTick] = useState(0);
  const [scorePop, setScorePop] = useState<{ id: number; text: string } | null>(null);

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

  const refreshLeaderboard = async () => {
    try {
      const rows = await fetchLeaderboard();
      setLeaderboard(rows);
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  };

  useEffect(() => {
    void refreshLeaderboard();
  }, []);

  useEffect(() => {
    if (!wallet.publicKey) {
      setProgress(null);
      setUsername("");
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const current = await fetchUserProgress(wallet.publicKey!.toBase58());
        if (!active) return;
        setProgress(current);
        setUsername(current.username);
        if (current.username) setUsernameInput(current.username);
      } catch (error) {
        if (!active) return;
        setFeedback(toErrorMessage(error));
      }
    };
    void load();

    return () => {
      active = false;
    };
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
  const boardLocked = isResolving || movesRemaining <= 0 || pendingSwap !== null;

  const startGame = async () => {
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

    let nextProgress = { ...base, username: clean };
    try {
      nextProgress = await upsertUser({ wallet: walletKey, username: clean, progress: nextProgress });
    } catch (error) {
      setFeedback(toErrorMessage(error));
      return;
    }

    setProgress(nextProgress);
    setUsername(clean);
    setBoard(createBoard());
    setScore(0);
    setLevel(1);
    setMovesRemaining(MAX_MOVES);
    setSessionId(crypto.randomUUID());
    setStarted(true);
    setSubmitState("idle");
    setPendingSwap(null);
    setScorePop(null);
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
      const popId = Date.now();
      setMatchFxTick((prev) => prev + 1);
      setScorePop({ id: popId, text: `+${gained}` });
      setTimeout(() => {
        setScorePop((current) => (current && current.id === popId ? null : current));
      }, 900);

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

    return totalMatched > 0;
  };

  const handleSwap = async (a: Coord, b: Coord) => {
    if (boardLocked) return;

    const original = board;
    setMovesRemaining((prev) => Math.max(0, prev - 1));
    setPendingSwap({ a, b });
    await delay(130);
    const swapped = swapTiles(board, a, b);
    setBoard(swapped);
    setPendingSwap(null);
    setIsResolving(true);

    try {
      const hadMatch = await resolveMatches(swapped);
      if (!hadMatch) {
        setPendingSwap({ a: b, b: a });
        await delay(130);
        setBoard(original);
        setPendingSwap(null);
      }
    } finally {
      setIsResolving(false);
    }
  };

  const handleCheckIn = async () => {
    if (!wallet.publicKey || !progress) return;
    const walletKey = wallet.publicKey.toBase58();
    const cleanUsername = sanitizeUsername(progress.username || username || usernameInput);
    if (cleanUsername.length < 3) {
      setCheckInState("failed");
      setFeedback("Username must be at least 3 valid characters.");
      return;
    }

    try {
      setCheckInState("loading");
      setFeedback("");

      const result = await submitDailyCheckInTx({
        connection,
        wallet,
        username: cleanUsername,
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

      await saveDailyCheckin({
        wallet: walletKey,
        username: cleanUsername,
        txSignature: result.signature,
        checkinDate: today,
        xpAwarded: xpGain,
        nextProgress,
      });
      setProgress(nextProgress);
      setUsername(cleanUsername);
      setCheckInState("success");
      setLastSignature(result.signature);
      setFeedback(`Daily check-in confirmed. +${xpGain} XP`);
      await refreshLeaderboard();
    } catch (error) {
      setCheckInState(classifyTxError(error));
      setFeedback(toErrorMessage(error));
    }
  };

  const handleRetryCheckIn = () => {
    if (checkInState === "loading") return;
    void handleCheckIn();
  };

  const handleScoreSubmit = async () => {
    if (!wallet.publicKey || !progress) return;
    const walletKey = wallet.publicKey.toBase58();
    const cleanUsername = sanitizeUsername(progress.username || username || usernameInput);
    if (cleanUsername.length < 3) {
      setSubmitState("failed");
      setFeedback("Username must be at least 3 valid characters.");
      return;
    }

    if (!isValidScore(score)) {
      setSubmitState("failed");
      setFeedback("Invalid score data.");
      return;
    }

    try {
      setSubmitState("loading");
      setFeedback("");

      const submittedSessions = loadSubmittedSessions(walletKey);
      if (submittedSessions.has(sessionId) || (await hasSubmittedSession(sessionId))) {
        setSubmitState("failed");
        setFeedback("This session score is already submitted.");
        return;
      }

      const result = await submitScoreTx({
        connection,
        wallet,
        username: cleanUsername,
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
      const suspiciousScore = score > 200000 || level > 500 || movesRemaining < 0;
      await saveScoreSubmission({
        wallet: walletKey,
        username: cleanUsername,
        score,
        level,
        movesUsed: MAX_MOVES - movesRemaining,
        gameSessionId: sessionId,
        txSignature: result.signature,
        suspiciousScore,
        nextProgress,
      });
      setProgress(nextProgress);
      setUsername(cleanUsername);

      setSubmitState("success");
      setLastSignature(result.signature);
      setFeedback(`Score submitted on-chain. +${xpFromRun} XP`);
      await refreshLeaderboard();
    } catch (error) {
      setSubmitState(classifyTxError(error));
      setFeedback(toErrorMessage(error));
    }
  };

  const handleRetrySubmit = () => {
    if (submitState === "loading") return;
    void handleScoreSubmit();
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
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-3 pb-10 pt-4 sm:px-5 sm:pt-6">
      <header className="glass-panel rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-black text-white">FAT CAT Match-3</h1>
            <p className="text-xs uppercase tracking-[0.16em] text-accent2">Network: {getNetworkLabel()}</p>
          </div>
          <p className="rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs text-white">Badge: {badge}</p>
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
        onRetryCheckIn={handleRetryCheckIn}
        onRetrySubmit={handleRetrySubmit}
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
        <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_0.9fr]">
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

            <div className="relative">
              {scorePop && (
                <div key={scorePop.id} className="score-pop pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-white/20 px-3 py-1 text-sm font-bold text-white backdrop-blur">
                  {scorePop.text}
                </div>
              )}
              <GameBoard
                board={board}
                clearingSet={clearingSet}
                locked={boardLocked}
                onSwap={handleSwap}
                pendingSwap={pendingSwap}
                fxTick={matchFxTick}
              />
            </div>
            {feedback && <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85">{feedback}</p>}
          </div>

          <LeaderboardPanel entries={leaderboard} />
        </div>
      )}
      <SocialLinks />
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
