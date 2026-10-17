"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Shield,
  CheckCircle2,
  MapPin,
  Camera,
  FileText,
  Sparkles,
  Lock,
  ArrowUpRight,
  Users,
  Award,
  HelpCircle,
  Coins,
  ThumbsUp,
  PlusCircle,
  AlertCircle,
  Clock,
  Send,
} from "lucide-react";

interface Props {
  initialInvestigation: any;
  quest: any;
  initialClues: any[];
  squad: any;
  currentUser: any;
}

export default function InvestigationRoomClient({
  initialInvestigation,
  quest,
  initialClues,
  squad,
  currentUser,
}: Props) {
  const [investigation, setInvestigation] = useState(initialInvestigation);
  const [clues, setClues] = useState(initialClues);
  const [userCoins, setUserCoins] = useState(currentUser?.coins ?? 50);

  // Clue solving form
  const [answerInput, setAnswerInput] = useState("");
  const [solving, setSolving] = useState(false);
  const [solveMessage, setSolveMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Hint unlocking
  const [hintLoading, setHintLoading] = useState(false);
  const [unlockedHints, setUnlockedHints] = useState<Record<number, string>>({});

  // Add evidence modal
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceType, setEvidenceType] = useState<"THEORY" | "NOTE" | "PHOTO" | "MAP_PIN">("NOTE");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceContent, setEvidenceContent] = useState("");
  const [evidencePhotoUrl, setEvidencePhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  // Recovery modal & claiming
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [claimingReward, setClaimingReward] = useState(false);
  const [claimHandoverCode, setClaimHandoverCode] = useState("");
  const [claimRecoveryNotes, setClaimRecoveryNotes] = useState("");
  const [claimPhotoUrl, setClaimPhotoUrl] = useState("");
  const [claimResult, setClaimResult] = useState<any>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const handleClaimRecovery = async (customCode?: string) => {
    setClaimingReward(true);
    setClaimError(null);
    try {
      const codeToSend = customCode || (claimHandoverCode.trim() ? claimHandoverCode.trim() : undefined);
      const res = await fetch(`/api/investigations/${investigation._id}/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handoverCode: codeToSend,
          recoveryNotes: claimRecoveryNotes.trim() || undefined,
          photoUrl: claimPhotoUrl || undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setClaimError(json.error?.message || "Failed to process recovery claim.");
        return;
      }

      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([100, 50, 150]);
      }

      setInvestigation((prev: any) => ({
        ...prev,
        status: json.data?.status || "COMPLETED",
        progressPct: 100,
      }));
      setClaimResult(json.data);
      setShowRecoveryModal(false);
    } catch (e: any) {
      setClaimError(e.message || "Failed to process recovery.");
    } finally {
      setClaimingReward(false);
    }
  };

  const currentClue = clues.find((c: any) => c.stageOrder === investigation.currentStage);

  const handleSolveClue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || !currentClue) return;

    setSolving(true);
    setSolveMessage(null);

    try {
      const res = await fetch(`/api/quests/${quest._id}/solve-clue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageOrder: currentClue.stageOrder,
          submittedAnswer: answerInput.trim(),
          investigationId: investigation._id,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([60, 60, 60]);
        }
        setSolveMessage({ text: json.error?.message || "Incorrect clue answer. Try again!", error: true });
        return;
      }

      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(120);
      }
      setSolveMessage({ text: json.data?.message || "Stage Solved!", error: false });
      setAnswerInput("");

      // Update investigation state
      setInvestigation((prev: any) => ({
        ...prev,
        currentStage: json.data?.isQuestComplete ? prev.currentStage : prev.currentStage + 1,
        progressPct: json.data?.progressPct ?? prev.progressPct,
        status: json.data?.isQuestComplete ? "READY_FOR_RECOVERY" : prev.status,
        solvedClues: [
          ...prev.solvedClues,
          {
            clueId: currentClue._id,
            stageOrder: currentClue.stageOrder,
            solvedByName: currentUser?.displayName || "You",
            solvedAt: new Date(),
          },
        ],
      }));
    } catch (e: any) {
      setSolveMessage({ text: e.message || "Failed to submit clue answer.", error: true });
    } finally {
      setSolving(false);
    }
  };

  const handleUnlockHint = async (stageOrder: number) => {
    setHintLoading(true);
    try {
      const res = await fetch(`/api/investigations/${investigation._id}/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageOrder }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Failed to unlock hint.");
        return;
      }

      setUnlockedHints((prev) => ({ ...prev, [stageOrder]: json.data.hintText }));
      setUserCoins(json.data.coinsRemaining);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setHintLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Failed to upload photo");
        return;
      }

      setEvidencePhotoUrl(json.url);
      setEvidenceType("PHOTO");
    } catch (err: any) {
      alert(err.message || "Upload error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceTitle || !evidenceContent) return;

    setSubmittingEvidence(true);
    try {
      const res = await fetch(`/api/investigations/${investigation._id}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: evidenceType,
          title: evidenceTitle,
          content: evidenceContent,
          photoUrl: evidencePhotoUrl || undefined,
          linkedStageOrder: investigation.currentStage,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setInvestigation((prev: any) => ({
          ...prev,
          evidenceNodes: json.data,
        }));
        setEvidenceTitle("");
        setEvidenceContent("");
        setEvidencePhotoUrl("");
        setShowEvidenceModal(false);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const handleUpvoteEvidence = async (evidenceId: string) => {
    try {
      const res = await fetch(`/api/investigations/${investigation._id}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPVOTE",
          evidenceId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setInvestigation((prev: any) => ({
          ...prev,
          evidenceNodes: json.data,
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Investigation Room Banner */}
      <div className="rounded-2xl bg-[#111827]/90 border border-white/10 p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                {squad ? `SQUAD [${squad.tag}] — ${squad.name}` : "SOLO RECON"}
              </span>
              <span className="font-mono text-sm text-amber-400 font-bold">
                {quest.questCode}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Status: <span className="text-white font-bold">{investigation.status}</span>
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              {quest.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              {quest.description}
            </p>
          </div>

          <div className="w-full lg:w-80 bg-slate-950/80 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">INVESTIGATION PROGRESS</span>
              <span className="text-emerald-400 font-bold">
                {investigation.progressPct}% COMPLETE
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${investigation.progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 pt-1 border-t border-white/5">
              <span>⭐ {quest.xpReward} XP</span>
              <span>🪙 {quest.coinReward} Coins</span>
              <span>🛡️ {quest.squadXpReward} Squad XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Column Corkboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Clue Chain & Active Stage Solver */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl bg-[#111827]/90 border border-white/10 p-5 space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Sequential Clue Chain
            </h2>

            <div className="space-y-4">
              {clues.map((clue: any) => {
                const solvedRecord = investigation.solvedClues?.find(
                  (s: any) => s.stageOrder === clue.stageOrder
                );
                const isCurrent = investigation.currentStage === clue.stageOrder;
                const hint = unlockedHints[clue.stageOrder] || (solvedRecord?.usedHint ? clue.hintText : null);

                return (
                  <div
                    key={String(clue._id)}
                    className={`rounded-xl p-4 border transition-all ${
                      solvedRecord
                        ? "bg-emerald-950/20 border-emerald-500/30"
                        : isCurrent
                        ? "bg-amber-950/20 border-amber-500/40"
                        : "bg-slate-900/40 border-white/5 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                        {clue.title}
                      </span>
                      {solvedRecord ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Lock className="w-4 h-4 text-slate-500" />
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-2">
                      {clue.clueText}
                    </p>

                    {/* Unlocked Breadcrumb */}
                    {solvedRecord && (
                      <div className="mt-3 pt-2.5 border-t border-emerald-500/20 space-y-1">
                        <div className="text-xs text-emerald-300 font-semibold">
                          🔓 {clue.unlockedBreadcrumbText}
                        </div>
                        <div className="text-[10px] font-mono text-emerald-400/80">
                          ✓ Solved by {solvedRecord.solvedByName || "Agent"}
                        </div>
                      </div>
                    )}

                    {/* Hint Section */}
                    {isCurrent && !solvedRecord && (
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        {hint ? (
                          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg font-mono">
                            💡 Hint: {hint}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUnlockHint(clue.stageOrder)}
                            disabled={hintLoading}
                            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-400 hover:text-amber-300"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            Unlock Hint (-{clue.hintCoinCost || 10} Coins)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Clue Solver Card */}
          {currentClue && investigation.status !== "COMPLETED" && (
            <div className="rounded-2xl bg-slate-900 border border-amber-500/30 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                  Stage {currentClue.stageOrder} Input
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {currentClue.verificationType}
                </span>
              </div>

              <form onSubmit={handleSolveClue} className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter riddle answer or marker code..."
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
                />

                <button
                  type="submit"
                  disabled={solving}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  {solving ? "Verifying with Campus Ledger..." : "Submit Clue Answer"}
                </button>
              </form>

              {solveMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-mono flex items-center gap-2 ${
                    solveMessage.error
                      ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                      : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                  }`}
                >
                  {solveMessage.error ? (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{solveMessage.text}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Column: Shared Evidence Corkboard */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl bg-[#111827]/90 border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-mono uppercase tracking-wider text-white font-bold">
                  Field Evidence Corkboard
                </h2>
              </div>
              <button
                onClick={() => setShowEvidenceModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Pin Evidence
              </button>
            </div>

            <div className="space-y-3">
              {investigation.evidenceNodes?.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-mono">
                  No evidence pinned yet. Be the first to add notes or sightings!
                </div>
              ) : (
                investigation.evidenceNodes?.map((node: any, idx: number) => {
                  const upvoted = currentUser && node.upvotes?.includes(currentUser.id);
                  return (
                    <div
                      key={node._id || idx}
                      className="rounded-xl bg-slate-950/80 border border-white/10 p-4 hover:border-cyan-500/40 transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                          {node.type === "PHOTO" && <Camera className="w-3 h-3" />}
                          {node.type === "MAP_PIN" && <MapPin className="w-3 h-3" />}
                          {node.type === "THEORY" && <FileText className="w-3 h-3" />}
                          {node.type} {node.linkedStageOrder ? `• STAGE ${node.linkedStageOrder}` : ""}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          By {node.authorName}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white">{node.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {node.content}
                      </p>

                      {node.photoUrl && (
                        <div className="rounded-lg overflow-hidden border border-white/10 max-h-48 bg-black/40">
                          <img
                            src={node.photoUrl}
                            alt={node.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                        <button
                          onClick={() => handleUpvoteEvidence(node._id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all ${
                            upvoted
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-slate-900 text-slate-400 hover:text-white"
                          }`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>{node.upvotes?.length || 0} Upvotes</span>
                        </button>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(node.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Squad Payout & Recovery Action */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl bg-[#111827]/90 border border-white/10 p-5 space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Squad Payout & Recovery
            </h2>

            <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/25 space-y-2">
              <div className="text-xs font-mono text-emerald-400 uppercase font-bold">
                Unlocked Target Zone
              </div>
              <div className="text-sm font-bold text-white">
                {quest.restrictedRoomNote || (quest.targetLocationId?.name || "Campus Main Gate")}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Participating hunters earn 100% Base XP ({quest.xpReward} XP) and Coins ({quest.coinReward} Coins). Submitting finder earns +15% Finder Bonus.
              </p>
            </div>

            {/* Final Recovery Button */}
            {investigation.status === "COMPLETED" ? (
              <div className="w-full py-3.5 px-4 rounded-xl font-bold text-xs font-mono bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>INVESTIGATION COMPLETED & CREDITED</span>
              </div>
            ) : quest.linkedLostItemId ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(true)}
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs font-mono bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Award className="w-4 h-4" />
                  VERIFY RECOVERY & HANDOVER
                  <ArrowUpRight className="w-4 h-4" />
                </button>
                <Link
                  href={`/items/${quest.linkedLostItemId._id || quest.linkedLostItemId}`}
                  className="block text-center text-[11px] font-mono text-cyan-400 hover:text-cyan-300"
                >
                  View item custody ticket →
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleClaimRecovery()}
                disabled={claimingReward || (investigation.status !== "READY_FOR_RECOVERY" && investigation.progressPct < 90)}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs font-mono bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Award className="w-4 h-4" />
                {claimingReward ? "Verifying with Campus Ledger..." : "CLAIM TREASURE REWARD"}
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Evidence Modal */}
      {showEvidenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="rounded-2xl bg-slate-900 border border-white/10 p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Pin Field Evidence to Corkboard
            </h3>

            <form onSubmit={handleAddEvidence} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Evidence Type</label>
                <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                  {(["NOTE", "MAP_PIN", "PHOTO", "THEORY"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEvidenceType(t)}
                      className={`py-1.5 rounded-lg border font-bold transition-all ${
                        evidenceType === t
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-slate-950 text-slate-400 border-white/5"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Headline / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sighted near Library 2nd floor staircase"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Observation Details *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide precise observation, table number, or deduction..."
                  value={evidenceContent}
                  onChange={(e) => setEvidenceContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 leading-relaxed"
                />
              </div>

              {/* Photo Evidence / Camera Capture */}
              <div className="space-y-2 p-3 rounded-xl bg-slate-950/70 border border-white/5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    Attach Field Photo / Snapshot
                  </span>
                  {uploadingPhoto && <span className="text-cyan-400 animate-pulse">Uploading...</span>}
                </div>

                <div className="flex items-center gap-2">
                  <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-white/10 flex items-center gap-1.5 transition-all">
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Take Photo / Browse</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="hidden"
                    />
                  </label>
                  {evidencePhotoUrl && (
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Photo Attached
                    </span>
                  )}
                </div>

                {evidencePhotoUrl && (
                  <div className="relative mt-2 rounded-lg overflow-hidden border border-white/10 h-28 bg-black/40">
                    <img
                      src={evidencePhotoUrl}
                      alt="Uploaded evidence"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEvidenceModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvidence}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all"
                >
                  {submittingEvidence ? "Pinning..." : "Pin to Corkboard"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recovery Submission Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="rounded-2xl bg-slate-900 border border-emerald-500/30 p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              Verify Item Recovery & Safe Handover
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Provide the 6-digit physical handover code from the verified owner or Safe-Desk staff, or attach photo evidence for administrative review.
            </p>

            {claimError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{claimError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">
                  6-Digit Handover Code (Instant Reward Payout)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 849201"
                  value={claimHandoverCode}
                  onChange={(e) => setClaimHandoverCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-emerald-400 font-mono tracking-widest text-center text-lg font-bold focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink mx-3 text-[10px] font-mono uppercase text-slate-500">
                  Or Submit Evidence for Review
                </span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Observation / Recovery Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Deposited item with Library Safe-Desk Staff Officer..."
                  value={claimRecoveryNotes}
                  onChange={(e) => setClaimRecoveryNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleClaimRecovery()}
                  disabled={claimingReward}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2"
                >
                  <Award className="w-4 h-4" />
                  {claimingReward ? "Submitting..." : "Submit Verification"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Claim Celebration Modal */}
      {claimResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in zoom-in-95">
          <div className="rounded-3xl bg-slate-900 border border-emerald-500/40 p-8 max-w-md w-full text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-400" />
            
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 mx-auto flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <Award className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-white tracking-tight">
                MISSION ACCOMPLISHED!
              </h3>
              <p className="text-xs text-slate-300 font-mono leading-relaxed">
                {claimResult.message || "Your investigation has been verified and recorded to the campus ledger."}
              </p>
            </div>

            {claimResult.rewards && (
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950/80 border border-white/10 font-mono">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[10px] text-emerald-400 uppercase font-bold">XP Earned</div>
                  <div className="text-lg font-black text-white">+{claimResult.rewards.xp}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[10px] text-amber-400 uppercase font-bold">Coins Awarded</div>
                  <div className="text-lg font-black text-white">+{claimResult.rewards.coins} 🪙</div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/dashboard"
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all text-center"
              >
                Return to Investigator HQ
              </Link>
              <button
                type="button"
                onClick={() => setClaimResult(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
              >
                Close & Review Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

