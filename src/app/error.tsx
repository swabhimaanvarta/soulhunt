"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RefreshCw, Home, ShieldAlert } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error boundary captured:", error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Error HUD */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
            <ShieldAlert className="w-12 h-12 animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px] font-black uppercase tracking-widest">
            ERROR
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-xs font-semibold">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
            <span>TELEMETRY INTERFERENCE</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            System Signal Interrupted
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            An unexpected error occurred while processing campus reconnaissance data. You can attempt to recalibrate the signal or return to base HQ.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-slate-500 bg-slate-900/60 p-2 rounded-lg border border-white/5">
              Ref Code: {error.digest}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 font-mono text-xs font-bold">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Recalibrate Connection
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-amber-400 text-slate-200 hover:text-white transition-all"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

