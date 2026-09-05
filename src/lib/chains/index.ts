import { type Chain, arbitrum, base, mainnet } from "viem/chains";
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  robinhoodChain,
  robinhoodTestnet,
} from "@/lib/chains/robinhood";

export type ChainKey =
  | "ethereum"
  | "base"
  | "arbitrum"
  | "robinhood"
  | "robinhood-testnet";

export type SupportedChain = {
  key: ChainKey;
  chain: Chain;
  shortName: string;
  label: string;
};

export const SUPPORTED_CHAINS: readonly SupportedChain[] = [
  {
    key: "ethereum",
    chain: mainnet,
    shortName: "ETH",
    label: "Ethereum",
  },
  {
    key: "base",
    chain: base,
    shortName: "Base",
    label: "Base",
  },
  {
    key: "arbitrum",
    chain: arbitrum,
    shortName: "Arb",
    label: "Arbitrum",
  },
  {
    key: "robinhood",
    chain: robinhoodChain,
    shortName: "RH",
    label: "Robinhood",
  },
  {
    key: "robinhood-testnet",
    chain: robinhoodTestnet,
    shortName: "RH Test",
    label: "Robinhood Testnet",
  },
] as const;

export const DEFAULT_CHAIN_KEY: ChainKey = "robinhood";

const byKey = Object.fromEntries(
  SUPPORTED_CHAINS.map((c) => [c.key, c])
) as Record<ChainKey, SupportedChain>;

const byId = Object.fromEntries(
  SUPPORTED_CHAINS.map((c) => [c.chain.id, c])
) as Record<number, SupportedChain>;

export function getSupportedChain(key: ChainKey): SupportedChain {
  return byKey[key];
}

export function getSupportedChainById(chainId: number): SupportedChain | undefined {
  return byId[chainId];
}

export function isSupportedChainId(chainId: number): boolean {
  return chainId in byId;
}

export function chainIdForKey(key: ChainKey): number {
  return byKey[key].chain.id;
}

export function keyForChainId(chainId: number): ChainKey | undefined {
  return byId[chainId]?.key;
}

export function allEip155Chains(): string[] {
  return SUPPORTED_CHAINS.map((c) => `eip155:${c.chain.id}`);
}

export function explorerAddressUrl(address: string, chainId: number) {
  const entry = byId[chainId] ?? byKey.robinhood;
  return `${entry.chain.blockExplorers!.default.url}/address/${address}`;
}

export function explorerTxUrl(hash: string, chainId: number) {
  const entry = byId[chainId] ?? byKey.robinhood;
  return `${entry.chain.blockExplorers!.default.url}/tx/${hash}`;
}

export const SAFE_APP_URL = "https://app.safe.global";

export function safeUrlForChain(chainId: number = ROBINHOOD_CHAIN_ID) {
  return `${SAFE_APP_URL}/welcome/accounts?chain=${chainId}`;
}

export {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  robinhoodChain,
  robinhoodTestnet,
};
