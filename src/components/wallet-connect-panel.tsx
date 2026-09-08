"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link2, Loader2, Unplug, Check, X, ArrowUpRight, ClipboardPaste, ImageUp } from "lucide-react";
import { useWalletStore, hydrateWcProjectId } from "@/lib/store";
import { initWalletKit, pairWithUri, approveProposal, rejectProposal, approveRequest, rejectRequest, disconnectWcSession, getWalletKit } from "@/lib/walletconnect/kit";
import { normalizePairingUri, personalMessage, typedData, SIGNING_METHODS, validateRequest } from "@/lib/walletconnect/validation";
import { decodePersonalSignMessage, normalizeWcTx } from "@/lib/rpc";
import { getSupportedChainById } from "@/lib/chains";

function networkName(id: string) {
  return getSupportedChainById(Number(id.split(":")[1]))?.label ?? id;
}

export function WalletConnectPanel() {
  const { address, wcProjectId, setWcProjectId, wcReady, wcUri, setWcUri, wcSessions, pendingProposal, pendingRequest, pin, setPin } = useWalletStore();
  const [pairing, setPairing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    hydrateWcProjectId();
    const url = new URL(window.location.href);
    const incoming = url.searchParams.get("uri");
    if (incoming) {
      // Pairing secrets belong in memory, never in browser history or outbound referrers.
      url.searchParams.delete("uri");
      window.history.replaceState(null, "", url.pathname + url.search + "#dapps");
      try { setWcUri(normalizePairingUri(incoming)); }
      catch (e) { queueMicrotask(() => setActionError(e instanceof Error ? e.message : "Invalid connection link.")); }
    }
  }, [setWcUri]);

  useEffect(() => {
    if (!/^[a-f0-9]{32}$/i.test(wcProjectId)) return;
    let cancelled = false;
    void initWalletKit(wcProjectId).then(() => {
      if (!cancelled) setInitError(null);
    }).catch(e => {
      if (!cancelled) setInitError(e instanceof Error ? e.message : "WalletConnect could not connect.");
    });
    return () => { cancelled = true; };
  }, [wcProjectId, retry]);

  async function action(fn: () => Promise<unknown>) {
    setNotice(null);
    setApproving(true);
    setActionError(null);
    try { await fn(); }
    catch (e) { setActionError(e instanceof Error ? e.message : "Please try again."); }
    finally { setApproving(false); }
  }

  async function handlePair() {
    setActionError(null);
    setNotice(null);
    setPairing(true);
    try {
      const uri = normalizePairingUri(wcUri);
      await initWalletKit(wcProjectId);
      await pairWithUri(uri);
      setWcUri("");
      setNotice("Link received. Keep the dapp open while its connection request arrives.");
    } catch (e) { setActionError(e instanceof Error ? e.message : "Connection failed."); }
    finally { setPairing(false); }
  }

  async function pasteLink() {
    try { setWcUri(normalizePairingUri(await navigator.clipboard.readText())); setActionError(null); }
    catch (e) { setActionError(e instanceof Error && e.name !== "NotAllowedError" ? e.message : "Paste the link into the field below."); }
  }

  async function readQr(file?: File) {
    if (!file) return;
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("Choose an image smaller than 15 MB.");
      const { default: QrScanner } = await import("qr-scanner");
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      setWcUri(normalizePairingUri(result.data));
      setActionError(null);
      setNotice("QR code read. Connect when you’re ready.");
    } catch (e) { setActionError(e instanceof Error ? e.message : "No WalletConnect QR code found. Try a clear screenshot of the dapp’s QR code."); }
  }

  const needsSignature = !!pendingRequest && SIGNING_METHODS.includes(pendingRequest.method);
  let requestError: string | null = null;
  let requestPreview = "";
  if (pendingRequest) {
    try {
      if (!address) throw new Error("Tap your Burner card to review this request.");
      validateRequest(getWalletKit()?.getActiveSessions()[pendingRequest.topic], address, pendingRequest.chainId, pendingRequest.method, pendingRequest.params);
      const { method, params } = pendingRequest;
      if (method === "eth_sendTransaction" || method === "eth_signTransaction") normalizeWcTx(params[0] as Record<string, unknown>);
      requestPreview = method === "personal_sign" ? decodePersonalSignMessage(personalMessage(params, address))
        : method.startsWith("eth_signTypedData") ? JSON.stringify(typedData(params, address), null, 2)
        : JSON.stringify(params.length === 1 ? params[0] : params, null, 2);
    } catch (e) { requestError = e instanceof Error ? e.message : "Invalid request."; }
  }

  return (
    <section id="dapps" className="scroll-mt-6 space-y-6 rounded-3xl border border-white/10 bg-[#0c1511]/90 p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">WalletConnect</p>
          <h2 className="font-display text-3xl font-semibold text-white">Your card. Any supported dapp.</h2>
        </div>
        <span role="status" className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60">
          <span className={`size-2 rounded-full ${wcReady ? "bg-emerald-400" : "bg-amber-300"}`} />
          {wcReady ? "Ready to connect" : initError ? "Connection unavailable" : "Connecting to relay…"}
        </span>
      </div>
      <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5 text-sm text-white/60">
          <p>Connect your Burner to Safe and other WalletConnect dapps. Every signature still needs your card.</p>
          <ol className="space-y-4">
            {["Choose WalletConnect in the dapp’s Connect wallet menu.", "Copy its connection link, or save its QR code as an image.", "Add it here, tap your Burner, and review the connection."].map((step, i) => (
              <li key={step} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs text-emerald-300">{i + 1}</span><span>{step}</span></li>
            ))}
          </ol>
          <a href="https://app.safe.global" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline">Open Safe <ArrowUpRight className="size-4" /></a>
          <p className="text-xs text-white/40">Ethereum mainnet · Base · Arbitrum · Monad · Robinhood<br />Robinhood Testnet is also supported.</p>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void pasteLink()}><ClipboardPaste className="size-4" />Paste link</Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 focus-within:ring-2 focus-within:ring-emerald-400">
              <ImageUp className="size-4" />Import QR image
              <input aria-label="Import WalletConnect QR image" type="file" accept="image/*" className="sr-only" onChange={e => { void readQr(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
          <label className="block space-y-2">
            <span className="text-sm text-white/65">Connection link</span>
            <Textarea placeholder="wc:… or a WalletConnect link" value={wcUri} onChange={e => setWcUri(e.target.value)} autoComplete="off" spellCheck={false} className="min-h-28 resize-y break-all border-white/15 bg-black/30 font-mono text-xs text-white" />
          </label>
          <Button className="h-11 w-full bg-emerald-400 text-zinc-950 hover:bg-emerald-300" disabled={pairing || !wcUri.trim() || !wcProjectId} onClick={() => void handlePair()}>
            {pairing ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}{pairing ? "Connecting…" : "Connect dapp"}
          </Button>
          {!address && <p className="text-xs text-white/50">You can add a link now. Tap your Burner above before approving.</p>}
          {notice && !pendingProposal && <p role="status" className="text-sm text-emerald-200">{notice}</p>}
          {actionError && !pendingProposal && !pendingRequest && <p role="alert" className="text-sm text-rose-300">{actionError}</p>}
          {initError && <div role="alert" className="space-y-2 text-sm text-rose-300"><p>{initError}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry connection</Button></div>}
          <details className="pt-2 text-xs text-white/40">
            <summary className="cursor-pointer">Connection settings</summary>
            <p className="py-2">WalletConnect is already configured. Only change this if you use your own Reown project. Reload after saving.</p>
            <label className="space-y-1"><span>Reown project ID</span><Input aria-label="Reown project ID" value={wcProjectId} onChange={e => setWcProjectId(e.target.value.trim())} className="font-mono text-xs" /></label>
          </details>
        </div>
      </div>
      <div className="border-t border-white/10 pt-5">
        <h3 className="mb-3 text-sm font-medium text-white/75">Connected apps <span className="ml-1 text-white/35">{wcSessions.length}</span></h3>
        {wcSessions.length === 0 ? <p className="text-sm text-white/40">Your approved dapps will appear here. You can disconnect them at any time.</p> : (
          <ul className="space-y-2">{wcSessions.map(s => <li key={s.topic} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3">
            <div className="min-w-0 space-y-1"><p className="truncate font-medium">{s.name}</p><p className="break-all text-xs text-white/45">{s.url}</p><p className="text-xs text-emerald-300/70">{s.chains.map(networkName).join(" · ")}</p>{address && !s.accounts.some(a => a.toLowerCase().endsWith(`:${address.toLowerCase()}`)) && <p className="text-xs text-amber-200">Connected to a different card. Reconnect this app to use your current Burner.</p>}</div>
            <Button disabled={approving} size="sm" variant="ghost" aria-label={`Disconnect ${s.name}`} onClick={() => void action(() => disconnectWcSession(s.topic))}><Unplug className="size-4" /><span className="hidden sm:inline">Disconnect</span></Button>
          </li>)}</ul>
        )}
      </div>

      <Dialog open={!!pendingProposal && !!address} onOpenChange={open => { if (!open && !approving) void action(rejectProposal); }}>
        <DialogContent showCloseButton={!approving} className="max-h-[90dvh] overflow-auto border-white/10 bg-zinc-950 text-white sm:max-w-lg">
          <DialogHeader><DialogTitle>Connect to {pendingProposal?.name}?</DialogTitle><DialogDescription>Share your address with this app. Transactions and signatures require a separate approval.</DialogDescription></DialogHeader>
          <p className="break-all text-sm text-emerald-300">{pendingProposal?.url}</p>
          {pendingProposal?.validation !== "VALID" && <p className="rounded-lg bg-amber-400/10 p-3 text-sm text-amber-200">{pendingProposal?.validation === "INVALID" ? "WalletConnect reports a domain mismatch. Reject this connection unless you are certain you trust it." : "This app’s identity has not been verified. Check the address above."}</p>}
          <div className="space-y-2 text-sm"><p className="text-white/50">Your Burner</p><p className="break-all font-mono text-xs">{address}</p><p className="pt-2 text-white/50">Requested networks</p><p>{pendingProposal?.chains.map(networkName).join(" · ") || "Supported EVM networks"}</p><details className="text-white/50"><summary className="cursor-pointer">Requested permissions</summary><p className="mt-2 break-words text-xs">{pendingProposal?.methods.join(", ")}</p></details></div>
          {actionError && <p role="alert" className="text-sm text-rose-300">{actionError}</p>}
          <DialogFooter><Button disabled={approving} variant="outline" onClick={() => void action(rejectProposal)}><X className="size-4" />Reject</Button><Button disabled={approving} onClick={() => void action(approveProposal)}>{approving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Approve connection</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {pendingProposal && !address && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">{pendingProposal.name} is waiting. Tap your Burner above to review its connection request.<Button variant="ghost" className="ml-2" disabled={approving} onClick={() => void action(rejectProposal)}>Reject connection</Button></p>}

      <Dialog open={!!pendingRequest && !!address && !pendingProposal} onOpenChange={open => { if (!open && !approving) void action(rejectRequest); }}>
        <DialogContent showCloseButton={!approving} className="max-h-[90dvh] overflow-auto border-white/10 bg-zinc-950 text-white sm:max-w-lg">
          <DialogHeader><DialogTitle>{needsSignature ? "Review & sign with Burner" : "Review app request"}</DialogTitle><DialogDescription>{pendingRequest?.dappName} · {networkName(pendingRequest?.chainId ?? "")}</DialogDescription></DialogHeader>
          <p className="break-all text-xs text-white/50">{pendingRequest?.dappUrl}</p><p className="font-mono text-xs text-emerald-300">{pendingRequest?.method}</p>
          {requestError ? <p role="alert" className="text-sm text-rose-300">{requestError}</p> : <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/50 p-3 font-mono text-xs text-white/75">{requestPreview}</pre>}
          {needsSignature && !requestError && <label className="space-y-2"><span className="text-sm text-white/60">Burner PIN</span><Input type="password" autoComplete="off" value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter PIN, then tap your card" /></label>}
          {actionError && <p role="alert" className="text-sm text-rose-300">{actionError}</p>}
          <DialogFooter><Button disabled={approving} variant="outline" onClick={() => void action(rejectRequest)}><X className="size-4" />Reject</Button><Button disabled={approving || !!requestError || (needsSignature && !pin)} onClick={() => void action(() => approveRequest(pin))}>{approving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{needsSignature ? "Tap & sign" : "Approve request"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {pendingRequest && !address && !pendingProposal && <p role="status" className="text-sm text-amber-200">A connected app has a request. Tap the same Burner card to review it.</p>}
    </section>
  );
}
