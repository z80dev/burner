import { describe, it, expect } from "vitest";
import { normalizePairingUri, validateRequest, personalMessage, SUPPORTED_METHODS } from "@/lib/walletconnect/validation";
import { normalizeWcTx } from "@/lib/rpc";
const address = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const session = { expiry: Date.now() / 1000 + 1000, namespaces: { eip155: { accounts: [`eip155:1:${address}`, `eip155:8453:${address}`], methods: SUPPORTED_METHODS } } };
const uri = `wc:${"a".repeat(64)}@2?relay-protocol=irn&symKey=${"b".repeat(64)}`;
describe("WalletConnect input", () => {
  it("accepts v2 links and encoded wallet deep links", () => {
    expect(normalizePairingUri(`  ${uri} `)).toBe(uri);
    expect(normalizePairingUri(`https://z80.wtf/burner/wc/?uri=${encodeURIComponent(uri)}`)).toBe(uri);
  });
  it("rejects incomplete, v1, and expired links", () => {
    for (const value of ["wc:hello", uri.replace("@2", "@1"), uri.replace("symKey", "missing"), `${uri}&expiryTimestamp=1`]) expect(() => normalizePairingUri(value)).toThrow();
  });
});
describe("Request authorization", () => {
  it("permits a message for the approved card on an approved network", () => {
    expect(validateRequest(session, address, "eip155:1", "personal_sign", ["0x6869", address])).toBe(1);
    expect(validateRequest(session, address, "eip155:8453", "personal_sign", [address, "hello"])).toBe(8453);
    expect(personalMessage([address, "hello"], address)).toBe("hello");
  });
  it("rejects a different card even when a session was restored", () => {
    expect(() => validateRequest(session, other, "eip155:1", "personal_sign", ["hi", other])).toThrow(/not approved/);
    expect(() => validateRequest(session, address, "eip155:1", "personal_sign", ["hi", other])).toThrow(/does not match/);
  });
  it("rejects unapproved and unsupported networks instead of falling back", () => {
    for (const chain of ["eip155:42161", "eip155:999", "eip155:1junk", undefined]) expect(() => validateRequest(session, address, chain, "eth_accounts", [])).toThrow();
  });
  it("rejects expired sessions and unsupported raw eth_sign", () => {
    expect(() => validateRequest({ ...session, expiry: 1 }, address, "eip155:1", "eth_accounts", [])).toThrow(/expired/);
    expect(() => validateRequest(session, address, "eip155:1", "eth_sign", [address, "0x12"])).toThrow();
  });
  it("requires transaction sender and matching network", () => {
    expect(() => validateRequest(session, address, "eip155:1", "eth_sendTransaction", [{ from: other }])).toThrow();
    expect(() => validateRequest(session, address, "eip155:1", "eth_sendTransaction", [{ from: address, chainId: "0x2105" }])).toThrow(/network/);
    expect(validateRequest(session, address, "eip155:1", "eth_sendTransaction", [{ from: address, to: other, value: "0x0" }])).toBe(1);
  });
  it("requires typed-data domain chain to agree", () => {
    const data = { types: { Mail: [] }, domain: { chainId: 8453 }, primaryType: "Mail", message: {} };
    expect(() => validateRequest(session, address, "eip155:1", "eth_signTypedData_v4", [address, JSON.stringify(data)])).toThrow(/network/);
    expect(validateRequest(session, address, "eip155:8453", "eth_signTypedData_v4", [address, JSON.stringify(data)])).toBe(8453);
  });
  it("only switches to approved networks", () => {
    expect(validateRequest(session, address, "eip155:1", "wallet_switchEthereumChain", [{ chainId: "0x2105" }])).toBe(1);
    expect(() => validateRequest(session, address, "eip155:1", "wallet_switchEthereumChain", [{ chainId: "0xa4b1" }])).toThrow(/not approved/);
  });
  it("normalizes zero native value to bigint", () => expect(normalizeWcTx({ value: "0x0", gas: "0x5208" })).toEqual({ value: 0n, gas: 21000n }));
});

describe("Transaction fidelity", () => {
  it("supports numeric quantities and input calldata without losing them", () => {
    expect(normalizeWcTx({ value: 0, gas: 21000, input: "0x1234", nonce: "0x1" })).toEqual({ value: 0n, gas: 21000n, data: "0x1234", nonce: 1 });
  });
  it("rejects transaction fields it cannot preserve", () => {
    for (const tx of [{ accessList: [] }, { authorizationList: [] }, { value: -1 }, { value: 0.5 }, { data: "0xabc" }, { data: "0xab", input: "0xcd" }, { type: "0x3" }]) expect(() => normalizeWcTx(tx)).toThrow();
  });
});
