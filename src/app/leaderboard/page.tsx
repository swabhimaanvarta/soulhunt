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
} from "lucide-react";

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"HUNTERS" | "SQUADS">("HUNTERS");
  const [hunters, setHunters] = useState<any[]>([]);
  const [squads, setSquads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?category=${tab}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          if (tab === "HUNTERS") setHunters(d.data.hunters || []);
          if (tab === "SQUADS") setSquads(d.data.squads || []);
        }
      })
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              CAMPUS HONORS LEDGER
            </span>
            <span className="text-xs font-mono text-slate-400">Official AIEM Standings</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Hall of Fame & Leaderboards
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Prestige earned through verified lost belonging recoveries, accurate clue deductions, and ethical campus safe-desk drop-offs.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-900 p-1 border border-white/10 text-xs font-mono">
          <button
            onClick={() => setTab("HUNTERS")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-all ${
              tab === "HUNTERS"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Top Hunters
          </button>
          <button
            onClick={() => setTab("SQUADS")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-all ${
              tab === "SQUADS"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Top Squads
          </button>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="py-20 text-center font-mono text-slate-500 text-xs animate-pulse">
          AUDITING CAMPUS PRESTIGE LEDGER...
        </div>
      ) : tab === "HUNTERS" ? (
        <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] border-b border-white/10">
                <tr>
                  <th className="py-4 px-6">Rank</th>
                  <th className="py-4 px-6">Hunter Agent</th>
                  <th className="py-4 px-6">Rank Title</th>
                  <th className="py-4 px-6 text-center">Level</th>
                  <th className="py-4 px-6 text-right">XP</th>
                  <th className="py-4 px-6 text-center">Recoveries</th>
                  <th className="py-4 px-6 text-center">Trust Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {hunters.map((h, idx) => {
                  const isTop3 = idx < 3;
                  return (
                    <tr
                      key={h._id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-4 px-6">
                        <span
                          className={`w-7 h-7 rounded-lg inline-flex items-center justify-center font-bold text-xs ${
                            idx === 0
                              ? "bg-amber-500 text-slate-950"
                              : idx === 1
                              ? "bg-slate-300 text-slate-950"
                              : idx === 2
                              ? "bg-amber-700 text-amber-100"
                              : "text-slate-500"
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3 font-sans">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-emerald-400 text-xs">
                            {h.displayName?.charAt(0)}
                          </div>
                          <div>
                            <Link
                              href={`/profile/${h.username}`}
                              className="font-bold text-white hover:text-emerald-300 transition-colors"
                            >
                              {h.displayName}
                            </Link>
                            <div className="text-[10px] text-slate-400 font-mono">
                              @{h.username} {h.squadId ? `• [${h.squadId.tag}]` : ""}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-slate-300 font-sans">
                        {h.rankTitle}
                      </td>

                      <td className="py-4 px-6 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          LVL {h.level}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right font-bold text-emerald-400">
                        {h.xp.toLocaleString()} XP
                      </td>

                      <td className="py-4 px-6 text-center text-slate-300">
                        {h.stats?.recoveriesCount || 0}
                      </td>

                      <td className="py-4 px-6 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          {h.trustTier} ({h.trustScore})
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] border-b border-white/10">
                <tr>
                  <th className="py-4 px-6">Rank</th>
                  <th className="py-4 px-6">Squad Syndicate</th>
                  <th className="py-4 px-6">Leader</th>
                  <th className="py-4 px-6 text-center">Level</th>
                  <th className="py-4 px-6 text-right">Squad XP</th>
                  <th className="py-4 px-6 text-center">Completed Hunts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {squads.map((sq, idx) => (
                  <tr
                    key={sq._id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-4 px-6">
                      <span
                        className={`w-7 h-7 rounded-lg inline-flex items-center justify-center font-bold text-xs ${
                          idx === 0
                            ? "bg-amber-500 text-slate-950"
                            : idx === 1
                            ? "bg-slate-300 text-slate-950"
                            : idx === 2
                            ? "bg-amber-700 text-amber-100"
                            : "text-slate-500"
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3 font-sans">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-cyan-400 text-xs">
                          {sq.tag}
                        </div>
                        <div>
                          <Link
                            href={`/squads/${sq._id}`}
                            className="font-bold text-white hover:text-cyan-300 transition-colors"
                          >
                            {sq.name}
                          </Link>
                          <div className="text-[10px] text-slate-400 line-clamp-1">
                            {sq.description || "Campus Investigation Squad"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-slate-300 font-sans">
                      {sq.leaderId?.displayName || "Agent"}
                    </td>

                    <td className="py-4 px-6 text-center">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                        LVL {sq.squadLevel || 1}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right font-bold text-cyan-400">
                      {sq.squadXp.toLocaleString()} XP
                    </td>

                    <td className="py-4 px-6 text-center text-slate-300">
                      {sq.completedHuntsCount || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

