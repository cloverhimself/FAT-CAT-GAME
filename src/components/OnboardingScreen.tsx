import { ChangeEvent } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { MEME_TOKEN_NAME, getNetworkLabel } from "@/lib/config/network";

type Props = {
  username: string;
  onUsernameChange: (value: string) => void;
  onStart: () => void;
  canStart: boolean;
  rpcHealthy: boolean;
};

export function OnboardingScreen({ username, onUsernameChange, onStart, canStart, rpcHealthy }: Props) {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-3xl border border-white/10 bg-panel/80 p-8 shadow-glow backdrop-blur">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-accent2">{MEME_TOKEN_NAME} Community Quest</p>
        <h1 className="mt-3 text-4xl font-black text-white">Meme Match 3</h1>
        <p className="mt-2 text-sm text-white/70">Connect wallet, pick username, and play for daily on-chain activity.</p>
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
          className="rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white placeholder:text-white/35 focus:border-accent focus:outline-none"
          maxLength={18}
        />
      </div>

      <div className="flex flex-col gap-4">
        <WalletMultiButton className="!h-12 !rounded-xl !bg-accent !font-bold !text-[#0e1116]" />
        {!rpcHealthy && (
          <p className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            RPC unavailable. Check endpoint or switch to a healthy {getNetworkLabel()} RPC.
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={!canStart}
        onClick={onStart}
        className="rounded-xl bg-accent2 px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#0e1116] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start Game
      </button>

      <p className="text-center text-xs text-white/50">Supports Phantom, Solflare, Backpack, and wallet-standard compatible wallets.</p>
    </section>
  );
}