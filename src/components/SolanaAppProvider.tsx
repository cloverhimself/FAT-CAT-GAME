import { ComponentType, ReactNode, useMemo } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { SOLANA_CLUSTER, SOLANA_RPC_URL } from "@/lib/config/network";

export function SolanaAppProvider({ children }: { children: ReactNode }) {
  const network =
    SOLANA_CLUSTER === "mainnet-beta" ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet;

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network }), new BackpackWalletAdapter()],
    [network],
  );

  const ConnectionProviderCompat = ConnectionProvider as unknown as ComponentType<any>;
  const WalletProviderCompat = WalletProvider as unknown as ComponentType<any>;
  const WalletModalProviderCompat = WalletModalProvider as unknown as ComponentType<any>;

  return (
    <ConnectionProviderCompat endpoint={SOLANA_RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProviderCompat wallets={wallets}>
        <WalletModalProviderCompat>{children}</WalletModalProviderCompat>
      </WalletProviderCompat>
    </ConnectionProviderCompat>
  );
}
