# RH Burner OS

A BurnerOS-style wallet for [Burner](https://burner.pro) Ethereum hardware cards on **Robinhood Chain**, with WalletConnect so you can use the card as a signer in [Safe](https://app.safe.global).

**Live:** [https://z80.wtf/burner](https://z80.wtf/burner)

Private keys never leave the Burner secure element. Signing uses the same LibBurner / LibHaLo stack as official BurnerOS.

## Features

- Connect Burner via **phone NFC** (Android Chrome) or **HaLo Bridge** (desktop USB reader)
- View ETH balance and send on **Robinhood Chain** (mainnet `4663` / testnet `46630`)
- **WalletConnect** pairing — paste a `wc:` URI from Safe (or any dApp)
- Approve session proposals and sign `personal_sign` / typed data / transactions with a card tap + PIN
- Deep link to Safe with Robinhood Chain selected

## Quick start

```bash
npm ci
cp .env.example .env.local
# Add a free WalletConnect Project ID from https://cloud.reown.com
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

### Desktop (HaLo Bridge)

1. Install [HaLo Bridge](https://github.com/arx-research/libhalo/releases) and start it
2. Grant origin consent: open `http://127.0.0.1:32868/consent?website=http://127.0.0.1:3847`
3. Plug in an NFC reader, tap your Burner, click **Tap Burner to connect**

For the deployed site, grant consent for the origin `https://z80.wtf` instead (no `/burner` path).

### Phone NFC

Use Android Chrome (WebNFC). Tap the card when prompted.

## Connect to Safe.global

1. Connect your Burner in RH Burner OS
2. Paste your Reown / WalletConnect Project ID (stored in the browser)
3. Open [app.safe.global](https://app.safe.global/welcome/accounts?chain=4663)
4. Connect wallet → **WalletConnect** → copy the URI
5. Paste the URI into RH Burner OS → **Pair with Safe** → Approve
6. When Safe asks you to sign, enter your PIN and tap the Burner

## Deploy (GitHub Pages)

This repo deploys to **https://z80.wtf/burner** via GitHub Actions on every push to `main`.

1. Repo Settings → Pages → Source: **GitHub Actions** (one-time)
2. Push to `main` (or run **Deploy to GitHub Pages**)
3. WalletConnect Project ID is included; override in the UI if needed

Local production export (with `/burner` base path):

```bash
GITHUB_PAGES=true npm run build
mkdir -p .preview
ln -sfn ../out .preview/burner
npx serve .preview
# Open http://localhost:3000/burner/
```

## Network

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 4663 | 46630 |
| RPC | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com` |
| Explorer | [Blockscout](https://robinhoodchain.blockscout.com) | [Testnet explorer](https://explorer.testnet.chain.robinhood.com) |

## Stack

- Next.js, TypeScript, Tailwind, shadcn/ui
- `@arx-research/libburner` + `@arx-research/libhalo`
- viem
- `@reown/walletkit` (WalletConnect wallet role)

## Environment

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | For WalletConnect | Project ID from [cloud.reown.com](https://cloud.reown.com) |

You can also paste the Project ID in the UI; it is saved to `localStorage` only.

## Security notes

- This app never sees your private key or seed
- PIN is used only to authorize on-card signing and is not persisted
- Review every WalletConnect request before tapping to sign

Not affiliated with Robinhood Markets, Inc. or Arx Research.
