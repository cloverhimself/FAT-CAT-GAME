import type { Metadata } from "next";
import { Baloo_2, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";

const baloo = Baloo_2({ subsets: ["latin"], variable: "--font-baloo" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

export const metadata: Metadata = {
  title: "Solana Meme Match-3",
  description: "Meme token themed match-3 with daily check-ins and on-chain score proof",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${baloo.variable} ${grotesk.variable}`}>{children}</body>
    </html>
  );
}