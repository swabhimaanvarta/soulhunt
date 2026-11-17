"use client";

import React, { useState } from "react";
import {
  Trophy,
  Award,
  Shield,
  Target,
  Compass,
  Star,
  Zap,
  CheckCircle2,
  Lock,
  Sparkles,
  Coins,
} from "lucide-react";
import { AchievementItem } from "./types";

interface TrophyRoomTabProps {
  achievements: AchievementItem[];
  isOwnProfile?: boolean;
}

const RARITY_STYLES: Record<
  string,
  {
    border: string;
    bg: string;
    badgeBg: string;
    text: string;
    glow: string;
    progressFill: string;
  }
> = {
  COMMON: {
    border: "border-emerald-500/30 hover:border-emerald-500/60",
    bg: "bg-slate-900/80",
    badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    text: "text-emerald-400",
    glow: "shadow-emerald-500/10",
    progressFill: "bg-emerald-500",
  },
  RARE: {
    border: "border-cyan-500/30 hover:border-cyan-500/60",
    bg: "bg-slate-900/80",
    badgeBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    text: "text-cyan-400",
    glow: "shadow-cyan-500/10",
    progressFill: "bg-cyan-500",
  },
  EPIC: {
    border: "border-violet-500/30 hover:border-violet-500/60",
    bg: "bg-slate-900/80",
    badgeBg: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    text: "text-violet-400",
    glow: "shadow-violet-500/10",
    progressFill: "bg-violet-500",
  },
  LEGENDARY: {
    border: "border-amber-500/40 hover:border-amber-500/70",
    bg: "bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/20",
    badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/40",
    text: "text-amber-400",
    glow: "shadow-amber-500/20",
    progressFill: "bg-gradient-to-r from-amber-500 to-amber-300",
  },
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Award,
  Trophy,
  Shield,
  Target,
  Compass,
  Star,
  Zap,
};

export default function TrophyRoomTab({ achievements = [], isOwnProfile }: TrophyRoomTabProps) {
  const [filterRarity, setFilterRarity] = useState<string>("ALL");

  // Visitor view: only display unlocked trophies
  const visibleAchievements = isOwnProfile
    ? achievements
    : achievements.filter((a) => a.isUnlocked);

  const filtered =
    filterRarity === "ALL"
      ? visibleAchievements
      : visibleAchievements.filter(
          (a) => a.achievementId?.rarity?.toUpperCase() === filterRarity
        );

  const unlockedCount = visibleAchievements.filter((a) => a.isUnlocked).length;

  return (
    <div className="space-y-6">
      {/* Header controls: Filter pills and trophy tally */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Investigator Trophy Room
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                {unlockedCount} Unlocked
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              {isOwnProfile
                ? "Tactical milestones, field discoveries, and investigative honors."
                : "Verified medals achieved during campus field operations."}
            </p>
          </div>
        </div>

        {/* Rarity filter pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {["ALL", "COMMON", "RARE", "EPIC", "LEGENDARY"].map((rarity) => (
            <button
              key={rarity}
              onClick={() => setFilterRarity(rarity)}
              type="button"
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                filterRarity === rarity
                  ? "bg-slate-800 text-white border-white/30 font-bold shadow-sm"
                  : "bg-slate-950/60 text-slate-400 border-white/5 hover:text-slate-200"
              }`}
            >
              {rarity}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Trophies */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-12 text-center">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">No Medals Displayed</h3>
          <p className="text-xs text-slate-500 font-mono mt-1 max-w-sm mx-auto">
            {isOwnProfile
              ? "Accept and complete campus quests to unlock investigative achievements."
              : "This operative has not unsealed any public medals matching this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const ach = item.achievementId;
            if (!ach) return null;

            const rarityKey = ach.rarity?.toUpperCase() || "COMMON";
            const styling = RARITY_STYLES[rarityKey] || RARITY_STYLES.COMMON;
            const IconComponent = ICON_MAP[ach.badgeIcon || "Award"] || Award;
            const threshold = ach.threshold || 1;
            const progress = item.progress || (item.isUnlocked ? threshold : 0);
            const progressPct = Math.min(100, Math.round((progress / threshold) * 100));

            return (
              <div
                key={item._id}
                className={`relative rounded-xl border ${styling.border} ${styling.bg} p-5 shadow-lg ${styling.glow} transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between`}
              >
                <div>
                  {/* Top Bar: Rarity tag and Unlocked status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase tracking-wider ${styling.badgeBg}`}
                    >
                      {rarityKey}
                    </span>

                    {item.isUnlocked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Unlocked</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Locked</span>
                      </span>
                    )}
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start gap-3 mb-2">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${styling.badgeBg}`}
                    >
                      <IconComponent className={`w-5 h-5 ${styling.text}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">
                        {ach.title}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono line-clamp-2 mt-0.5 leading-relaxed">
                        {ach.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                  {/* Progress bar for in-progress achievements (Owner view) */}
                  {isOwnProfile && !item.isUnlocked && (
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                        <span>Progress</span>
                        <span>
                          {progress} / {threshold} ({progressPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full ${styling.progressFill} transition-all duration-500`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Footer rewards / unlock date */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <div className="flex items-center gap-2">
                      {ach.xpReward > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-400">
                          <Sparkles className="w-3 h-3" />
                          +{ach.xpReward} XP
                        </span>
                      )}
                      {ach.coinReward > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-amber-400">
                          <Coins className="w-3 h-3" />
                          +{ach.coinReward}
                        </span>
                      )}
                    </div>

                    {item.unlockedAt && (
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.unlockedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
