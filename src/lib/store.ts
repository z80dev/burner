"use client";

import { create } from "zustand";
import type { Address, Hex } from "viem";
import type { BurnerSession, HaloMethod } from "@/lib/burner/client";
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
} from "@/lib/chains/robinhood";

export type NetworkMode = "mainnet" | "testnet";

export type PendingWcProposal = {
  id: number;
  name: string;
  url: string;
  description: string;
  icons: string[];
};

export type PendingWcRequest = {
  id: number;
  topic: string;
  method: string;
  params: unknown[];
  chainId?: string;
  dappName?: string;
};

export type WcSessionInfo = {
  topic: string;
  name: string;
  url: string;
  icon?: string;
};

type WalletState = {
  address: Address | null;
  method: HaloMethod | null;
  session: BurnerSession | null;
  connecting: boolean;
  connectError: string | null;
  network: NetworkMode;
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
  setNetwork: (n: NetworkMode) => void;
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

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  method: null,
  session: null,
  connecting: false,
  connectError: null,
  network: "mainnet",
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
    }),
  setNetwork: (n) => set({ network: n }),
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
    try {
      await session?.disconnect?.();
    } catch {
      // ignore
    }
    set({
      session: null,
      address: null,
      method: null,
      balanceWei: null,
      pendingProposal: null,
      pendingRequest: null,
      wcSessions: [],
    });
  },

  chainId: () =>
    get().network === "testnet"
      ? ROBINHOOD_TESTNET_CHAIN_ID
      : ROBINHOOD_CHAIN_ID,
}));

export function hydrateWcProjectId() {
  useWalletStore.getState().setWcProjectId(loadProjectId());
}
