import React from "react";

export default function ItemDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse">
      {/* Top Bar Navigation & Actions Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-4 w-52 bg-slate-800/80 rounded" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-slate-900 border border-white/10 rounded-xl" />
          <div className="h-8 w-20 bg-cyan-500/10 border border-cyan-500/20 rounded-xl" />
        </div>
      </div>

      {/* Role-Aware Contextual Action Banner Skeleton */}
      <div className="rounded-2xl p-4 sm:p-5 bg-slate-900/60 border border-white/10 flex items-center justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-36 bg-slate-800 rounded" />
          <div className="h-3 w-64 max-w-full bg-slate-800/60 rounded" />
        </div>
        <div className="h-9 w-32 bg-slate-800 rounded-xl" />
      </div>

      {/* Main Item Dossier Card Skeleton */}
      <div className="glass-panel rounded-3xl p-5 sm:p-7 md:p-8 border border-white/10 space-y-6 backdrop-blur-xl bg-slate-900/40">
        {/* Header Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-6 w-32 bg-emerald-500/20 border border-emerald-500/30 rounded-full" />
              <div className="h-6 w-28 bg-slate-800 rounded-full" />
              <div className="h-6 w-24 bg-amber-500/15 rounded-full" />
            </div>
            <div className="h-8 w-3/4 max-w-lg bg-slate-800 rounded-xl" />
            <div className="h-4 w-1/2 max-w-md bg-slate-800/60 rounded" />
          </div>
          <div className="h-10 w-36 bg-slate-800 rounded-xl self-start md:self-auto" />
        </div>

        {/* Media & Details Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Item Photo Placeholder */}
          <div className="h-64 sm:h-80 w-full bg-slate-800/50 rounded-2xl border border-white/5 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-white/5" />
          </div>

          {/* Dossier Attributes Grid */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                <div className="h-3 w-16 bg-slate-800 rounded" />
                <div className="h-5 w-24 bg-slate-800 rounded" />
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                <div className="h-3 w-16 bg-slate-800 rounded" />
                <div className="h-5 w-24 bg-slate-800 rounded" />
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                <div className="h-3 w-16 bg-slate-800 rounded" />
                <div className="h-5 w-28 bg-slate-800 rounded" />
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
                <div className="h-3 w-16 bg-slate-800 rounded" />
                <div className="h-5 w-20 bg-slate-800 rounded" />
              </div>
            </div>

            {/* Description Skeleton */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
              <div className="h-3 w-28 bg-slate-800 rounded" />
              <div className="h-3.5 w-full bg-slate-800/60 rounded" />
              <div className="h-3.5 w-4/5 bg-slate-800/60 rounded" />
              <div className="h-3.5 w-2/3 bg-slate-800/60 rounded" />
            </div>
          </div>
        </div>

        {/* Investigation & Lifecycle Stepper Skeleton */}
        <div className="pt-6 border-t border-white/10 space-y-4">
          <div className="h-4 w-40 bg-slate-800 rounded" />
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-900/50 rounded-2xl border border-white/5">
            {[1, 2, 3, 4, 5].map((step) => (
              <React.Fragment key={step}>
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 shrink-0" />
                {step < 5 && <div className="h-1 flex-1 bg-slate-800/60 rounded-full" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
