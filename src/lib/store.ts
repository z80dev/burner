"use client";

import { create } from "zustand";
import type { Address, Hex } from "viem";
import type { BurnerSession, HaloMethod } from "@/lib/burner/client";
import {
  DEFAULT_CHAIN_KEY,
  chainIdForKey,
  type ChainKey,
  isSupportedChainId,
  keyForChainId,
} from "@/lib/chains";

export type PendingWcProposal = {
  id: number;
  name: string;
  url: string;
  description: string;
  icons: string[];
  chains: string[];
  methods: string[];
  validation?: string;
};

export type PendingWcRequest = {
  id: number;
  topic: string;
  method: string;
  params: unknown[];
  chainId?: string;
  dappName?: string;
  dappUrl?: string;
};

export type WcSessionInfo = {
  topic: string;
  name: string;
  url: string;
  icon?: string;
  accounts: string[];
  chains: string[];
};

type WalletState = {
  address: Address | null;
  ensName: string | null;
  method: HaloMethod | null;
  session: BurnerSession | null;
  connecting: boolean;
  connectError: string | null;
  chainKey: ChainKey;
  balanceWei: bigint | null;
  balanceLoading: boolean;
  pin: string;
  wcProjectId: string;
  wcReady: boolean;
  wcUri: string;
  wcSessions: WcSessionInfo[];
  pendingProposal: PendingWcProposal | null;
  pendingRequest: PendingWcRequest | null;
  lastTxHash: Hex | null;
  statusMessage: string | null;

  setConnecting: (v: boolean) => void;
  setConnectError: (e: string | null) => void;
  setSession: (s: BurnerSession | null) => void;
  setEnsName: (name: string | null) => void;
  setChainKey: (key: ChainKey) => void;
  setChainById: (chainId: number) => boolean;
  setBalance: (b: bigint | null) => void;
  setBalanceLoading: (v: boolean) => void;
  setPin: (pin: string) => void;
  setWcProjectId: (id: string) => void;
  setWcReady: (v: boolean) => void;
  setWcUri: (uri: string) => void;
  setWcSessions: (sessions: WcSessionInfo[]) => void;
  setPendingProposal: (p: PendingWcProposal | null) => void;
  setPendingRequest: (r: PendingWcRequest | null) => void;
  setLastTxHash: (h: Hex | null) => void;
  setStatusMessage: (m: string | null) => void;
  disconnect: () => Promise<void>;
  chainId: () => number;
};

const WC_PROJECT_KEY = "rh-burner-wc-project-id";
const CHAIN_KEY_STORAGE = "rh-burner-chain-key";

const DEFAULT_WC_PROJECT_ID = "1a0b6477019e1ebea77b070f4bb2b098";

function loadProjectId() {
  if (typeof window === "undefined") {
    return (
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || DEFAULT_WC_PROJECT_ID
    );
  }
  return (
    localStorage.getItem(WC_PROJECT_KEY) ||
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    DEFAULT_WC_PROJECT_ID
  );
}

function loadChainKey(): ChainKey {
  if (typeof window === "undefined") return DEFAULT_CHAIN_KEY;
  const stored = localStorage.getItem(CHAIN_KEY_STORAGE);
  if (
    stored === "ethereum" ||
    stored === "base" ||
    stored === "arbitrum" ||
    stored === "monad" ||
    stored === "robinhood" ||
    stored === "robinhood-testnet"
  ) {
    return stored;
  }
  // Migrate legacy mainnet/testnet toggle
  if (stored === "testnet" || stored === "mainnet") {
    return stored === "testnet" ? "robinhood-testnet" : "robinhood";
  }
  return DEFAULT_CHAIN_KEY;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  ensName: null,
  method: null,
  session: null,
  connecting: false,
  connectError: null,
  chainKey: DEFAULT_CHAIN_KEY,
  balanceWei: null,
  balanceLoading: false,
  pin: "",
  wcProjectId: "",
  wcReady: false,
  wcUri: "",
  wcSessions: [],
  pendingProposal: null,
  pendingRequest: null,
  lastTxHash: null,
  statusMessage: null,

  setConnecting: (v) => set({ connecting: v }),
  setConnectError: (e) => set({ connectError: e }),
  setSession: (s) =>
    set({
      session: s,
      address: s?.address ?? null,
      method: s?.method ?? null,
      connectError: null,
      ensName: null,
    }),
  setEnsName: (name) => set({ ensName: name }),
  setChainKey: (key) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CHAIN_KEY_STORAGE, key);
    }
    set({ chainKey: key, balanceWei: null });
  },
  setChainById: (chainId) => {
    if (!isSupportedChainId(chainId)) return false;
    const key = keyForChainId(chainId);
    if (!key) return false;
    get().setChainKey(key);
    return true;
  },
  setBalance: (b) => set({ balanceWei: b }),
  setBalanceLoading: (v) => set({ balanceLoading: v }),
  setPin: (pin) => set({ pin }),
  setWcProjectId: (id) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(WC_PROJECT_KEY, id);
    }
    set({ wcProjectId: id });
  },
  setWcReady: (v) => set({ wcReady: v }),
  setWcUri: (uri) => set({ wcUri: uri }),
  setWcSessions: (sessions) => set({ wcSessions: sessions }),
  setPendingProposal: (p) => set({ pendingProposal: p }),
  setPendingRequest: (r) => set({ pendingRequest: r }),
  setLastTxHash: (h) => set({ lastTxHash: h }),
  setStatusMessage: (m) => set({ statusMessage: m }),

  disconnect: async () => {
    const { session } = get();
    const { disconnectAllSessions } = await import("@/lib/walletconnect/kit");
    await disconnectAllSessions();
    try {
      await session?.disconnect?.();
    } catch {
      // ignore
    }
    set({
      session: null,
      pin: "",
      wcUri: "",
      lastTxHash: null,
      statusMessage: null,
      address: null,
      ensName: null,
      method: null,
      balanceWei: null,
      pendingProposal: null,
      pendingRequest: null,
      wcSessions: [],
    });
  },

  chainId: () => chainIdForKey(get().chainKey),
}));

export function hydrateWcProjectId() {
  useWalletStore.getState().setWcProjectId(loadProjectId());
}

export function hydrateChainKey() {
  useWalletStore.setState({ chainKey: loadChainKey() });
}
