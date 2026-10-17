"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Compass,
  MapPin,
  Coins,
  Shield,
  Users,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
  AlertCircle,
} from "lucide-react";

export default function QuestBriefingPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [quest, setQuest] = useState<any>(null);
  const [clues, setClues] = useState<any[]>([]);
  const [investigation, setInvestigation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/quests/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setQuest(d.data.quest);
          setClues(d.data.clues || []);
          setInvestigation(d.data.investigation || null);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleStart = async (asSquad: boolean) => {
    setDeploying(true);
    try {
      const res = await fetch(`/api/quests/${id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asSquad }),
      });
      const json = await res.json();
      if (json.success && json.data?.investigationId) {
        router.push(`/investigations/${json.data.investigationId}`);
      } else {
        alert(json.error || "Please log in.");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center font-mono text-slate-500 animate-pulse">
        DECRYPTING MISSION BRIEFING...
      </div>
    );
  }

  if (!quest) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Mission Not Found</h2>
        <Link href="/quests" className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-mono">
          Return to Quest Board
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <Link
          href="/quests"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Quest Board
        </Link>
      </div>

      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono uppercase font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {quest.questType} MISSION
              </span>
              <span className="font-mono text-xs text-amber-400 font-bold">
                {quest.questCode}
              </span>
            </div>
            <h1 className="text-3xl font-black text-white">{quest.title}</h1>
          </div>

          <div className="flex items-center gap-3">
            {investigation ? (
              <Link
                href={`/investigations/${investigation._id}`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-emerald-500/20"
              >
                Resume Active Room ({investigation.progressPct}% Done) →
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStart(false)}
                  disabled={deploying}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all"
                >
                  {deploying ? "Deploying..." : "Start Solo Recon"}
                </button>
                <button
                  onClick={() => handleStart(true)}
                  disabled={deploying}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  Squad Raid
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-xs font-mono text-slate-400 uppercase">Mission Objective</div>
          <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-5 rounded-2xl border border-white/5">
            {quest.description}
          </p>
        </div>

        {/* Rewards and Parameters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3.5 text-center">
            <div className="text-emerald-400 font-mono font-black text-lg">+{quest.xpReward}</div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Hunter XP</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3.5 text-center">
            <div className="text-amber-400 font-mono font-black text-lg">+{quest.coinReward}</div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Hunter Coins</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3.5 text-center">
            <div className="text-cyan-400 font-mono font-black text-lg">+{quest.squadXpReward}</div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Squad XP</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3.5 text-center">
            <div className="text-violet-400 font-mono font-black text-lg">
              {"★".repeat(quest.difficulty)}
            </div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Difficulty</div>
          </div>
        </div>

        {/* Sequential Clue Chain Blueprint */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <div className="text-xs font-mono text-slate-400 uppercase">
            Sequential Investigation Steps ({clues.length} Stages)
          </div>

          <div className="space-y-3">
            {clues.map((clue, idx) => (
              <div
                key={clue._id}
                className="rounded-xl bg-slate-950/40 border border-white/5 p-4 flex items-start gap-4"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-800 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                  {clue.stageOrder}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-sm text-white">{clue.title}</div>
                  <div className="text-xs text-slate-400">
                    Verification Type: <span className="font-mono text-cyan-400">{clue.verificationType}</span>
                    {clue.targetLocationId && (
                      <span className="ml-3 text-slate-400">
                        📍 {clue.targetLocationId.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

