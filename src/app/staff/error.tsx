"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Building, RefreshCw, LayoutDashboard, ShieldAlert } from "lucide-react";

export default function StaffStationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Safe-Desk staff error boundary captured:", error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
      <div className="glass-panel max-w-lg w-full rounded-3xl p-6 sm:p-8 border border-white/10 text-center space-y-6 backdrop-blur-xl bg-slate-900/60 shadow-2xl">
        {/* Error Indicator HUD */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            <Building className="w-10 h-10 animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px] font-black uppercase tracking-widest">
            STATION FAULT
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>SAFE-DESK CONDUIT DISRUPTED</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Safe-Desk Operations Unavailable
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
            {error.message ||
              "Failed to initialize custody queue or Safe-Desk station operations. Station telemetry may be offline or session authorization requires re-synchronization."}
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-slate-500 bg-slate-950/80 p-2 rounded-lg border border-white/5 break-all">
              Station Digest: {error.digest}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 font-mono text-xs font-bold">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/10 transition-all"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
