"use client";

import {
  createPublicClient,
  http,
  isAddress,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

/** ENS registry lives on Ethereum mainnet; used for all chains. */
function ensClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(mainnet.rpcUrls.default.http[0]),
  });
}

export function looksLikeEnsName(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.includes(".")) return false;
  if (isAddress(trimmed)) return false;
  // Common ENS / DNS-encoded names used with ENS
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(
    trimmed
  );
}

export async function resolveEnsName(name: string): Promise<Address | null> {
  const normalized = normalize(name.trim());
  const address = await ensClient().getEnsAddress({ name: normalized });
  return address ?? null;
}

export async function lookupEnsName(address: Address): Promise<string | null> {
  try {
    return (await ensClient().getEnsName({ address })) ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a recipient that is either a hex address or an ENS / DNS name.
 */
export async function resolveRecipient(input: string): Promise<{
  address: Address;
  ensName?: string;
}> {
  const trimmed = input.trim();
  if (isAddress(trimmed)) {
    return { address: trimmed };
  }
  if (!looksLikeEnsName(trimmed)) {
    throw new Error("Enter a valid address or ENS name");
  }
  let normalized: string;
  try {
    normalized = normalize(trimmed);
  } catch {
    throw new Error("Invalid ENS name");
  }
  const address = await resolveEnsName(normalized);
  if (!address) {
    throw new Error(`ENS name “${normalized}” is not registered`);
  }
  return { address, ensName: normalized };
}
