"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Trophy,
  Users,
  Award,
  Shield,
  Coins,
  ArrowRight,
  Flame,
  Sparkles,
  Crown,
  Medal,
  ChevronRight,
  ShieldAlert,
  Compass,
  Target,
  ExternalLink,
} from "lucide-react";

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"HUNTERS" | "SQUADS">("HUNTERS");
  const [timeframe, setTimeframe] = useState<"ALL_TIME" | "WEEKLY">("ALL_TIME");
  const [hunters, setHunters] = useState<any[]>([]);
  const [squads, setSquads] = useState<any[]>([]);
  const [viewerPos, setViewerPos] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?category=${tab}&timeframe=${timeframe}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          if (tab === "HUNTERS") {
            setHunters(d.data.hunters || []);
            setViewerPos(d.data.viewerPosition || null);
          }
          if (tab === "SQUADS") {
            setSquads(d.data.squads || []);
            setViewerPos(d.data.viewerSquadPosition || null);
          }
        }
      })
      .catch((err) => console.error("Leaderboard fetch error:", err))
      .finally(() => setLoading(false));
  }, [tab, timeframe]);

  const top3 = tab === "HUNTERS" ? hunters.slice(0, 3) : squads.slice(0, 3);
  const remaining = tab === "HUNTERS" ? hunters.slice(3) : squads.slice(3);

  // Helper for emblem icon rendering
  const renderEmblem = (iconName?: string) => {
    switch (iconName) {
      case "ShieldAlert":
        return <ShieldAlert className="w-5 h-5 text-amber-400" />;
      case "Shield":
        return <Shield className="w-5 h-5 text-emerald-400" />;
      case "Target":
        return <Target className="w-5 h-5 text-rose-400" />;
      case "Trophy":
        return <Trophy className="w-5 h-5 text-amber-400" />;
      case "Award":
        return <Award className="w-5 h-5 text-violet-400" />;
      case "Compass":
      default:
        return <Compass className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Clash of Clans Style Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)] flex items-center gap-1.5">
              <Trophy className="w-3 h-3 text-amber-400" />
              CAMPUS CLASH LEAGUES
            </span>
            <span className="text-xs font-mono text-slate-400">Official AIEM Standings</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Hall of Legends</span>
            <Crown className="w-7 h-7 text-amber-400 animate-bounce" style={{ animationDuration: "3s" }} />
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Clash of Clans style competitive standings. Operatives and Syndicates earn trophies and prestige through verified property recoveries, investigative deductions, and campus safe-desk custody.
          </p>
        </div>

        {/* Tab Switcher & Timeframe Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Timeframe: All-Time vs Weekly Season */}
          <div className="flex rounded-xl bg-slate-900/90 p-1 border border-white/10 text-xs font-mono">
            <button
              onClick={() => setTimeframe("ALL_TIME")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                timeframe === "ALL_TIME"
                  ? "bg-slate-800 text-white shadow-sm border border-white/10"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All-Time Legends
            </button>
            <button
              onClick={() => setTimeframe("WEEKLY")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                timeframe === "WEEKLY"
                  ? "bg-amber-500 text-slate-950 font-black shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Weekly Season ⚡
            </button>
          </div>

          {/* Primary View: Top Operatives vs Top Syndicates */}
          <div className="flex rounded-xl bg-slate-900/90 p-1 border border-white/10 text-xs font-mono">
            <button
              onClick={() => setTab("HUNTERS")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-all ${
                tab === "HUNTERS"
                  ? "bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Top Operatives</span>
            </button>
            <button
              onClick={() => setTab("SQUADS")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-all ${
                tab === "SQUADS"
                  ? "bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Top Syndicates</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center font-mono text-emerald-400 text-xs flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
          <span className="tracking-widest">CALCULATING CAMPUS TROPHIES & LEAGUE STANDINGS...</span>
        </div>
      ) : (
        <>
          {/* Top 3 Podium Cards (Clash of Clans Style) */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 items-end">
              {/* Rank 2 (Silver - Left) */}
              {top3[1] && (
                <div className="order-2 md:order-1 relative rounded-3xl bg-gradient-to-b from-slate-800/80 via-slate-900/90 to-slate-950 border border-slate-400/40 p-5 shadow-xl flex flex-col items-center text-center space-y-3">
                  <div className="absolute -top-4 w-9 h-9 rounded-full bg-slate-300 text-slate-950 font-black font-mono flex items-center justify-center shadow-lg border-2 border-slate-100 text-sm">
                    #2
                  </div>
                  <div className="pt-2">
                    {tab === "HUNTERS" ? (
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-300 flex items-center justify-center font-mono font-bold text-slate-200 text-xl shadow-lg">
                          {top3[1].displayName?.charAt(0)}
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-slate-800/90 border-2 border-slate-300 flex items-center justify-center shadow-lg">
                        {renderEmblem(top3[1].emblemIcon)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {tab === "HUNTERS" ? top3[1].displayName : top3[1].name}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      {tab === "HUNTERS"
                        ? `@${top3[1].username} ${top3[1].squadId ? `• [${top3[1].squadId.tag}]` : ""}`
                        : `[${top3[1].tag}] Syndicate`}
                    </p>
                    {tab === "HUNTERS" && top3[1].equippedTitle && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {top3[1].equippedTitle}
                      </span>
                    )}
                  </div>
                  <div className="w-full pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">
                      {tab === "HUNTERS" ? `LVL ${top3[1].level}` : `Lv.${top3[1].squadLevel || 1}`}
                    </span>
                    <span className="text-slate-200 font-bold flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5 text-slate-300" />
                      {(tab === "HUNTERS"
                        ? timeframe === "WEEKLY"
                          ? top3[1].weeklyScore || 0
                          : top3[1].xp
                        : timeframe === "WEEKLY"
                        ? top3[1].weeklyScore || 0
                        : top3[1].squadXp
                      ).toLocaleString()}{" "}
                      Trophies
                    </span>
                  </div>
                </div>
              )}

              {/* Rank 1 (Gold - Center - Elevated) */}
              {top3[0] && (
                <div className="order-1 md:order-2 relative rounded-3xl bg-gradient-to-b from-amber-500/25 via-slate-900 to-slate-950 border-2 border-amber-400/80 p-6 shadow-[0_0_35px_rgba(245,158,11,0.25)] flex flex-col items-center text-center space-y-3.5 md:-translate-y-4">
                  <div className="absolute -top-5 w-11 h-11 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 font-black font-mono flex items-center justify-center shadow-xl border-2 border-white text-base">
                    👑 #1
                  </div>
                  <div className="pt-3">
                    {tab === "HUNTERS" ? (
                      <div className="relative">
                        <span className="absolute -inset-1 rounded-full bg-amber-400/30 animate-pulse blur-sm" />
                        <div className="relative w-20 h-20 rounded-full bg-slate-800 border-2 border-amber-400 flex items-center justify-center font-mono font-bold text-amber-300 text-2xl shadow-xl">
                          {top3[0].displayName?.charAt(0)}
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <span className="absolute -inset-1 rounded-2xl bg-amber-400/30 animate-pulse blur-sm" />
                        <div className="relative w-20 h-20 rounded-2xl bg-slate-800/90 border-2 border-amber-400 flex items-center justify-center shadow-xl">
                          {renderEmblem(top3[0].emblemIcon)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-white text-lg">
                      {tab === "HUNTERS" ? top3[0].displayName : top3[0].name}
                    </h3>
                    <p className="text-xs font-mono text-amber-300 font-bold">
                      {tab === "HUNTERS"
                        ? `@${top3[0].username} ${top3[0].squadId ? `• [${top3[0].squadId.tag}]` : ""}`
                        : `[${top3[0].tag}] Grand Syndicate`}
                    </p>
                    {tab === "HUNTERS" && top3[0].equippedTitle && (
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                        ⭐ {top3[0].equippedTitle}
                      </span>
                    )}
                  </div>
                  <div className="w-full pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs font-mono">
                    <span className="text-amber-300 font-bold">
                      {tab === "HUNTERS" ? `LVL ${top3[0].level}` : `Lv.${top3[0].squadLevel || 1}`}
                    </span>
                    <span className="text-amber-400 font-black text-sm flex items-center gap-1">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      {(tab === "HUNTERS"
                        ? timeframe === "WEEKLY"
                          ? top3[0].weeklyScore || 0
                          : top3[0].xp
                        : timeframe === "WEEKLY"
                        ? top3[0].weeklyScore || 0
                        : top3[0].squadXp
                      ).toLocaleString()}{" "}
                      Trophies
                    </span>
                  </div>
                </div>
              )}

              {/* Rank 3 (Bronze - Right) */}
              {top3[2] && (
                <div className="order-3 relative rounded-3xl bg-gradient-to-b from-amber-900/30 via-slate-900/90 to-slate-950 border border-amber-700/50 p-5 shadow-xl flex flex-col items-center text-center space-y-3">
                  <div className="absolute -top-4 w-9 h-9 rounded-full bg-amber-700 text-amber-100 font-black font-mono flex items-center justify-center shadow-lg border-2 border-amber-600 text-sm">
                    #3
                  </div>
                  <div className="pt-2">
                    {tab === "HUNTERS" ? (
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-amber-700 flex items-center justify-center font-mono font-bold text-amber-200 text-xl shadow-lg">
                          {top3[2].displayName?.charAt(0)}
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-slate-800/90 border-2 border-amber-700 flex items-center justify-center shadow-lg">
                        {renderEmblem(top3[2].emblemIcon)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {tab === "HUNTERS" ? top3[2].displayName : top3[2].name}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      {tab === "HUNTERS"
                        ? `@${top3[2].username} ${top3[2].squadId ? `• [${top3[2].squadId.tag}]` : ""}`
                        : `[${top3[2].tag}] Syndicate`}
                    </p>
                    {tab === "HUNTERS" && top3[2].equippedTitle && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        {top3[2].equippedTitle}
                      </span>
                    )}
                  </div>
                  <div className="w-full pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">
                      {tab === "HUNTERS" ? `LVL ${top3[2].level}` : `Lv.${top3[2].squadLevel || 1}`}
                    </span>
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5 text-amber-600" />
                      {(tab === "HUNTERS"
                        ? timeframe === "WEEKLY"
                          ? top3[2].weeklyScore || 0
                          : top3[2].xp
                        : timeframe === "WEEKLY"
                        ? top3[2].weeklyScore || 0
                        : top3[2].squadXp
                      ).toLocaleString()}{" "}
                      Trophies
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Roster Table (Ranks 1 to N with Clash of Clans Clan Badges) */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] border-b border-white/10">
                  <tr>
                    <th className="py-4 px-6 text-center w-16">Rank</th>
                    <th className="py-4 px-6">{tab === "HUNTERS" ? "Hunter Operative" : "Squad Syndicate"}</th>
                    <th className="py-4 px-6 text-center">{tab === "HUNTERS" ? "Cosmetic Title" : "Recruitment Mode"}</th>
                    <th className="py-4 px-6 text-center">Level</th>
                    <th className="py-4 px-6 text-center">{tab === "HUNTERS" ? "Trust Tier" : "Members"}</th>
                    <th className="py-4 px-6 text-right">Trophies / XP</th>
                    <th className="py-4 px-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(tab === "HUNTERS" ? hunters : squads).map((item, idx) => {
                    const isTop1 = idx === 0;
                    const isTop2 = idx === 1;
                    const isTop3 = idx === 2;

                    return (
                      <tr
                        key={item._id}
                        className={`hover:bg-white/[0.03] transition-colors ${
                          isTop1 ? "bg-amber-500/[0.04]" : isTop2 ? "bg-slate-300/[0.02]" : isTop3 ? "bg-amber-700/[0.02]" : ""
                        }`}
                      >
                        {/* Rank Shield */}
                        <td className="py-4 px-6 text-center">
                          <span
                            className={`w-8 h-8 rounded-xl inline-flex items-center justify-center font-mono font-black text-xs ${
                              isTop1
                                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                                : isTop2
                                ? "bg-slate-300 text-slate-950"
                                : isTop3
                                ? "bg-amber-700 text-amber-100"
                                : "text-slate-400 bg-white/5 border border-white/10"
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>

                        {/* Name & Identity */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3 font-sans">
                            {tab === "HUNTERS" ? (
                              <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-emerald-400 text-xs shrink-0">
                                {item.displayName?.charAt(0)}
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-800/90 border border-white/10 flex items-center justify-center shrink-0">
                                {renderEmblem(item.emblemIcon)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm hover:text-emerald-300 transition-colors truncate">
                                  {tab === "HUNTERS" ? item.displayName : item.name}
                                </span>
                                {tab === "SQUADS" && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    [{item.tag}]
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                {tab === "HUNTERS"
                                  ? `@${item.username} ${item.squadId ? `• [${item.squadId.tag}] ${item.squadId.name}` : ""}`
                                  : item.description || "Campus Investigation Syndicate"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Cosmetic Title or Join Mode Badge */}
                        <td className="py-4 px-6 text-center">
                          {tab === "HUNTERS" ? (
                            item.equippedTitle ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                {item.equippedTitle}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">—</span>
                            )
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                item.joinType === "OPEN"
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                  : item.joinType === "CLOSED"
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              }`}
                            >
                              {item.joinType === "OPEN" ? "Anyone Can Join" : item.joinType === "CLOSED" ? "Closed" : "Invite Only"}
                            </span>
                          )}
                        </td>

                        {/* Level */}
                        <td className="py-4 px-6 text-center">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono text-xs">
                            LVL {tab === "HUNTERS" ? item.level : item.squadLevel || 1}
                          </span>
                        </td>

                        {/* Trust Tier or Member Count */}
                        <td className="py-4 px-6 text-center">
                          {tab === "HUNTERS" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-white/10 font-mono">
                              {item.trustTier?.replace(/_/g, " ")}
                            </span>
                          ) : (
                            <span className="font-mono text-slate-300 text-xs">
                              {item.memberCount || 1} / 50
                            </span>
                          )}
                        </td>

                        {/* Trophies / XP */}
                        <td className="py-4 px-6 text-right font-bold text-amber-400 font-mono text-xs">
                          <div className="flex items-center justify-end gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                              {(tab === "HUNTERS"
                                ? timeframe === "WEEKLY"
                                  ? item.weeklyScore || 0
                                  : item.xp
                                : timeframe === "WEEKLY"
                                ? item.weeklyScore || 0
                                : item.squadXp
                              ).toLocaleString()}{" "}
                              Trophies
                            </span>
                          </div>
                        </td>

                        {/* Inspect Action */}
                        <td className="py-4 px-6 text-center">
                          {tab === "HUNTERS" ? (
                            <Link
                              href={`/profile/${item.username}`}
                              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 transition-all font-mono text-[11px] inline-flex items-center gap-1"
                            >
                              <span>Dossier</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          ) : (
                            <Link
                              href={`/squads/${item._id}`}
                              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/40 transition-all font-mono text-[11px] inline-flex items-center gap-1"
                            >
                              <span>Hub</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
