import React from "react";

export default function LeaderboardLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="border-b border-white/10 pb-6 space-y-2">
        <div className="h-5 w-32 bg-amber-500/20 rounded border border-amber-500/30" />
        <div className="h-9 w-64 bg-slate-800 rounded-xl" />
        <div className="h-4 w-96 max-w-full bg-slate-800/60 rounded" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <div className="h-9 w-32 bg-slate-800 rounded-xl" />
        <div className="h-9 w-32 bg-slate-900 rounded-xl" />
      </div>

      {/* Podium Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-2xl bg-slate-900 border border-white/5 p-6 flex flex-col justify-end space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto" />
            <div className="h-5 w-32 bg-slate-800 rounded mx-auto" />
            <div className="h-4 w-20 bg-emerald-500/20 rounded mx-auto" />
          </div>
        ))}
      </div>

      {/* Rankings List Skeleton */}
      <div className="space-y-3 pt-6">
        {[4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-900/70 border border-white/5 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <div className="h-6 w-6 bg-slate-800 rounded" />
              <div className="h-8 w-8 rounded-full bg-slate-800" />
              <div className="h-4 w-36 bg-slate-800 rounded" />
            </div>
            <div className="h-5 w-24 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

