"use client";

import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  // LibHaLo / WalletConnect expect Node globals in the browser
  const g = globalThis as typeof globalThis & {
    Buffer?: typeof Buffer;
    process?: { env: Record<string, string | undefined> };
  };
  g.Buffer = g.Buffer ?? Buffer;
  g.process = g.process ?? { env: {} };
}

export function Polyfills() {
  return null;
}
