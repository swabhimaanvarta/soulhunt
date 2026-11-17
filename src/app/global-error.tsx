"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RefreshCw, Home, ShieldAlert } from "lucide-react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error boundary captured:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07090E] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Status HUD */}
          <div className="relative inline-flex items-center justify-center">
            <div className="w-24 h-24 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.25)]">
              <ShieldAlert className="w-12 h-12 animate-pulse" />
            </div>
            <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-rose-500 text-slate-950 font-mono text-[10px] font-black uppercase tracking-widest">
              CRITICAL
            </div>
          </div>

          {/* Error Details */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono text-xs font-semibold">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              <span>CORE SUBSYSTEM INTERRUPTED</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Critical System Malfunction
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              A root-level exception occurred. Telemetry diagnostics have recorded this incident. Recalibrate or return to campus hub.
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
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)] transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Recalibrate Core
            </button>

            <Link
              href="/"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-rose-400 text-slate-200 hover:text-white transition-all"
            >
              <Home className="w-4 h-4" />
              Return Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
