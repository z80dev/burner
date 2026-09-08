"use client";

import { SUPPORTED_CHAINS, getSupportedChain, type ChainKey } from "@/lib/chains";
import { useWalletStore } from "@/lib/store";

export function NetworkSelect() {
  const chainKey = useWalletStore(s => s.chainKey);
  const setChainKey = useWalletStore(s => s.setChainKey);
  const network = getSupportedChain(chainKey);
  return (
    <label className="block w-fit space-y-1.5">
      <span className="block text-xs uppercase tracking-wider text-white/45">Network</span>
      <select
        value={chainKey}
        onChange={e => setChainKey(e.target.value as ChainKey)}
        className="h-10 min-w-[12rem] rounded-lg border border-white/20 bg-black/40 px-3 text-sm text-white outline-none focus-visible:border-emerald-400/60"
      >
        {SUPPORTED_CHAINS.map(c => (
          <option key={c.key} value={c.key} className="bg-zinc-950">{c.label}</option>
        ))}
      </select>
      <span className="block text-xs text-white/45">Native currency: {network.chain.nativeCurrency.symbol}</span>
    </label>
  );
}
