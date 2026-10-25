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
  Trophy,
  Zap,
  BookmarkCheck,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function QuestBoardPage() {
  const router = useRouter();
  const [quests, setQuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [statusTab, setStatusTab] = useState<"AVAILABLE" | "COMPLETED">("AVAILABLE");
  const [startingQuestId, setStartingQuestId] = useState<string | null>(null);

  const questTypes = [
    { key: "ALL", label: "All Types" },
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
    setMounted(true);
    fetchQuests();
  }, [filterType]);

  const { toast } = useToast();

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
        toast({
          title: "Quest Activated",
          description: "Entering investigation room...",
          variant: "success",
        });
        router.push(`/investigations/${json.data.investigationId}`);
      } else if (json.code === "ALREADY_COMPLETED") {
        toast({
          title: "Mission Already Completed",
          description: "You have already completed this quest and claimed your rewards. Multiple submissions are not permitted.",
          variant: "destructive",
        });
        if (json.data?.investigationId) {
          router.push(`/investigations/${json.data.investigationId}`);
        }
      } else {
        toast({
          title: "Quest Activation Failed",
          description: json.error || "Please log in to accept this quest.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Connection Error",
        description: e.message || "Failed to initiate quest",
        variant: "destructive",
      });
    } finally {
      setStartingQuestId(null);
    }
  };

  const availableQuests = quests.filter((q) => !q.isCompletedByUser);
  const completedQuests = quests.filter((q) => Boolean(q.isCompletedByUser));
  const activeQuestsToDisplay = statusTab === "AVAILABLE" ? availableQuests : completedQuests;
  const nextRecommendedQuest = availableQuests[0] || null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              CAMPUS RECON BOARD
            </span>
            <span className="text-xs font-mono text-slate-400">
              {mounted ? `${availableQuests.length} Available • ${completedQuests.length} Completed` : "Scanning Campus..."}
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

      {/* Next Recommended Mission Banner (If user has completed at least 1 quest and has another available) */}
      {completedQuests.length > 0 && nextRecommendedQuest && (
        <div className="rounded-2xl p-5 border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900/90 to-emerald-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_0_25px_rgba(6,182,212,0.1)]">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-cyan-500/20 text-cyan-300">
                  NEXT RECOMMENDED ASSIGNMENT
                </span>
                <span className="text-xs font-mono text-amber-400 font-bold">
                  +{nextRecommendedQuest.xpReward} XP • +{nextRecommendedQuest.coinReward} Coins
                </span>
              </div>
              <h3 className="text-base font-bold text-white">
                {nextRecommendedQuest.title}
              </h3>
              <p className="text-xs text-slate-300 line-clamp-1 max-w-xl">
                {nextRecommendedQuest.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => handleStartQuest(nextRecommendedQuest._id, false)}
              disabled={startingQuestId === nextRecommendedQuest._id}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              <span>{startingQuestId === nextRecommendedQuest._id ? "Deploying..." : "Deploy Next Quest"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Primary Section Selector (Available Missions vs Completed Archives) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4 max-w-full min-w-0">
        <div className="grid grid-cols-2 sm:flex items-center gap-2 max-w-full">
          <button
            onClick={() => setStatusTab("AVAILABLE")}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-mono text-[11px] sm:text-xs font-bold transition-all ${
              statusTab === "AVAILABLE"
                ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                : "bg-white/5 text-slate-400 hover:text-white border border-white/10"
            }`}
          >
            <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span>
              <span className="sm:hidden">Available</span>
              <span className="hidden sm:inline">Available Missions</span> ({availableQuests.length})
            </span>
          </button>

          <button
            onClick={() => setStatusTab("COMPLETED")}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-mono text-[11px] sm:text-xs font-bold transition-all ${
              statusTab === "COMPLETED"
                ? "bg-amber-400 text-slate-950 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                : "bg-white/5 text-slate-400 hover:text-white border border-white/10"
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span>
              <span className="sm:hidden">Completed</span>
              <span className="hidden sm:inline">Completed Files</span> ({completedQuests.length})
            </span>
          </button>
        </div>

        {/* Category Type Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono max-w-full no-scrollbar min-w-0">
          {questTypes.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilterType(t.key)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-bold text-[11px] flex-shrink-0 ${
                filterType === t.key
                  ? "bg-white/15 text-white border border-white/30"
                  : "bg-transparent text-slate-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quests Grid */}
      {loading ? (
        <div className="py-20 text-center font-mono text-emerald-400 text-xs animate-pulse">
          SCANNING CAMPUS INVESTIGATION REPOSITORY...
        </div>
      ) : activeQuestsToDisplay.length === 0 ? (
        <div className="neon-block rounded-2xl p-12 text-center space-y-3 border border-white/10">
          {statusTab === "COMPLETED" ? (
            <>
              <Trophy className="w-12 h-12 text-amber-500/60 mx-auto" />
              <h3 className="text-base font-bold text-white">No Completed Quests in this Category</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Select an active mission from the Available Missions tab to begin your first investigation and earn honors!
              </p>
              <button
                onClick={() => setStatusTab("AVAILABLE")}
                className="mt-2 px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono rounded-xl hover:bg-emerald-500/30"
              >
                Browse Available Missions
              </button>
            </>
          ) : (
            <>
              <Compass className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Available Missions Found</h3>
              <p className="text-xs text-slate-400">
                You have completed all active missions or none are available in this filter.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeQuestsToDisplay.map((q) => {
            const isCompleted = Boolean(q.isCompletedByUser);
            const isInProgress = q.userInvestigationStatus === "IN_PROGRESS";

            return (
              <div
                key={q._id}
                className={`neon-block rounded-2xl p-6 border transition-all flex flex-col justify-between group ${
                  isCompleted
                    ? "border-emerald-500/40 bg-emerald-950/15 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
                    : isInProgress
                    ? "border-cyan-500/40 bg-cyan-950/15 shadow-[0_0_20px_rgba(6,182,212,0.12)]"
                    : "border-emerald-500/30 hover:border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    {isCompleted ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        COMPLETED CASE
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {q.questType}
                      </span>
                    )}

                    <span className="font-mono text-xs text-amber-400 font-bold">
                      {q.questCode}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Link href={`/quests/${q._id}`} className="block">
                      <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {q.title}
                      </h3>
                    </Link>
                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                      {q.description}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/10 text-xs font-mono">
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
                      <span className="text-amber-400">
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

                {/* Action Buttons depending on status */}
                <div className="pt-4 mt-4 border-t border-white/10">
                  {isCompleted ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-300 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Reward Claimed
                        </span>
                        <span className="text-slate-400 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Single Entry
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {q.userInvestigationId && (
                          <Link
                            href={`/investigations/${q.userInvestigationId}`}
                            className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-mono font-bold transition-all text-center"
                          >
                            Review Dossier →
                          </Link>
                        )}
                        <Link
                          href={`/quests/${q._id}`}
                          className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono transition-all text-center"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  ) : isInProgress && q.userInvestigationId ? (
                    <div className="space-y-2">
                      <Link
                        href={`/investigations/${q.userInvestigationId}`}
                        className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all text-center flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Resume Active Room ({q.userProgressPct || 0}%)
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartQuest(q._id, false)}
                        disabled={startingQuestId === q._id}
                        className="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all text-center shadow-[0_0_12px_rgba(16,185,129,0.2)] disabled:opacity-50"
                      >
                        {startingQuestId === q._id ? "Deploying..." : "Solo Recon"}
                      </button>

                      <button
                        onClick={() => handleStartQuest(q._id, true)}
                        disabled={startingQuestId === q._id}
                        className="flex-1 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold transition-all text-center flex items-center justify-center gap-1 shadow-[0_0_12px_rgba(6,182,212,0.2)] disabled:opacity-50"
                      >
                        <Users className="w-3 h-3" />
                        Squad Raid
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
