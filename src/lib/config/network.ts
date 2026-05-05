import { Cluster, clusterApiUrl } from "@solana/web3.js";

const envCluster = import.meta.env.VITE_SOLANA_CLUSTER as Cluster | undefined;

export const SOLANA_CLUSTER: Cluster = envCluster ?? "devnet";
export const SOLANA_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL ?? clusterApiUrl(SOLANA_CLUSTER);
export const MEME_TOKEN_NAME = import.meta.env.VITE_MEME_TOKEN_NAME ?? "PumpCat";

export function getNetworkLabel(): string {
  return SOLANA_CLUSTER === "mainnet-beta" ? "Mainnet" : "Devnet";
}