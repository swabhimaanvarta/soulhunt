"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Shield,
  Trophy,
  Compass,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  LogOut,
  UserPlus,
  Award,
} from "lucide-react";

export default function SquadDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [squad, setSquad] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [activeInvestigations, setActiveInvestigations] = useState<any[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSquad = async () => {
    try {
      const res = await fetch(`/api/squads/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSquad(json.data.squad);
        setMembers(json.data.members || []);
        setActiveInvestigations(json.data.activeInvestigations || []);
        setIsMember(json.data.isMember);
        setIsLeader(json.data.isLeader);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchSquad();
  }, [id]);

  const handleJoin = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/squads/${id}/join`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Failed to join squad.");
        return;
      }
      fetchSquad();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm("Are you sure you want to leave this squad?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/squads/${id}/leave`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Failed to leave squad.");
        return;
      }
      fetchSquad();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center font-mono text-slate-500 animate-pulse">
        CONNECTING TO SQUAD FREQUENCY...
      </div>
    );
  }

  if (!squad) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Squad Not Found</h2>
        <Link href="/squads" className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-mono">
          Return to Squads Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <Link
          href="/squads"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Squads Directory
        </Link>
      </div>

      {/* Squad Header Banner */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 p-0.5 shadow-xl shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-mono font-black text-xl text-emerald-400">
                {squad.tag}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300">
                  LEVEL {squad.squadLevel || 1} SYNDICATE
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {members.length} / 8 Operatives
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{squad.name}</h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl">{squad.description}</p>
            </div>
          </div>

          {/* Action button */}
          <div>
            {isMember ? (
              <button
                onClick={handleLeave}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold transition-all"
              >
                <LogOut className="w-4 h-4" />
                Leave Squad
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={actionLoading || members.length >= 8}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-emerald-500/20 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                {members.length >= 8 ? "Squad Full" : "Enlist in Squad"}
              </button>
            )}
          </div>
        </div>

        {/* Squad HUD Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-emerald-400">{squad.squadXp}</div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Total Squad XP</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-cyan-400">{squad.completedHuntsCount || 0}</div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Hunts Solved</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-amber-400">{members.length}</div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Active Members</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-violet-400">
              {squad.leaderId?.displayName || "Agent"}
            </div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Squad Commander</div>
          </div>
        </div>
      </div>

      {/* 2-Column: Member Roster & Active Shared Investigations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Member Roster */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Operatives Roster ({members.length})
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Sorted by Contributed XP</span>
          </div>

          <div className="space-y-3">
            {members.map((m: any) => {
              const u = m.userId;
              if (!u) return null;
              return (
                <div
                  key={m._id}
                  className="rounded-2xl bg-slate-950/60 border border-white/5 p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-emerald-400 text-sm">
                      {u.displayName?.charAt(0) || "U"}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{u.displayName}</span>
                        {m.squadRole === "LEADER" && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 font-bold">
                            LEADER
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        LVL {u.level} • {u.rankTitle} • @{u.username}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-emerald-400 font-bold text-xs">
                      +{m.contributedSquadXp} XP
                    </div>
                    <div className="text-[10px] text-slate-500">Contributed</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shared Investigations */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              Active Squad Hunts ({activeInvestigations.length})
            </h2>
          </div>

          <div className="space-y-3">
            {activeInvestigations.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-mono">
                No active investigations running. Accept a quest from the Quest Board to start a raid!
              </div>
            ) : (
              activeInvestigations.map((inv: any) => (
                <Link
                  key={inv._id}
                  href={`/investigations/${inv._id}`}
                  className="block p-4 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-cyan-500/40 transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-amber-400 font-bold">
                      {inv.questId?.questCode || "QUEST"}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      {inv.progressPct}% Done
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                    {inv.questId?.title || "Investigation Room"}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-white/5">
                    <span>Stage {inv.currentStage} In Progress</span>
                    <span className="text-cyan-400 font-bold flex items-center gap-1">
                      Enter Corkboard <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

