import { Connection } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { sendMemoTransaction } from "./txHelpers";

export type ScoreSubmissionPayload = {
  type: "score_submission";
  sessionId: string;
  username: string;
  wallet: string;
  score: number;
  level: number;
  timestamp: string;
};

export async function submitScoreTx(args: {
  connection: Connection;
  wallet: WalletContextState;
  username: string;
  score: number;
  level: number;
  sessionId: string;
}): Promise<{ signature: string; payload: ScoreSubmissionPayload }> {
  const { connection, wallet, username, score, level, sessionId } = args;
  if (!wallet.publicKey) throw new Error("Wallet is not connected");

  const payload: ScoreSubmissionPayload = {
    type: "score_submission",
    sessionId,
    username,
    wallet: wallet.publicKey.toBase58(),
    score,
    level,
    timestamp: new Date().toISOString(),
  };

  const signature = await sendMemoTransaction({
    connection,
    wallet,
    message: JSON.stringify(payload),
  });

  return { signature, payload };
}