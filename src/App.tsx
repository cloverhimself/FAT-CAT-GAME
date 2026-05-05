import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SolanaAppProvider } from "@/components/SolanaAppProvider";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { WalletStatusBanner } from "@/components/WalletStatusBanner";
import { GameBoard } from "@/components/GameBoard";
import { GameHud } from "@/components/GameHud";
import { LeaderboardPanel } from "@/components/LeaderboardPanel";
import { SocialLinks } from "@/components/SocialLinks";
import { clearAndDrop, createBoard, scoreForMatch } from "@/lib/game/gameLogic";
import { Coord } from "@/lib/game/types";
import { findMatches } from "@/lib/game/tileMatching";
import { toUtcDay } from "@/lib/solana/dailyCheckIn";
import { SolanaTxState, checkRpcHealth, classifyTxError, toErrorMessage } from "@/lib/solana/txHelpers";
import { LeaderboardEntry } from "@/lib/state/leaderboard";
import { getSoundEngine } from "@/lib/audio/sound";
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
import { hasSupabaseEnv } from "@/lib/supabase/client";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_SCORE = 1_000_000;
const MAX_LEVEL = 20;
const MIN_SESSION_MS = 8_000;

function targetForLevel(level: number): number {
  return 350 + Math.floor(level * level * 38);
}

function movesForLevel(level: number): number {
  return Math.max(9, 22 - Math.floor(level * 0.55));
}

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
    return new Set(JSON.parse(raw) as string[]);
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

type SessionMeta = {
  id: string;
  startedAt: number;
  endedAt: number | null;
  movesUsed: number;
};

type LevelUpState = {
  nextLevel: number;
};

