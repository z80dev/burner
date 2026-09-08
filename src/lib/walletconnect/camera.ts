import type QrScanner from "qr-scanner";
import { normalizePairingUri } from "./validation";

export function cameraError(error: unknown): string {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/NotAllowed|Permission|denied/i.test(message)) return "Camera access was denied. Allow camera access for this site in your browser settings, then try again.";
  if (/NotFound|DevicesNotFound|not found/i.test(message)) return "No camera was found. Use a phone or a computer with a camera, or paste the connection link.";
  if (/NotReadable|TrackStart|in use/i.test(message)) return "The camera is busy. Close other apps using it, then try again.";
  return "Could not start the camera. Try again, or open this page in Safari or Chrome.";
}

/** Owns one camera stream, including cancellation while permission is pending. */
export function startCameraScanner(
  video: HTMLVideoElement,
  onScan: (uri: string) => void,
  onError: (message: string) => void,
  onReady: () => void,
) {
  let disposed = false;
  let scanner: QrScanner | undefined;
  const stopVideo = () => {
    const stream = video.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  };
  const dispose = () => {
    disposed = true;
    scanner?.destroy();
    stopVideo();
  };
  void (async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API unavailable");
      const { default: Scanner } = await import("qr-scanner");
      if (disposed) return;
      scanner = new Scanner(video, result => {
        if (disposed) return;
        let uri: string;
        try { uri = normalizePairingUri(result.data); }
        catch (error) { onError(error instanceof Error ? error.message : "Scan a WalletConnect QR code."); return; }
        dispose();
        onScan(uri);
      }, { preferredCamera: "environment", maxScansPerSecond: 8, returnDetailedScanResult: true });
      await scanner.start();
      if (disposed) { scanner.destroy(); stopVideo(); return; }
      onReady();
    } catch (error) {
      if (!disposed) {
        scanner?.destroy();
        stopVideo();
        onError(cameraError(error));
      }
    }
  })();
  return dispose;
}
