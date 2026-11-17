"use client";

import React from "react";
import {
  Trophy,
  CheckCircle2,
  Calendar,
  Clock,
  Award,
  Zap,
  Coins,
  Shield,
  Star,
  Users,
} from "lucide-react";

export interface SquadHuntParticipant {
  userId: string | any;
  displayName: string;
  username: string;
  avatarUrl?: string;
  cluesSolvedCount: number;
  isFinder: boolean;
  trophiesAwarded: number;
  xpAwarded: number;
  coinsAwarded: number;
}

export interface SquadHuntRecordItem {
  _id: string;
  squadId?: string;
  questId?: string;
  investigationId?: string;
  questCode: string;
  questTitle: string;
  questType?: string;
  difficulty: number;
  status: "COMPLETED" | "FAILED" | "ABANDONED";
  completedAt: string | Date;
  startedAt?: string | Date;
  durationSeconds?: number;
  finisherUserId?: string;
  finisherName?: string;
  participatingMembers: SquadHuntParticipant[];
  squadRewards?: {
    squadXp: number;
    squadTrophies: number;
  };
  totalCluesCount?: number;
  evidencePinsCount?: number;
}

interface SquadHuntHistoryCardProps {
  hunt: SquadHuntRecordItem;
}

function formatDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatDate(dateVal: string | Date): string {
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "Recently Completed";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Recently Completed";
  }
}

export default function SquadHuntHistoryCard({ hunt }: SquadHuntHistoryCardProps) {
  const formattedDate = formatDate(hunt.completedAt);
  const durationStr = formatDuration(hunt.durationSeconds);
  const participants = Array.isArray(hunt.participatingMembers) ? hunt.participatingMembers : [];

  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-cyan-500/30 transition-all space-y-4 group">
      {/* Top Meta Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {hunt.questCode || "RAID"}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {hunt.status || "COMPLETED"}
          </span>
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            Lv.{hunt.difficulty || 1} Difficulty
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          {durationStr && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              {durationStr}
            </span>
          )}
          <span className="flex items-center gap-1 text-slate-400">
            <Calendar className="w-3 h-3 text-slate-500" />
            {formattedDate}
          </span>
        </div>
      </div>

      {/* Quest Title & Payout Pill */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
            {hunt.questTitle || "Campus Syndicate Investigation"}
          </h4>
          {hunt.finisherName && (
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Recovered by: <span className="text-cyan-300 font-bold">{hunt.finisherName}</span>
            </p>
          )}
        </div>

        {/* Squad Ledger Rewards */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0 font-mono text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5 font-bold">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            +{hunt.squadRewards?.squadXp ?? 50} Squad XP
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1.5 font-bold">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            +{hunt.squadRewards?.squadTrophies ?? 25} Trophies
          </div>
        </div>
      </div>

      {/* Participated Operatives Roster */}
      <div className="space-y-2 pt-1 border-t border-white/5">
        <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-3 h-3 text-cyan-400" />
          <span>Participating Operatives ({participants.length})</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {participants.map((p, idx) => {
            const initial = p.displayName ? p.displayName.charAt(0).toUpperCase() : "A";
            return (
              <div
                key={p.userId ? String(p.userId) : `p-${idx}`}
                className="p-2.5 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-cyan-300 text-xs shrink-0">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                      <span>{p.displayName || "Agent"}</span>
                      {p.isFinder && (
                        <span className="px-1 py-0.2 rounded text-[8px] font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                          FINDER
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                      <span>{p.cluesSolvedCount || 0} Clues</span>
                      {p.isFinder && <span className="text-amber-400">+Bonus XP</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono text-[10px] shrink-0">
                  <div className="text-emerald-400 font-bold">+{p.xpAwarded || 0} XP</div>
                  <div className="text-amber-300">+{p.trophiesAwarded || 0} 🏆</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
