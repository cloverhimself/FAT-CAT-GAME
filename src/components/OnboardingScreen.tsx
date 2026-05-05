import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { MEME_TOKEN_NAME } from "@/lib/config/network";

type Props = {
  username: string;
  onUsernameChange: (value: string) => void;
  onStart: () => void;
  canStart: boolean;
  rpcHealthy: boolean;
  feedback: string;
};

const MOBILE_UA_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iPadOSDesktopUA = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return MOBILE_UA_PATTERN.test(ua) || iPadOSDesktopUA;
}

function buildMobileWalletLinks(currentUrl: string, origin: string): Array<{ name: string; href: string }> {
  const encodedUrl = encodeURIComponent(currentUrl);
  const encodedRef = encodeURIComponent(origin);

  return [
    {
      name: "Phantom",
      href: `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodedRef}`,
    },
    {
      name: "Solflare",
      href: `https://solflare.com/ul/v1/browse/${encodedUrl}?ref=${encodedRef}`,
    },
  ];
}

export function OnboardingScreen({ username, onUsernameChange, onStart, canStart, rpcHealthy, feedback }: Props) {
  const { wallets, wallet, connected, connecting, select, connect } = useWallet();
  const [bannerSrc, setBannerSrc] = useState("/img/1500x1500.jpg");
  const [mobileOpenLinks, setMobileOpenLinks] = useState<Array<{ name: string; href: string }>>([]);
  const mobile = useMemo(() => isMobileDevice(), []);
  const autoConnectAttemptRef = useRef<string | null>(null);

  const mobileInstalledWallet = useMemo(() => {
    const installedWallets = wallets.filter((entry) => entry.readyState === WalletReadyState.Installed);
    if (installedWallets.length === 0) return null;

    const preferredNames = ["Phantom", "Solflare", "Backpack"];
    for (const name of preferredNames) {
      const match = installedWallets.find((entry) => entry.adapter.name === name);
      if (match) return match;
    }

    return installedWallets[0];
  }, [wallets]);

  const handleMobileWalletConnect = useCallback(async () => {
    if (!mobileInstalledWallet || connected || connecting) return;
    if (wallet?.adapter.name !== mobileInstalledWallet.adapter.name) {
      select(mobileInstalledWallet.adapter.name);
      return;
    }

    try {
      await connect();
    } catch {
      // User can reject or wallet app can refuse focus; keep UI responsive.
    }
  }, [connect, connected, connecting, mobileInstalledWallet, select, wallet?.adapter.name]);

  useEffect(() => {
    if (!mobile || typeof window === "undefined") return;
    setMobileOpenLinks(buildMobileWalletLinks(window.location.href, window.location.origin));
  }, [mobile]);

  useEffect(() => {
    if (!mobile || !mobileInstalledWallet || connected || connecting) return;

    const targetWalletName = mobileInstalledWallet.adapter.name;
    if (wallet?.adapter.name !== targetWalletName) {
      select(targetWalletName);
      return;
    }

    if (autoConnectAttemptRef.current === targetWalletName) return;
    autoConnectAttemptRef.current = targetWalletName;

    void connect().catch(() => {
      // Ignore silent auto-connect failures; user can retry manually.
    });
  }, [connect, connected, connecting, mobile, mobileInstalledWallet, select, wallet?.adapter.name]);

  return (
    <section className="glass-panel mx-auto flex w-full max-w-xl flex-col gap-6 rounded-3xl p-8">
      <div className="rounded-2xl border border-white/35 bg-white/10 p-2 shadow-[0_0_25px_rgba(98,236,255,0.25)] backdrop-blur">
        <img
          src={bannerSrc}
          alt="FAT CATS banner"
          className="h-auto w-full rounded-xl object-cover"
          loading="lazy"
          decoding="async"
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
        {mobile ? (
          mobileInstalledWallet ? (
            <button
              type="button"
              onClick={() => void handleMobileWalletConnect()}
              disabled={connected || connecting}
              className="h-12 rounded-xl bg-gradient-to-r from-[#ffe3ef] to-[#fff6df] font-bold text-[#ef3f87] shadow-md transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connected
                ? `${mobileInstalledWallet.adapter.name} Connected`
                : connecting
                  ? `Connecting ${mobileInstalledWallet.adapter.name}...`
                  : `Connect ${mobileInstalledWallet.adapter.name}`}
            </button>
          ) : (
            <div className="grid gap-2">
              <p className="rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                No wallet provider was detected in this mobile browser. Open this page in a wallet app browser to connect.
              </p>
              {mobileOpenLinks.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="rounded-xl bg-gradient-to-r from-[#ffe3ef] to-[#fff6df] px-4 py-3 text-center text-sm font-bold text-[#ef3f87] shadow-md transition hover:brightness-105"
                >
                  Open in {item.name}
                </a>
              ))}
            </div>
          )
        ) : (
          <WalletMultiButton className="!h-12 !rounded-xl !bg-gradient-to-r !from-[#ffe3ef] !to-[#fff6df] !font-bold !text-[#ef3f87] !shadow-md !transition !hover:scale-[1.01]" />
        )}
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

      {feedback && <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85">{feedback}</p>}

      <p className="text-center text-xs text-white/50">
        Supports Phantom, Solflare, Backpack, and wallet-standard compatible wallets.
      </p>
    </section>
  );
}
