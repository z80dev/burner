"use client";

import Burner from "@arx-research/libburner";
import type { Address, Hex } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";

export type HaloMethod = "webnfc" | "bridge" | "credential";

export type BurnerSession = {
  address: Address;
  burner: Burner;
  method: HaloMethod;
  disconnect?: () => Promise<void> | void;
};

type HaloExec = (cmd: unknown) => Promise<unknown>;

function createBurner(haloExecCb: HaloExec) {
  return new Burner({
    haloExecCb,
    // LibBurner only accepts base/base-sepolia for its subsidized token helpers.
    // We use asViemAccount() + Robinhood RPC for general EVM signing.
    chain: "base",
    chainRpcUrls: {
      http: [...robinhoodChain.rpcUrls.default.http],
    },
  });
}

async function connectViaWebNfc(): Promise<BurnerSession> {
  const { execHaloCmdWeb } = await import("@arx-research/libhalo/api/web");
  const burner = createBurner(async (cmd) => execHaloCmdWeb(cmd as never));
  const data = await burner.getData();
  return {
    address: data.address,
    burner,
    method: "webnfc",
  };
}

async function connectViaBridge(): Promise<BurnerSession> {
  const { HaloBridge } = await import("@arx-research/libhalo/api/web");

  const bridge = new HaloBridge({
    createWebSocket: (url: string) => new WebSocket(url),
  });

  await bridge.connect();

  // First-time origins need user consent in the HaLo Bridge app
  const consentUrl = bridge.getConsentURL(
    typeof window !== "undefined" ? window.location.origin : "",
    {}
  );
  if (consentUrl && typeof window !== "undefined") {
    // Soft hint — caller may surface this if exec fails with consent error
    console.info("HaLo Bridge consent URL:", consentUrl);
  }

  const burner = createBurner(async (cmd) => bridge.execHaloCmd(cmd as never));
  const data = await burner.getData();

  return {
    address: data.address,
    burner,
    method: "bridge",
    disconnect: async () => {
      await bridge.close();
    },
  };
}

export function getBridgeConsentUrl(websiteUrl?: string): string {
  // Bridge consent is scoped to the WebSocket Origin, which has no path.
  const origin = new URL(
    websiteUrl ||
      (typeof window !== "undefined"
        ? window.location.origin
        : "http://127.0.0.1:3847")
  ).origin;
  return `http://127.0.0.1:32868/consent?website=${encodeURIComponent(origin)}`;
}

/**
 * Prefer WebNFC on capable devices; fall back to HaLo Bridge on desktop.
 */
export async function connectBurner(
  preferred: HaloMethod | "auto" = "auto"
): Promise<BurnerSession> {
  if (preferred === "webnfc") return connectViaWebNfc();
  if (preferred === "bridge") return connectViaBridge();

  const hasNfc =
    typeof window !== "undefined" && "NDEFReader" in window;

  if (hasNfc) {
    try {
      return await connectViaWebNfc();
    } catch (err) {
      // Fall through to bridge if NFC fails (e.g. user cancelled).
      console.warn("WebNFC connect failed, trying HaLo Bridge", err);
    }
  }

  return connectViaBridge();
}

export function setBurnerPin(session: BurnerSession, pin: string) {
  session.burner.setPassword(pin);
}

export async function getBurnerViemAccount(session: BurnerSession) {
  // Ensure tag data is loaded
  if (!session.burner.burnerData) {
    await session.burner.getData();
  }
  return session.burner.asViemAccount();
}

export type SignRequest =
  | { type: "personal_sign"; message: Hex | string }
  | { type: "eth_signTypedData"; typedData: Record<string, unknown> }
  | {
      type: "eth_sendTransaction";
      transaction: {
        to?: Address;
        from?: Address;
        data?: Hex;
        value?: Hex | bigint;
        gas?: Hex | bigint;
        gasPrice?: Hex | bigint;
        maxFeePerGas?: Hex | bigint;
        maxPriorityFeePerGas?: Hex | bigint;
        nonce?: Hex | number;
      };
    };

export async function signWithBurner(
  session: BurnerSession,
  request: SignRequest,
  pin?: string
): Promise<Hex | string> {
  if (pin) setBurnerPin(session, pin);
  const account = await getBurnerViemAccount(session);

  if (request.type === "personal_sign") {
    if (!account.signMessage) throw new Error("Account cannot sign messages");
    return account.signMessage({ message: request.message as never });
  }

  if (request.type === "eth_signTypedData") {
    if (!account.signTypedData) throw new Error("Account cannot sign typed data");
    return account.signTypedData(request.typedData as never);
  }

  // eth_sendTransaction — sign then broadcast from caller
  if (!account.signTransaction) {
    throw new Error("Account cannot sign transactions");
  }

  const tx = request.transaction;
  const signed = await account.signTransaction({
    to: tx.to,
    data: tx.data,
    value: typeof tx.value === "string" ? BigInt(tx.value) : tx.value,
    gas: typeof tx.gas === "string" ? BigInt(tx.gas) : tx.gas,
    gasPrice:
      typeof tx.gasPrice === "string" ? BigInt(tx.gasPrice) : tx.gasPrice,
    maxFeePerGas:
      typeof tx.maxFeePerGas === "string"
        ? BigInt(tx.maxFeePerGas)
        : tx.maxFeePerGas,
    maxPriorityFeePerGas:
      typeof tx.maxPriorityFeePerGas === "string"
        ? BigInt(tx.maxPriorityFeePerGas)
        : tx.maxPriorityFeePerGas,
    nonce: typeof tx.nonce === "string" ? Number(tx.nonce) : tx.nonce,
    chainId: robinhoodChain.id,
    type: tx.maxFeePerGas ? "eip1559" : undefined,
  } as never);

  return signed;
}
