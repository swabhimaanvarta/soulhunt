import React from "react";
import { Shield } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse font-mono">
      <div className="flex items-center gap-3 border-b border-white/10 pb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
          <Shield className="w-5 h-5 animate-pulse" />
        </div>
        <div className="space-y-1">
          <div className="h-6 w-64 bg-slate-800 rounded" />
          <div className="h-3 w-48 bg-slate-800/60 rounded" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-8 w-28 bg-slate-900 border border-white/10 rounded-lg" />
        ))}
      </div>

      {/* Stat Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-900 border border-white/5 rounded-xl p-4 space-y-2">
            <div className="h-4 w-20 bg-slate-800 rounded" />
            <div className="h-7 w-16 bg-slate-800 rounded" />
          </div>
        ))}
      </div>

      {/* Table Placeholder */}
      <div className="h-96 bg-slate-900 border border-white/10 rounded-2xl p-6" />
    </div>
  );
}

