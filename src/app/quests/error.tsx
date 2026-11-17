"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Compass, RefreshCw, ArrowLeft, ShieldAlert } from "lucide-react";

export default function QuestsErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Quests board error captured:", error);
  }, [error]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 min-h-[60vh] flex items-center justify-center">
      <div className="glass-panel rounded-3xl p-8 border border-white/10 text-center space-y-6 max-w-lg w-full">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-500/10">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            QUEST TELEMETRY ERROR
          </span>
          <h2 className="text-2xl font-black text-white">Recon Link Interrupted</h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
            Unable to synchronize campus quest directives or clue progress. Attempting to recalibrate connection may restore your active session.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-slate-500 bg-slate-950/80 p-1.5 rounded border border-white/5">
              Code: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 font-mono text-xs font-bold pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recalibrate Telemetry
          </button>

          <Link
            href="/quests"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/10 transition-all flex items-center justify-center gap-2"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Quest Board
          </Link>

          <Link
            href="/"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3 h-3" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
