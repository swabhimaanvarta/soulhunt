"use client";

import React from "react";
import Link from "next/link";
import { Compass, AlertTriangle, ArrowLeft, Home, Navigation, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Radar Glitch Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-24 h-24 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.25)]">
            <AlertTriangle className="w-12 h-12 animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-rose-500 text-slate-950 font-mono text-[10px] font-black uppercase tracking-widest">
            404
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono text-xs font-semibold">
            <Navigation className="w-3.5 h-3.5 text-rose-400" />
            <span>RADAR DEADZONE DETECTED</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Grid Coordinates Unreachable
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            The campus sector, quest briefing, or recovery dossier you requested does not exist or has been archived from the active reconnaissance grid.
          </p>
        </div>

        {/* Tactical Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 font-mono text-xs font-bold">
          <Link
            href="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>

          <Link
            href="/lost-and-found"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-emerald-400 text-slate-200 hover:text-white transition-all"
          >
            <Search className="w-4 h-4 text-cyan-400" />
            Search Directory
          </Link>
        </div>
      </div>
    </div>
  );
}

