"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Link2,
  Loader2,
  Unplug,
  Check,
  X,
  Shield,
} from "lucide-react";
import { useWalletStore, hydrateWcProjectId } from "@/lib/store";
import {
  initWalletKit,
  pairWithUri,
  approveProposal,
  rejectProposal,
  approveRequest,
  rejectRequest,
  disconnectWcSession,
} from "@/lib/walletconnect/kit";
import { decodePersonalSignMessage } from "@/lib/rpc";

export function WalletConnectPanel() {
  const {
    address,
    wcProjectId,
    setWcProjectId,
    wcReady,
    wcUri,
    setWcUri,
    wcSessions,
    pendingProposal,
    pendingRequest,
    pin,
    setPin,
    setStatusMessage,
  } = useWalletStore();

  const [pairing, setPairing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    hydrateWcProjectId();
  }, []);

  useEffect(() => {
    if (!wcProjectId || wcProjectId.length < 8) return;
    let cancelled = false;
    void initWalletKit(wcProjectId).catch((e) => {
      if (!cancelled) {
        setInitError(e instanceof Error ? e.message : "WalletConnect init failed");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [wcProjectId]);

  async function handlePair() {
    setActionError(null);
    if (!address) {
      setActionError("Connect your Burner first");
      return;
    }
    if (!wcUri.trim().startsWith("wc:")) {
      setActionError("Paste a WalletConnect URI starting with wc:");
      return;
    }
    setPairing(true);
    try {
      if (!wcReady) await initWalletKit(wcProjectId);
      await pairWithUri(wcUri);
      setWcUri("");
      setStatusMessage("Waiting for dApp session proposal…");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Pairing failed");
    } finally {
      setPairing(false);
    }
  }

  async function handleApproveProposal() {
    setApproving(true);
    setActionError(null);
    try {
      await approveProposal();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setApproving(false);
    }
  }

  async function handleApproveRequest() {
    setApproving(true);
    setActionError(null);
    try {
      if (!pin) throw new Error("Enter your Burner PIN to sign");
      await approveRequest(pin);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Sign failed");
    } finally {
      setApproving(false);
    }
  }

  const requestPreview = (() => {
    if (!pendingRequest) return null;
    const { method, params } = pendingRequest;
    if (method === "personal_sign") {
      const msg =
        typeof params[0] === "string" ? decodePersonalSignMessage(params[0]) : "";
      return msg.slice(0, 280);
    }
    if (method.startsWith("eth_signTypedData")) {
      return JSON.stringify(params[1] ?? params[0], null, 2).slice(0, 400);
    }
    if (method === "eth_sendTransaction" || method === "eth_signTransaction") {
      return JSON.stringify(params[0], null, 2).slice(0, 400);
    }
    return JSON.stringify(params).slice(0, 280);
  })();

  return (
    <section className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <Shield className="size-5 text-emerald-400" />
        <h2 className="font-display text-2xl font-semibold text-white">
          Connect to Safe
        </h2>
      </div>
      <p className="max-w-2xl text-sm text-white/55">
        In{" "}
        <a
          href="https://app.safe.global"
          className="text-emerald-300 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          app.safe.global
        </a>
        , choose WalletConnect, pick Ethereum / Base / Arbitrum / Robinhood, then
        paste the{" "}
        <code className="rounded bg-white/10 px-1">wc:</code> URI here. Your
        Burner signs every request — keys never leave the card.
      </p>

      <div className="grid max-w-xl gap-3">
        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-white/45">
            WalletConnect Project ID
          </span>
          <Input
            placeholder="From cloud.reown.com"
            value={wcProjectId}
            onChange={(e) => setWcProjectId(e.target.value.trim())}
            className="border-white/15 bg-black/30 font-mono text-sm text-white"
          />
          <span className="block text-xs text-white/35">
            Free at{" "}
            <a
              href="https://cloud.reown.com"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-300/80 hover:underline"
            >
              cloud.reown.com
            </a>
            . Stored only in this browser.
          </span>
        </label>

        {initError && (
          <p className="text-sm text-rose-300">{initError}</p>
        )}

        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-white/45">
            WalletConnect URI from Safe
          </span>
          <Textarea
            placeholder="wc:…"
            value={wcUri}
            onChange={(e) => setWcUri(e.target.value)}
            className="min-h-24 border-white/15 bg-black/30 font-mono text-sm text-white"
          />
        </label>

        <Button
          className="w-fit bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
          disabled={pairing || !address || !wcProjectId}
          onClick={() => void handlePair()}
        >
          {pairing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Link2 className="size-4" />
          )}
          Pair with Safe
        </Button>
        {actionError && !pendingProposal && !pendingRequest && (
          <p className="text-sm text-rose-300">{actionError}</p>
        )}
      </div>

      {wcSessions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-white/45">
            Active sessions
          </p>
          <ul className="space-y-2">
            {wcSessions.map((s) => (
              <li
                key={s.topic}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                    </span>
                    <span className="truncate font-medium text-white">
                      {s.name}
                    </span>
                  </div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-xs text-white/40 hover:text-emerald-300"
                  >
                    {s.url}
                  </a>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/60 hover:bg-white/10 hover:text-white"
                  onClick={() => void disconnectWcSession(s.topic)}
                >
                  <Unplug className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={!!pendingProposal}
        onOpenChange={(open) => {
          if (!open) void rejectProposal();
        }}
      >
        <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve connection</DialogTitle>
            <DialogDescription className="text-white/55">
              {pendingProposal?.name} wants to connect to your Burner (Ethereum,
              Base, Arbitrum, Robinhood Chain).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
              eip155:{useWalletStore.getState().chainId()}
            </Badge>
            <p className="text-white/50">{pendingProposal?.url}</p>
            <p className="text-white/40">{pendingProposal?.description}</p>
          </div>
          {actionError && <p className="text-sm text-rose-300">{actionError}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="border-white/20"
              onClick={() => void rejectProposal()}
            >
              <X className="size-4" />
              Reject
            </Button>
            <Button
              className="bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
              disabled={approving}
              onClick={() => void handleApproveProposal()}
            >
              {approving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingRequest}
        onOpenChange={(open) => {
          if (!open) void rejectRequest();
        }}
      >
        <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sign with Burner</DialogTitle>
            <DialogDescription className="text-white/55">
              {pendingRequest?.dappName ?? "dApp"} requests{" "}
              <code className="text-emerald-300">{pendingRequest?.method}</code>
              {pendingRequest?.chainId ? ` on ${pendingRequest.chainId}` : ""}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-48 overflow-auto rounded-lg bg-black/50 p-3 font-mono text-xs text-white/70 whitespace-pre-wrap">
            {requestPreview}
          </pre>
          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-wider text-white/45">
              Burner PIN
            </span>
            <Input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="border-white/15 bg-black/30 text-white"
              placeholder="Tap card after approving"
            />
          </label>
          {actionError && <p className="text-sm text-rose-300">{actionError}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="border-white/20"
              onClick={() => void rejectRequest()}
            >
              <X className="size-4" />
              Reject
            </Button>
            <Button
              className="bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
              disabled={approving}
              onClick={() => void handleApproveRequest()}
            >
              {approving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Tap & sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
