import { isAddress, type Address } from "viem";
import { isSupportedChainId } from "@/lib/chains";

export const SIGNING_METHODS = ["personal_sign", "eth_signTypedData", "eth_signTypedData_v3", "eth_signTypedData_v4", "eth_sendTransaction", "eth_signTransaction"];
export const SUPPORTED_METHODS = ["eth_accounts", "eth_requestAccounts", ...SIGNING_METHODS, "wallet_switchEthereumChain", "wallet_addEthereumChain"];

export function normalizePairingUri(input: string): string {
  let uri = input.trim();
  if (!uri.startsWith("wc:")) {
    try { uri = new URL(uri).searchParams.get("uri") ?? ""; } catch { /* handled below */ }
  }
  const match = /^wc:([a-f0-9]{64})@2\?(.+)$/i.exec(uri);
  if (!match) throw new Error("Use a WalletConnect link or QR code from the dapp’s Connect wallet screen.");
  const query = new URLSearchParams(match[2]);
  if (!/^[a-f0-9]{64}$/i.test(query.get("symKey") ?? "") || query.get("relay-protocol") !== "irn") {
    throw new Error("This WalletConnect link is incomplete. Copy a fresh link from the dapp.");
  }
  const expiry = query.get("expiryTimestamp");
  if (expiry && (!/^\d+$/.test(expiry) || Number(expiry) <= Date.now() / 1000)) {
    throw new Error("This WalletConnect link has expired. Generate a new QR code in the dapp.");
  }
  return uri;
}

export type SessionPermissions = {
  expiry: number;
  namespaces: Record<string, { accounts: string[]; methods: string[]; chains?: string[] }>;
};

export function personalMessage(params: unknown[], address: Address): string {
  const firstIsAccount = typeof params[0] === "string" && params[0].toLowerCase() === address.toLowerCase();
  return String(firstIsAccount ? params[1] : params[0]);
}

export function typedData(params: unknown[], address: Address) {
  const raw = typeof params[0] === "string" && params[0].toLowerCase() === address.toLowerCase() ? params[1] : params[0];
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!data || typeof data !== "object" || !data.types || !data.domain || !data.primaryType || !data.message) throw new Error("Invalid typed data.");
  return data;
}

export function validateRequest(session: SessionPermissions | undefined, address: Address, chainId: string | undefined, method: string, params: unknown[]) {
  if (!session || session.expiry <= Date.now() / 1000) throw new Error("This dapp session has expired. Connect again.");
  const match = /^eip155:(\d+)$/.exec(chainId ?? "");
  const id = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(id) || !isSupportedChainId(id)) throw new Error("Unsupported request network.");
  const namespaces = Object.values(session.namespaces);
  const approved = namespaces.some(ns => ns.methods.includes(method) && ns.accounts.some(a => a.toLowerCase() === `${chainId}:${address}`.toLowerCase()));
  if (!approved || !SUPPORTED_METHODS.includes(method)) throw new Error("This account, network, or method was not approved for this dapp.");
  if (!Array.isArray(params)) throw new Error("Invalid request parameters.");
  function requireAccount(value: unknown) {
    if (typeof value !== "string" || !isAddress(value) || value.toLowerCase() !== address.toLowerCase()) throw new Error("The requested account does not match your connected Burner.");
  }
  if (method === "personal_sign") {
    const reversed = typeof params[0] === "string" && params[0].toLowerCase() === address.toLowerCase();
    requireAccount(params[reversed ? 0 : 1]);
    if (typeof params[reversed ? 1 : 0] !== "string") throw new Error("Invalid message.");
  }
  if (method.startsWith("eth_signTypedData")) {
    const accountFirst = typeof params[0] === "string" && isAddress(params[0]);
    requireAccount(params[accountFirst ? 0 : 1]);
    const data = typedData(params, address);
    if (data.domain.chainId != null && Number(data.domain.chainId) !== id) throw new Error("Typed-data network does not match the request network.");
  }
  if (method === "eth_sendTransaction" || method === "eth_signTransaction") {
    const tx = params[0] as Record<string, unknown> | undefined;
    if (!tx || typeof tx !== "object") throw new Error("Invalid transaction.");
    requireAccount(tx.from);
    if (tx.chainId != null && Number(tx.chainId) !== id) throw new Error("Transaction network does not match the request network.");
    if (tx.to != null && (typeof tx.to !== "string" || !isAddress(tx.to))) throw new Error("Invalid transaction recipient.");
  }
  if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") {
    const target = (params[0] as { chainId?: unknown })?.chainId;
    if (typeof target !== "string" || !/^0x[0-9a-f]+$/i.test(target) || !isSupportedChainId(Number(target))) throw new Error("Unsupported network. Connect using one of the listed networks.");
    if (!namespaces.some(ns => ns.accounts.some(a => a.toLowerCase() === `eip155:${Number(target)}:${address}`.toLowerCase()))) throw new Error("This network was not approved. Reconnect the dapp to add it.");
  }
  return id;
}
