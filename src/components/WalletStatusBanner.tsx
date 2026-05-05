import { ReactNode } from "react";
import { SOLANA_CLUSTER } from "@/lib/config/network";
import { SolanaTxState } from "@/lib/solana/txHelpers";
import { FaWallet, FaDatabase, FaCheckCircle, FaTrophy } from "react-icons/fa";

type Props = {
  walletConnected: boolean;
  walletConnecting: boolean;
  rpcHealthy: boolean;
  rpcReason: string | null;
  checkInState: SolanaTxState;
  submitState: SolanaTxState;
  lastSignature: string | null;
  onRetryCheckIn: () => void;
  onRetrySubmit: () => void;
};

const txLabel: Record<SolanaTxState, string> = {
  idle: "Idle",
  loading: "Processing transaction...",
  success: "Transaction confirmed",
  failed: "Transaction failed",
  rejected: "Transaction rejected",
};

export function WalletStatusBanner({
  walletConnected,
  walletConnecting,
  rpcHealthy,
  rpcReason,
  checkInState,
  submitState,
  lastSignature,
  onRetryCheckIn,
  onRetrySubmit,
}: Props) {
  const Row = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
    <div className="flex items-center gap-2">
      <span className="text-cyan-200">{icon}</span>
      <span className="text-white/85">
        {label}: {value}
      </span>
    </div>
  );

  return (
    <div className="glass-panel grid gap-2 rounded-2xl p-4 text-sm text-white/85">
      <Row icon={<FaWallet />} label="Wallet" value={walletConnecting ? "Connecting..." : walletConnected ? "Connected" : "Disconnected"} />
      <Row icon={<FaDatabase />} label="RPC" value={rpcHealthy ? "Healthy" : `Issue: ${rpcReason ?? "unknown"}`} />
      <Row icon={<FaCheckCircle />} label="Check-in" value={txLabel[checkInState]} />
      <Row icon={<FaTrophy />} label="Score submit" value={txLabel[submitState]} />
      <div className="flex flex-wrap gap-2 pt-1">
        {(checkInState === "failed" || checkInState === "rejected") && (
          <button
            type="button"
            onClick={onRetryCheckIn}
            className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/30"
          >
            Retry Check-in
          </button>
        )}
        {(submitState === "failed" || submitState === "rejected") && (
          <button
            type="button"
            onClick={onRetrySubmit}
            className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/30"
          >
            Retry Score Submit
          </button>
        )}
      </div>
      {lastSignature && (
        <a
          className="truncate text-xs text-neon underline"
          href={`https://explorer.solana.com/tx/${lastSignature}?cluster=${SOLANA_CLUSTER}`}
          target="_blank"
          rel="noreferrer"
        >
          Last tx: {lastSignature}
        </a>
      )}
    </div>
  );
}
