"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startCameraScanner } from "@/lib/walletconnect/camera";

export function CameraScanner({ onScan, onClose }: { onScan: (uri: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanned = useEffectEvent(onScan);

  useEffect(() => {
    if (!video.current) return;
    return startCameraScanner(video.current, uri => scanned(uri), setError, () => setReady(true));
  }, [attempt]);

  return (
    <div className="space-y-3 rounded-xl border border-emerald-400/25 bg-black/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium"><Camera className="size-4 text-emerald-300" />Scan WalletConnect QR</h3>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close camera"><X className="size-4" /></Button>
      </div>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-black">
        <video ref={video} autoPlay muted playsInline aria-label="QR scanner camera preview" className="size-full object-cover" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-xl border-2 border-emerald-300/80" />
      </div>
      <p role="status" className="flex items-center gap-2 text-xs text-white/60">
        {!ready && !error && <Loader2 className="size-3 animate-spin" />}
        {ready ? "Point your camera at the dapp’s WalletConnect QR code." : error ? "Camera scan paused or needs attention." : "Allow camera access to start scanning…"}
      </p>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {error && <Button variant="outline" size="sm" onClick={() => { setError(null); setReady(false); setAttempt(n => n + 1); }}>Try camera again</Button>}
      <p className="text-xs text-white/40">Scanned on your device. The camera stops when a code is read or you close it.</p>
    </div>
  );
}
