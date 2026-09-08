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
  SUPPORTED_CHAINS,
  allEip155Chains,
  getSupportedChainById,
  isSupportedChainId,
  type ChainKey,
} from "@/lib/chains";
import { getBurnerViemAccount, type BurnerSession } from "@/lib/burner/client";
import {
  decodePersonalSignMessage,
  getChain,
  normalizeWcTx,
  parseEip155ChainId,
} from "@/lib/rpc";
import { useWalletStore } from "@/lib/store";

let walletKit: Awaited<ReturnType<typeof WalletKit.init>> | null = null;
let initPromise: Promise<Awaited<ReturnType<typeof WalletKit.init>>> | null =
  null;

import { SUPPORTED_METHODS, SIGNING_METHODS, normalizePairingUri, validateRequest } from "./validation";

type Proposal = Omit<WalletKitTypes.SessionProposal, "verifyContext"> & { verifyContext?: WalletKitTypes.SessionProposal["verifyContext"] };
let proposals: Proposal[] = [];
let requests: WalletKitTypes.SessionRequest[] = [];
let responding = false;

const SUPPORTED_EVENTS = ["chainChanged", "accountsChanged"];

function supportedChains() {
  return allEip155Chains();
}

function accountsFor(address: Address) {
  return supportedChains().map((c) => `${c}:${address}`);
}

function chainLabelList() {
  return SUPPORTED_CHAINS.map((c) => c.label).join(", ");
}

function syncSessions() {
  if (!walletKit) return;
  const sessions = Object.values(walletKit.getActiveSessions()).map((s) => ({
    topic: s.topic,
    name: s.peer.metadata.name,
    url: s.peer.metadata.url,
    icon: s.peer.metadata.icons?.[0],
    accounts: Object.values(s.namespaces).flatMap(n => n.accounts),
    chains: [...new Set(Object.values(s.namespaces).flatMap(n => n.accounts.map(a => a.split(":").slice(0, 2).join(":"))))],
  }));
  useWalletStore.getState().setWcSessions(sessions);
}

export async function initWalletKit(projectId: string) {
  if (!/^[a-f0-9]{32}$/i.test(projectId)) {
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
        name: "Burner",
        description:
          "Burner hardware wallet for Ethereum mainnet, Base, Arbitrum, Monad, and Robinhood Chain — connect to Safe and other dApps",
        url: appUrl,
        icons: [`${appUrl}/icon.svg`],
      },
    });

    kit.on("session_proposal", onSessionProposal);
    kit.on("session_request", onSessionRequest);
    kit.on("session_delete", ({ topic }) => {
      requests = requests.filter(r => r.topic !== topic);
      syncPending();
      syncSessions();
    });
    kit.on("proposal_expire", ({ id }) => {
      proposals = proposals.filter(p => p.id !== id);
      syncPending();
    });
    kit.on("session_request_expire", ({ id }) => {
      requests = requests.filter(r => r.id !== id);
      syncPending();
    });
    core.relayer.on("relayer_connect", () => useWalletStore.getState().setWcReady(true));
    core.relayer.on("relayer_disconnect", () => useWalletStore.getState().setWcReady(false));

    walletKit = kit;
    useWalletStore.getState().setWcReady(true);
    syncSessions();
    Object.values(kit.getPendingSessionProposals()).forEach(p => onSessionProposal({ id: p.id, params: p }));
    kit.getPendingSessionRequests().forEach(onSessionRequest);
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

function syncPending() {
  const proposal = proposals[0];
  const event = requests[0];
  const store = useWalletStore.getState();
  const namespaces = proposal ? [...Object.values(proposal.params.optionalNamespaces ?? {}), ...Object.values(proposal.params.requiredNamespaces)] : [];
  store.setPendingProposal(proposal ? {
    id: proposal.id,
    ...proposal.params.proposer.metadata,
    chains: [...new Set(namespaces.flatMap(n => n.chains ?? []))],
    methods: [...new Set(namespaces.flatMap(n => n.methods))],
    validation: proposal.verifyContext?.verified?.validation,
  } : null);
  const peer = event ? walletKit?.getActiveSessions()[event.topic]?.peer.metadata : undefined;
  store.setPendingRequest(event ? {
    id: event.id, topic: event.topic, method: event.params.request.method,
    params: event.params.request.params as unknown[], chainId: event.params.chainId,
    dappName: peer?.name, dappUrl: peer?.url,
  } : null);
}

function onSessionProposal(proposal: Proposal) {
  if (!proposals.some(p => p.id === proposal.id)) proposals.push(proposal);
  syncPending();
}

function onSessionRequest(event: WalletKitTypes.SessionRequest) {
  if (!requests.some(r => r.id === event.id && r.topic === event.topic)) requests.push(event);
  syncPending();
}

export async function pairWithUri(uri: string) {
  const kit = walletKit ?? (await initWalletKit(useWalletStore.getState().wcProjectId));
  if (!kit) throw new Error("WalletKit not ready");
  await kit.pair({ uri: normalizePairingUri(uri) });
}

export async function approveProposal() {
  const store = useWalletStore.getState();
  if (!store.address || !walletKit) throw new Error("Connect Burner first");
  const proposal = proposals[0];
  if (!proposal) throw new Error("No pending proposal");

  const approvedNamespaces = buildApprovedNamespaces({
    proposal: proposal.params,
    supportedNamespaces: {
      eip155: {
        chains: supportedChains(),
        methods: SUPPORTED_METHODS,
        events: SUPPORTED_EVENTS,
        accounts: accountsFor(store.address),
      },
    },
  });

  await walletKit.approveSession({
    id: proposal.id,
    namespaces: approvedNamespaces,
  });

  proposals = proposals.filter(p => p.id !== proposal.id);
  syncPending();
  syncSessions();
  store.setStatusMessage(`Connected to ${proposal.params.proposer.metadata.name}`);
}

