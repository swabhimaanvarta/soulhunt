"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Shield,
  Compass,
  Target,
  Trophy,
  Award,
  Users,
  MessageSquare,
  LogOut,
  PlusCircle,
  ArrowRight,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  History,
  Radio,
  ExternalLink,
  Flame,
} from "lucide-react";
import SquadHuntHistoryCard, { SquadHuntRecordItem } from "./SquadHuntHistoryCard";

interface MySquadSyndicateViewProps {
  currentUser: any;
  onBrowseSquads: () => void;
  onResignSuccess?: () => void;
}

export default function MySquadSyndicateView({
  currentUser,
  onBrowseSquads,
  onResignSuccess,
}: MySquadSyndicateViewProps) {
  const router = useRouter();
  const squadId =
    currentUser?.squadId?._id ||
    currentUser?.squadId ||
    currentUser?.squad?._id ||
    (typeof currentUser?.squad === "string" ? currentUser.squad : null);

  const [squad, setSquad] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [activeHunts, setActiveHunts] = useState<any[]>([]);
  const [pastHunts, setPastHunts] = useState<SquadHuntRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resignLoading, setResignLoading] = useState(false);
  const [showResignModal, setShowResignModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!squadId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Fetch squad profile & member roster
      const squadRes = await fetch(`/api/squads/${squadId}`);
      const squadJson = await squadRes.json();
      if (squadJson.success && squadJson.data) {
        setSquad(squadJson.data.squad);
        setMembers(squadJson.data.members || []);
      }

      // 2. Fetch active raids & persistent hunt history
      const huntsRes = await fetch(`/api/squads/${squadId}/hunts`);
      const huntsJson = await huntsRes.json();
      if (huntsJson.success && huntsJson.data) {
        setActiveHunts(huntsJson.data.activeHunts || []);
        setPastHunts(huntsJson.data.pastHunts || []);
      }
    } catch (err: any) {
      console.error("Error loading squad syndicate view:", err);
      setErrorMessage("Failed to load syndicate operational data. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [squadId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResign = async () => {
    if (!squad?._id) return;
    setResignLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/squads/${squad._id}/leave`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const errText = typeof json.error === "object" ? json.error?.message : json.error;
        throw new Error(errText || "Failed to resign from squad.");
      }

      setShowResignModal(false);
      if (onResignSuccess) {
        onResignSuccess();
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to resign from squad.");
    } finally {
      setResignLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3 font-mono">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
        <div className="text-xs text-slate-400 uppercase tracking-wider">
          Initializing Syndicate Command Feeds...
        </div>
      </div>
    );
  }

  if (!squad) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">No Active Syndicate Record Found</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          We could not resolve your squad membership details. You may browse and enlist in campus syndicates.
        </p>
        <button
          onClick={onBrowseSquads}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all"
        >
          Browse Campus Squads →
        </button>
      </div>
    );
  }

  // Emblem renderer
  const renderEmblem = (iconName?: string) => {
    const className = "w-6 h-6 text-emerald-400";
    switch (iconName) {
      case "Shield":
        return <Shield className={className} />;
      case "Compass":
        return <Compass className={className} />;
      case "Target":
        return <Target className={className} />;
      case "Trophy":
        return <Trophy className={className} />;
      case "Award":
        return <Award className={className} />;
      case "ShieldAlert":
      default:
        return <ShieldAlert className={className} />;
    }
  };

  // CoC Role Badge Styles
  const getRoleBadge = (role?: string) => {
    switch (role?.toUpperCase()) {
      case "LEADER":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "COLEADER":
        return "bg-violet-500/20 text-violet-300 border-violet-500/40";
      case "ELDER":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "MEMBER":
      default:
        return "bg-slate-800 text-slate-300 border-white/10";
    }
  };

  const currentLevel = squad.squadLevel || 1;
  const currentXp = squad.squadXp || 0;
  // Progress formula within current 300 XP bracket per level
  const xpInBracket = currentXp % 300;
  const progressPct = Math.min(100, Math.round((xpInBracket / 300) * 100));

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-slate-400 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Syndicate Header Hero */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 relative overflow-hidden space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Syndicate Identity */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
              {renderEmblem(squad.emblemIcon)}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono uppercase font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  [{squad.tag}]
                </span>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  SYNDICATE LVL {currentLevel}
                </span>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono uppercase font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-cyan-400" />
                  {squad.trophies || 0} Trophies
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                {squad.name}
              </h2>

              <p className="text-xs text-slate-400 font-mono">
                Commander: <span className="text-slate-200 font-bold">{squad.leaderId?.displayName || "Agent"}</span>
                {squad.description && ` — "${squad.description}"`}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
            <Link
              href={`/squads/${squad._id}`}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs font-mono border border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer shadow-sm text-center"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
              <span className="hidden sm:inline">Enter Command Room</span>
              <span className="sm:hidden">Command</span>
            </Link>

            <Link
              href={`/squads/${squad._id}?tab=chat`}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 font-bold text-xs font-mono border border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer shadow-sm text-center"
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
              <span className="hidden sm:inline">Tactical Comms</span>
              <span className="sm:hidden">Comms</span>
            </Link>

            <Link
              href="/quests?questType=SQUAD_HUNT"
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-emerald-500/20 transition-all cursor-pointer text-center"
            >
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">Launch Squad Raid</span>
              <span className="sm:hidden">Squad Raid</span>
            </Link>

            <button
              onClick={() => setShowResignModal(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl bg-slate-950/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 font-mono text-xs border border-white/5 hover:border-rose-500/30 transition-all cursor-pointer text-center"
              title="Resign from Squad"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Resign</span>
            </button>
          </div>
        </div>

        {/* Metrics HUD Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/10">
          {/* Total Squad XP & Progress */}
          <div className="rounded-2xl bg-slate-950/60 border border-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase text-[10px]">Syndicate XP</span>
              <span className="text-emerald-400 font-bold">{currentXp} XP</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-slate-400 flex justify-between">
              <span>Lvl {currentLevel}</span>
              <span>{xpInBracket}/300 to Lvl {currentLevel + 1}</span>
            </div>
          </div>

          {/* Trophies & Weekly Score */}
          <div className="rounded-2xl bg-slate-950/60 border border-white/5 p-4 flex flex-col justify-between">
            <div className="text-[10px] font-mono uppercase text-slate-400">Syndicate Trophies</div>
            <div className="text-2xl font-black font-mono text-amber-400 flex items-center gap-1.5">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>{squad.trophies || 0}</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Weekly: <span className="text-white font-bold">{squad.weeklyScore || 0} pts</span>
            </div>
          </div>

          {/* Completed Hunts */}
          <div className="rounded-2xl bg-slate-950/60 border border-white/5 p-4 flex flex-col justify-between">
            <div className="text-[10px] font-mono uppercase text-slate-400">Raids Completed</div>
            <div className="text-2xl font-black font-mono text-cyan-400 flex items-center gap-1.5">
              <Flame className="w-5 h-5 text-cyan-400" />
              <span>{squad.completedHuntsCount || 0}</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Active Raids: <span className="text-emerald-400 font-bold">{activeHunts.length}</span>
            </div>
          </div>

          {/* Member Cap Ratio */}
          <div className="rounded-2xl bg-slate-950/60 border border-white/5 p-4 flex flex-col justify-between">
            <div className="text-[10px] font-mono uppercase text-slate-400">Operatives Roster</div>
            <div className="text-2xl font-black font-mono text-emerald-400 flex items-center gap-1.5">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>{members.length} / {squad.memberCap || 8}</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {members.length >= (squad.memberCap || 8) ? (
                <span className="text-rose-400 font-bold">Roster Full</span>
              ) : (
                <span className="text-emerald-400">Recruiting Open</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Active Raids & Hunt History Log (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Active Squad Raids Section */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-base font-bold text-white">Active Squad Raids</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {activeHunts.length} LIVE
                </span>
              </div>

              <Link
                href="/quests?questType=SQUAD_HUNT"
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
              >
                Launch Raid <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {activeHunts.length === 0 ? (
              <div className="py-8 text-center space-y-3 font-mono text-xs">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
                  <Compass className="w-5 h-5" />
                </div>
                <div className="text-slate-400">
                  No active investigations currently underway.
                </div>
                <Link
                  href="/quests?questType=SQUAD_HUNT"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 font-bold border border-cyan-500/30 transition-all"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Initiate Syndicate Raid Board →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeHunts.map((inv) => {
                  const quest = inv.questId || {};
                  const participants = Array.isArray(inv.participatingUserIds)
                    ? inv.participatingUserIds
                    : [];

                  return (
                    <div
                      key={inv._id}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-cyan-500/40 transition-all space-y-3 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {quest.questCode || "RAID"}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            Stage {inv.currentStage || 1} In Progress
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {inv.progressPct || 0}% Complete
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {quest.title || "Squad Raid Investigation"}
                      </h4>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all"
                          style={{ width: `${inv.progressPct || 0}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5 text-xs font-mono">
                        {/* Participating Operatives */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Operatives:</span>
                          <div className="flex items-center -space-x-1.5">
                            {participants.slice(0, 4).map((p: any, pIdx: number) => (
                              <div
                                key={p._id || `p-${pIdx}`}
                                className="w-5 h-5 rounded-full bg-slate-800 border border-slate-900 flex items-center justify-center text-[9px] text-cyan-300 font-bold"
                                title={p.displayName || "Agent"}
                              >
                                {p.displayName ? p.displayName.charAt(0).toUpperCase() : "A"}
                              </div>
                            ))}
                            {participants.length > 4 && (
                              <div className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-[8px] text-slate-400 font-bold">
                                +{participants.length - 4}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Resume button */}
                        <Link
                          href={`/investigations/${inv._id}`}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 font-bold text-xs font-mono border border-cyan-500/30 transition-all flex items-center gap-1"
                        >
                          Resume Investigation Room <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Persistent Squad Hunt History Log */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-bold text-white">Persistent Squad Hunt History</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {pastHunts.length} LOGGED
                </span>
              </div>
            </div>

            {pastHunts.length === 0 ? (
              <div className="py-12 text-center space-y-3 font-mono">
                <Trophy className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">
                  No completed squad raids logged yet. Launch your syndicate&apos;s first raid!
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Completed team investigations permanently log here with participant attribution, clues solved, finder bonuses, and reward tallies.
                </p>
                <Link
                  href="/quests?questType=SQUAD_HUNT"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono shadow-md shadow-emerald-500/20 transition-all mt-2"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Launch Syndicate Raid
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {pastHunts.map((hunt) => (
                  <SquadHuntHistoryCard key={hunt._id} hunt={hunt} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Operatives Roster & Quick Actions (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Operatives Roster Preview */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Operatives Roster</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {members.length}/{squad.memberCap || 8}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {members.map((m) => {
                const u = m.userId || {};
                const role = m.role || m.squadRole || "MEMBER";
                const initial = u.displayName ? u.displayName.charAt(0).toUpperCase() : "A";

                return (
                  <div
                    key={m._id}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-cyan-300 text-xs shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span>{u.displayName || "Agent"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[8px] font-mono border font-bold uppercase ${getRoleBadge(
                              role
                            )}`}
                          >
                            {role}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Lv.{u.level || 1}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono shrink-0">
                      <div className="text-emerald-400 font-bold text-[11px]">
                        +{m.contributedSquadXp || 0} XP
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase">Contribution</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/5">
              <Link
                href={`/squads/${squad._id}`}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 text-xs font-mono font-bold border border-white/5 hover:border-cyan-500/30 transition-all"
              >
                <span>Manage Roster in Command Room</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Quick Scouting Shortcut Card */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-3">
            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Campus Scouting</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Explore rival campus deduction units, inspect leaderboard standings, or compare syndicate trophies.
            </p>
            <button
              onClick={onBrowseSquads}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-cyan-500/20 text-cyan-300 font-bold text-xs font-mono border border-cyan-500/30 transition-all cursor-pointer"
            >
              <span>Browse Other Campus Squads</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Resign Confirmation Modal */}
      {showResignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="rounded-2xl bg-slate-900 border border-white/15 max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Resign from Syndicate</h3>
                <p className="text-xs text-slate-400 font-mono">Confirm squad separation</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-mono">
              Are you sure you want to resign from <strong className="text-white">[{squad.tag}] {squad.name}</strong>? You will lose access to syndicate investigations and tactical comms.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowResignModal(false)}
                disabled={resignLoading}
                className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResign}
                disabled={resignLoading}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs font-mono transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                {resignLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Resigning...</span>
                  </>
                ) : (
                  <span>Confirm Resignation</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
