"use client";

import React, { useState, useEffect } from "react";
import { Zap, Shield, Clock, Sparkles } from "lucide-react";
import {
  getRushHourStatus,
  getSyndicateWeekendStatus,
  RushHourStatus,
  SyndicateWeekendStatus,
} from "@/lib/communityEvents";

export default function LiveTelemetryBar() {
  const [rushHour, setRushHour] = useState<RushHourStatus | null>(null);
  const [weekend, setWeekend] = useState<SyndicateWeekendStatus | null>(null);

  useEffect(() => {
    const updateTelemetry = () => {
      const now = new Date();
      setRushHour(getRushHourStatus(now));
      setWeekend(getSyndicateWeekendStatus(now));
    };

    updateTelemetry();
    const interval = setInterval(updateTelemetry, 30000); // 30s update interval
    return () => clearInterval(interval);
  }, []);

  if (!rushHour && !weekend) return null;

  const isRushActive = rushHour?.isActive;
  const isWeekendActive = weekend?.isActive;

  if (isRushActive) {
    return (
      <div className="w-full rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/80 via-slate-900/90 to-amber-950/60 p-3.5 sm:p-4 text-amber-200 shadow-lg shadow-amber-500/10 flex flex-wrap items-center justify-between gap-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-300">
            <Zap className="w-4 h-4 fill-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-amber-300">
                LIVE HUD TELEMETRY // RUSH HOUR RECON
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/30 text-amber-200 border border-amber-500/40">
                1.5x XP + 20 COINS
              </span>
            </div>
            <p className="text-xs text-amber-100/90 font-mono mt-0.5">
              Active student movement window. All clues award +50% XP boost and +20 bonus coins!
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-300 bg-slate-950/70 border border-amber-500/30 px-3 py-1.5 rounded-xl">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{rushHour.minutesRemaining}m remaining</span>
        </div>
      </div>
    );
  }

  if (isWeekendActive) {
    return (
      <div className="w-full rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/80 via-slate-900/90 to-violet-950/60 p-3.5 sm:p-4 text-cyan-200 shadow-lg shadow-cyan-500/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 text-cyan-300">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-cyan-300">
                LIVE HUD TELEMETRY // SYNDICATE WEEKEND
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/30 text-cyan-200 border border-cyan-500/40">
                2.0x SQUAD XP
              </span>
            </div>
            <p className="text-xs text-cyan-100/90 font-mono mt-0.5">
              Tactical Syndicate Weekend is active! All squad operations grant double Squad XP.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-300 bg-slate-950/70 border border-cyan-500/30 px-3 py-1.5 rounded-xl">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{weekend.hoursRemaining}h remaining</span>
        </div>
      </div>
    );
  }

  // Off-peak subtle telemetry
  return (
    <div className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-3.5 py-2 text-slate-400 flex items-center justify-between gap-2 text-[11px] font-mono">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-slate-300 font-bold">CAMPUS TELEMETRY</span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-400">Next Rush Hour: 08:30 or 16:30 IST</span>
      </div>
      <span className="text-emerald-400/80 font-bold hidden sm:inline">Normal Sector Conditions</span>
    </div>
  );
}
