import React from "react";

export default function LeaderboardLoading() {
  return (
    <div
      role="status"
      aria-label="Loading leaderboard"
      className="min-h-screen bg-[#070A0F] text-slate-100 pb-36 md:pb-28 pt-2 sm:pt-4"
    >
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6 md:space-y-8 animate-pulse">
        {/* Tactical Esports Header Skeleton */}
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-900/60 p-4 sm:p-6 md:p-8 space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-5 sm:h-6 w-32 sm:w-44 bg-amber-500/20 rounded-full border border-amber-500/30" />
            <div className="h-4 sm:h-5 w-24 sm:w-32 bg-cyan-500/20 rounded-full" />
          </div>
          <div className="h-8 sm:h-10 w-56 sm:w-72 bg-slate-800 rounded-xl sm:rounded-2xl" />
          <div className="h-4 w-96 max-w-full bg-slate-800/60 rounded" />
          <div className="grid grid-cols-2 sm:flex flex-wrap gap-2.5 sm:gap-3 pt-2">
            <div className="h-9 sm:h-10 w-full sm:w-56 bg-slate-950/80 rounded-xl sm:rounded-2xl border border-white/10" />
            <div className="h-9 sm:h-10 w-full sm:w-48 bg-slate-950/80 rounded-xl sm:rounded-2xl border border-white/10" />
            <div className="h-9 sm:h-10 w-full sm:w-40 bg-slate-950/80 rounded-xl sm:rounded-2xl border border-white/10" />
          </div>
        </div>

        {/* Champions Podium Skeleton (Top 3) */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-4 md:gap-6 pt-2 sm:pt-4 items-end">
          {/* Rank 2 Skeleton */}
          <div className="order-1 h-56 sm:h-80 rounded-xl sm:rounded-3xl bg-slate-900/60 border border-slate-400/20 p-2 sm:p-6 flex flex-col items-center justify-between">
            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-slate-800 border-2 border-slate-400/40" />
            <div className="space-y-1 sm:space-y-2 w-full flex flex-col items-center">
              <div className="h-3 sm:h-5 w-16 sm:w-36 bg-slate-800 rounded" />
              <div className="h-2.5 sm:h-4 w-12 sm:w-24 bg-slate-800/60 rounded" />
              <div className="h-3 sm:h-4 w-14 sm:w-28 bg-cyan-500/20 rounded-full hidden sm:block" />
            </div>
            <div className="w-full h-6 sm:h-9 bg-slate-800 rounded-lg sm:rounded-xl" />
          </div>

          {/* Rank 1 Skeleton (Elevated Center) */}
          <div className="order-2 h-64 sm:h-92 rounded-xl sm:rounded-3xl bg-slate-900/80 border sm:border-2 border-amber-400/40 p-2.5 sm:p-6 flex flex-col items-center justify-between -translate-y-2 sm:-translate-y-4 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-slate-800 border-2 border-amber-400/60" />
            <div className="space-y-1 sm:space-y-2 w-full flex flex-col items-center">
              <div className="h-4 sm:h-6 w-20 sm:w-44 bg-slate-800 rounded" />
              <div className="h-3 sm:h-4 w-14 sm:w-32 bg-amber-500/30 rounded" />
              <div className="h-3.5 sm:h-5 w-16 sm:w-36 bg-amber-500/20 rounded-full hidden sm:block" />
            </div>
            <div className="w-full h-7 sm:h-10 bg-amber-500/30 rounded-lg sm:rounded-xl" />
          </div>

          {/* Rank 3 Skeleton */}
          <div className="order-3 h-56 sm:h-80 rounded-xl sm:rounded-3xl bg-slate-900/60 border border-amber-700/30 p-2 sm:p-6 flex flex-col items-center justify-between">
            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-slate-800 border-2 border-amber-700/50" />
            <div className="space-y-1 sm:space-y-2 w-full flex flex-col items-center">
              <div className="h-3 sm:h-5 w-16 sm:w-36 bg-slate-800 rounded" />
              <div className="h-2.5 sm:h-4 w-12 sm:w-24 bg-slate-800/60 rounded" />
              <div className="h-3 sm:h-4 w-14 sm:w-28 bg-violet-500/20 rounded-full hidden sm:block" />
            </div>
            <div className="w-full h-6 sm:h-9 bg-slate-800 rounded-lg sm:rounded-xl" />
          </div>
        </div>

        {/* Competitive Standings Table Skeleton */}
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-900/60 overflow-hidden">
          <div className="h-12 sm:h-14 bg-slate-950/80 border-b border-white/10 px-3.5 sm:px-6 flex items-center justify-between">
            <div className="h-3.5 sm:h-4 w-36 sm:w-48 bg-slate-800 rounded" />
            <div className="h-3 sm:h-4 w-20 sm:w-24 bg-slate-800/60 rounded" />
          </div>
          <div className="divide-y divide-white/5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-14 sm:h-16 px-2.5 sm:px-6 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-800 shrink-0" />
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-800 shrink-0" />
                  <div className="space-y-1 min-w-0">
                    <div className="h-3.5 sm:h-4 w-24 sm:w-32 bg-slate-800 rounded" />
                    <div className="h-2.5 sm:h-3 w-32 sm:w-44 bg-slate-800/50 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-6 shrink-0">
                  <div className="h-5 w-24 bg-slate-800/60 rounded-full hidden md:block" />
                  <div className="h-6 w-16 bg-emerald-500/20 rounded-lg hidden sm:block" />
                  <div className="h-4 sm:h-5 w-16 sm:w-24 bg-amber-500/20 rounded" />
                  <div className="w-7 h-7 sm:w-24 sm:h-8 bg-slate-800 rounded-lg sm:rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
