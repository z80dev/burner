import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ start: vi.fn(), destroy: vi.fn(), decoded: undefined as undefined | ((result: {data: string}) => void), options: {} as Record<string, unknown> }));
vi.mock("qr-scanner", () => ({ default: class {
  constructor(_video: unknown, callback: (result: {data: string}) => void, options: Record<string, unknown>) { f.decoded = callback; f.options = options; }
  start = f.start; destroy = f.destroy;
} }));
import { startCameraScanner } from "@/lib/walletconnect/camera";
const uri = `wc:${"a".repeat(64)}@2?relay-protocol=irn&symKey=${"b".repeat(64)}`;
beforeEach(() => { vi.clearAllMocks(); f.start.mockResolvedValue(undefined); vi.stubGlobal("navigator", {mediaDevices: {getUserMedia: vi.fn()}}); });
afterEach(() => vi.unstubAllGlobals());
function setup() {
  const stop = vi.fn();
  const video = {srcObject: {getTracks: () => [{stop}]}} as unknown as HTMLVideoElement;
  const scanned = vi.fn(), error = vi.fn(), ready = vi.fn();
  const dispose = startCameraScanner(video, scanned, error, ready);
  return {stop, video, scanned, error, ready, dispose};
}
describe("Camera scanner lifecycle", () => {
  it("prefers the rear camera and stops after one valid scan", async () => {
    const s = setup(); await vi.waitFor(() => expect(s.ready).toHaveBeenCalled());
    expect(f.options.preferredCamera).toBe("environment");
    f.decoded!({data:uri}); f.decoded!({data:uri});
    expect(s.scanned).toHaveBeenCalledExactlyOnceWith(uri);
    expect(f.destroy).toHaveBeenCalled(); expect(s.stop).toHaveBeenCalled(); expect(s.video.srcObject).toBeNull();
  });
  it("keeps scanning after an unrelated QR code", async () => {
    const s = setup(); await vi.waitFor(() => expect(s.ready).toHaveBeenCalled());
    f.decoded!({data:"https://example.com"});
    expect(s.error).toHaveBeenCalled(); expect(s.scanned).not.toHaveBeenCalled(); expect(f.destroy).not.toHaveBeenCalled();
    s.dispose(); expect(s.stop).toHaveBeenCalled();
  });
  it("cleans up if closed while camera permission is pending", async () => {
    let resolve!: () => void; f.start.mockImplementationOnce(() => new Promise<void>(r => {resolve=r;}));
    const s=setup(); await vi.waitFor(() => expect(resolve).toBeTypeOf("function")); s.dispose();
    const lateStop=vi.fn(); s.video.srcObject={getTracks:()=>[{stop:lateStop}]} as unknown as MediaStream;
    resolve(); await vi.waitFor(() => expect(lateStop).toHaveBeenCalled()); expect(s.ready).not.toHaveBeenCalled();
  });
  it("explains denied camera permission and releases the stream", async () => {
    f.start.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"));
    const s=setup(); await vi.waitFor(() => expect(s.error).toHaveBeenCalledWith(expect.stringContaining("Camera access was denied")));
    expect(s.stop).toHaveBeenCalled(); expect(s.scanned).not.toHaveBeenCalled();
  });
});
