import { Cluster, clusterApiUrl } from "@solana/web3.js";

export const SOLANA_CLUSTER =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as Cluster | undefined) ?? "devnet";

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl(SOLANA_CLUSTER);

export const MEME_TOKEN_NAME = process.env.NEXT_PUBLIC_MEME_TOKEN_NAME ?? "PumpCat";

export function getNetworkLabel(): string {
  return SOLANA_CLUSTER === "mainnet-beta" ? "Mainnet" : "Devnet";
}