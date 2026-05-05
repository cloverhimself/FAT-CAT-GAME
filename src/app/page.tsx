"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SolanaAppProvider } from "@/components/SolanaAppProvider";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { WalletStatusBanner } from "@/components/WalletStatusBanner";
import { GameBoard } from "@/components/GameBoard";
import { GameHud } from "@/components/GameHud";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { createBoard, canSwap, swapTiles, clearAndDrop, scoreForMatch } from "@/lib/game/gameLogic";
import { Coord } from "@/lib/game/types";
import { findMatches } from "@/lib/game/tileMatching";
import { getNetworkLabel } from "@/lib/config/network";
import { submitDailyCheckInTx, toUtcDay } from "@/lib/solana/dailyCheckIn";
import { submitScoreTx } from "@/lib/solana/scoreSubmission";
import {
  SolanaTxState,
  checkRpcHealth,
  classifyTxError,
  toErrorMessage,
} from "@/lib/solana/txHelpers";
import {
  getLeaderboard,
  isSameDay,
  LeaderboardEntry,
  upsertLeaderboardEntry,
} from "@/lib/state/leaderboard";
import { getUserProgress, saveUserProgress, UserProgress } from "@/lib/storage/userProgress";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function utcYesterdayOf(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function GameApp() {
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
  const [sessionId, setSessionId] = useState(crypto.randomUUID());

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [rpcHealthy, setRpcHealthy] = useState(true);
  const [rpcReason, setRpcReason] = useState<string | null>(null);

  const [checkInState, setCheckInState] = useState<SolanaTxState>("idle");
  const [submitState, setSubmitState] = useState<SolanaTxState>("idle");
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>("");

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
    if (current.username) {
      setUsernameInput(current.username);
    }
  }, [wallet.publicKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const health = await checkRpcHealth(connection);
      if (cancelled) return;
      setRpcHealthy(health.ok);
      setRpcReason(health.reason ?? null);
    };

    run();
    const timer = setInterval(run, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [connection]);

  const canStart = wallet.connected && usernameInput.trim().length >= 3 && rpcHealthy;
  const canCheckIn = !!progress && !isSameDay(progress.lastCheckInDay) && checkInState !== "loading";

  const startGame = () => {
    if (!wallet.publicKey || !canStart) return;
    const clean = usernameInput.trim();
    const walletKey = wallet.publicKey.toBase58();

    const base = progress ?? {
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
    setSessionId(crypto.randomUUID());
    setStarted(true);
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
      await delay(170);

      next = clearAndDrop(next, result.matchedSet);
      setBoard(next);
      setClearingSet(new Set());
      await delay(130);
    }

    if (totalMatched > 0) {
      const earned = scoreForMatch(totalMatched, cascadeSteps);
      setScore((prev) => {
        const updated = prev + earned;
        setLevel(Math.floor(updated / 500) + 1);
        return updated;
      });
    }

    return totalMatched > 0;
  };

  const handleSwap = async (a: Coord, b: Coord) => {
    if (isResolving) return;
    if (!canSwap(board, a, b)) return;

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
      const wasYesterday = progress.lastCheckInDay
        ? utcYesterdayOf(today) === progress.lastCheckInDay
        : false;

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
      setFeedback(`Check-in confirmed. +${xpGain} XP`);
    } catch (error) {
      setCheckInState(classifyTxError(error));
      setFeedback(toErrorMessage(error));
    }
  };

  const handleScoreSubmit = async () => {
    if (!wallet.publicKey || !progress) return;

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

      const xpFromRun = Math.floor(score / 25);
      const nextProgress: UserProgress = {
        ...progress,
        bestScore: Math.max(progress.bestScore, score),
        totalXP: progress.totalXP + xpFromRun,
      };
      saveUserProgress(nextProgress);
      setProgress(nextProgress);

      const entry: LeaderboardEntry = {
        id: wallet.publicKey.toBase58(),
        username: nextProgress.username,
        wallet: wallet.publicKey.toBase58(),
        score: Math.max(score, progress.bestScore),
        level,
        submittedAt: new Date().toISOString(),
        streak: nextProgress.streak,
        totalXP: nextProgress.totalXP,
        totalCheckIns: nextProgress.totalCheckIns,
      };

      const updated = upsertLeaderboardEntry(entry);
      setLeaderboard(updated);
      setSubmitState("success");
      setLastSignature(result.signature);
      setFeedback(`Score proof submitted. +${xpFromRun} XP`);
    } catch (error) {
      setSubmitState(classifyTxError(error));
      setFeedback(toErrorMessage(error));
    }
  };

  const streakBadge = useMemo(() => {
    const streak = progress?.streak ?? 0;
    if (streak >= 30) return "Legendary Meme Grinder";
    if (streak >= 14) return "Diamond Paws";
    if (streak >= 7) return "Viral Streaker";
    if (streak >= 3) return "Growing Hype";
    return "Fresh Meme Holder";
  }, [progress?.streak]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-4 pb-10 sm:p-6">
      <header className="rounded-2xl border border-white/10 bg-panel/75 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-black text-white">Solana Meme Match-3</h1>
            <p className="text-xs uppercase tracking-[0.16em] text-accent2">Network: {getNetworkLabel()}</p>
          </div>
          <p className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-neon">Badge: {streakBadge}</p>
        </div>
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
          onUsernameChange={setUsernameInput}
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
              onCheckIn={handleCheckIn}
              onSubmitScore={handleScoreSubmit}
              canCheckIn={canCheckIn}
              checkInBusy={checkInState === "loading"}
              submitBusy={submitState === "loading"}
            />

            <GameBoard board={board} clearingSet={clearingSet} locked={isResolving} onSwap={handleSwap} />
            {feedback && <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85">{feedback}</p>}
          </div>

          <LeaderboardPanel entries={leaderboard} />
        </div>
      )}

      <footer className="text-center text-xs text-white/45">
        Solana-only game. Use devnet for testing. For production set `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta` and a mainnet RPC URL.
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <SolanaAppProvider>
      <GameApp />
    </SolanaAppProvider>
  );
}