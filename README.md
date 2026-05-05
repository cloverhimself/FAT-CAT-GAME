# Solana Meme Match-3

A Solana-only, meme-token themed match-3 game with:

- Wallet onboarding (Phantom, Solflare, wallet-adapter compatible wallets)
- Username + wallet-gated start
- 8x8 drag/swipe match-3 board
- Daily on-chain check-in (memo tx)
- On-chain score submission (memo tx)
- Local XP, streak, and leaderboard retention loop

## Stack

- Next.js + React + TypeScript
- Tailwind CSS
- `@solana/web3.js`
- Solana wallet adapter

## Network Configuration

Use env vars (see `.env.example`):

- `NEXT_PUBLIC_SOLANA_CLUSTER` (`devnet` or `mainnet-beta`)
- `NEXT_PUBLIC_SOLANA_RPC_URL` (RPC endpoint)
- `NEXT_PUBLIC_MEME_TOKEN_NAME` (branding label)

Primary config file:

- `src/lib/config/network.ts`

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Gameplay + Engagement Mechanics

- Match 3+ themed tiles for score.
- Cascades grant bonus score.
- Daily check-in submits a memo transaction as proof of activity.
- Score submission sends session metadata on-chain via memo.
- Local retention state tracks streak, total XP, total check-ins, and best score.
- Leaderboard supports sorting by score, streak, XP, and check-ins.

## Important Files

- `src/lib/game/gameLogic.ts`
- `src/lib/game/tileMatching.ts`
- `src/lib/solana/txHelpers.ts`
- `src/lib/solana/dailyCheckIn.ts`
- `src/lib/solana/scoreSubmission.ts`
- `src/lib/state/leaderboard.ts`
- `src/components/SolanaAppProvider.tsx`
- `src/components/GameBoard.tsx`
- `src/app/page.tsx`