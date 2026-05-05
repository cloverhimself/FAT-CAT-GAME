import { SOLANA_CLUSTER } from "@/lib/config/network";
import { SolanaTxState } from "@/lib/solana/txHelpers";

type Props = {
  walletConnected: boolean;
  walletConnecting: boolean;
  rpcHealthy: boolean;
  rpcReason: string | null;
  checkInState: SolanaTxState;
  submitState: SolanaTxState;
  lastSignature: string | null;
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
}: Props) {
  return (
    <div className="grid gap-2 rounded-2xl border border-white/10 bg-panel/80 p-4 text-sm text-white/80">
      <p>Wallet: {walletConnecting ? "Connecting..." : walletConnected ? "Connected" : "Disconnected"}</p>
      <p>RPC: {rpcHealthy ? "Healthy" : `Issue: ${rpcReason ?? "unknown"}`}</p>
      <p>Check-in: {txLabel[checkInState]}</p>
      <p>Score submit: {txLabel[submitState]}</p>
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