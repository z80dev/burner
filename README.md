# Burner

A BurnerOS-style wallet for [Burner](https://burner.pro) Ethereum hardware cards on **Ethereum, Base, Arbitrum, and Robinhood Chain**, with WalletConnect for [Safe](https://app.safe.global) and other EVM dapps.

**Live:** [https://z80.wtf/burner](https://z80.wtf/burner)

Private keys never leave the Burner secure element. Signing uses the same LibBurner / LibHaLo stack as official BurnerOS.

## Features

- Connect Burner via **phone NFC** (iPhone Safari / Android Chrome) or **HaLo Bridge** (desktop USB reader)
- View ETH balance and send on **Ethereum**, **Base**, **Arbitrum**, and **Robinhood Chain** (mainnet `4663` / testnet `46630`)
- **ENS** forward resolution for send (`vitalik.eth`) and reverse lookup on the connected address
- **WalletConnect** pairing — paste a connection link, import a QR screenshot, or open a wallet deep link
- Review full signing payloads, requested networks, app identity, and active connections
- Restore pending proposals and requests after reload; queue requests without replacing the one under review
- Approve session proposals and sign `personal_sign` / typed data / transactions with a card tap + PIN
- Deep link to Safe with the selected chain

## Quick start

```bash
npm ci
cp .env.example .env.local
# The existing public Reown project ID is already included
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

### Desktop (HaLo Bridge)

1. Install [HaLo Bridge](https://github.com/arx-research/libhalo/releases) and start it
2. Grant origin consent: open `http://127.0.0.1:32868/consent?website=http://127.0.0.1:3847`
3. Plug in an NFC reader, tap your Burner, click **HaLo Bridge**

For the deployed site, grant consent for the origin `https://z80.wtf` instead (no `/burner` path).

### Phone NFC

On iPhone, open the site in Safari, tap **Tap Burner to connect**, and follow the NFC security-key prompt while holding the Burner near the top of the phone. LibHaLo uses the iOS credential transport.

Android Chrome uses WebNFC. Neither phone flow requires HaLo Bridge or a hosted backend. The **HaLo Bridge** button is only for a desktop with the local bridge app and a USB NFC reader.

## Connect to a dapp

1. Open the dapp (for example [Safe](https://app.safe.global)) and choose **Connect wallet → WalletConnect**.
2. Copy the connection link or save a screenshot of the QR code.
3. In Burner, paste the link or choose **Import QR image**, then **Connect dapp**. QR images are decoded locally in the browser.
4. Tap your Burner card if it is not already connected, then review the app URL, requested networks, and permissions. Choose **Approve connection**.
5. Keep this tab available. When the dapp requests a signature, review the complete message or transaction, enter your PIN, and tap your card. Account queries and network changes do not require a PIN or signature.
6. Use **Connected apps** to disconnect a dapp. Disconnecting the card also disconnects its WalletConnect sessions.

The Reown project ID is already configured; users do not need their own. An override remains under **Connection settings**, and requires a reload after editing.

Web-wallet entry points are `/burner/?uri=<encoded-wc-uri>` and `/burner/wc/?uri=<encoded-wc-uri>`. The URI is loaded for review and removed from the URL. A user still chooses **Connect dapp** and approves the connection. This supports links from dapps configured with this wallet URL; it does not register Burner automatically in every dapp’s wallet directory.

Only approved accounts, networks, and methods may sign. Unsupported networks never fall back to the selected network. Typed-data and transaction chain IDs must match the request. Raw `eth_sign`, blob transactions, access lists, and authorization-list transactions are not supported. Full payload review is provided; this version does not simulate transactions or decode arbitrary contract calls.

## Validation

```bash
npm run lint
npm test
GITHUB_PAGES=true npm run build
```

Tests cover URI validation, request authorization, queueing, session approval, real SDK disconnect calls (mocked transport), network changes without signing, duplicate-sign prevention, and interrupted response delivery. Hardware signing requires a physical Burner and a supported NFC transport; automated tests use a mock card and never broadcast a transaction.

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

## Networks

| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| Ethereum | 1 | `https://ethereum.reth.rs/rpc` | [Etherscan](https://etherscan.io) |
| Base | 8453 | `https://mainnet.base.org` | [Basescan](https://basescan.org) |
| Arbitrum One | 42161 | `https://arb1.arbitrum.io/rpc` | [Arbiscan](https://arbiscan.io) |
| Robinhood Chain | 4663 | `https://rpc.mainnet.chain.robinhood.com` | [Blockscout](https://robinhoodchain.blockscout.com) |
| Robinhood Testnet | 46630 | `https://rpc.testnet.chain.robinhood.com` | [Testnet explorer](https://explorer.testnet.chain.robinhood.com) |

ENS names are resolved against Ethereum mainnet regardless of the selected send network.

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
