"use client";

import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  hexToString,
  isHex,
  type Address,
  type Hex,
  type TransactionRequest,
} from "viem";
import {
  robinhoodChain,
  robinhoodTestnet,
} from "@/lib/chains/robinhood";
import type { BurnerSession } from "@/lib/burner/client";
import { getBurnerViemAccount } from "@/lib/burner/client";
import type { NetworkMode } from "@/lib/store";

export function getChain(network: NetworkMode) {
  return network === "testnet" ? robinhoodTestnet : robinhoodChain;
}

export function getPublicClient(network: NetworkMode) {
  const chain = getChain(network);
  return createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });
}

export async function fetchEthBalance(
  address: Address,
  network: NetworkMode
): Promise<bigint> {
  const client = getPublicClient(network);
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
  network: NetworkMode;
  to: Address;
  amountEth: string;
  pin?: string;
}): Promise<Hex> {
  const { session, network, to, amountEth, pin } = args;
  if (pin) session.burner.setPassword(pin);

  const chain = getChain(network);
  const account = (await getBurnerViemAccount(session)) as never;
  const publicClient = getPublicClient(network);
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
  if (typeof tx.to === "string") out.to = tx.to as Address;
  if (typeof tx.from === "string") out.from = tx.from as Address;
  if (typeof tx.data === "string") out.data = tx.data as Hex;
  if (typeof tx.value === "string") out.value = BigInt(tx.value);
  if (typeof tx.gas === "string") out.gas = BigInt(tx.gas);
  if (typeof tx.gasLimit === "string") out.gas = BigInt(tx.gasLimit);
  if (typeof tx.gasPrice === "string") out.gasPrice = BigInt(tx.gasPrice);
  if (typeof tx.maxFeePerGas === "string")
    out.maxFeePerGas = BigInt(tx.maxFeePerGas);
  if (typeof tx.maxPriorityFeePerGas === "string")
    out.maxPriorityFeePerGas = BigInt(tx.maxPriorityFeePerGas);
  if (typeof tx.nonce === "string" || typeof tx.nonce === "number")
    out.nonce = Number(tx.nonce);
  return out;
}
