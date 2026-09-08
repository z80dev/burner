import { describe, expect, it } from "vitest";
import { buildApprovedNamespaces } from "@walletconnect/utils";
import { allEip155Chains, getSupportedChain, explorerTxUrl, type ChainKey } from "@/lib/chains";
import { validateRequest, SUPPORTED_METHODS } from "@/lib/walletconnect/validation";
import { useWalletStore, hydrateChainKey } from "@/lib/store";

const address = "0x1111111111111111111111111111111111111111";
const networks: [ChainKey, number, string][] = [["ethereum", 1, "ETH"], ["base", 8453, "ETH"], ["arbitrum", 42161, "ETH"], ["monad", 143, "MON"]];
describe("Mainnet support", () => {
  it.each(networks)("supports %s for balances, sessions and requests", (key, id, symbol) => {
    const chain = getSupportedChain(key).chain;
    expect(chain.id).toBe(id);
    expect(chain.nativeCurrency.symbol).toBe(symbol);
    expect(chain.nativeCurrency.decimals).toBe(18);
    expect(chain.testnet).not.toBe(true);
    const namespaces = buildApprovedNamespaces({
      proposal: { id: 1, expiryTimestamp: Math.floor(Date.now() / 1000) + 300, relays: [{ protocol: "irn" }], pairingTopic: "test", proposer: { publicKey: "test", metadata: { name: "Network test", description: "Test", url: "https://example.com", icons: [] } }, requiredNamespaces: { eip155: { chains: [`eip155:${id}`], methods: ["personal_sign", "eth_sendTransaction", "wallet_switchEthereumChain"], events: ["chainChanged"] } }, optionalNamespaces: {} },
      supportedNamespaces: { eip155: { chains: allEip155Chains(), accounts: allEip155Chains().map(c => `${c}:${address}`), methods: SUPPORTED_METHODS, events: ["chainChanged"] } },
    });
    const session = { expiry: Date.now() / 1000 + 1000, namespaces };
    expect(namespaces.eip155.accounts).toContain(`eip155:${id}:${address}`);
    expect(validateRequest(session, address, `eip155:${id}`, "eth_sendTransaction", [{ from: address, to: address, chainId: `0x${id.toString(16)}`, value: "0x0" }])).toBe(id);
    expect(validateRequest(session, address, `eip155:${id}`, "wallet_switchEthereumChain", [{ chainId: `0x${id.toString(16)}` }])).toBe(id);
  });
  it("uses Monadscan for Monad transactions", () => expect(explorerTxUrl("0x1234", 143)).toBe("https://monadscan.com/tx/0x1234"));
  it("can select Monad by chain ID", () => {
    expect(useWalletStore.getState().setChainById(143)).toBe(true);
    expect(useWalletStore.getState().chainKey).toBe("monad");
    expect(useWalletStore.getState().chainId()).toBe(143);
    hydrateChainKey();
  });
});
