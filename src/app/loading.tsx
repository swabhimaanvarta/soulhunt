import React from "react";
import { Compass } from "lucide-react";

export default function GlobalLoading() {
  return (
    <div className="min-h-[calc(100vh-160px)] w-full flex flex-col items-center justify-center p-6 space-y-6">
      <div className="relative">
        {/* Outer glowing pulsing ring */}
        <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Compass className="w-7 h-7 text-emerald-400 animate-pulse" />
        </div>
      </div>

      <div className="text-center space-y-1.5 font-mono">
        <div className="text-xs font-bold tracking-widest text-emerald-400 uppercase">
          INITIALIZING AIEM TACTICAL GRID
        </div>
        <div className="text-[11px] text-slate-500">
          Decrypting campus safe-desk ledger & satellite telemetry...
        </div>
      </div>

      {/* Placeholder skeleton preview */}
      <div className="w-full max-w-4xl space-y-4 pt-6 animate-pulse opacity-40">
        <div className="h-10 bg-slate-800/60 rounded-2xl w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="h-44 bg-slate-800/40 rounded-2xl border border-white/5" />
          <div className="h-44 bg-slate-800/40 rounded-2xl border border-white/5" />
          <div className="h-44 bg-slate-800/40 rounded-2xl border border-white/5" />
        </div>
      </div>
    </div>
  );
}

