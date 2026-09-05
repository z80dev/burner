"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Nfc, Usb, Loader2, Unplug } from "lucide-react";
import { connectBurner, getBridgeConsentUrl } from "@/lib/burner/client";
import { useWalletStore } from "@/lib/store";
import { fetchEthBalance } from "@/lib/rpc";

export function ConnectPanel() {
  const {
    address,
    method,
    connecting,
    connectError,
    setConnecting,
    setConnectError,
    setSession,
    disconnect,
    network,
    setBalance,
    setBalanceLoading,
  } = useWalletStore();
  const [hasNfc, setHasNfc] = useState(false);

  useEffect(() => {
    setHasNfc(typeof window !== "undefined" && "NDEFReader" in window);
  }, []);

  async function handleConnect(preferred: "auto" | "webnfc" | "bridge") {
    setConnecting(true);
    setConnectError(null);
    try {
      const session = await connectBurner(preferred);
      setSession(session);
      setBalanceLoading(true);
      const bal = await fetchEthBalance(session.address, network);
      setBalance(bal);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to connect Burner";
      const hint =
        msg.toLowerCase().includes("consent") ||
        msg.toLowerCase().includes("bridge")
          ? ` Grant bridge consent: ${getBridgeConsentUrl()}`
          : "";
      setConnectError(msg + hint);
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
          className="rounded-md bg-emerald-500/15 px-3 py-1.5 font-mono text-sm text-emerald-300"
        >
          {address.slice(0, 6)}…{address.slice(-4)}
        </Badge>
        {method && (
          <Badge variant="outline" className="border-white/15 text-white/70">
            via {method === "webnfc" ? "NFC" : "HaLo Bridge"}
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
        <p className="max-w-xl text-sm text-rose-300/90">{connectError}</p>
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
        , then grant consent once. On Android Chrome, tap your Burner to the
        phone.
      </p>
    </div>
  );
}
