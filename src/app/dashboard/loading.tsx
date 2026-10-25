import React from "react";

export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      {/* Header Profile Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30" />
          <div className="space-y-2">
            <div className="h-7 w-48 bg-slate-800 rounded-lg" />
            <div className="h-4 w-32 bg-slate-800/60 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* 4 Stat Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-slate-900 border border-white/5 space-y-3">
            <div className="h-4 w-20 bg-slate-800 rounded" />
            <div className="h-8 w-24 bg-slate-800 rounded" />
            <div className="h-3 w-28 bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* Level XP Bar Skeleton */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-white/5 space-y-3">
        <div className="flex justify-between">
          <div className="h-4 w-36 bg-slate-800 rounded" />
          <div className="h-4 w-24 bg-emerald-500/20 rounded" />
        </div>
        <div className="h-3 w-full bg-slate-800 rounded-full" />
      </div>

      {/* Quick Actions & Active Quests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-2xl bg-slate-900 border border-white/5 p-5" />
        <div className="h-64 rounded-2xl bg-slate-900 border border-white/5 p-5" />
      </div>
    </div>
  );
}

