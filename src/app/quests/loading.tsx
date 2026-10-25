import React from "react";
import { Sparkles, Trophy } from "lucide-react";

export default function QuestsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-32 bg-amber-500/20 rounded border border-amber-500/30" />
            <div className="h-4 w-24 bg-slate-800 rounded" />
          </div>
          <div className="h-9 w-72 bg-slate-800 rounded-xl" />
          <div className="h-4 w-96 max-w-full bg-slate-800/60 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-28 bg-slate-800 rounded-xl" />
          <div className="h-10 w-28 bg-emerald-500/20 rounded-xl" />
        </div>
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-24 bg-slate-800/80 rounded-xl" />
        ))}
      </div>

      {/* Grid of Quest Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-3xl p-6 bg-slate-900/60 border border-white/5 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-5 w-24 bg-slate-800 rounded-full" />
                <div className="h-4 w-16 bg-slate-800 rounded" />
              </div>
              <div className="h-6 w-3/4 bg-slate-800 rounded-lg" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-slate-800/60 rounded" />
                <div className="h-3 w-5/6 bg-slate-800/60 rounded" />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 bg-slate-800 rounded" />
                <div className="h-4 w-24 bg-emerald-500/20 rounded" />
              </div>
              <div className="h-10 w-full bg-slate-800 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

