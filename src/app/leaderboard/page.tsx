"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Trophy,
  Users,
  Award,
  Shield,
  Crown,
  ChevronRight,
  ShieldAlert,
  Compass,
  Target,
  ExternalLink,
  Sparkles,
  Zap,
  Filter,
  ShieldCheck,
  Flame,
  Bookmark,
  Cpu,
  Eye,
  ArrowUp,
  Search,
} from "lucide-react";
import {
  COSMETIC_FRAMES,
  AVATAR_PRESETS,
  DEPARTMENTS,
} from "@/components/profile/types";

interface HunterItem {
  _id: string;
  username: string;
  displayName: string;
  identityMode?: "PSEUDONYMOUS" | "ANONYMOUS" | "PUBLIC";
  avatarPreset: string;
  avatarUrl: string;
  equippedTitle: string;
  equippedFrame: string;
  equippedTheme: string;
  department: string;
  level: number;
  rankTitle: string;
  xp: number;
  weeklyScore: number;
  trophies?: number;
  stats: {
    recoveriesCount: number;
    questsCompleted: number;
  };
  squadId?: {
    _id?: string;
    name: string;
    tag: string;
    emblemIcon?: string;
  } | null;
}

interface SquadItem {
  _id: string;
  name: string;
  tag: string;
  description?: string;
  emblemIcon?: string;
  joinType?: "OPEN" | "INVITE_ONLY" | "CLOSED";
  leaderId?: {
    displayName: string;
    username: string;
    avatarUrl?: string;
  };
  squadXp: number;
  squadLevel: number;
  trophies?: number;
  completedHuntsCount: number;
  memberCount: number;
  memberCap: number;
  weeklyScore?: number;
}

interface ViewerPosition {
  userId?: string;
  squadId?: string;
  username?: string;
  displayName?: string;
  avatarPreset?: string;
  equippedFrame?: string;
  equippedTitle?: string;
  name?: string;
  tag?: string;
  rank: number | null;
  departmentRank?: number | null;
  xp?: number;
  squadXp?: number;
  level?: number;
  weeklyScore?: number;
  trophies?: number;
  isLeaderboardPublic?: boolean;
  percentile?: number | null;
  totalUsers?: number;
  totalSquads?: number;
  memberCount?: number;
  memberCap?: number;
  department?: string;
}

const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  recon: Target,
  sleuth: Compass,
  vanguard: Shield,
  sentinel: Cpu,
  shadow: Eye,
  archivist: Bookmark,
};

function getFrameConfig(frameId?: string) {
  return (
    COSMETIC_FRAMES.find((f) => f.id === frameId) || {
      id: "frame-emerald-pulse",
      name: "Emerald Cyber Pulse",
      border: "border-emerald-400",
      shadow: "shadow-[0_0_20px_rgba(16,185,129,0.6)] ring-2 ring-emerald-400/40 animate-pulse",
      accent: "text-emerald-400",
      glowColor: "rgba(16, 185, 129, 0.5)",
    }
  );
}

