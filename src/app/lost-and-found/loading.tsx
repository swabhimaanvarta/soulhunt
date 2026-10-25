import React from "react";

export default function LostAndFoundLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <div className="h-5 w-40 bg-emerald-500/20 rounded border border-emerald-500/30" />
          <div className="h-9 w-64 bg-slate-800 rounded-xl" />
          <div className="h-4 w-80 max-w-full bg-slate-800/60 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-32 bg-slate-800 rounded-xl" />
          <div className="h-10 w-36 bg-emerald-500/30 rounded-xl" />
        </div>
      </div>

      {/* Search & Category Filter Skeleton */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="h-11 flex-1 bg-slate-900 border border-white/10 rounded-xl" />
        <div className="h-11 w-44 bg-slate-900 border border-white/10 rounded-xl" />
      </div>

      {/* Grid of Item Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="rounded-3xl p-5 bg-slate-900/60 border border-white/5 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="h-40 w-full bg-slate-800/60 rounded-2xl" />
              <div className="flex items-center justify-between">
                <div className="h-4 w-16 bg-slate-800 rounded" />
                <div className="h-4 w-20 bg-emerald-500/20 rounded" />
              </div>
              <div className="h-5 w-3/4 bg-slate-800 rounded" />
              <div className="h-3 w-full bg-slate-800/40 rounded" />
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-800 rounded" />
              <div className="h-4 w-16 bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

