"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  MapPin,
  Coins,
  Shield,
  Users,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  Lock,
} from "lucide-react";

export default function QuestBoardPage() {
  const router = useRouter();
  const [quests, setQuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("ALL");
  const [startingQuestId, setStartingQuestId] = useState<string | null>(null);

  const questTypes = [
    { key: "ALL", label: "All Quests" },
    { key: "INVESTIGATION", label: "Lost Item Investigations" },
    { key: "CAMPUS_TREASURE", label: "Campus Mystery Hunts" },
    { key: "SQUAD_HUNT", label: "Squad Raids" },
    { key: "QUICK_FIND", label: "Quick Finds" },
  ];

  const fetchQuests = async () => {
    setLoading(true);
    try {
      const url = filterType === "ALL" ? "/api/quests" : `/api/quests?type=${filterType}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setQuests(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuests();
  }, [filterType]);

  const handleStartQuest = async (questId: string, asSquad: boolean = false) => {
    setStartingQuestId(questId);
    try {
      const res = await fetch(`/api/quests/${questId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asSquad }),
      });
      const json = await res.json();
      if (json.success && json.data?.investigationId) {
        router.push(`/investigations/${json.data.investigationId}`);
      } else {
        alert(json.error || "Please log in to accept this quest.");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setStartingQuestId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              CAMPUS RECON BOARD
            </span>
            <span className="text-xs font-mono text-slate-400">
              {quests.length} Active Missions
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Campus Quest & Mystery Hunt Board
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Accept field deduction missions, track physical clues across AIEM buildings, and recover belongings to earn XP, Hunter Coins, and Squad honors.
          </p>
        </div>

        <Link
          href="/lost-and-found/report-lost"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/10 font-bold text-xs font-mono transition-all self-start md:self-auto"
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          Turn Lost Item into Quest
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-mono">
        {questTypes.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilterType(t.key)}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all font-bold ${
              filterType === t.key
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "bg-white/5 text-slate-400 hover:text-white border border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Quests Grid */}
      {loading ? (
        <div className="py-20 text-center font-mono text-slate-500 text-xs animate-pulse">
          FETCHING CLASSIFIED INVESTIGATION BOARDS...
        </div>
      ) : quests.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-3">
          <Compass className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No quests found in this category</h3>
          <p className="text-xs text-slate-400">
            Check back later or report a lost item to initiate a new investigation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quests.map((q) => (
            <div
              key={q._id}
              className="glass-panel rounded-2xl p-6 border border-white/10 hover:border-emerald-500/40 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {q.questType}
                  </span>
                  <span className="font-mono text-xs text-amber-400 font-bold">
                    {q.questCode}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                    {q.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {q.description}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5 text-xs font-mono">
                  {q.targetLocationId && (
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="truncate">
                        Target: {q.targetLocationId.name} ({q.targetLocationId.code})
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Stages: {q.totalStages || 3} Clues</span>
                    <span>
                      Difficulty: {"★".repeat(q.difficulty)}{"☆".repeat(Math.max(0, 5 - q.difficulty))}
                    </span>
                  </div>

                  {/* Rewards Row */}
                  <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-200">
                    <span className="text-emerald-400 font-bold">⭐ +{q.xpReward} XP</span>
                    <span className="text-amber-400 font-bold">🪙 +{q.coinReward} Coins</span>
                    {q.squadXpReward > 0 && (
                      <span className="text-cyan-400 font-bold">🛡️ +{q.squadXpReward} Squad XP</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 mt-4 border-t border-white/5 flex items-center gap-2">
                <button
                  onClick={() => handleStartQuest(q._id, false)}
                  disabled={startingQuestId === q._id}
                  className="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all text-center"
                >
                  {startingQuestId === q._id ? "Deploying..." : "Solo Recon"}
                </button>

                <button
                  onClick={() => handleStartQuest(q._id, true)}
                  disabled={startingQuestId === q._id}
                  className="flex-1 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold transition-all text-center flex items-center justify-center gap-1"
                >
                  <Users className="w-3 h-3" />
                  Squad Raid
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

