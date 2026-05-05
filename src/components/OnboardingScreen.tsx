import { ChangeEvent, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { MEME_TOKEN_NAME } from "@/lib/config/network";

type Props = {
  username: string;
  onUsernameChange: (value: string) => void;
  onStart: () => void;
  canStart: boolean;
  rpcHealthy: boolean;
};

export function OnboardingScreen({ username, onUsernameChange, onStart, canStart, rpcHealthy }: Props) {
  const [bannerSrc, setBannerSrc] = useState("/img/1500x1500.jpg");

  return (
    <section className="glass-panel mx-auto flex w-full max-w-xl flex-col gap-6 rounded-3xl p-8">
      <div className="rounded-2xl border border-white/35 bg-white/10 p-2 shadow-[0_0_25px_rgba(98,236,255,0.25)] backdrop-blur">
        <img
          src={bannerSrc}
          alt="FAT CATS banner"
          className="h-auto w-full rounded-xl object-cover"
          onError={() => setBannerSrc("/img/fatcats-tab.png")}
        />
      </div>

      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-accent2">{MEME_TOKEN_NAME} Community Quest</p>
        <h1 className="mt-3 text-4xl font-black text-white">FAT CAT</h1>
        <p className="mt-2 text-sm text-white/70">Connect wallet, pick username, and play for daily community activity.</p>
      </div>

      <div className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-white/85">
        <p className="font-semibold text-white">FAT CAT Quest</p>
        <p className="mt-1">
          Play daily, match tiles, build streaks, save your score, and climb the Fat Cats leaderboard. This app never moves user funds. Wallet-linked records are used for check-ins and score submissions only.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="username" className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onUsernameChange(event.target.value)}
          placeholder="meme-warrior"
          className="rounded-xl border border-white/25 bg-white/15 px-4 py-3 text-white placeholder:text-white/45 backdrop-blur focus:border-white/60 focus:outline-none"
          maxLength={18}
        />
      </div>

      <div className="flex flex-col gap-4">
        <WalletMultiButton className="!h-12 !rounded-xl !bg-gradient-to-r !from-[#ffe3ef] !to-[#fff6df] !font-bold !text-[#ef3f87] !shadow-md !transition !hover:scale-[1.01]" />
        {!rpcHealthy && (
          <p className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            RPC unavailable. Check your endpoint in .env.local.
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={!canStart}
        onClick={onStart}
        className="rounded-xl bg-gradient-to-r from-[#ffe3ef] to-[#fff6df] px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#ef3f87] shadow-md transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start Game
      </button>

      <p className="text-center text-xs text-white/50">Supports Phantom, Solflare, Backpack, and wallet-standard compatible wallets.</p>
    </section>
  );
}
