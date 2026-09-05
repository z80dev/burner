"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, ExternalLink, Loader2, Send } from "lucide-react";
import { isAddress, type Address } from "viem";
import { useWalletStore } from "@/lib/store";
import { fetchEthBalance, formatEth, sendEth } from "@/lib/rpc";
import {
  explorerAddressUrl,
  explorerTxUrl,
  safeUrlForChain,
} from "@/lib/chains/robinhood";

export function WalletDashboard() {
  const {
    address,
    session,
    network,
    setNetwork,
    balanceWei,
    balanceLoading,
    setBalance,
    setBalanceLoading,
    pin,
    setPin,
    lastTxHash,
    setLastTxHash,
    setStatusMessage,
    chainId,
  } = useWalletStore();

  const [copied, setCopied] = useState(false);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    async function refresh() {
      setBalanceLoading(true);
      try {
        const bal = await fetchEthBalance(address!, network);
        if (!cancelled) setBalance(bal);
      } catch {
        if (!cancelled) setBalance(null);
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    }
    void refresh();
    const id = setInterval(() => void refresh(), 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, network, setBalance, setBalanceLoading]);

  if (!address || !session) return null;

  async function copyAddress() {
    await navigator.clipboard.writeText(address!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSend() {
    setSendError(null);
    if (!session || !address) return;
    if (!isAddress(to)) {
      setSendError("Enter a valid recipient address");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setSendError("Enter an amount greater than 0");
      return;
    }
    if (!pin) {
      setSendError("Enter your Burner PIN to sign");
      return;
    }
    setSending(true);
    try {
      const hash = await sendEth({
        session,
        network,
        to: to as Address,
        amountEth: amount,
        pin,
      });
      setLastTxHash(hash);
      setStatusMessage("Transaction broadcast on Robinhood Chain");
      setAmount("");
      const bal = await fetchEthBalance(address, network);
      setBalance(bal);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-400/80">
            Portfolio
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <h2 className="font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">
              {balanceLoading && balanceWei === null
                ? "…"
                : formatEth(balanceWei)}
              <span className="ml-2 text-2xl text-white/40">ETH</span>
            </h2>
          </div>
          <p className="mt-2 text-sm text-white/45">
            on Robinhood Chain {network === "testnet" ? "Testnet" : "Mainnet"} ·
            ID {chainId()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={network === "mainnet" ? "default" : "outline"}
            className={
              network === "mainnet"
                ? "bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                : "border-white/20 bg-transparent text-white/70 hover:bg-white/10"
            }
            onClick={() => setNetwork("mainnet")}
          >
            Mainnet
          </Button>
          <Button
            size="sm"
            variant={network === "testnet" ? "default" : "outline"}
            className={
              network === "testnet"
                ? "bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                : "border-white/20 bg-transparent text-white/70 hover:bg-white/10"
            }
            onClick={() => setNetwork("testnet")}
          >
            Testnet
          </Button>
        </div>
      </div>

      <Tabs defaultValue="receive" className="w-full">
        <TabsList className="mb-4 bg-white/5">
          <TabsTrigger value="receive">Receive</TabsTrigger>
          <TabsTrigger value="send">Send</TabsTrigger>
          <TabsTrigger value="safe">Safe</TabsTrigger>
        </TabsList>

        <TabsContent value="receive" className="space-y-4">
          <div className="flex flex-col items-start gap-6 sm:flex-row">
            <div className="rounded-xl bg-white p-3 shadow-[0_0_40px_-10px_rgba(52,211,153,0.45)]">
              <QRCodeSVG value={address} size={160} level="M" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm text-white/55">
                Deposit ETH on Robinhood Chain to this Burner address.
              </p>
              <code className="block break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-sm text-emerald-200">
                {address}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => void copyAddress()}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <a
                  href={explorerAddressUrl(address, chainId())}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 text-sm text-white hover:bg-white/10"
                >
                  <ExternalLink className="size-4" />
                  Explorer
                </a>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="send" className="space-y-4">
          <div className="grid max-w-md gap-3">
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-wider text-white/45">
                To
              </span>
              <Input
                placeholder="0x…"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border-white/15 bg-black/30 font-mono text-white"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-wider text-white/45">
                Amount (ETH)
              </span>
              <Input
                placeholder="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-white/15 bg-black/30 text-white"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-wider text-white/45">
                Burner PIN
              </span>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="border-white/15 bg-black/30 text-white"
              />
            </label>
            {sendError && (
              <p className="text-sm text-rose-300">{sendError}</p>
            )}
            <Button
              className="bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
              disabled={sending}
              onClick={() => void handleSend()}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Sign & send
            </Button>
            {lastTxHash && (
              <a
                className="inline-flex items-center gap-1 text-sm text-emerald-300 hover:underline"
                href={explorerTxUrl(lastTxHash, chainId())}
                target="_blank"
                rel="noreferrer"
              >
                View last tx <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </TabsContent>

        <TabsContent value="safe" className="space-y-4">
          <p className="max-w-lg text-sm text-white/60">
            Open Safe and connect this wallet with WalletConnect. Select{" "}
            <strong className="text-white">Robinhood Chain</strong> (chain ID{" "}
            {chainId()}) when creating or opening a Safe. Use the WalletConnect
            panel below to paste the URI from Safe.
          </p>
          <a
            href={safeUrlForChain(chainId())}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-400 px-3 text-sm font-medium text-zinc-950 hover:bg-emerald-300"
          >
            <ExternalLink className="size-4" />
            Open Safe.global
          </a>
        </TabsContent>
      </Tabs>
    </section>
  );
}
