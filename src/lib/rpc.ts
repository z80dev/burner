"use client";

import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  hexToString,
  isHex,
  type Address,
  type Chain,
  type Hex,
  type TransactionRequest,
} from "viem";
import {
  getSupportedChain,
  getSupportedChainById,
  type ChainKey,
} from "@/lib/chains";
import type { BurnerSession } from "@/lib/burner/client";
import { getBurnerViemAccount } from "@/lib/burner/client";

export function getChain(chainKey: ChainKey): Chain {
  return getSupportedChain(chainKey).chain;
}

export function getChainById(chainId: number): Chain {
  const entry = getSupportedChainById(chainId);
  if (!entry) {
    throw new Error(`Unsupported chain ${chainId}`);
  }
  return entry.chain;
}

export function getPublicClient(chainKey: ChainKey) {
  const chain = getChain(chainKey);
  return createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });
}

export function getPublicClientById(chainId: number) {
  const chain = getChainById(chainId);
  return createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });
}

export async function fetchEthBalance(
  address: Address,
  chainKey: ChainKey
): Promise<bigint> {
  const client = getPublicClient(chainKey);
  return client.getBalance({ address });
}

export function formatEth(wei: bigint | null, digits = 6): string {
  if (wei === null) return "—";
  const eth = formatEther(wei);
  const [whole, frac = ""] = eth.split(".");
  return `${whole}.${frac.slice(0, digits).padEnd(Math.min(digits, frac.length), "0")}`;
}

export async function sendEth(args: {
  session: BurnerSession;
  chainKey: ChainKey;
  to: Address;
  amountEth: string;
  pin?: string;
}): Promise<Hex> {
  const { session, chainKey, to, amountEth, pin } = args;
  if (pin) session.burner.setPassword(pin);

  const chain = getChain(chainKey);
  const account = (await getBurnerViemAccount(session)) as never;
  const publicClient = getPublicClient(chainKey);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });

  const value = parseEtherSafe(amountEth);
  const hash = await walletClient.sendTransaction({
    to,
    value,
    account,
    chain,
  });

  void publicClient.waitForTransactionReceipt({ hash }).catch(() => null);
  return hash;
}

function parseEtherSafe(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Invalid amount");
  }
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "000000000000000000").slice(0, 18);
  return BigInt(whole) * BigInt("1000000000000000000") + BigInt(fracPadded);
}

export function decodePersonalSignMessage(raw: unknown): string {
  if (typeof raw !== "string") return String(raw);
  if (isHex(raw)) {
    try {
      return hexToString(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function normalizeWcTx(
  tx: Record<string, unknown>
): TransactionRequest {
  const out: TransactionRequest = {};
  for (const field of ["authorizationList", "blobs", "blobVersionedHashes", "maxFeePerBlobGas", "accessList"]) {
    if (tx[field] != null) throw new Error(`Transactions with ${field} are not supported by this wallet yet.`);
  }
  if (tx.type != null && ![0, 2].includes(Number(tx.type))) throw new Error("Unsupported transaction type.");
  function quantity(value: unknown, label: string): bigint {
    if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) throw new Error(`Invalid ${label}.`);
    if (!["string", "number", "bigint"].includes(typeof value) || !/^(0x[0-9a-f]+|[0-9]+)$/i.test(String(value))) throw new Error(`Invalid ${label}.`);
    return BigInt(value as string);
  }
  if (typeof tx.to === "string") out.to = tx.to as Address;
  if (typeof tx.from === "string") out.from = tx.from as Address;
  const data = tx.data ?? tx.input;
  if (data != null) {
    if (typeof data !== "string" || !/^0x([0-9a-f]{2})*$/i.test(data)) throw new Error("Invalid transaction data.");
    if (tx.data != null && tx.input != null && tx.data !== tx.input) throw new Error("Conflicting transaction data.");
    out.data = data as Hex;
  }
  for (const field of ["value", "gas", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas"] as const) {
    if (tx[field] != null) out[field] = quantity(tx[field], field);
  }
  if (tx.gasLimit != null) out.gas = quantity(tx.gasLimit, "gas limit");
  if (tx.nonce != null) {
    const nonce = quantity(tx.nonce, "nonce");
    if (nonce > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Invalid nonce.");
    out.nonce = Number(nonce);
  }
  if (tx.type != null) out.type = Number(tx.type) === 2 ? "eip1559" : "legacy";
  return out;
}

export function parseEip155ChainId(eip155?: string): number | null {
  if (!eip155) return null;
  const match = /^eip155:(\d+)$/.exec(eip155);
  if (!match) return null;
  return Number(match[1]);
}