function AppShell() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const sound = useMemo(() => getSoundEngine(), []);

  const [usernameInput, setUsernameInput] = useState("");
  const [username, setUsername] = useState("");
  const [started, setStarted] = useState(false);

  const [board, setBoard] = useState<number[][]>(() => createBoard(1));
  const [clearingSet, setClearingSet] = useState<Set<string>>(new Set());
  const [isResolving, setIsResolving] = useState(false);
  const [pendingSwap, setPendingSwap] = useState<{ a: Coord; b: Coord } | null>(null);
  const [matchFxTick, setMatchFxTick] = useState(0);
  const [scorePop, setScorePop] = useState<{ id: number; text: string } | null>(null);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelScore, setLevelScore] = useState(0);
  const [targetScore, setTargetScore] = useState(targetForLevel(1));
  const [movesRemaining, setMovesRemaining] = useState(movesForLevel(1));
  const [levelFailed, setLevelFailed] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta>({
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    endedAt: null,
    movesUsed: 0,
  });

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [rpcHealthy, setRpcHealthy] = useState(true);
  const [rpcReason, setRpcReason] = useState<string | null>(null);

  const [checkInState, setCheckInState] = useState<SolanaTxState>("idle");
  const [submitState, setSubmitState] = useState<SolanaTxState>("idle");
  const [lastRecordId, setLastRecordId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("fat-cat-sound") !== "off";
  });
  const [soundVolume, setSoundVolume] = useState(() => {
    if (typeof window === "undefined") return 0.55;
    const raw = localStorage.getItem("fat-cat-volume");
    const parsed = raw ? Number(raw) : 0.55;
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.55;
  });
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [levelUpState, setLevelUpState] = useState<LevelUpState | null>(null);

  const refreshLeaderboard = async () => {
    if (!hasSupabaseEnv) return;
    try {
      const rows = await fetchLeaderboard();
      setLeaderboard(rows);
    } catch (error) {
      setFeedback(toErrorMessage(error));
    }
  };

  useEffect(() => {
    sound.setEnabled(soundEnabled);
    sound.setVolume(soundVolume);
    if (typeof window !== "undefined") {
      localStorage.setItem("fat-cat-sound", soundEnabled ? "on" : "off");
      localStorage.setItem("fat-cat-volume", String(soundVolume));
    }
    if (!soundEnabled) {
      sound.pauseMusic();
      setMusicPlaying(false);
    }
  }, [sound, soundEnabled, soundVolume]);

  useEffect(() => {
    return () => {
      sound.pauseMusic();
    };
  }, [sound]);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setFeedback("Supabase env missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.");
      return;
    }
    void refreshLeaderboard();
  }, []);

  useEffect(() => {
    if (!wallet.publicKey || !hasSupabaseEnv) {
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

  const canStart = wallet.connected && usernameInput.trim().length >= 3 && rpcHealthy && hasSupabaseEnv;
  const canCheckIn = !!progress && !isSameDay(progress.lastCheckInDay) && checkInState !== "loading";
  const boardLocked = isResolving || levelFailed || pendingSwap !== null || levelUpState !== null;

  const resetRunForLevel = (nextLevel: number) => {
    setBoard(createBoard(nextLevel));
    setLevel(nextLevel);
    setLevelScore(0);
    setTargetScore(targetForLevel(nextLevel));
    setMovesRemaining(movesForLevel(nextLevel));
    setLevelFailed(false);
  };

  const startGame = async () => {
    sound.unlock();
    if (!wallet.publicKey || !canStart) return;
    if (!hasSupabaseEnv) {
      setFeedback("Supabase is required before starting. Configure .env.local and restart.");
      return;
    }

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

    try {
      const nextProgress = await upsertUser({ wallet: walletKey, username: clean, progress: base });
      setProgress(nextProgress);
      setUsername(clean);
      setScore(0);
      resetRunForLevel(1);
      setSessionMeta({ id: crypto.randomUUID(), startedAt: Date.now(), endedAt: null, movesUsed: 0 });
      setStarted(true);
      setSubmitState("idle");
      setPendingSwap(null);
      setScorePop(null);
      setFeedback("");
      sound.playCheckInSuccess();
      const startedMusic = await sound.startMusic();
      setMusicPlaying(startedMusic);
    } catch (error) {
      sound.playGameOver();
      setFeedback(toErrorMessage(error));
    }
  };

  const resolveMatches = async (initialBoard: number[][]): Promise<{ hadMatch: boolean; gained: number; cascades: number }> => {
    let next = initialBoard;
    let totalMatched = 0;
    let cascadeSteps = 0;

    while (true) {
      const result = findMatches(next);
      if (result.groups.length === 0) break;

      cascadeSteps += 1;
      totalMatched += result.matchedSet.size;
      setClearingSet(new Set(result.matchedSet));
      await delay(150);

      next = clearAndDrop(next, result.matchedSet, level);
      setBoard(next);
      setClearingSet(new Set());
      await delay(105);
    }

    if (totalMatched <= 0) return { hadMatch: false, gained: 0, cascades: 0 };

    const gained = scoreForMatch(totalMatched, cascadeSteps);
    const popId = Date.now();
    setMatchFxTick((prev) => prev + 1);
    setScorePop({ id: popId, text: `+${gained}` });
    setTimeout(() => {
      setScorePop((current) => (current && current.id === popId ? null : current));
    }, 900);

    return { hadMatch: true, gained, cascades: cascadeSteps };
  };

  const handleSwap = async (a: Coord, b: Coord) => {
    if (boardLocked) return;
    sound.unlock();
    sound.playSwap();

    const original = board;
    const nextMovesLeft = Math.max(0, movesRemaining - 1);
    setMovesRemaining(nextMovesLeft);
    setSessionMeta((prev) => ({ ...prev, movesUsed: prev.movesUsed + 1 }));

    setPendingSwap({ a, b });
    await delay(130);

    const swapped = original.map((row) => [...row]);
    const temp = swapped[a.row][a.col];
    swapped[a.row][a.col] = swapped[b.row][b.col];
    swapped[b.row][b.col] = temp;
    setBoard(swapped);
    setPendingSwap(null);
    setIsResolving(true);

    try {
      const { hadMatch, gained, cascades } = await resolveMatches(swapped);

      if (!hadMatch) {
        setPendingSwap({ a: b, b: a });
        await delay(130);
        setBoard(original);
        setPendingSwap(null);
        sound.playInvalidSwap();
      } else {
        if (cascades > 1) {
          sound.playCombo(cascades);
        } else {
          sound.playMatchPop();
        }
        const newTotal = Math.min(score + gained, MAX_SCORE);
        const newLevelScore = levelScore + gained;
        setScore(newTotal);

        if (newLevelScore >= targetScore) {
          if (level >= MAX_LEVEL) {
            setLevelScore(targetScore);
            setFeedback("Max level reached. Submit your run.");
            setLevelFailed(true);
            setSessionMeta((prev) => ({ ...prev, endedAt: Date.now() }));
            sound.playLevelUp();
          } else {
            const nextLevel = level + 1;
            setFeedback(`Level ${level} cleared.`);
            setLevelUpState({ nextLevel });
            sound.playLevelUp();
          }
        } else {
          setLevelScore(newLevelScore);
        }
      }

      if (nextMovesLeft <= 0 && levelScore + (hadMatch ? gained : 0) < targetScore) {
        setLevelFailed(true);
        setSessionMeta((prev) => ({ ...prev, endedAt: Date.now() }));
        setFeedback("Level failed. Moves exhausted before target score. Try Again.");
        sound.playGameOver();
      }
    } finally {
      setIsResolving(false);
    }
  };

  const handleTryAgain = () => {
    sound.unlock();
    const sameLevel = level;
    setScore(0);
    resetRunForLevel(sameLevel);
    setSessionMeta({ id: crypto.randomUUID(), startedAt: Date.now(), endedAt: null, movesUsed: 0 });
    setPendingSwap(null);
    setSubmitState("idle");
    setLevelUpState(null);
    setFeedback("New run started.");
  };

  const handleContinueLevel = () => {
    if (!levelUpState) return;
    sound.unlock();
    sound.playClick();
    const nextLevel = levelUpState.nextLevel;
    setLevelUpState(null);
    resetRunForLevel(nextLevel);
    setFeedback(`You advanced to level ${nextLevel}.`);
  };

  const handleCheckIn = async () => {
    sound.unlock();
    if (!wallet.publicKey || !progress || !hasSupabaseEnv) return;
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

      const today = toUtcDay();
      const dbCheckinId = `db-checkin-${walletKey.slice(0, 8)}-${today}`;
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
        txSignature: dbCheckinId,
        checkinDate: today,
        xpAwarded: xpGain,
        nextProgress,
      });

      setProgress(nextProgress);
      setUsername(cleanUsername);
      setCheckInState("success");
      setLastRecordId(dbCheckinId);
      setFeedback(`Daily check-in saved. +${xpGain} XP`);
      sound.playCheckInSuccess();
      await refreshLeaderboard();
    } catch (error) {
      setCheckInState(classifyTxError(error));
      setFeedback(toErrorMessage(error));
      sound.playGameOver();
    }
  };

  const handleRetryCheckIn = () => {
    if (checkInState === "loading") return;
    void handleCheckIn();
  };

  const handleScoreSubmit = async () => {
    sound.unlock();
    if (!wallet.publicKey || !progress || !hasSupabaseEnv) return;
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

    const endedAt = sessionMeta.endedAt ?? Date.now();
    const sessionDuration = endedAt - sessionMeta.startedAt;
    if (sessionDuration < MIN_SESSION_MS) {
      setSubmitState("failed");
      setFeedback("Session too short. Anti-cheat blocked this score.");
      return;
    }

    if (sessionMeta.movesUsed < 1 || sessionMeta.movesUsed > 10000) {
      setSubmitState("failed");
      setFeedback("Invalid moves used for this session.");
      return;
    }

    const impossibleScoreLimit = sessionMeta.movesUsed * 1500 + level * 5000;
    if (score > impossibleScoreLimit) {
      setSubmitState("failed");
      setFeedback("Impossible score detected for this session.");
      return;
    }

    try {
      setSubmitState("loading");
      setFeedback("");

      const submittedSessions = loadSubmittedSessions(walletKey);
      if (submittedSessions.has(sessionMeta.id) || (await hasSubmittedSession(sessionMeta.id))) {
        setSubmitState("failed");
        setFeedback("This game session score is already submitted.");
        return;
      }

      const dbScoreId = `db-score-${sessionMeta.id}`;

      submittedSessions.add(sessionMeta.id);
      saveSubmittedSessions(walletKey, submittedSessions);

      const xpFromRun = Math.floor(score / 35);
      const nextProgress: UserProgress = {
        ...progress,
        bestScore: Math.max(progress.bestScore, score),
        totalXP: progress.totalXP + xpFromRun,
      };

      const suspiciousReasons: string[] = [];
      if (sessionDuration < 45_000) suspiciousReasons.push("short_session");
      if (score > sessionMeta.movesUsed * 400) suspiciousReasons.push("high_score_density");
      const suspiciousScore = suspiciousReasons.length > 0;

      await saveScoreSubmission({
        wallet: walletKey,
        username: cleanUsername,
        score,
        level,
        movesUsed: sessionMeta.movesUsed,
        gameSessionId: sessionMeta.id,
        txSignature: dbScoreId,
        suspiciousScore,
        suspiciousReason: suspiciousReasons.length ? suspiciousReasons.join(",") : null,
        nextProgress,
      });

      setProgress(nextProgress);
      setUsername(cleanUsername);
      setSubmitState("success");
      setLastRecordId(dbScoreId);
      setFeedback(`Score saved. +${xpFromRun} XP. Manual rewards review only.`);
      sound.playScoreSubmitSuccess();
      await refreshLeaderboard();
    } catch (error) {
      setSubmitState(classifyTxError(error));
      setFeedback(toErrorMessage(error));
      sound.playGameOver();
    }
  };

  const handleToggleMusic = async () => {
    sound.unlock();
    if (musicPlaying) {
      sound.pauseMusic();
      setMusicPlaying(false);
      return;
    }
    const startedMusic = await sound.startMusic();
    setMusicPlaying(startedMusic);
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
    <main
      className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-3 pb-10 pt-4 sm:px-5 sm:pt-6"
      onPointerDownCapture={(event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const button = target.closest("button");
        if (!button || button.classList.contains("tile-shell")) return;
        sound.unlock();
        sound.playClick();
      }}
    >
      <header className="glass-panel rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-black text-white">FAT CAT</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleToggleMusic()}
              className="rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/25"
            >
              {musicPlaying ? "Pause Music" : "Play Music"}
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/25"
            >
              Sound: {soundEnabled ? "On" : "Off"}
            </button>
            <label className="flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold text-white">
              Volume
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(soundVolume * 100)}
                onChange={(event) => setSoundVolume(Number(event.target.value) / 100)}
                className="h-1 w-20 accent-cyan-300"
              />
            </label>
            <p className="rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs text-white">Badge: {badge}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-white/65">This app never moves your SOL or tokens. Wallet-linked check-ins and scores are saved for leaderboard and manual rewards only.</p>
      </header>

      <WalletStatusBanner
        walletConnected={wallet.connected}
        walletConnecting={wallet.connecting}
        rpcHealthy={rpcHealthy}
        rpcReason={rpcReason}
        checkInState={checkInState}
        submitState={submitState}
        lastRecordId={lastRecordId}
        onRetryCheckIn={handleRetryCheckIn}
        onRetrySubmit={handleRetrySubmit}
      />

      {!hasSupabaseEnv && (
        <div className="rounded-2xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
          Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to
          <code> .env.local</code>, then restart.
        </div>
      )}

      {!started ? (
        <OnboardingScreen
          username={usernameInput}
          onUsernameChange={(value) => setUsernameInput(sanitizeUsername(value))}
          onStart={() => void startGame()}
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
              levelScore={levelScore}
              targetScore={targetScore}
              onCheckIn={handleCheckIn}
              onSubmitScore={handleScoreSubmit}
              canCheckIn={canCheckIn}
              checkInBusy={checkInState === "loading"}
              submitBusy={submitState === "loading"}
              outOfMoves={levelFailed}
              onTryAgain={handleTryAgain}
            />

            <div className="relative">
              {scorePop && (
                <div key={scorePop.id} className="score-pop pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-white/20 px-3 py-1 text-sm font-bold text-white backdrop-blur">
                  {scorePop.text}
                </div>
              )}
              {levelUpState && <div className="absolute inset-0 z-20 rounded-[28px] bg-black/40 backdrop-blur-sm" />}
              <GameBoard
                board={board}
                clearingSet={clearingSet}
                locked={boardLocked}
                onSwap={handleSwap}
                pendingSwap={pendingSwap}
                fxTick={matchFxTick}
              />
              {levelUpState && (
                <div className="levelup-overlay absolute inset-0 z-30 flex items-center justify-center p-4">
                  <div className="levelup-modal relative w-full max-w-sm overflow-hidden rounded-2xl border border-cyan-200/55 bg-[#121a3dcc] p-5 text-center shadow-[0_0_35px_rgba(84,230,255,0.35)] backdrop-blur-md">
                    <div className="pointer-events-none absolute inset-0">
                      <span className="levelup-spark levelup-spark-1" />
                      <span className="levelup-spark levelup-spark-2" />
                      <span className="levelup-spark levelup-spark-3" />
                    </div>
                    <img src="/img/fatcats-tab.png" alt="FAT CAT character art" className="mx-auto h-24 w-24 rounded-full border border-white/35 object-cover shadow-lg" />
                    <h3 className="mt-3 text-3xl font-black tracking-wide text-white">LEVEL UP!</h3>
                    <p className="mt-1 text-sm text-cyan-100">You advanced to Level {levelUpState.nextLevel}</p>
                    <button
                      type="button"
                      onClick={handleContinueLevel}
                      className="mt-4 rounded-lg bg-gradient-to-r from-[#ff8fca] via-[#ff965f] to-[#5ce9ff] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-[#10253c] transition hover:brightness-105 active:scale-[0.98]"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}
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
