"use client";

import React, { useState, useEffect } from "react";
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
  Loader2,
  Share2,
  Copy,
  Check,
  Maximize2,
  X,
  Compass,
  ArrowRight,
  ChevronRight,
  Filter,
  Trophy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sfx } from "@/lib/audio/sfx";

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
  const { toast } = useToast();

  // Mobile active tab view: "CLUES" | "EVIDENCE" | "PAYOUT"
  const [mobileTab, setMobileTab] = useState<"CLUES" | "EVIDENCE" | "PAYOUT">("CLUES");

  // Evidence filtering
  const [evidenceFilter, setEvidenceFilter] = useState<"ALL" | "NOTE" | "PHOTO" | "MAP_PIN" | "THEORY">("ALL");

  // Clue solving form
  const [answerInput, setAnswerInput] = useState("");
  const [solving, setSolving] = useState(false);
  const [solveMessage, setSolveMessage] = useState<{ text: string; explanation?: string; error?: boolean } | null>(null);

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
  const [uploadingRecoveryPhoto, setUploadingRecoveryPhoto] = useState(false);
  const [claimResult, setClaimResult] = useState<any>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Lightbox modal for evidence/clue images
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Visibility-aware background polling against /api/investigations/[id] (3-4 second interval)
  useEffect(() => {
    if (investigation.status === "COMPLETED") return;
    let isMounted = true;
    const pollInterval = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(`/api/investigations/${investigation._id}`);
        const json = await res.json();
        if (isMounted && json.success && json.data) {
          const remoteInv = json.data.investigation;
          setInvestigation((prev: any) => {
            if (
              remoteInv.currentStage !== prev.currentStage ||
              remoteInv.status !== prev.status ||
              remoteInv.progressPct !== prev.progressPct ||
              remoteInv.solvedClues?.length !== prev.solvedClues?.length ||
              remoteInv.evidenceNodes?.length !== prev.evidenceNodes?.length ||
              remoteInv.unlockedHintStages?.length !== prev.unlockedHintStages?.length
            ) {
              return remoteInv;
            }
            return prev;
          });
          if (Array.isArray(json.data.clues) && json.data.clues.length > 0) {
            setClues(json.data.clues);
          }
          if (json.data.currentUser?.coins !== undefined) {
            setUserCoins(json.data.currentUser.coins);
          }
        }
      } catch {
        // Silently ignore transient network drops during background sync
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [investigation._id, investigation.status]);

  const handleShareRoom = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      toast({
        title: "Mission Link Copied",
        description: "Investigation room URL copied to clipboard.",
        variant: "success",
      });
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleClaimRecovery = async (customCode?: string) => {
    if (claimingReward) return;
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
      sfx.playLevelUpFanfare();

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

  const handleRecoveryPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingRecoveryPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!json.success) {
        toast({
          title: "Upload Failed",
          description: json.error || "Failed to upload photo",
          variant: "destructive",
        });
        return;
      }

      setClaimPhotoUrl(json.url);
      toast({
        title: "Photo Attached",
        description: "Recovery proof snapshot attached.",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Upload Error",
        description: err.message || "Failed to upload photo",
        variant: "destructive",
      });
    } finally {
      setUploadingRecoveryPhoto(false);
    }
  };

  const currentClue = clues.find((c: any) => c.stageOrder === investigation.currentStage);

  const handleSolveClue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (solving) return;
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
      sfx.playDecryptionStutter();
      setSolveMessage({
        text: json.data?.message || "Stage Solved!",
        explanation: json.data?.explanation || "",
        error: false,
      });
      setAnswerInput("");

      // Immediately refresh investigation state and revealed clues from server
      try {
        const refRes = await fetch(`/api/investigations/${investigation._id}`);
        const refJson = await refRes.json();
        if (refJson.success && refJson.data) {
          setInvestigation(refJson.data.investigation);
          if (Array.isArray(refJson.data.clues) && refJson.data.clues.length > 0) {
            setClues(refJson.data.clues);
          }
          if (refJson.data.currentUser?.coins !== undefined) {
            setUserCoins(refJson.data.currentUser.coins);
          }
        } else {
          // Fallback optimistic update
          setInvestigation((prev: any) => ({
            ...prev,
            currentStage: json.data?.nextStage ?? (prev.currentStage + 1),
            progressPct: json.data?.progressPct ?? prev.progressPct,
            status: json.data?.status ?? prev.status,
            solvedClues: [
              ...(prev.solvedClues || []),
              {
                clueId: currentClue._id,
                stageOrder: currentClue.stageOrder,
                solvedByName: currentUser?.displayName || "You",
                solvedAt: new Date(),
              },
            ],
          }));
        }
      } catch {
        setInvestigation((prev: any) => ({
          ...prev,
          currentStage: json.data?.nextStage ?? (prev.currentStage + 1),
          progressPct: json.data?.progressPct ?? prev.progressPct,
          status: json.data?.status ?? prev.status,
          solvedClues: [
            ...(prev.solvedClues || []),
            {
              clueId: currentClue._id,
              stageOrder: currentClue.stageOrder,
              solvedByName: currentUser?.displayName || "You",
              solvedAt: new Date(),
            },
          ],
        }));
      }
    } catch (e: any) {
      setSolveMessage({ text: e.message || "Failed to submit clue answer.", error: true });
    } finally {
      setSolving(false);
    }
  };

  const handleUnlockHint = async (stageOrder: number) => {
    if (hintLoading) return;
    setHintLoading(true);
    try {
      const res = await fetch(`/api/investigations/${investigation._id}/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageOrder }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({
          title: "Hint Unlock Failed",
          description: json.error || "Failed to unlock hint.",
          variant: "destructive",
        });
        return;
      }

      setUnlockedHints((prev) => ({ ...prev, [stageOrder]: json.data.hintText }));
      setUserCoins(json.data.coinsRemaining);
      toast({
        title: "Hint Decrypted",
        description: "Tactical hint revealed for this investigation stage.",
        variant: "cyber",
      });
    } catch (e: any) {
      toast({
        title: "Network Error",
        description: e.message || "Failed to communicate with investigation server.",
        variant: "destructive",
      });
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
        toast({
          title: "Upload Failed",
          description: json.error || "Failed to upload photo",
          variant: "destructive",
        });
        return;
      }

      setEvidencePhotoUrl(json.url);
      setEvidenceType("PHOTO");
      toast({
        title: "Photo Uploaded",
        description: "Visual evidence attached to docket.",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Upload Error",
        description: err.message || "Failed to upload image",
        variant: "destructive",
      });
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
        toast({
          title: "Evidence Node Logged",
          description: "New intelligence added to the investigation board.",
          variant: "success",
        });
      }
    } catch (e: any) {
      toast({
        title: "Submission Error",
        description: e.message || "Failed to submit evidence node.",
        variant: "destructive",
      });
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

  const filteredEvidence = (investigation.evidenceNodes || []).filter((node: any) => {
    if (evidenceFilter === "ALL") return true;
    return node.type === evidenceFilter;
  });

  const totalClues = clues.length;
  const solvedCount = investigation.solvedClues?.length || 0;

  return (
    <div className="space-y-6">
      {/* Investigation Room Tactical HUD Banner */}
      <div className="rounded-3xl bg-[#111827]/90 border border-white/10 p-5 sm:p-7 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {investigation.isSquadInvestigation ? (
                <span className="px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {squad ? `SQUAD [${squad.tag}] — ${squad.name}` : "SQUAD RAID"}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  SOLO RECON
                </span>
              )}

              <span className="font-mono text-xs text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/25">
                {quest.questCode}
              </span>

              <span
                className={`text-xs font-mono px-2.5 py-1 rounded-full border font-bold uppercase ${
                  investigation.status === "COMPLETED"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : investigation.status === "READY_FOR_RECOVERY"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                }`}
              >
                {investigation.status?.replace(/_/g, " ")}
              </span>

              {/* Hunter Coin Balance */}
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-full border border-white/10">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{userCoins} Coins Available</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              {quest.title}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {quest.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleShareRoom}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-mono text-slate-300 transition-all cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedLink ? "Link Copied" : "Share Mission Room"}</span>
              </button>

              {quest.targetLocationId && (
                <Link
                  href={`/map?locationId=${quest.targetLocationId._id || quest.targetLocationId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-mono text-cyan-300 transition-all"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Target Zone Map</span>
                </Link>
              )}
            </div>
          </div>

          {/* Progress Card */}
          <div className="w-full lg:w-80 bg-slate-950/80 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">MISSION PROGRESS</span>
              <span className="text-emerald-400 font-bold">
                {investigation.progressPct}% COMPLETE
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-500 shadow-sm shadow-emerald-500/50"
                style={{ width: `${investigation.progressPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 pt-1 border-t border-white/5">
              <span className="flex items-center gap-1 text-emerald-300 font-bold">
                ⭐ +{quest.xpReward} XP
              </span>
              <span className="flex items-center gap-1 text-amber-300 font-bold">
                🪙 +{quest.coinReward} Coins
              </span>
              {investigation.isSquadInvestigation && (
                <span className="flex items-center gap-1 text-cyan-300 font-bold">
                  🛡️ +{quest.squadXpReward} Squad XP
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Completion Notification Banner */}
      {investigation.status === "COMPLETED" && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900/90 to-cyan-950/60 border border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.15)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <span>CASE FILE SOLVED & REWARDS DISTRIBUTED</span>
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">ARCHIVED</span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                All clues and verification requirements have been completed. Multi-entry is blocked.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/quests"
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
            >
              <span>Next Quest Board →</span>
            </Link>
          </div>
        </div>
      )}

      {/* Responsive Mobile / Tablet Tab Switcher (< lg) */}
      <div className="lg:hidden flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 font-mono text-xs">
        <button
          type="button"
          onClick={() => setMobileTab("CLUES")}
          className={`flex-1 py-2 px-2 sm:px-3 rounded-xl font-bold transition-all text-[11px] sm:text-xs truncate ${
            mobileTab === "CLUES"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Clues ({solvedCount}/{totalClues})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("EVIDENCE")}
          className={`flex-1 py-2 px-2 sm:px-3 rounded-xl font-bold transition-all text-[11px] sm:text-xs truncate ${
            mobileTab === "EVIDENCE"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Evidence ({investigation.evidenceNodes?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("PAYOUT")}
          className={`flex-1 py-2 px-2 sm:px-3 rounded-xl font-bold transition-all text-[11px] sm:text-xs truncate ${
            mobileTab === "PAYOUT"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          {investigation.isSquadInvestigation ? "Payout" : "Dossier"}
        </button>
      </div>

      {/* Main 3-Column Tactical Board Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Clue Chain & Active Stage Solver */}
        <div
          className={`lg:col-span-4 space-y-4 ${
            mobileTab !== "CLUES" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="rounded-3xl bg-[#111827]/90 border border-white/10 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2 font-bold">
                <Shield className="w-4 h-4 text-emerald-400" />
                Sequential Clue Chain ({solvedCount}/{totalClues})
              </h2>
              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                ACTIVE RECON
              </span>
            </div>

            <div className="space-y-3.5">
              {clues.map((clue: any, index: number) => {
                const solvedRecord = investigation.solvedClues?.find(
                  (s: any) => s.stageOrder === clue.stageOrder
                );
                const isCurrent = investigation.currentStage === clue.stageOrder;
                const isHintAlreadyUnlocked =
                  Boolean(unlockedHints[clue.stageOrder]) ||
                  Boolean(investigation.unlockedHintStages?.includes(clue.stageOrder)) ||
                  Boolean(solvedRecord?.usedHint);
                const hint = unlockedHints[clue.stageOrder] || (isHintAlreadyUnlocked ? clue.hintText : null);

                return (
                  <div
                    key={String(clue._id)}
                    className={`rounded-2xl p-4 border transition-all ${
                      solvedRecord
                        ? "bg-emerald-950/20 border-emerald-500/30"
                        : isCurrent
                        ? "bg-amber-950/25 border-amber-500/50 shadow-md shadow-amber-500/10"
                        : "bg-slate-900/40 border-white/5 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                            solvedRecord
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : isCurrent
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                              : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {clue.stageOrder || index + 1}
                        </span>
                        <span className="text-xs font-mono font-bold text-white">
                          {clue.title}
                        </span>
                      </div>

                      {solvedRecord ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-2 pl-8">
                      {clue.clueText}
                    </p>

                    {/* Unlocked Breadcrumb */}
                    {solvedRecord && (
                      <div className="mt-3 pt-2.5 border-t border-emerald-500/20 pl-8 space-y-1">
                        <div className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                          <span>🔓</span>
                          <span>{clue.unlockedBreadcrumbText}</span>
                        </div>
                        <div className="text-[10px] font-mono text-emerald-400/80">
                          ✓ Solved by {solvedRecord.solvedByName || "Agent"}
                        </div>
                      </div>
                    )}

                    {/* Hint Section */}
                    {isCurrent && !solvedRecord && (
                      <div className="mt-3 pt-2.5 border-t border-white/5 pl-8 space-y-2">
                        {hint ? (
                          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl font-mono leading-relaxed">
                            💡 Hint: {hint}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUnlockHint(clue.stageOrder)}
                            disabled={hintLoading}
                            className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:pointer-events-none cursor-pointer bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl transition-all"
                          >
                            {hintLoading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Decrypting Clue Hint...</span>
                              </>
                            ) : (
                              <>
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>Unlock Hint (-{clue.hintCoinCost || 10} Coins)</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Clue Solver Input Card */}
          {currentClue && investigation.status !== "COMPLETED" && (
            <div className="rounded-3xl bg-slate-900 border border-amber-500/40 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Stage {currentClue.stageOrder} Answer Input
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-white/5">
                  {currentClue.verificationType}
                </span>
              </div>

              <form onSubmit={handleSolveClue} className="space-y-3">
                {currentClue.verificationType === "MULTIPLE_CHOICE" && Array.isArray(currentClue.options) && currentClue.options.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-mono text-slate-400">Select the option corresponding to your deduction:</p>
                    <div className="grid grid-cols-1 gap-2">
                      {currentClue.options.map((opt: any, idx: number) => {
                        const isSelected = answerInput === opt.id;
                        return (
                          <button
                            key={opt.id || idx}
                            type="button"
                            onClick={() => setAnswerInput(opt.id)}
                            className={`w-full p-3 rounded-xl border text-left text-xs font-mono transition-all flex items-start gap-3 cursor-pointer ${
                              isSelected
                                ? "bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/10"
                                : "bg-slate-950/80 border-white/10 text-slate-300 hover:border-white/20 hover:bg-slate-950"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                isSelected ? "bg-amber-400 text-slate-950" : "bg-white/10 text-slate-400"
                              }`}
                            >
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="leading-relaxed">{opt.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder={
                      currentClue.verificationType === "NUMERIC_CALCULATION"
                        ? "Enter calculated numeric value (e.g. 7000)..."
                        : "Enter riddle answer or marker code..."
                    }
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400 font-mono"
                  />
                )}

                <button
                  type="submit"
                  disabled={solving || !answerInput.trim()}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {solving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying with Campus Ledger...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Stage Answer</span>
                    </>
                  )}
                </button>
              </form>

              {solveMessage && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-mono space-y-1.5 ${
                    solveMessage.error
                      ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                      : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {solveMessage.error ? (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    )}
                    <span className="font-bold">{solveMessage.text}</span>
                  </div>
                  {solveMessage.explanation && (
                    <div className="pl-6 text-[11px] text-emerald-400/90 leading-relaxed border-t border-emerald-500/20 pt-1.5 mt-1">
                      💡 <span className="font-bold text-white">Syllabus Explanation:</span> {solveMessage.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 2: Shared Field Evidence Corkboard */}
        <div
          className={`lg:col-span-5 space-y-4 ${
            mobileTab !== "EVIDENCE" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="rounded-3xl bg-[#111827]/90 border border-white/10 p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-mono uppercase tracking-wider text-white font-bold">
                  Field Evidence Corkboard ({investigation.evidenceNodes?.length || 0})
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowEvidenceModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Pin Evidence</span>
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
              {(["ALL", "NOTE", "PHOTO", "MAP_PIN", "THEORY"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setEvidenceFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    evidenceFilter === filter
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold"
                      : "bg-slate-950 text-slate-400 border-white/5 hover:text-white"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Evidence nodes */}
            <div className="space-y-3">
              {filteredEvidence.length === 0 ? (
                <div className="text-center py-14 text-slate-500 text-xs font-mono border border-dashed border-white/10 rounded-2xl p-6">
                  <Camera className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p>No field evidence pinned in this category.</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {investigation.isSquadInvestigation
                      ? "Click “Pin Evidence” to share findings or sightings with your squad."
                      : "Record field notes and observations for your case dossier."}
                  </p>
                </div>
              ) : (
                filteredEvidence.map((node: any, idx: number) => {
                  const upvoted = currentUser && node.upvotes?.includes(currentUser.id);
                  return (
                    <div
                      key={node._id || idx}
                      className="rounded-2xl bg-slate-950/80 border border-white/10 p-4 hover:border-cyan-500/40 transition-all space-y-2.5"
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
                        <div
                          onClick={() => setLightboxImage({ url: node.photoUrl, title: node.title })}
                          className="relative rounded-xl overflow-hidden border border-white/10 max-h-52 bg-black/40 group cursor-pointer"
                        >
                          <img
                            src={node.photoUrl}
                            alt={node.title}
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (!target.src.endsWith("/placeholder-item.png")) {
                                target.src = "/placeholder-item.png";
                              }
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <Maximize2 className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => handleUpvoteEvidence(node._id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all cursor-pointer ${
                            upvoted
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-slate-900 text-slate-400 hover:text-white border border-white/5"
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

        {/* Column 3: Squad Payout & Recovery Action */}
        <div
          className={`lg:col-span-3 space-y-4 ${
            mobileTab !== "PAYOUT" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="rounded-3xl bg-[#111827]/90 border border-white/10 p-5 space-y-4 shadow-xl">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2 font-bold border-b border-white/10 pb-3">
              {investigation.isSquadInvestigation ? (
                <>
                  <Users className="w-4 h-4 text-cyan-400" />
                  Squad Payout & Recovery
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Hunter Case Dossier & Payout
                </>
              )}
            </h2>

            <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/25 space-y-2">
              <div className="text-[11px] font-mono text-emerald-400 uppercase font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Unlocked Target Zone</span>
              </div>
              <div className="text-sm font-bold text-white">
                {quest.restrictedRoomNote || (quest.targetLocationId?.name || "Campus Main Gate")}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {investigation.isSquadInvestigation
                  ? `Participating squad hunters earn 100% Base XP (${quest.xpReward} XP) and Coins (${quest.coinReward} Coins). Submitting finder earns +15% Finder Bonus.`
                  : `Solo Recon operatives earn 100% Base XP (${quest.xpReward} XP) and Coins (${quest.coinReward} Coins) directly credited to your account.`}
              </p>
            </div>

            {/* Final Recovery Button */}
            {investigation.status === "COMPLETED" ? (
              <div className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs font-mono bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>INVESTIGATION COMPLETED & CREDITED</span>
              </div>
            ) : quest.linkedLostItemId ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(true)}
                  disabled={solvedCount < totalClues && investigation.status !== "READY_FOR_RECOVERY"}
                  className="w-full py-3 px-4 rounded-2xl font-bold text-xs font-mono bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Award className="w-4 h-4" />
                  <span>
                    {solvedCount < totalClues && investigation.status !== "READY_FOR_RECOVERY"
                      ? `SOLVE ALL CLUES TO UNLOCK (${solvedCount}/${totalClues})`
                      : "VERIFY RECOVERY & HANDOVER"}
                  </span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
                <Link
                  href={`/items/${quest.linkedLostItemId._id || quest.linkedLostItemId}`}
                  className="block text-center text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  View item custody ticket →
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleClaimRecovery()}
                disabled={claimingReward || (investigation.status !== "READY_FOR_RECOVERY" && solvedCount < totalClues)}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs font-mono bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>{claimingReward ? "Verifying with Campus Ledger..." : "CLAIM TREASURE REWARD"}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Evidence Modal */}
      {showEvidenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="rounded-3xl bg-slate-900 border border-white/10 p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Pin Field Evidence to Corkboard
              </h3>
              <button
                type="button"
                onClick={() => setShowEvidenceModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEvidence} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Evidence Type</label>
                <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                  {(["NOTE", "MAP_PIN", "PHOTO", "THEORY"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEvidenceType(t)}
                      className={`py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
                        evidenceType === t
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-slate-950 text-slate-400 border-white/5 hover:text-white"
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
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.endsWith("/placeholder-item.png")) {
                          target.src = "/placeholder-item.png";
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEvidenceModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvidence || !evidenceTitle || !evidenceContent}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-cyan-500/20"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="rounded-3xl bg-slate-900 border border-emerald-500/30 p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-400" />
                Verify Item Recovery & Safe Handover
              </h3>
              <button
                type="button"
                onClick={() => setShowRecoveryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Provide the 6-digit physical handover code from the verified owner or Safe-Desk staff, or attach recovery notes for administrative review.
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

              {/* Photo Evidence in Recovery Modal */}
              <div className="space-y-2 p-3 rounded-xl bg-slate-950/70 border border-white/5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    Attach Recovery Photo / Handover Receipt (Optional)
                  </span>
                  {uploadingRecoveryPhoto && <span className="text-cyan-400 animate-pulse">Uploading...</span>}
                </div>

                <div className="flex items-center gap-2">
                  <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-white/10 flex items-center gap-1.5 transition-all">
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Take Photo / Browse</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleRecoveryPhotoUpload}
                      disabled={uploadingRecoveryPhoto}
                      className="hidden"
                    />
                  </label>
                  {claimPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setClaimPhotoUrl("")}
                      className="text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>

                {claimPhotoUrl && (
                  <div className="relative mt-2 rounded-lg overflow-hidden border border-white/10 h-24 max-w-xs bg-black/40">
                    <img
                      src={claimPhotoUrl}
                      alt="Recovery snapshot"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.endsWith("/placeholder-item.png")) {
                          target.src = "/placeholder-item.png";
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleClaimRecovery()}
                  disabled={claimingReward}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  {claimingReward ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Settling Handover Ledger...</span>
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4" />
                      <span>Submit Verification</span>
                    </>
                  )}
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

            {(claimResult.rewards || claimResult.xpAwarded !== undefined) && (() => {
              const xpVal = claimResult.rewards?.xp ?? claimResult.xpAwarded ?? 0;
              const coinsVal = claimResult.rewards?.coins ?? claimResult.coinsAwarded ?? 0;
              const trophiesVal = claimResult.rewards?.trophies ?? claimResult.trophiesAwarded ?? 25;

              return (
                <div className="grid grid-cols-3 gap-2.5 p-4 rounded-2xl bg-slate-950/80 border border-white/10 font-mono">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-[10px] text-emerald-400 uppercase font-bold">XP Earned</div>
                    <div className="text-base font-black text-white">+{xpVal}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="text-[10px] text-amber-400 uppercase font-bold">Coins</div>
                    <div className="text-base font-black text-white">+{coinsVal} 🪙</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-400/15 border border-amber-400/30 shadow-md">
                    <div className="text-[10px] text-amber-300 uppercase font-bold">Trophies</div>
                    <div className="text-base font-black text-amber-300">+{trophiesVal} 🏆</div>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/quests"
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all text-center flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/25"
              >
                <span>Find Next Quest →</span>
              </Link>
              <Link
                href="/dashboard"
                className="w-full py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs font-mono transition-all text-center"
              >
                Return to Investigator HQ
              </Link>
              <button
                type="button"
                onClick={() => setClaimResult(null)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all cursor-pointer"
              >
                Close & Review Case File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[85vh] rounded-3xl overflow-hidden border border-white/20 bg-slate-950 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/80">
              <div className="font-mono text-xs text-slate-300 font-bold flex items-center gap-2 truncate">
                <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate">{lightboxImage.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 bg-black/60 overflow-hidden">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith("/placeholder-item.png")) {
                    target.src = "/placeholder-item.png";
                  }
                }}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
