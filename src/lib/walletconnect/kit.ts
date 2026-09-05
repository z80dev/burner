"use client";

import { Core } from "@walletconnect/core";
import { WalletKit, type WalletKitTypes } from "@reown/walletkit";
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
import {
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  robinhoodChain,
  robinhoodTestnet,
} from "@/lib/chains/robinhood";
import { getBurnerViemAccount, type BurnerSession } from "@/lib/burner/client";
import {
  decodePersonalSignMessage,
  getPublicClient,
  normalizeWcTx,
} from "@/lib/rpc";
import { useWalletStore, type NetworkMode } from "@/lib/store";

let walletKit: Awaited<ReturnType<typeof WalletKit.init>> | null = null;
let initPromise: Promise<Awaited<ReturnType<typeof WalletKit.init>>> | null =
  null;

const SUPPORTED_METHODS = [
  "eth_accounts",
  "eth_requestAccounts",
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_sign",
  "personal_sign",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
];

const SUPPORTED_EVENTS = ["chainChanged", "accountsChanged"];

function supportedChains(network: NetworkMode) {
  // Always advertise both so Safe can pick Robinhood Chain
  const primary =
    network === "testnet"
      ? ROBINHOOD_TESTNET_CHAIN_ID
      : ROBINHOOD_CHAIN_ID;
  const secondary =
    network === "testnet"
      ? ROBINHOOD_CHAIN_ID
      : ROBINHOOD_TESTNET_CHAIN_ID;
  return [`eip155:${primary}`, `eip155:${secondary}`];
}

function accountsFor(address: Address, network: NetworkMode) {
  return supportedChains(network).map((c) => `${c}:${address}`);
}

function syncSessions() {
  if (!walletKit) return;
  const sessions = Object.values(walletKit.getActiveSessions()).map((s) => ({
    topic: s.topic,
    name: s.peer.metadata.name,
    url: s.peer.metadata.url,
    icon: s.peer.metadata.icons?.[0],
  }));
  useWalletStore.getState().setWcSessions(sessions);
}

export async function initWalletKit(projectId: string) {
  if (!projectId || projectId.length < 8) {
    throw new Error("Set a WalletConnect Project ID first (cloud.reown.com).");
  }
  if (walletKit) return walletKit;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const appUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${basePath}`
        : "https://z80.wtf/burner";
    const core = new Core({ projectId });
    const kit = await WalletKit.init({
      core,
      metadata: {
        name: "RH Burner OS",
        description:
          "Burner hardware wallet for Robinhood Chain — connect to Safe and other dApps",
        url: appUrl,
        icons: [`${appUrl}/icon.svg`],
      },
    });

    kit.on("session_proposal", onSessionProposal);
    kit.on("session_request", onSessionRequest);
    kit.on("session_delete", () => syncSessions());

    walletKit = kit;
    useWalletStore.getState().setWcReady(true);
    syncSessions();
    return kit;
  })();

  try {
    return await initPromise;
  } catch (e) {
    initPromise = null;
    walletKit = null;
    throw e;
  }
}

function onSessionProposal(proposal: WalletKitTypes.SessionProposal) {
  useWalletStore.getState().setPendingProposal({
    id: proposal.id,
    name: proposal.params.proposer.metadata.name,
    url: proposal.params.proposer.metadata.url,
    description: proposal.params.proposer.metadata.description,
    icons: proposal.params.proposer.metadata.icons ?? [],
  });
  // Keep raw proposal accessible via walletKit
  (globalThis as unknown as { __wcProposal?: WalletKitTypes.SessionProposal }).__wcProposal =
    proposal;
}

function onSessionRequest(event: WalletKitTypes.SessionRequest) {
  const { topic, params, id } = event;
  const sessions = walletKit?.getActiveSessions() ?? {};
  const session = sessions[topic];
  useWalletStore.getState().setPendingRequest({
    id,
    topic,
    method: params.request.method,
    params: params.request.params as unknown[],
    chainId: params.chainId,
    dappName: session?.peer.metadata.name,
  });
  (globalThis as unknown as { __wcRequest?: WalletKitTypes.SessionRequest }).__wcRequest =
    event;
}

export async function pairWithUri(uri: string) {
  const kit = walletKit ?? (await initWalletKit(useWalletStore.getState().wcProjectId));
  if (!kit) throw new Error("WalletKit not ready");
  await kit.pair({ uri: uri.trim() });
}

export async function approveProposal() {
  const store = useWalletStore.getState();
  if (!store.address || !walletKit) throw new Error("Connect Burner first");
  const proposal = (globalThis as unknown as { __wcProposal?: WalletKitTypes.SessionProposal })
    .__wcProposal;
  if (!proposal) throw new Error("No pending proposal");

  const approvedNamespaces = buildApprovedNamespaces({
    proposal: proposal.params,
    supportedNamespaces: {
      eip155: {
        chains: supportedChains(store.network),
        methods: SUPPORTED_METHODS,
        events: SUPPORTED_EVENTS,
        accounts: accountsFor(store.address, store.network),
      },
    },
  });

  await walletKit.approveSession({
    id: proposal.id,
    namespaces: approvedNamespaces,
  });

  store.setPendingProposal(null);
  (globalThis as unknown as { __wcProposal?: undefined }).__wcProposal = undefined;
  syncSessions();
  store.setStatusMessage(`Connected to ${proposal.params.proposer.metadata.name}`);
}

export async function rejectProposal() {
  if (!walletKit) return;
  const proposal = (globalThis as unknown as { __wcProposal?: WalletKitTypes.SessionProposal })
    .__wcProposal;
  if (!proposal) {
    useWalletStore.getState().setPendingProposal(null);
    return;
  }
  await walletKit.rejectSession({
    id: proposal.id,
    reason: getSdkError("USER_REJECTED"),
  });
  useWalletStore.getState().setPendingProposal(null);
  (globalThis as unknown as { __wcProposal?: undefined }).__wcProposal = undefined;
}

export async function disconnectWcSession(topic: string) {
  if (!walletKit) return;
  await walletKit.disconnectSession({
    topic,
    reason: getSdkError("USER_DISCONNECTED"),
  });
  syncSessions();
}

export async function approveRequest(pin?: string) {
  const store = useWalletStore.getState();
  const session = store.session;
  const pending = store.pendingRequest;
  if (!walletKit || !session || !pending) {
    throw new Error("Nothing to approve");
  }

  const event = (globalThis as unknown as { __wcRequest?: WalletKitTypes.SessionRequest })
    .__wcRequest;
  if (!event) throw new Error("Missing session request");

  if (pin) session.burner.setPassword(pin);

  try {
    const result = await handleRpc(session, store.network, pending.method, pending.params);
    await walletKit.respondSessionRequest({
      topic: pending.topic,
      response: { id: pending.id, jsonrpc: "2.0", result },
    });
    store.setStatusMessage(`Signed ${pending.method}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    await walletKit.respondSessionRequest({
      topic: pending.topic,
      response: {
        id: pending.id,
        jsonrpc: "2.0",
        error: { code: 5000, message },
      },
    });
    throw e;
  } finally {
    store.setPendingRequest(null);
    (globalThis as unknown as { __wcRequest?: undefined }).__wcRequest = undefined;
  }
}

