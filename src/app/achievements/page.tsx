"use client";

import React, { useState, useEffect } from "react";
import {
  Award,
  Shield,
  Sparkles,
  CheckCircle2,
  Lock,
  Coins,
  MapPin,
  Users,
  Compass,
} from "lucide-react";

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAchievements(d.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const rarityColors: Record<string, string> = {
    COMMON: "border-slate-500/30 text-slate-300 bg-slate-500/10",
    RARE: "border-cyan-500/30 text-cyan-300 bg-cyan-500/10",
    EPIC: "border-purple-500/30 text-purple-300 bg-purple-500/10",
    LEGENDARY: "border-amber-500/40 text-amber-300 bg-amber-500/15 shadow-amber-500/10",
  };

  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              CAMPUS HONORS & CITATIONS
            </span>
            <span className="text-xs font-mono text-slate-400">
              {unlockedCount} / {achievements.length} Unlocked
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Hunter Achievements & Badges
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Prove your field deduction mastery. Complete campus recoveries, safe-desk turn-ins, and squad investigations to earn permanent badges and bounties.
          </p>
        </div>

        {/* Unlocked Progress HUD */}
        <div className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-slate-900 border border-white/10">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-black font-mono text-lg">
            {unlockedCount}
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Completed Citations</div>
            <div className="text-sm font-bold text-white font-mono">
              {Math.round((unlockedCount / Math.max(1, achievements.length)) * 100)}% Complete
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center font-mono text-slate-500 text-xs animate-pulse">
          SCANNING HONORS ARCHIVE...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map((ach) => {
            const isUnlocked = ach.isUnlocked;
            const progress = ach.userProgress || 0;
            const threshold = ach.threshold || 1;
            const pct = Math.min(100, Math.round((progress / threshold) * 100));

            return (
              <div
                key={ach._id}
                className={`glass-panel rounded-3xl p-6 border transition-all flex flex-col justify-between ${
                  isUnlocked
                    ? "border-emerald-500/40 bg-emerald-950/10 shadow-lg shadow-emerald-500/5"
                    : "border-white/10"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${
                        rarityColors[ach.rarity] || rarityColors.COMMON
                      }`}
                    >
                      {ach.rarity}
                    </span>

                    {isUnlocked ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-mono text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        UNLOCKED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-500 font-mono text-xs">
                        <Lock className="w-3.5 h-3.5" />
                        IN PROGRESS
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Award className={`w-5 h-5 ${isUnlocked ? "text-amber-400" : "text-slate-500"}`} />
                      {ach.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {ach.description}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Progress</span>
                      <span className={isUnlocked ? "text-emerald-400 font-bold" : "text-slate-300"}>
                        {progress} / {threshold} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isUnlocked ? "bg-emerald-400" : "bg-cyan-500/70"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-400 font-bold">+{ach.xpReward} XP</span>
                  <span className="text-amber-400 font-bold">+{ach.coinReward} Coins</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