export async function rejectProposal() {
  if (!walletKit) return;
  const proposal = proposals[0];
  if (!proposal) {
    useWalletStore.getState().setPendingProposal(null);
    return;
  }
  await walletKit.rejectSession({
    id: proposal.id,
    reason: getSdkError("USER_REJECTED"),
  });
  proposals = proposals.filter(p => p.id !== proposal.id);
  syncPending();
}

export async function disconnectWcSession(topic: string) {
  if (!walletKit) return;
  if (responding) throw new Error("Wait for the current request to finish before disconnecting.");
  await walletKit.disconnectSession({
    topic,
    reason: getSdkError("USER_DISCONNECTED"),
  });
  requests = requests.filter(r => r.topic !== topic);
  syncPending();
  syncSessions();
}

export async function approveRequest(pin?: string) {
  const store = useWalletStore.getState();
  const session = store.session;
  const pending = store.pendingRequest;
  if (!walletKit || !session || !pending) {
    throw new Error("Nothing to approve");
  }

  const event = requests[0];
  if (!event) throw new Error("Missing session request");

  if (responding) throw new Error("A request is already being processed.");
  responding = true;
  let executed = false;

  try {
    validateRequest(walletKit.getActiveSessions()[pending.topic], session.address, pending.chainId, pending.method, pending.params);
    if (SIGNING_METHODS.includes(pending.method)) {
      if (!pin) throw new Error("Enter your Burner PIN to sign.");
      session.burner.setPassword(pin);
    }
    const result = await handleRpc(
      session,
      store.chainKey,
      pending.method,
      pending.params,
      pending.chainId
    );
    executed = true;
    await walletKit.respondSessionRequest({
      topic: pending.topic,
      response: { id: pending.id, jsonrpc: "2.0", result },
    });
    if (pending.method === "wallet_switchEthereumChain" || pending.method === "wallet_addEthereumChain") {
      await walletKit.emitSessionEvent({ topic: pending.topic, chainId: pending.chainId!, event: { name: "chainChanged", data: useWalletStore.getState().chainId() } });
    }
    store.setStatusMessage(`Approved ${pending.method}`);
  } catch (e) {
    if (executed) throw new Error("The request completed, but delivery to the dapp was interrupted. Check the dapp and transaction history before trying again.");
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
    responding = false;
    store.setPin("");
    if (SIGNING_METHODS.includes(pending.method)) session.burner.setPassword("");
    requests = requests.filter(r => !(r.id === pending.id && r.topic === pending.topic));
    syncPending();
  }
}

export async function rejectRequest() {
  if (responding) return;
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
  requests = requests.filter(r => !(r.id === pending.id && r.topic === pending.topic));
  syncPending();
}

async function handleRpc(
  session: BurnerSession,
  chainKey: ChainKey,
  method: string,
  params: unknown[],
  requestChainId?: string
): Promise<unknown> {
  const account = SIGNING_METHODS.includes(method) ? await getBurnerViemAccount(session) : null;
  const requestedId = parseEip155ChainId(requestChainId);
  const activeKey =
    requestedId != null && isSupportedChainId(requestedId)
      ? (getSupportedChainById(requestedId)?.key ?? chainKey)
      : chainKey;
  const chain = getChain(activeKey);
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
      if (!account?.signMessage) throw new Error("Cannot sign");
      return account.signMessage({
        message: isProbablyHexMessage(message)
          ? { raw: message as Hex }
          : decoded,
      });
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
      if (!account?.signTypedData) throw new Error("Cannot sign typed data");
      return account.signTypedData(data as never);
    }

    case "eth_signTransaction": {
      const tx = normalizeWcTx(params[0] as Record<string, unknown>);
      if (!account?.signTransaction) throw new Error("Cannot sign tx");
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
      if (activeKey !== chainKey) {
        useWalletStore.getState().setChainKey(activeKey);
      }
      return hash;
    }

    case "wallet_switchEthereumChain": {
      const requested = (params[0] as { chainId: string })?.chainId;
      const id = Number.parseInt(requested, 16);
      const ok = useWalletStore.getState().setChainById(id);
      if (!ok) {
        throw new Error(
          `Unsupported chain ${id}. Supported: ${chainLabelList()}.`
        );
      }
      return null;
    }

    case "wallet_addEthereumChain": {
      const requested = (params[0] as { chainId: string })?.chainId;
      const id = Number.parseInt(requested, 16);
      if (isSupportedChainId(id)) {
        useWalletStore.getState().setChainById(id);
        return null;
      }
      throw new Error(
        `Only ${chainLabelList()} can be added.`
      );
    }

    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

function isProbablyHexMessage(message: string) {
  return /^0x[0-9a-fA-F]+$/.test(message);
}

export async function disconnectAllSessions() {
  if (!walletKit) return;
  if (responding) throw new Error("Wait for the current request to finish before disconnecting.");
  for (const topic of Object.keys(walletKit.getActiveSessions())) await disconnectWcSession(topic);
  while (proposals.length) await rejectProposal();
  requests = [];
  syncPending();
}

export function getWalletKit() {
  return walletKit;
}
