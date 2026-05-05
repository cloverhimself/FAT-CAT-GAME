# FAT CAT Match-3 (Vite)

A lightweight Solana-only meme-token match-3 game built with Vite + React + TypeScript + Tailwind.

## Features

- Solana wallet connection via wallet adapter
- Phantom, Solflare, Backpack, and wallet-standard compatible wallets
- Username onboarding before gameplay
- 8x8 match-3 board with drag (desktop) and swipe (mobile)
- Meme-themed tiles from `public/img`
- Score + level + moves system
- Daily check-in memo transaction
- Score submission memo transaction
- Supabase-backed leaderboard, XP, streaks, and check-in history
- Responsive layout for desktop/tablet/mobile
- Transaction states: loading, success, failed, rejected
- Devnet/Mainnet RPC config from env

## Security

- No token transfers
- No private key or seed phrase handling
- No automatic airdrops
- Rewards are manual only
- On-chain actions are memo check-ins and memo score submissions only
- UI explicitly states the app never moves user funds

## Environment

Copy `.env.example` to `.env.local` (or `.env`) and set:

- `VITE_SOLANA_CLUSTER=devnet` or `mainnet-beta`
- `VITE_SOLANA_RPC_URL=...`
- `VITE_MEME_TOKEN_NAME=...`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run typecheck
npm run build
```

## Supabase setup

1. Create a Supabase project.
2. Run `supabase_schema.sql` in the SQL editor.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
4. Keep token rewards manual and reviewed (`scores.reviewed`, `scores.suspicious_score`).
