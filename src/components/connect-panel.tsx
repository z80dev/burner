"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Nfc, Usb, Loader2, Unplug } from "lucide-react";
import { connectBurner, getBridgeConsentUrl } from "@/lib/burner/client";
import { useWalletStore } from "@/lib/store";
import { fetchEthBalance } from "@/lib/rpc";
import { lookupEnsName } from "@/lib/ens";

const subscribeToNfc = () => () => {};
const getNfcSnapshot = () => "NDEFReader" in window;
const getServerNfcSnapshot = () => false;

export function ConnectPanel() {
  const {
    address,
    ensName,
    method,
    connecting,
    connectError,
    setConnecting,
    setConnectError,
    setSession,
    setEnsName,
    disconnect,
    chainKey,
    setBalance,
    setBalanceLoading,
  } = useWalletStore();
  const hasNfc = useSyncExternalStore(
    subscribeToNfc,
    getNfcSnapshot,
    getServerNfcSnapshot
  );

  async function handleConnect(preferred: "auto" | "webnfc" | "bridge") {
    setConnecting(true);
    setConnectError(null);
    try {
      const session = await connectBurner(preferred);
      setSession(session);
      setBalanceLoading(true);
      const [bal, name] = await Promise.all([
        fetchEthBalance(session.address, chainKey),
        lookupEnsName(session.address),
      ]);
      setBalance(bal);
      setEnsName(name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to connect Burner";
      setConnectError(
        msg.toLowerCase().includes("unable to locate halo bridge")
          ? "HaLo Bridge was not found on this computer. Install and start HaLo Bridge, then connect a USB NFC reader. On iPhone or Android, use Tap Burner to connect for phone NFC. No hosted backend is needed."
          : msg
      );
    } finally {
      setConnecting(false);
      setBalanceLoading(false);
    }
  }

  if (address) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="secondary"
          className="rounded-md bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-300"
        >
          {ensName ? (
            <span className="font-display font-medium">{ensName}</span>
          ) : (
            <span className="font-mono">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
          )}
        </Badge>
        {method && (
          <Badge variant="outline" className="border-white/15 text-white/70">
            via {method === "bridge" ? "HaLo Bridge" : "NFC"}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => void disconnect()}
        >
          <Unplug className="size-4" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          className="h-12 bg-emerald-400 px-5 text-base text-zinc-950 hover:bg-emerald-300"
          disabled={connecting}
          onClick={() => void handleConnect("auto")}
        >
          {connecting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Nfc className="size-4" />
          )}
          Tap Burner to connect
        </Button>
        {hasNfc && (
          <Button
            size="lg"
            variant="outline"
            className="h-12 border-white/20 bg-white/5 px-5 text-base text-white hover:bg-white/10"
            disabled={connecting}
            onClick={() => void handleConnect("webnfc")}
          >
            <Nfc className="size-4" />
            Use phone NFC
          </Button>
        )}
        <Button
          size="lg"
          variant="outline"
          className="h-12 border-white/20 bg-white/5 px-5 text-base text-white hover:bg-white/10"
          disabled={connecting}
          onClick={() => void handleConnect("bridge")}
        >
          <Usb className="size-4" />
          HaLo Bridge
        </Button>
      </div>
      {connectError && (
        <div role="alert" className="max-w-xl space-y-2 text-sm text-rose-300/90">
          <p>{connectError}</p>
          {connectError.toLowerCase().includes("consent") && (
            <a
              href={getBridgeConsentUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-emerald-300 underline"
            >
              Grant this site access in your local HaLo Bridge app
            </a>
          )}
        </div>
      )}
      <p className="max-w-lg text-sm text-white/50">
        On desktop, install{" "}
        <a
          className="text-emerald-300 underline-offset-2 hover:underline"
          href="https://github.com/arx-research/libhalo/releases"
          target="_blank"
          rel="noreferrer"
        >
          HaLo Bridge
        </a>
        {" "}and start it with a USB NFC reader connected. Bridge runs on your
        computer, not on our server. On iPhone, open this site in Safari and
        tap to connect, then follow the security-key prompt with your Burner
        held near the top of your phone. Android Chrome uses NFC directly.
      </p>
    </div>
  );
}
