import { Connection } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { sendMemoTransaction } from "./txHelpers";

export type DailyCheckInPayload = {
  type: "daily_checkin";
  username: string;
  wallet: string;
  timestamp: string;
  day: string;
};

export function toUtcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function submitDailyCheckInTx(args: {
  connection: Connection;
  wallet: WalletContextState;
  username: string;
}): Promise<{ signature: string; payload: DailyCheckInPayload }> {
  const { connection, wallet, username } = args;
  if (!wallet.publicKey) throw new Error("Wallet is not connected");

  const payload: DailyCheckInPayload = {
    type: "daily_checkin",
    username,
    wallet: wallet.publicKey.toBase58(),
    timestamp: new Date().toISOString(),
    day: toUtcDay(),
  };

  const signature = await sendMemoTransaction({
    connection,
    wallet,
    message: JSON.stringify(payload),
  });

  return { signature, payload };
}