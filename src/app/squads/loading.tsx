import React from "react";

export default function SquadsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <div className="h-5 w-36 bg-cyan-500/20 rounded border border-cyan-500/30" />
          <div className="h-9 w-64 bg-slate-800 rounded-xl" />
          <div className="h-4 w-96 max-w-full bg-slate-800/60 rounded" />
        </div>
        <div className="h-10 w-36 bg-emerald-500/20 rounded-xl" />
      </div>

      <div className="h-10 w-80 bg-slate-900 border border-white/10 rounded-xl" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-56 rounded-2xl bg-slate-900 border border-white/5 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-5 w-20 bg-slate-800 rounded" />
                <div className="h-4 w-12 bg-cyan-500/20 rounded" />
              </div>
              <div className="h-6 w-1/2 bg-slate-800 rounded" />
              <div className="h-3 w-3/4 bg-slate-800/60 rounded" />
            </div>
            <div className="pt-3 border-t border-white/5 flex justify-between">
              <div className="h-4 w-20 bg-slate-800 rounded" />
              <div className="h-4 w-24 bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

