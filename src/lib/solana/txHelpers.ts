import { Commitment, Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export type SolanaTxState = "idle" | "loading" | "success" | "failed" | "rejected";

export function createMemoInstruction(wallet: PublicKey, message: string): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: wallet, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(message, "utf8"),
  });
}

export async function checkRpcHealth(connection: Connection): Promise<{ ok: boolean; reason?: string }> {
  try {
    await connection.getLatestBlockhash("finalized");
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: toErrorMessage(error) };
  }
}

export async function sendMemoTransaction(args: {
  connection: Connection;
  wallet: WalletContextState;
  message: string;
  commitment?: Commitment;
}): Promise<string> {
  const { connection, wallet, message, commitment = "confirmed" } = args;
  if (!wallet.publicKey) throw new Error("Wallet is not connected");

  const latest = await connection.getLatestBlockhash(commitment);
  const transaction = new Transaction({
    feePayer: wallet.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  });

  transaction.add(createMemoInstruction(wallet.publicKey, message));

  const signature = await wallet.sendTransaction(transaction, connection, {
    preflightCommitment: commitment,
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    commitment,
  );

  return signature;
}

export function classifyTxError(error: unknown): SolanaTxState {
  const message = toErrorMessage(error).toLowerCase();
  if (message.includes("rejected") || message.includes("user denied")) return "rejected";
  return "failed";
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}