function getPresetConfig(presetId?: string) {
  return (
    AVATAR_PRESETS.find((p) => p.id === presetId) || {
      id: "recon",
      name: "Recon Scout",
      roleDesc: "Field Detection & Zone Patrol",
      color: "emerald",
      border: "border-emerald-500",
      bg: "bg-emerald-950/80 text-emerald-400",
    }
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"HUNTERS" | "SQUADS">("HUNTERS");
  const [timeframe, setTimeframe] = useState<"ALL_TIME" | "WEEKLY">("ALL_TIME");
  const [department, setDepartment] = useState<string>("ALL");
  const [hunters, setHunters] = useState<HunterItem[]>([]);
  const [squads, setSquads] = useState<SquadItem[]>([]);
  const [viewerPos, setViewerPos] = useState<ViewerPosition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    let url = `/api/leaderboard?category=${tab}&timeframe=${timeframe}`;
    if (tab === "HUNTERS" && department && department !== "ALL") {
      url += `&department=${encodeURIComponent(department)}`;
    }

    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
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
      .catch((err) => {
        if (!cancelled) console.error("Leaderboard fetch error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, timeframe, department]);

  const top3Hunters = hunters.slice(0, 3);
  const remainingHunters = hunters.slice(3);

  const top3Squads = squads.slice(0, 3);
  const remainingSquads = squads.slice(3);

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

  const getScore = (item: HunterItem | SquadItem) => {
    if ("squadXp" in item) {
      return timeframe === "WEEKLY" ? item.weeklyScore || 0 : item.trophies || item.squadXp || 0;
    }
    return timeframe === "WEEKLY" ? item.weeklyScore || 0 : item.trophies || item.xp || 0;
  };

  const scrollToRow = (targetId: string) => {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-amber-500/20");
      setTimeout(() => el.classList.remove("bg-amber-500/20"), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 pb-36 md:pb-28 pt-2 sm:pt-4">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6 md:space-y-8">
        {/* Tactical Esports Header */}
        <section
          aria-label="Tactical Esports Header"
          className="relative rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl p-4 sm:p-6 md:p-8 shadow-2xl overflow-hidden"
        >
          {/* Glowing Ambient Background Accents */}
          <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.06),transparent_60%)]" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6">
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-mono uppercase font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] flex items-center gap-1 sm:gap-1.5">
                  <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                  <span>CAMPUS ESPORTS</span>
                </span>
                <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400" />
                  {timeframe === "WEEKLY" ? "WEEKLY SPRINT" : "ALL-TIME"}
                </span>
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  • Season 4 Live Standings
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight flex items-center gap-2 sm:gap-3">
                <span>Hall of Legends</span>
                <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 animate-pulse shrink-0" />
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed line-clamp-2 sm:line-clamp-none">
                Elite tactical standings for AIEM property recovery, safe-desk custody, and investigative decryption. Operatives and syndicates claim dominance through verified campus actions.
              </p>

              {/* League Tiers Legend */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 pt-0.5 sm:pt-1 text-[10px] sm:text-[11px] font-mono">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] sm:text-[10px]">
                  Tiers:
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Gold (1-3)
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Elite (4-10)
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Recon (11-30)
                </span>
              </div>
            </div>

            {/* Segmented Controls & Filter */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
              {/* Category Pill Control */}
              <div
                role="tablist"
                aria-label="Leaderboard category"
                className="grid grid-cols-2 sm:flex rounded-xl sm:rounded-2xl bg-slate-950/80 p-1 border border-white/10 text-xs font-mono shadow-inner w-full sm:w-auto"
              >
                <button
                  role="tab"
                  aria-selected={tab === "HUNTERS"}
                  onClick={() => setTab("HUNTERS")}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition-all focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none ${
                    tab === "HUNTERS"
                      ? "bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Top Operatives</span>
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "SQUADS"}
                  onClick={() => setTab("SQUADS")}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition-all focus-visible:ring-2 focus-visible:ring-cyan-400 focus:outline-none ${
                    tab === "SQUADS"
                      ? "bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Top Syndicates</span>
                </button>
              </div>

              {/* Timeframe Pill Control */}
              <div
                role="group"
                aria-label="Leaderboard timeframe"
                className="grid grid-cols-2 sm:flex rounded-xl sm:rounded-2xl bg-slate-950/80 p-1 border border-white/10 text-xs font-mono shadow-inner w-full sm:w-auto"
              >
                <button
                  onClick={() => setTimeframe("ALL_TIME")}
                  className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs text-center transition-all focus-visible:ring-2 focus-visible:ring-amber-400 focus:outline-none ${
                    timeframe === "ALL_TIME"
                      ? "bg-slate-800 text-white border border-white/10 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="hidden sm:inline">All-Time Legends</span>
                  <span className="sm:hidden">All-Time</span>
                </button>
                <button
                  onClick={() => setTimeframe("WEEKLY")}
                  className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-black text-[11px] sm:text-xs text-center transition-all flex items-center justify-center gap-1 focus-visible:ring-2 focus-visible:ring-amber-400 focus:outline-none ${
                    timeframe === "WEEKLY"
                      ? "bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>Weekly</span>
                  <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current shrink-0" />
                </button>
              </div>

              {/* Department Filter Dropdown (Operatives View Only) */}
              {tab === "HUNTERS" && (
                <div className="relative w-full sm:w-auto">
                  <div className="flex items-center rounded-xl sm:rounded-2xl bg-slate-950/80 border border-white/15 px-3 py-1.5 text-xs font-mono shadow-inner focus-within:ring-2 focus-within:ring-emerald-400 w-full">
                    <Filter className="w-3.5 h-3.5 text-emerald-400 mr-2 shrink-0" />
                    <select
                      id="department-filter"
                      aria-label="Filter operatives by department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="bg-transparent text-slate-200 text-xs font-mono font-medium focus:outline-none cursor-pointer pr-2 w-full"
                    >
                      <option value="ALL" className="bg-slate-900 text-white">
                        All Departments
                      </option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept} className="bg-slate-900 text-white">
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {loading ? (
          <div
            role="status"
            aria-label="Loading standings"
            className="py-24 text-center font-mono text-emerald-400 text-xs flex flex-col items-center justify-center gap-3"
          >
            <div className="w-10 h-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
            <span className="tracking-widest uppercase">DECRYPTING REAL-TIME CAMPUS LEADERBOARD...</span>
          </div>
        ) : (
          <>
            {/* Champions Podium (Top 3) */}
            {(tab === "HUNTERS" ? top3Hunters : top3Squads).length > 0 && (
              <section aria-label="Champions Podium" className="pt-2 sm:pt-4">
                <div className="grid grid-cols-3 gap-1.5 sm:gap-4 md:gap-6 items-end pt-2 sm:pt-4">
                  {/* Rank 2 (Silver - Left) */}
                  {(tab === "HUNTERS" ? top3Hunters[1] : top3Squads[1]) && (
                    <div className="order-1 relative rounded-xl sm:rounded-3xl bg-gradient-to-b from-slate-400/15 via-slate-900/90 to-slate-950 border border-slate-300/40 p-2 sm:p-4 md:p-6 shadow-[0_0_20px_rgba(203,213,225,0.12)] flex flex-col items-center text-center space-y-2 sm:space-y-3 md:space-y-4">
                      {/* Rank Badge */}
                      <div className="absolute -top-3 sm:-top-4 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-slate-300 text-slate-950 font-black font-mono flex items-center justify-center shadow-lg border border-slate-100 sm:border-2 text-[10px] sm:text-xs">
                        <span className="hidden sm:inline">🥈 #2 Silver</span>
                        <span className="sm:hidden">🥈 #2</span>
                      </div>

                      {/* Avatar / Emblem */}
                      <div className="pt-1.5 sm:pt-2">
                        {tab === "HUNTERS" ? (
                          (() => {
                            const h = top3Hunters[1];
                            const frame = getFrameConfig(h.equippedFrame);
                            const preset = getPresetConfig(h.avatarPreset);
                            const IconComp = PRESET_ICONS[h.avatarPreset] || Target;
                            return (
                              <div className="relative inline-flex items-center justify-center">
                                <div
                                  className={`w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-2 ${frame.border} ${frame.shadow} ${preset.bg} flex items-center justify-center shadow-xl bg-slate-950 overflow-hidden`}
                                  title={`${preset.name} - ${frame.name}`}
                                >
                                  {h.avatarUrl && !h.avatarUrl.includes("recon.png") && h.identityMode !== "ANONYMOUS" ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={h.avatarUrl}
                                      alt={h.displayName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <IconComp className={`w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 ${frame.accent}`} />
                                  )}
                                </div>
                                <span className="hidden sm:inline-block absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-900 border border-slate-400 text-slate-300">
                                  {h.avatarPreset || "recon"}
                                </span>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-slate-800/90 border border-slate-300 flex items-center justify-center shadow-xl">
                            {renderEmblem(top3Squads[1].emblemIcon)}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="space-y-0.5 sm:space-y-1 w-full">
                        <h3 className="font-bold text-white text-xs sm:text-sm md:text-base truncate">
                          {tab === "HUNTERS" ? top3Hunters[1].displayName : top3Squads[1].name}
                        </h3>
                        <p className="text-[9px] sm:text-[11px] font-mono text-slate-400 truncate">
                          {tab === "HUNTERS" ? (
                            <>
                              {top3Hunters[1].identityMode === "ANONYMOUS" || top3Hunters[1].displayName === "Anonymous Hunter" ? (
                                <span className="text-slate-400 italic">Classified</span>
                              ) : top3Hunters[1].displayName === `@${top3Hunters[1].username}` ? (
                                <span className="text-slate-300 font-semibold">{top3Hunters[1].rankTitle || "Operative"}</span>
                              ) : (
                                <span>@{top3Hunters[1].username}</span>
                              )}
                              {top3Hunters[1].squadId && (
                                <span className="ml-1 text-cyan-300 font-bold">
                                  • [{top3Hunters[1].squadId.tag}]
                                </span>
                              )}
                            </>
                          ) : (
                            `[${top3Squads[1].tag}] Syndicate`
                          )}
                        </p>
                        {tab === "HUNTERS" && top3Hunters[1].equippedTitle && (
                          <span className="hidden sm:inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {top3Hunters[1].equippedTitle}
                          </span>
                        )}
                        {tab === "HUNTERS" && (
                          <p className="hidden md:block text-[10px] font-mono text-slate-400 line-clamp-1 pt-0.5">
                            {top3Hunters[1].department}
                          </p>
                        )}
                      </div>

                      {/* Footer Stats */}
                      <div className="w-full pt-1.5 sm:pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-mono">
                        <span className="text-slate-400 font-bold">
                          {tab === "HUNTERS" ? `LVL ${top3Hunters[1].level}` : `Lv.${top3Squads[1].squadLevel || 1}`}
                        </span>
                        <span className="text-slate-200 font-bold flex items-center gap-1">
                          <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-300 shrink-0" />
                          <span>{getScore(tab === "HUNTERS" ? top3Hunters[1] : top3Squads[1]).toLocaleString()}</span>
                          <span className="hidden sm:inline"> Trophies</span>
                        </span>
                      </div>

                      {/* Action */}
                      <div className="w-full">
                        {tab === "HUNTERS" ? (
                          <Link
                            href={`/profile/${top3Hunters[1].username}`}
                            className="w-full py-1 sm:py-2 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 hover:border-slate-300 font-mono text-[10px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 transition-all"
                          >
                            <span className="hidden sm:inline">View Dossier</span>
                            <span className="sm:hidden">Dossier</span>
                            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                          </Link>
                        ) : (
                          <Link
                            href={`/squads/${top3Squads[1]._id}`}
                            className="w-full py-1 sm:py-2 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 hover:border-slate-300 font-mono text-[10px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 transition-all"
                          >
                            <span className="hidden sm:inline">View Hub</span>
                            <span className="sm:hidden">Hub</span>
                            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rank 1 (Gold - Center - Elevated) */}
                  {(tab === "HUNTERS" ? top3Hunters[0] : top3Squads[0]) && (
                    <div className="order-2 relative rounded-xl sm:rounded-3xl bg-gradient-to-b from-amber-500/25 via-slate-900 to-slate-950 border border-amber-400/80 sm:border-2 p-2.5 sm:p-5 md:p-6 shadow-[0_0_35px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/40 flex flex-col items-center text-center space-y-2 sm:space-y-3.5 md:space-y-4 -translate-y-2 sm:-translate-y-4">
                      {/* Rank 1 Crown Badge */}
                      <div className="absolute -top-3.5 sm:-top-5 px-2 sm:px-4 py-0.5 sm:py-1.5 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 font-black font-mono flex items-center justify-center shadow-2xl border border-white sm:border-2 text-[10px] sm:text-sm gap-1">
                        <Crown className="w-3 h-3 sm:w-4 sm:h-4 fill-current shrink-0" />
                        <span className="hidden sm:inline">#1 CHAMPION</span>
                        <span className="sm:hidden">#1</span>
                      </div>

                      {/* Avatar / Emblem */}
                      <div className="pt-2 sm:pt-3">
                        {tab === "HUNTERS" ? (
                          (() => {
                            const h = top3Hunters[0];
                            const frame = getFrameConfig(h.equippedFrame);
                            const preset = getPresetConfig(h.avatarPreset);
                            const IconComp = PRESET_ICONS[h.avatarPreset] || Target;
                            return (
                              <div className="relative inline-flex items-center justify-center">
                                <div
                                  className={`w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full border-2 ${frame.border} ${frame.shadow} ${preset.bg} flex items-center justify-center shadow-2xl bg-slate-950 overflow-hidden`}
                                  title={`${preset.name} - ${frame.name}`}
                                >
                                  {h.avatarUrl && !h.avatarUrl.includes("recon.png") && h.identityMode !== "ANONYMOUS" ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={h.avatarUrl}
                                      alt={h.displayName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <IconComp className={`w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 ${frame.accent}`} />
                                  )}
                                </div>
                                <span className="hidden sm:inline-block absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-500 text-slate-950 border border-white shadow">
                                  {h.avatarPreset || "recon"}
                                </span>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl sm:rounded-2xl bg-slate-800/90 border border-amber-400 sm:border-2 flex items-center justify-center shadow-2xl">
                            {renderEmblem(top3Squads[0].emblemIcon)}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="space-y-0.5 sm:space-y-1 w-full">
                        <h3 className="font-black text-amber-300 sm:text-white text-xs sm:text-base md:text-lg truncate">
                          {tab === "HUNTERS" ? top3Hunters[0].displayName : top3Squads[0].name}
                        </h3>
                        <p className="text-[10px] sm:text-xs font-mono text-amber-300 font-bold truncate">
                          {tab === "HUNTERS" ? (
                            <>
                              {top3Hunters[0].identityMode === "ANONYMOUS" || top3Hunters[0].displayName === "Anonymous Hunter" ? (
                                <span className="text-amber-200/80 italic">Classified</span>
                              ) : top3Hunters[0].displayName === `@${top3Hunters[0].username}` ? (
                                <span>{top3Hunters[0].rankTitle || "Elite Operative"}</span>
                              ) : (
                                <span>@{top3Hunters[0].username}</span>
                              )}
                              {top3Hunters[0].squadId && (
                                <span className="ml-1 text-amber-200">
                                  • [{top3Hunters[0].squadId.tag}]
                                </span>
                              )}
                            </>
                          ) : (
                            `[${top3Squads[0].tag}] Grand Syndicate`
                          )}
                        </p>
                        {tab === "HUNTERS" && top3Hunters[0].equippedTitle && (
                          <span className="hidden sm:inline-block mt-1 px-3 py-0.5 rounded-full text-[11px] font-mono font-black bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                            ⭐ {top3Hunters[0].equippedTitle}
                          </span>
                        )}
                        {tab === "HUNTERS" && (
                          <p className="hidden md:block text-[11px] font-mono text-slate-300 line-clamp-1 pt-0.5">
                            {top3Hunters[0].department}
                          </p>
                        )}
                      </div>

                      {/* Footer Stats */}
                      <div className="w-full pt-1.5 sm:pt-3 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-mono">
                        <span className="text-amber-300 font-bold">
                          {tab === "HUNTERS" ? `LVL ${top3Hunters[0].level}` : `Lv.${top3Squads[0].squadLevel || 1}`}
                        </span>
                        <span className="text-amber-400 font-black text-xs sm:text-sm flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                          <span>{getScore(tab === "HUNTERS" ? top3Hunters[0] : top3Squads[0]).toLocaleString()}</span>
                          <span className="hidden sm:inline"> Trophies</span>
                        </span>
                      </div>

                      {/* Action */}
                      <div className="w-full">
                        {tab === "HUNTERS" ? (
                          <Link
                            href={`/profile/${top3Hunters[0].username}`}
                            className="w-full py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-[10px] sm:text-xs font-black inline-flex items-center justify-center gap-1 transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                          >
                            <span className="hidden sm:inline">View Dossier</span>
                            <span className="sm:hidden">Dossier</span>
                            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3] shrink-0" />
                          </Link>
                        ) : (
                          <Link
                            href={`/squads/${top3Squads[0]._id}`}
                            className="w-full py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-[10px] sm:text-xs font-black inline-flex items-center justify-center gap-1 transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                          >
                            <span className="hidden sm:inline">View Hub</span>
                            <span className="sm:hidden">Hub</span>
                            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3] shrink-0" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rank 3 (Bronze - Right) */}
                  {(tab === "HUNTERS" ? top3Hunters[2] : top3Squads[2]) && (
                    <div className="order-3 relative rounded-xl sm:rounded-3xl bg-gradient-to-b from-amber-900/30 via-slate-900/90 to-slate-950 border border-amber-700/50 p-2 sm:p-4 md:p-6 shadow-[0_0_20px_rgba(180,83,9,0.18)] flex flex-col items-center text-center space-y-2 sm:space-y-3 md:space-y-4">
                      {/* Rank Badge */}
                      <div className="absolute -top-3 sm:-top-4 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-700 text-amber-100 font-black font-mono flex items-center justify-center shadow-lg border border-amber-600 sm:border-2 text-[10px] sm:text-xs">
                        <span className="hidden sm:inline">🥉 #3 Bronze</span>
                        <span className="sm:hidden">🥉 #3</span>
                      </div>

                      {/* Avatar / Emblem */}
                      <div className="pt-1.5 sm:pt-2">
                        {tab === "HUNTERS" ? (
                          (() => {
                            const h = top3Hunters[2];
                            const frame = getFrameConfig(h.equippedFrame);
                            const preset = getPresetConfig(h.avatarPreset);
                            const IconComp = PRESET_ICONS[h.avatarPreset] || Target;
                            return (
                              <div className="relative inline-flex items-center justify-center">
                                <div
                                  className={`w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-2 ${frame.border} ${frame.shadow} ${preset.bg} flex items-center justify-center shadow-xl bg-slate-950 overflow-hidden`}
                                  title={`${preset.name} - ${frame.name}`}
                                >
                                  {h.avatarUrl && !h.avatarUrl.includes("recon.png") && h.identityMode !== "ANONYMOUS" ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={h.avatarUrl}
                                      alt={h.displayName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <IconComp className={`w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 ${frame.accent}`} />
                                  )}
                                </div>
                                <span className="hidden sm:inline-block absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-900 border border-amber-700 text-amber-300">
                                  {h.avatarPreset || "recon"}
                                </span>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-slate-800/90 border border-amber-700 flex items-center justify-center shadow-xl">
                            {renderEmblem(top3Squads[2].emblemIcon)}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="space-y-0.5 sm:space-y-1 w-full">
                        <h3 className="font-bold text-white text-xs sm:text-sm md:text-base truncate">
                          {tab === "HUNTERS" ? top3Hunters[2].displayName : top3Squads[2].name}
                        </h3>
                        <p className="text-[9px] sm:text-[11px] font-mono text-slate-400 truncate">
                          {tab === "HUNTERS" ? (
                            <>
                              {top3Hunters[2].identityMode === "ANONYMOUS" || top3Hunters[2].displayName === "Anonymous Hunter" ? (
                                <span className="text-amber-200/70 italic">Classified</span>
                              ) : top3Hunters[2].displayName === `@${top3Hunters[2].username}` ? (
                                <span className="text-amber-300/80 font-semibold">{top3Hunters[2].rankTitle || "Operative"}</span>
                              ) : (
                                <span>@{top3Hunters[2].username}</span>
                              )}
                              {top3Hunters[2].squadId && (
                                <span className="ml-1 text-amber-300 font-bold">
                                  • [{top3Hunters[2].squadId.tag}]
                                </span>
                              )}
                            </>
                          ) : (
                            `[${top3Squads[2].tag}] Syndicate`
                          )}
                        </p>
                        {tab === "HUNTERS" && top3Hunters[2].equippedTitle && (
                          <span className="hidden sm:inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                            {top3Hunters[2].equippedTitle}
                          </span>
                        )}
                        {tab === "HUNTERS" && (
                          <p className="hidden md:block text-[10px] font-mono text-slate-400 line-clamp-1 pt-0.5">
                            {top3Hunters[2].department}
                          </p>
                        )}
                      </div>

                      {/* Footer Stats */}
                      <div className="w-full pt-1.5 sm:pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-mono">
                        <span className="text-slate-400 font-bold">
                          {tab === "HUNTERS" ? `LVL ${top3Hunters[2].level}` : `Lv.${top3Squads[2].squadLevel || 1}`}
                        </span>
                        <span className="text-amber-500 font-bold flex items-center gap-1">
                          <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0" />
                          <span>{getScore(tab === "HUNTERS" ? top3Hunters[2] : top3Squads[2]).toLocaleString()}</span>
                          <span className="hidden sm:inline"> Trophies</span>
                        </span>
                      </div>

                      {/* Action */}
                      <div className="w-full">
                        {tab === "HUNTERS" ? (
                          <Link
                            href={`/profile/${top3Hunters[2].username}`}
                            className="w-full py-1 sm:py-2 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 hover:border-amber-700 font-mono text-[10px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 transition-all"
                          >
                            <span className="hidden sm:inline">View Dossier</span>
                            <span className="sm:hidden">Dossier</span>
                            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                          </Link>
                        ) : (
                          <Link
                            href={`/squads/${top3Squads[2]._id}`}
                            className="w-full py-1 sm:py-2 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 hover:border-amber-700 font-mono text-[10px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 transition-all"
                          >
                            <span className="hidden sm:inline">View Hub</span>
                            <span className="sm:hidden">Hub</span>
                            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Competitive Standings Table */}
            <section
              aria-label="Competitive Standings Table"
              className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl overflow-hidden shadow-2xl"
            >
              <div className="px-3.5 py-3 sm:px-6 sm:py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 sm:gap-4 bg-slate-950/70">
                <div className="flex items-center gap-2">
                  <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <h2 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-white">
                    {tab === "HUNTERS" ? "Operatives Roster (Ranks 1 – 30)" : "Syndicates Roster (Ranks 1 – 25)"}
                  </h2>
                </div>
                <div className="text-[10px] sm:text-xs font-mono text-slate-400">
                  {tab === "HUNTERS" ? `${hunters.length} Operatives Listed` : `${squads.length} Syndicates Listed`}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950/90 text-slate-400 uppercase text-[9px] sm:text-[10px] tracking-wider border-b border-white/10">
                    <tr>
                      <th scope="col" className="py-2.5 sm:py-4 px-1.5 sm:px-4 md:px-6 text-center w-8 sm:w-16">Rank</th>
                      <th scope="col" className="py-2.5 sm:py-4 px-2 sm:px-4 md:px-6">{tab === "HUNTERS" ? "Operative Callsign" : "Syndicate"}</th>
                      <th scope="col" className="hidden md:table-cell py-2.5 sm:py-4 px-2 sm:px-4 md:px-6 text-center">{tab === "HUNTERS" ? "Cosmetic Title" : "Recruitment Mode"}</th>
                      <th scope="col" className="hidden sm:table-cell py-2.5 sm:py-4 px-2 sm:px-4 md:px-6 text-center">Level</th>
                      <th scope="col" className="hidden lg:table-cell py-2.5 sm:py-4 px-2 sm:px-4 md:px-6 text-center">{tab === "HUNTERS" ? "Campus Activity" : "Squad Capacity"}</th>
                      <th scope="col" className="py-2.5 sm:py-4 px-2 sm:px-4 md:px-6 text-right">Trophies</th>
                      <th scope="col" className="py-2.5 sm:py-4 px-1 sm:px-4 md:px-6 text-center w-10 sm:w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {tab === "HUNTERS" ? (
                      hunters.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-mono text-xs">
                            No operatives found matching the current department filter.
                          </td>
                        </tr>
                      ) : (
                        hunters.map((hunter, idx) => {
                          const rankNum = idx + 1;
                          const isTop1 = rankNum === 1;
                          const isTop2 = rankNum === 2;
                          const isTop3 = rankNum === 3;
                          const isElite = rankNum >= 4 && rankNum <= 10;

                          const frame = getFrameConfig(hunter.equippedFrame);
                          const preset = getPresetConfig(hunter.avatarPreset);
                          const IconComp = PRESET_ICONS[hunter.avatarPreset] || Target;

                          return (
                            <tr
                              key={hunter._id}
                              id={`operative-row-${hunter._id}`}
                              className={`transition-colors hover:bg-white/[0.04] ${
                                isTop1
                                  ? "bg-amber-500/[0.06]"
                                  : isTop2
                                  ? "bg-slate-300/[0.03]"
                                  : isTop3
                                  ? "bg-amber-700/[0.03]"
                                  : isElite
                                  ? "bg-cyan-500/[0.02]"
                                  : ""
                              }`}
                            >
                              {/* Glowing Rank Badge */}
                              <td className="py-2 sm:py-3.5 px-1.5 sm:px-4 md:px-6 text-center">
                                <span
                                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl inline-flex items-center justify-center font-mono font-black text-[10px] sm:text-xs ${
                                    isTop1
                                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/40"
                                      : isTop2
                                      ? "bg-slate-300 text-slate-950 shadow-md shadow-slate-300/30"
                                      : isTop3
                                      ? "bg-amber-700 text-amber-100 shadow-md shadow-amber-700/30"
                                      : isElite
                                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                                      : "text-slate-400 bg-white/5 border border-white/10"
                                  }`}
                                >
                                  {rankNum}
                                </span>
                              </td>

                              {/* Operative Identity */}
                              <td className="py-2 sm:py-3.5 px-2 sm:px-4 md:px-6">
                                <div className="flex items-center gap-2 sm:gap-3.5">
                                  {/* Operative Avatar with Cosmetic Frame */}
                                  <div className="relative shrink-0">
                                    <div
                                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 ${frame.border} ${frame.shadow} ${preset.bg} flex items-center justify-center bg-slate-950 overflow-hidden`}
                                      title={`${hunter.displayName} (${preset.name}) - ${frame.name}`}
                                    >
                                      {hunter.avatarUrl && !hunter.avatarUrl.includes("recon.png") && hunter.identityMode !== "ANONYMOUS" ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={hunter.avatarUrl}
                                          alt={hunter.displayName}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <IconComp className={`w-4 h-4 sm:w-5 sm:h-5 ${frame.accent}`} />
                                      )}
                                    </div>
                                    <span
                                      className="hidden sm:inline-block absolute -bottom-1 -right-1 px-1 py-0.2 rounded-full text-[8px] font-mono font-bold bg-slate-900 border border-white/20 text-slate-300"
                                      title={preset.name}
                                    >
                                      {hunter.avatarPreset || "recon"}
                                    </span>
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-white text-xs sm:text-sm hover:text-emerald-300 transition-colors truncate max-w-[90px] xs:max-w-[130px] sm:max-w-none">
                                        {hunter.displayName}
                                      </span>
                                      <span className="sm:hidden px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-slate-800 text-emerald-400 border border-emerald-500/20 shrink-0">
                                        Lv.{hunter.level}
                                      </span>
                                      {hunter.squadId && (
                                        <span className="px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                                          [{hunter.squadId.tag}]
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate flex items-center gap-1 sm:gap-1.5 max-w-[120px] xs:max-w-[160px] sm:max-w-none">
                                      {hunter.identityMode === "ANONYMOUS" || hunter.displayName === "Anonymous Hunter" ? (
                                        <span className="text-slate-500 italic">Classified</span>
                                      ) : hunter.displayName === `@${hunter.username}` ? (
                                        <span className="text-emerald-400/90 font-medium">{hunter.rankTitle || "Operative"}</span>
                                      ) : (
                                        <span>@{hunter.username}</span>
                                      )}
                                      <span className="text-slate-600">•</span>
                                      <span className="text-slate-400">{hunter.department}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Equipped Cosmetic Title Pill */}
                              <td className="hidden md:table-cell py-2 sm:py-3.5 px-2 sm:px-4 md:px-6 text-center">
                                {hunter.equippedTitle ? (
                                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                    {hunter.equippedTitle}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[11px]">—</span>
                                )}
                              </td>

                              {/* Level Badge */}
                              <td className="hidden sm:table-cell py-2 sm:py-3.5 px-2 sm:px-4 md:px-6 text-center">
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 font-bold font-mono text-xs border border-emerald-500/30">
                                  LVL {hunter.level}
                                </span>
                              </td>

                              {/* Verified Campus Activity */}
                              <td className="hidden lg:table-cell py-2 sm:py-3.5 px-2 sm:px-4 md:px-6 text-center">
                                <div className="inline-flex items-center gap-3 text-[11px] font-mono bg-slate-950/60 px-3 py-1 rounded-xl border border-white/10">
                                  <span
                                    className="flex items-center gap-1 text-emerald-400 font-semibold"
                                    title="Verified Handover Recoveries"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>{hunter.stats?.recoveriesCount ?? 0}</span>
                                  </span>
                                  <span className="text-slate-600">|</span>
                                  <span
                                    className="flex items-center gap-1 text-cyan-400 font-semibold"
                                    title="Investigation Quests Solved"
                                  >
                                    <Target className="w-3.5 h-3.5" />
                                    <span>{hunter.stats?.questsCompleted ?? 0}</span>
                                  </span>
                                </div>
                              </td>

                              {/* Trophies / XP */}
                              <td className="py-2 sm:py-3.5 px-2 sm:px-4 md:px-6 text-right font-black text-amber-400 font-mono text-xs">
                                <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                                  <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                                  <span className="text-xs sm:text-sm">
                                    {(timeframe === "WEEKLY"
                                      ? hunter.weeklyScore || 0
                                      : hunter.trophies || hunter.xp
                                    ).toLocaleString()}{" "}
                                    <span className="hidden sm:inline text-[10px] text-amber-500/80 font-normal">Trophies</span>
                                  </span>
                                </div>
                              </td>

                              {/* Dossier Action Button */}
                              <td className="py-2 sm:py-3.5 px-1 sm:px-4 md:px-6 text-center">
                                <Link
                                  href={`/profile/${hunter.username}`}
                                  aria-label={`View dossier for ${hunter.displayName}`}
                                  className="sm:hidden p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 transition-all inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-emerald-400"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                                <Link
                                  href={`/profile/${hunter.username}`}
                                  className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 transition-all font-mono text-xs items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-400"
                                >
                                  <span>View Dossier</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      )
                    ) : (
                      squads.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-mono text-xs">
                            No syndicates currently registered.
                          </td>
                        </tr>
                      ) : (
                        squads.map((squad, idx) => {
                          const rankNum = idx + 1;
                          const isTop1 = rankNum === 1;
                          const isTop2 = rankNum === 2;
                          const isTop3 = rankNum === 3;
                          const isElite = rankNum >= 4 && rankNum <= 10;

                          return (
                            <tr
                              key={squad._id}
                              id={`syndicate-row-${squad._id}`}
                              className={`transition-colors hover:bg-white/[0.04] ${
                                isTop1
                                  ? "bg-amber-500/[0.06]"
                                  : isTop2
                                  ? "bg-slate-300/[0.03]"
                                  : isTop3
                                  ? "bg-amber-700/[0.03]"
                                  : isElite
                                  ? "bg-cyan-500/[0.02]"
                                  : ""
                              }`}
                            >
                              {/* Glowing Rank Badge */}
                              <td className="py-2 sm:py-3.5 px-1.5 sm:px-4 md:px-6 text-center">
                                <span
                                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl inline-flex items-center justify-center font-mono font-black text-[10px] sm:text-xs ${
                                    isTop1
                                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/40"
                                      : isTop2
                                      ? "bg-slate-300 text-slate-950 shadow-md shadow-slate-300/30"
                                      : isTop3
                                      ? "bg-amber-700 text-amber-100 shadow-md shadow-amber-700/30"
                                      : isElite
                                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                                      : "text-slate-400 bg-white/5 border border-white/10"
                                  }`}
                                >
                                  {rankNum}
                                </span>
                              </td>

                              {/* Syndicate Identity */}
                              <td className="py-2 sm:py-3.5 px-2 sm:px-4 md:px-6">
                                <div className="flex items-center gap-2 sm:gap-3.5">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-800/90 border border-white/10 flex items-center justify-center shrink-0 shadow">
                                    {renderEmblem(squad.emblemIcon)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-white text-xs sm:text-sm hover:text-cyan-300 transition-colors truncate max-w-[90px] xs:max-w-[130px] sm:max-w-none">
                                        {squad.name}
                                      </span>
                                      <span className="sm:hidden px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-slate-800 text-cyan-400 border border-cyan-500/20 shrink-0">
                                        Lv.{squad.squadLevel || 1}
                                      </span>
                                      <span className="px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                                        [{squad.tag}]
                                      </span>
                                    </div>
                                    <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate max-w-[120px] xs:max-w-[160px] sm:max-w-none">
                                      {squad.description || "AIEM Campus Tactical Syndicate"}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Recruitment Mode Pill */}
                              <td className="hidden md:table-cell py-2 sm:py-3.5 px-2 sm:px-4 md:px-6 text-center">
                                <span
                                  className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border ${
                                    squad.joinType === "OPEN"
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                      : squad.joinType === "CLOSED"
                                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  }`}
                                >
                                  {squad.joinType === "OPEN"
                                    ? "Anyone Can Join"
                                    : squad.joinType === "CLOSED"
                                    ? "Closed"
                                    : "Invite Only"}
                                </span>
                              </td>

                              {/* Squad Level */}
                              <td className="hidden sm:table-cell py-2 sm:py-3.5 px-2 sm:px-4 md:px-6 text-center">
                                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 font-bold font-mono text-xs border border-cyan-500/30">
                                  Lv.{squad.squadLevel || 1}
                                </span>
                              </td>

                              {/* Real Dynamic Member Count vs memberCap (default 8, NOT 50!) */}
                              <td className="hidden lg:table-cell py-2 sm:py-3.5 px-2 sm:px-4 md:px-6 text-center">
                                <span className="font-mono text-slate-300 text-xs bg-slate-950/60 px-3 py-1 rounded-xl border border-white/10 inline-flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>
                                    {squad.memberCount || 1} / {squad.memberCap ?? 8}
                                  </span>
                                </span>
                              </td>

                              {/* Trophies / XP */}
                              <td className="py-2 sm:py-3.5 px-2 sm:px-4 md:px-6 text-right font-black text-amber-400 font-mono text-xs">
                                <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                                  <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                                  <span className="text-xs sm:text-sm">
                                    {(timeframe === "WEEKLY"
                                      ? squad.weeklyScore || 0
                                      : squad.trophies || squad.squadXp
                                    ).toLocaleString()}{" "}
                                    <span className="hidden sm:inline text-[10px] text-amber-500/80 font-normal">Trophies</span>
                                  </span>
                                </div>
                              </td>

                              {/* Syndicate Hub Action */}
                              <td className="py-2 sm:py-3.5 px-1 sm:px-4 md:px-6 text-center">
                                <Link
                                  href={`/squads/${squad._id}`}
                                  aria-label={`View hub for ${squad.name}`}
                                  className="sm:hidden p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/40 transition-all inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-cyan-400"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                                <Link
                                  href={`/squads/${squad._id}`}
                                  className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/40 transition-all font-mono text-xs items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400"
                                >
                                  <span>View Hub</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Sticky "Your Operative Standing" HUD Bar */}
      {viewerPos && (
        <aside
          aria-label="Your Operative Standing"
          className="fixed bottom-16 md:bottom-5 left-0 right-0 z-30 px-2.5 sm:px-6 pointer-events-none"
        >
          <div className="pointer-events-auto max-w-5xl mx-auto rounded-xl sm:rounded-2xl bg-[#090D14]/95 border border-amber-500/40 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] p-2.5 sm:px-6 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 text-xs font-mono">
            {/* Standing Details */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-300">
                <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="font-bold text-white text-[11px] sm:text-sm truncate max-w-[150px] xs:max-w-[220px] sm:max-w-none">
                    {tab === "HUNTERS"
                      ? !viewerPos.isLeaderboardPublic
                        ? "Rank: Private"
                        : viewerPos.rank !== null
                        ? `Rank: #${viewerPos.rank}${
                            department &&
                            department !== "ALL" &&
                            department !== "All Departments" &&
                            viewerPos.department !== department
                              ? ` (${viewerPos.department || "Other"})`
                              : ""
                          }`
                        : "Rank: Unranked"
                      : viewerPos.rank !== null
                      ? `Syndicate: #${viewerPos.rank} [${viewerPos.tag || ""}]`
                      : "Unranked Syndicate"}
                  </span>
                  {viewerPos.percentile && viewerPos.rank !== null && (
                    <span className="px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                      Top {viewerPos.percentile}%
                    </span>
                  )}
                </div>

                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate max-w-[150px] xs:max-w-[220px] sm:max-w-none">
                  {(timeframe === "WEEKLY"
                    ? viewerPos.weeklyScore || 0
                    : tab === "HUNTERS"
                    ? viewerPos.trophies || viewerPos.xp || 0
                    : viewerPos.trophies || viewerPos.squadXp || 0
                  ).toLocaleString()}{" "}
                  Trophies
                  {tab === "HUNTERS" && viewerPos.level && ` • Lv.${viewerPos.level}`}
                  {tab === "HUNTERS" && viewerPos.equippedTitle && ` • ${viewerPos.equippedTitle}`}
                  {tab === "SQUADS" && viewerPos.memberCount && ` • ${viewerPos.memberCount}/${viewerPos.memberCap ?? 8}`}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {viewerPos.rank !== null &&
                (tab !== "HUNTERS" ||
                  department === "ALL" ||
                  department === "All Departments" ||
                  viewerPos.department === department) && (
                <button
                  type="button"
                  onClick={() => {
                    const rowId =
                      tab === "HUNTERS"
                        ? `operative-row-${viewerPos.userId}`
                        : `syndicate-row-${viewerPos.squadId}`;
                    scrollToRow(rowId);
                  }}
                  className="px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold transition-all flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-amber-400"
                  title="Jump to Row"
                >
                  <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Jump</span>
                </button>
              )}

              {tab === "HUNTERS" && viewerPos.username ? (
                <Link
                  href={`/profile/${viewerPos.username}`}
                  className="px-2.5 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] sm:text-xs transition-all flex items-center gap-1 sm:gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)] focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <span className="hidden sm:inline">My Dossier</span>
                  <span className="sm:hidden">Dossier</span>
                  <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                </Link>
              ) : viewerPos.squadId ? (
                <Link
                  href={`/squads/${viewerPos.squadId}`}
                  className="px-2.5 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-[11px] sm:text-xs transition-all flex items-center gap-1 sm:gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)] focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <span className="hidden sm:inline">My Syndicate</span>
                  <span className="sm:hidden">Syndicate</span>
                  <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                </Link>
              ) : null}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
