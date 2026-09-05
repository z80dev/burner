"use client";

import { useEffect } from "react";
import { ConnectPanel } from "@/components/connect-panel";
import { WalletDashboard } from "@/components/wallet-dashboard";
import { WalletConnectPanel } from "@/components/wallet-connect-panel";
import { useWalletStore, hydrateChainKey } from "@/lib/store";
import { Separator } from "@/components/ui/separator";

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
            RH Burner OS
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
          <section className="flex min-h-[70vh] flex-col justify-center gap-8">
            <div className="max-w-2xl space-y-5">
              <p className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-white md:text-7xl">
                RH Burner OS
              </p>
              <h1 className="max-w-xl text-xl text-white/70 md:text-2xl">
                Use your Burner card on Ethereum, Base, Arbitrum, and Robinhood
                Chain — and connect it to Safe.
              </h1>
              <p className="max-w-lg text-base text-white/45">
                Same secure-element keys as os.burner.pro. Tap to sign. ENS
                names resolve. WalletConnect for Safe and other dApps.
              </p>
            </div>
            <ConnectPanel />
          </section>
        ) : (
          <>
            <section className="space-y-6 animate-in fade-in duration-500">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-display text-3xl font-semibold text-white md:text-4xl">
                    RH Burner OS
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

            <Separator className="bg-white/10" />

            <WalletConnectPanel />
          </>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/5 px-5 py-6 text-center text-xs text-white/30 md:px-8">
        Keys stay on your Burner. Not affiliated with Robinhood Markets or Arx —
        built for Ethereum, Base, Arbitrum, Robinhood Chain + Burner cards.
      </footer>
    </div>
  );
}