export async function rejectRequest() {
  const store = useWalletStore.getState();
  const pending = store.pendingRequest;
  if (!walletKit || !pending) {
    store.setPendingRequest(null);
    return;
  }
  await walletKit.respondSessionRequest({
    topic: pending.topic,
    response: {
      id: pending.id,
      jsonrpc: "2.0",
      error: { code: 5000, message: "User rejected." },
    },
  });
  store.setPendingRequest(null);
  (globalThis as unknown as { __wcRequest?: undefined }).__wcRequest = undefined;
}

async function handleRpc(
  session: BurnerSession,
  network: NetworkMode,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const account = await getBurnerViemAccount(session);
  const chain =
    network === "testnet" ? robinhoodTestnet : robinhoodChain;
  const address = session.address;

  switch (method) {
    case "eth_accounts":
    case "eth_requestAccounts":
      return [address];

    case "personal_sign": {
      const [raw] = params;
      // personal_sign params: [message, address] or [address, message]
      const message =
        typeof raw === "string" && raw.toLowerCase() === address.toLowerCase()
          ? (params[1] as string)
          : (raw as string);
      const decoded = decodePersonalSignMessage(message);
      if (!account.signMessage) throw new Error("Cannot sign");
      return account.signMessage({
        message: isProbablyHexMessage(message)
          ? { raw: message as Hex }
          : decoded,
      });
    }

    case "eth_sign": {
      const data = params[1] as Hex;
      if (!account.signMessage) throw new Error("Cannot sign");
      return account.signMessage({ message: { raw: data } });
    }

    case "eth_signTypedData":
    case "eth_signTypedData_v3":
    case "eth_signTypedData_v4": {
      const typed =
        typeof params[0] === "string" &&
        (params[0] as string).toLowerCase() === address.toLowerCase()
          ? params[1]
          : params[0];
      const data =
        typeof typed === "string" ? JSON.parse(typed) : (typed as object);
      if (!account.signTypedData) throw new Error("Cannot sign typed data");
      return account.signTypedData(data as never);
    }

    case "eth_signTransaction": {
      const tx = normalizeWcTx(params[0] as Record<string, unknown>);
      if (!account.signTransaction) throw new Error("Cannot sign tx");
      return account.signTransaction({
        ...tx,
        chainId: chain.id,
      } as never);
    }

    case "eth_sendTransaction": {
      const tx = normalizeWcTx(params[0] as Record<string, unknown>);
      const walletClient = createWalletClient({
        account: account as never,
        chain,
        transport: http(chain.rpcUrls.default.http[0]),
      });
      const hash = await walletClient.sendTransaction({
        ...tx,
        account: account as never,
        chain,
      } as never);
      useWalletStore.getState().setLastTxHash(hash);
      return hash;
    }

    case "wallet_switchEthereumChain": {
      const requested = (params[0] as { chainId: string })?.chainId;
      const id = Number.parseInt(requested, 16);
      if (id === ROBINHOOD_CHAIN_ID) {
        useWalletStore.getState().setNetwork("mainnet");
        return null;
      }
      if (id === ROBINHOOD_TESTNET_CHAIN_ID) {
        useWalletStore.getState().setNetwork("testnet");
        return null;
      }
      throw new Error(`Unsupported chain ${id}. This wallet is Robinhood Chain only.`);
    }

    case "wallet_addEthereumChain": {
      const requested = (params[0] as { chainId: string })?.chainId;
      const id = Number.parseInt(requested, 16);
      if (id === ROBINHOOD_CHAIN_ID || id === ROBINHOOD_TESTNET_CHAIN_ID) {
        return null;
      }
      throw new Error("Only Robinhood Chain can be added.");
    }

    default:
      // Touch public client so unused import stays meaningful for future eth_call proxies
      void getPublicClient(network);
      throw new Error(`Unsupported method: ${method}`);
  }
}

function isProbablyHexMessage(message: string) {
  return /^0x[0-9a-fA-F]+$/.test(message);
}

export function getWalletKit() {
  return walletKit;
}
