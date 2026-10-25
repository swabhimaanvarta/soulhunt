import React from "react";

export default function RewardsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <div className="h-5 w-36 bg-amber-500/20 rounded border border-amber-500/30" />
          <div className="h-9 w-64 bg-slate-800 rounded-xl" />
          <div className="h-4 w-96 max-w-full bg-slate-800/60 rounded" />
        </div>
        <div className="h-14 w-44 bg-slate-900 border border-amber-500/30 rounded-2xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-64 rounded-3xl bg-slate-900/60 border border-white/5 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <div className="h-5 w-20 bg-slate-800 rounded" />
                <div className="h-5 w-16 bg-amber-500/20 rounded" />
              </div>
              <div className="h-6 w-3/4 bg-slate-800 rounded" />
              <div className="h-4 w-full bg-slate-800/60 rounded" />
            </div>
            <div className="h-10 w-full bg-slate-800 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

