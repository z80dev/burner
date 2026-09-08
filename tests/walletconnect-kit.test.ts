import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ handlers: {} as Record<string, (event: never) => void>, active: {} as Record<string, unknown>, signMessage: vi.fn(), approveSession: vi.fn(), respond: vi.fn(), disconnect: vi.fn(), event: vi.fn(), pair: vi.fn() }));
vi.mock("@walletconnect/core", () => ({ Core: class { relayer = { on: vi.fn() }; } }));
vi.mock("@reown/walletkit", () => ({ WalletKit: { init: vi.fn(async () => ({
  on: (name: string, handler: (event: never) => void) => { f.handlers[name] = handler; },
  getActiveSessions: () => f.active,
  getPendingSessionProposals: () => ({}), getPendingSessionRequests: () => [],
  approveSession: f.approveSession, rejectSession: vi.fn(),
  respondSessionRequest: f.respond, disconnectSession: f.disconnect, emitSessionEvent: f.event, pair: f.pair,
})) } }));
vi.mock("@/lib/burner/client", () => ({ getBurnerViemAccount: vi.fn(async () => ({ signMessage: f.signMessage })) }));
import { initWalletKit, approveProposal, approveRequest, rejectRequest, disconnectAllSessions } from "@/lib/walletconnect/kit";
import { useWalletStore } from "@/lib/store";
import { SUPPORTED_METHODS } from "@/lib/walletconnect/validation";
import type { BurnerSession } from "@/lib/burner/client";
const address = "0x1111111111111111111111111111111111111111";
const peer = { metadata: { name: "Test dapp", url: "https://example.com", description: "Test", icons: [] } };
const card = { address, burner: { setPassword: vi.fn() }, method: "credential" } as unknown as BurnerSession;
function request(id: number, method = "personal_sign", params: unknown[] = ["0x6869", address], chainId = "eip155:1") {
  f.handlers.session_request({ id, topic: "session", params: { chainId, request: { method, params } } } as never);
}
beforeEach(async () => {
  await initWalletKit("a".repeat(32));
  await disconnectAllSessions();
  vi.clearAllMocks();
  f.active = { session: { topic: "session", expiry: Date.now() / 1000 + 1000, peer, namespaces: { eip155: { accounts: [`eip155:1:${address}`, `eip155:8453:${address}`], methods: SUPPORTED_METHODS, events: ["chainChanged"] } } } };
  useWalletStore.getState().setSession(card);
  f.signMessage.mockResolvedValue("0xsigned");
  f.respond.mockResolvedValue(undefined);
  f.disconnect.mockImplementation(async ({ topic }) => { delete f.active[topic]; });
});
describe("WalletConnect lifecycle", () => {
  it("approves a dapp proposal using the connected card", async () => {
    f.handlers.session_proposal({ id: 1, params: { proposer: peer, requiredNamespaces: { eip155: { chains: ["eip155:1"], methods: ["personal_sign"], events: ["accountsChanged"] } }, optionalNamespaces: {} } } as never);
    await approveProposal();
    expect(f.approveSession).toHaveBeenCalledWith(expect.objectContaining({ id: 1, namespaces: expect.objectContaining({ eip155: expect.objectContaining({ accounts: [`eip155:1:${address}`] }) }) }));
    expect(useWalletStore.getState().pendingProposal).toBeNull();
  });
  it("queues incoming requests without replacing the one under review", async () => {
    request(1); request(2);
    expect(useWalletStore.getState().pendingRequest?.id).toBe(1);
    await rejectRequest();
    expect(useWalletStore.getState().pendingRequest?.id).toBe(2);
    await approveRequest("1234");
    expect(f.respond).toHaveBeenLastCalledWith({ topic: "session", response: { id: 2, jsonrpc: "2.0", result: "0xsigned" } });
    expect(useWalletStore.getState().pendingRequest).toBeNull();
    expect(useWalletStore.getState().pin).toBe("");
  });
  it("switches network without requiring a PIN or a card signature", async () => {
    request(3, "wallet_switchEthereumChain", [{ chainId: "0x2105" }]);
    await approveRequest();
    expect(f.signMessage).not.toHaveBeenCalled();
    expect(useWalletStore.getState().chainId()).toBe(8453);
    expect(f.event).toHaveBeenCalledWith(expect.objectContaining({ event: { name: "chainChanged", data: 8453 } }));
  });
  it("rejects unapproved networks before touching the card", async () => {
    request(4, "personal_sign", ["0x6869", address], "eip155:42161");
    await expect(approveRequest("1234")).rejects.toThrow(/not approved/);
    expect(f.signMessage).not.toHaveBeenCalled();
    expect(f.respond).toHaveBeenCalledWith(expect.objectContaining({ response: expect.objectContaining({ error: expect.any(Object) }) }));
  });
  it("prevents duplicate signing while NFC is pending", async () => {
    let finish!: (value: string) => void;
    f.signMessage.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    request(5);
    const signing = approveRequest("1234");
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    await expect(approveRequest("1234")).rejects.toThrow(/already/);
    await rejectRequest();
    expect(f.respond).not.toHaveBeenCalled();
    finish("0xsigned"); await signing;
    expect(f.signMessage).toHaveBeenCalledTimes(1);
  });
  it("does not send a contradictory error if delivery fails after signing", async () => {
    request(6); f.respond.mockRejectedValueOnce(new Error("offline"));
    await expect(approveRequest("1234")).rejects.toThrow(/completed/);
    expect(f.respond).toHaveBeenCalledTimes(1);
    expect(f.signMessage).toHaveBeenCalledTimes(1);
  });
  it("removes expired requests and disconnects actual SDK sessions", async () => {
    request(7); request(8);
    f.handlers.session_request_expire({ id: 7 } as never);
    expect(useWalletStore.getState().pendingRequest?.id).toBe(8);
    await useWalletStore.getState().disconnect();
    expect(f.disconnect).toHaveBeenCalledWith(expect.objectContaining({ topic: "session" }));
    expect(useWalletStore.getState().pendingRequest).toBeNull();
    expect(useWalletStore.getState().address).toBeNull();
  });
});
