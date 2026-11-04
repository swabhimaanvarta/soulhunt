"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Clock,
  Flame,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sfx } from "@/lib/audio/sfx";

interface DailyQuestData {
  dateKey: string;
  resetAt: string;
  secondsRemaining: number;
  quests: Array<{
    questKey: string;
    title: string;
    description: string;
    targetCount: number;
    currentProgress: number;
    isCompleted: boolean;
    isClaimed: boolean;
    xpReward?: number;
    rewardXp?: number;
    coinReward?: number;
    rewardCoins?: number;
    category?: string;
  }>;
  dailyStreak: number;
  longestDailyStreak: number;
}

function formatCountdown(sec: number): string {
  if (sec <= 0) return "00h 00m 00s";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function renderDifficultyStars(difficulty: any): string {
  const d = typeof difficulty === "number" && !isNaN(difficulty) ? Math.min(5, Math.max(1, Math.round(difficulty))) : 2;
  return "★".repeat(d) + "☆".repeat(Math.max(0, 5 - d));
}

export default function QuestBoardPage() {
  const router = useRouter();
  const [quests, setQuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [statusTab, setStatusTab] = useState<"AVAILABLE" | "COMPLETED">("AVAILABLE");
  const [startingQuestId, setStartingQuestId] = useState<string | null>(null);

  // Daily Quests Board state
  const [dailyData, setDailyData] = useState<DailyQuestData | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  const questTypes = [
    { key: "ALL", label: "All Types" },
    { key: "INVESTIGATION", label: "Lost Item Investigations" },
    { key: "CAMPUS_TREASURE", label: "Campus Mystery Hunts" },
    { key: "SQUAD_HUNT", label: "Squad Raids" },
    { key: "QUICK_FIND", label: "Quick Finds" },
  ];

  const fetchQuests = useCallback(async () => {
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
  }, [filterType]);

  useEffect(() => {
    setMounted(true);
    fetchQuests();
  }, [fetchQuests]);

  const { toast } = useToast();

  const fetchDailyQuests = useCallback(async () => {
    try {
      const res = await fetch("/api/quests/daily");
      const json = await res.json();
      if (json.success) {
        setDailyData(json);
        if (typeof json.secondsRemaining === "number") {
          setSecondsRemaining(json.secondsRemaining);
        }
      }
    } catch (err) {
      console.error("Failed to fetch daily quests:", err);
    } finally {
      setDailyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyQuests();
  }, [fetchDailyQuests]);

  // Real-time countdown timer to IST midnight reset
  useEffect(() => {
    if (secondsRemaining === null || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          fetchDailyQuests();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining, fetchDailyQuests]);

  const handleClaimDaily = async (questKey: string) => {
    if (!dailyData || claimingKey) return;
    setClaimingKey(questKey);
    try {
      const res = await fetch("/api/quests/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questKey,
          dateKey: dailyData.dateKey,
        }),
      });
      const json = await res.json();
      if (json.success) {
        sfx.playCoinCascade(6);
        toast({
          title: "Daily Objective Completed!",
          description: `Reward claimed: +${json.xpAwarded} XP and +${json.coinsAwarded} Hunter Coins!`,
          variant: "success",
        });
        fetchDailyQuests();
      } else {
        toast({
          title: "Reward Claim Failed",
          description: json.error?.message || json.message || "Unable to claim objective reward.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Connection Error",
        description: e.message || "Failed to submit claim.",
        variant: "destructive",
      });
    } finally {
      setClaimingKey(null);
    }
  };

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-8 space-y-8 overflow-x-hidden w-full">
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

      {/* SECTION: Prominent Daily Quests Board (Anchored to Asia/Kolkata IST Midnight Reset) */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-4 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Glow corner accents */}
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />

        {/* Board Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                DAILY RECON DIRECTIVE
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Goa Campus Timezone: Asia/Kolkata (IST)
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Daily Quests & Streak Operations
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Complete rotating field objectives every 24 hours to build consecutive-day streaks and claim bonus XP and Hunter Coins.
            </p>
          </div>

          {/* Countdown & Streak Pills */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Real-time IST Midnight Countdown Timer */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-cyan-500/30 text-cyan-300 font-mono text-xs shadow-md">
              <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
              <div>
                <span className="text-[9px] text-slate-400 block uppercase leading-none">Midnight Reset In</span>
                <span className="font-bold text-cyan-200">
                  {secondsRemaining !== null ? formatCountdown(secondsRemaining) : "Calculating..."}
                </span>
              </div>
            </div>

            {/* Streak Counters */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-amber-500/30 text-amber-300 font-mono text-xs shadow-md">
              <Flame className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[9px] text-slate-400 block uppercase leading-none">Current Streak</span>
                <span className="font-bold text-amber-300">
                  {dailyData?.dailyStreak ?? 0} {dailyData?.dailyStreak === 1 ? "Day" : "Days"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-300 font-mono text-xs shadow-md">
              <Trophy className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[9px] text-slate-400 block uppercase leading-none">Longest Streak</span>
                <span className="font-bold text-white">
                  {dailyData?.longestDailyStreak ?? 0} {dailyData?.longestDailyStreak === 1 ? "Day" : "Days"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Objectives Content */}
        {dailyLoading ? (
          <div className="py-12 flex flex-col items-center justify-center font-mono text-xs text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>SYNCHRONIZING CAMPUS DAILY DIRECTIVES (IST)...</span>
          </div>
        ) : !dailyData || dailyData.quests.length === 0 ? (
          <div className="py-8 text-center font-mono text-xs text-slate-400">
            No active daily directives found for this rotation cycle.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-5">
            {dailyData.quests.map((quest) => {
              const xp = quest.xpReward ?? quest.rewardXp ?? 0;
              const coins = quest.coinReward ?? quest.rewardCoins ?? 0;
              const pct = Math.min(100, Math.round((quest.currentProgress / (quest.targetCount || 1)) * 100));
              const isClaiming = claimingKey === quest.questKey;

              return (
                <div
                  key={quest.questKey}
                  className={`rounded-2xl p-4 border transition-all flex flex-col justify-between space-y-3.5 relative overflow-hidden ${
                    quest.isClaimed
                      ? "bg-slate-950/60 border-white/5 opacity-80"
                      : quest.isCompleted
                      ? "bg-gradient-to-br from-slate-900 to-amber-950/30 border-amber-500/40 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/20"
                      : "bg-slate-950/80 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="space-y-2">
                    {/* Header: Title and Reward Pills */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">
                          DAILY OBJECTIVE
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          {quest.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] font-bold">
                        <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          +{xp} XP
                        </span>
                        <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          {coins}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 font-mono leading-relaxed">
                      {quest.description}
                    </p>
                  </div>

                  {/* Progress Meter & Claim Section */}
                  <div className="space-y-2.5 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Progress</span>
                      <span className={quest.isCompleted ? "text-emerald-400 font-bold" : "text-slate-300"}>
                        {quest.currentProgress} / {quest.targetCount} ({pct}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          quest.isCompleted
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                            : "bg-emerald-500/70"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Claim Button / Status Badge */}
                    <div className="pt-1">
                      {quest.isClaimed ? (
                        <div className="w-full py-2 rounded-xl bg-slate-900 border border-white/5 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Claimed</span>
                        </div>
                      ) : quest.isCompleted ? (
                        <button
                          type="button"
                          disabled={isClaiming}
                          onClick={() => handleClaimDaily(quest.questKey)}
                          className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-mono font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isClaiming ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Claiming Bounty...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Claim Daily Reward</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="w-full py-2 rounded-xl bg-slate-950 border border-white/5 text-slate-500 font-mono text-xs flex items-center justify-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>In Progress</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                <span className="text-xs font-mono text-amber-400 font-bold flex items-center gap-1.5 flex-wrap">
                  <span>+{nextRecommendedQuest.xpReward} XP</span>
                  <span className="text-slate-600">•</span>
                  <span>+{nextRecommendedQuest.coinReward} Coins</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-300">+{nextRecommendedQuest.trophyReward || (nextRecommendedQuest.difficulty ? nextRecommendedQuest.difficulty * 15 : 25)} 🏆 Trophies</span>
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
                        Difficulty: {renderDifficultyStars(q.difficulty)}
                      </span>
                    </div>

                    {/* Rewards Row */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-200">
                      <span className="text-emerald-400 font-bold">⭐ +{q.xpReward} XP</span>
                      <span className="text-amber-400 font-bold">🪙 +{q.coinReward} Coins</span>
                      <span className="text-amber-300 font-bold">🏆 +{q.trophyReward || (q.difficulty ? q.difficulty * 15 : 25)} Trophies</span>
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
