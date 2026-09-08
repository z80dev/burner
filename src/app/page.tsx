"use client";

import { useEffect } from "react";
import { NetworkSelect } from "@/components/network-select";
import { ConnectPanel } from "@/components/connect-panel";
import { WalletDashboard } from "@/components/wallet-dashboard";
import { WalletConnectPanel } from "@/components/wallet-connect-panel";
import { useWalletStore, hydrateChainKey } from "@/lib/store";
import { Nfc, ShieldCheck, ArrowDownRight } from "lucide-react";

export default function HomePage() {
  const address = useWalletStore((s) => s.address);
  const statusMessage = useWalletStore((s) => s.statusMessage);
  const setStatusMessage = useWalletStore((s) => s.setStatusMessage);

  useEffect(() => {
    hydrateChainKey();
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => setStatusMessage(null), 5000);
    return () => clearTimeout(t);
  }, [statusMessage, setStatusMessage]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-mesh" aria-hidden />
      <div className="pointer-events-none absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-[100px] animate-pulse-slow" aria-hidden />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-[22rem] w-[22rem] rounded-full bg-lime-400/10 blur-[90px]" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-400 text-zinc-950">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
              <path
                d="M4 14c4-7 12-7 16 0"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="10" r="3" fill="currentColor" />
            </svg>
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-white">
            Burner
          </span>
        </div>
        <a
          href="https://burner.pro"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-white/45 transition hover:text-emerald-300"
        >
          burner.pro
        </a>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-14 px-5 pb-24 pt-4 md:px-8 md:pt-10">
        {!address ? (
          <section className="grid items-center gap-10 py-6 md:grid-cols-[1.4fr_1fr] md:py-12">
            <div className="space-y-7">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-emerald-300">A wallet built around your card</p>
              <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-white md:text-7xl">Tap in.<br /><span className="text-emerald-300">Go anywhere.</span></h1>
              <p className="max-w-lg text-lg leading-relaxed text-white/60">Your Burner card, connected to Ethereum mainnet, Base, Arbitrum, Monad, and Robinhood. Keep your keys in your pocket. Bring your wallet to your favorite dapps.</p>
              <NetworkSelect />
              <ConnectPanel />
              <a href="#dapps" className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:underline">Connect to a dapp <ArrowDownRight className="size-4" /></a>
            </div>
            <div className="hidden md:block" aria-hidden="true">
              <div className="relative mx-auto aspect-[1.586] max-w-sm rotate-[-8deg] overflow-hidden rounded-2xl border border-emerald-200/20 bg-gradient-to-br from-emerald-950 via-[#152b22] to-[#060b08] p-7 shadow-2xl shadow-emerald-950/60">
                <div className="flex items-center justify-between"><span className="font-display text-3xl font-semibold">Burner</span><Nfc className="size-7 text-emerald-200/70" /></div>
                <div className="absolute -bottom-10 -right-6 size-48 rounded-full border-[24px] border-emerald-300/10" />
                <div className="absolute bottom-7 left-7 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-emerald-100/60"><ShieldCheck className="size-4" />Keys stay on the card</div>
              </div>
              <p className="mt-10 text-center text-xs uppercase tracking-[0.18em] text-white/35">One card. Multiple networks.</p>
            </div>
          </section>
        ) : (
          <>
            <section className="space-y-6 animate-in fade-in duration-500">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-display text-3xl font-semibold text-white md:text-4xl">
                    Burner
                  </p>
                  <p className="mt-1 text-white/50">
                    Multi-chain Burner wallet · hardware-backed
                  </p>
                </div>
                <ConnectPanel />
              </div>
              {statusMessage && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                  {statusMessage}
                </div>
              )}
            </section>

            <WalletDashboard />


          </>
        )}
        <WalletConnectPanel />
      </main>

      <footer className="relative z-10 border-t border-white/5 px-5 py-6 text-center text-xs text-white/30 md:px-8">
        Keys stay on your Burner. Not affiliated with Robinhood Markets or Arx —
        built for Ethereum mainnet, Base, Arbitrum, Monad, Robinhood Chain + Burner cards.
      </footer>
    </div>
  );
}
