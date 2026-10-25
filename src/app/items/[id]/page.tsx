"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  MapPin,
  Clock,
  Lock,
  Compass,
  Coins,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Building,
  User,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ItemDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Claim Form State
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [answerProvided, setAnswerProvided] = useState("");
  const [proofText, setProofText] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<any>(null);

  // Handover Verification State
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);

  const fetchItem = async () => {
    try {
      const res = await fetch(`/api/items/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setItem(json.data);
      } else {
        setError(typeof json.error === "object" ? json.error.message : json.error || "Item not found");
      }
    } catch (e: any) {
      setError(e.message || "Failed to load item.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchItem();
  }, [id]);

  const { toast } = useToast();

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimLoading(true);
    try {
      const res = await fetch(`/api/items/${id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerProvided,
          proofText,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        const errorMsg = json.error?.message || (typeof json.error === "string" ? json.error : "Claim submission failed.");
        throw new Error(errorMsg);
      }
      setClaimSuccess(json.data);
      toast({
        title: "Claim Submitted Successfully",
        description: json.data?.autoApproved
          ? "Verification answer matched! 6-digit recovery code generated."
          : "Your claim has been submitted to the finder/staff for review.",
        variant: "success",
      });
      fetchItem();
    } catch (err: any) {
      toast({
        title: "Claim Submission Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setClaimLoading(false);
    }
  };

  const handleVerifyHandover = async (claimId: string) => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast({
        title: "Code Required",
        description: "Please enter the exact 6-digit handover recovery code.",
        variant: "destructive",
      });
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/claims/verify-handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId,
          handoverCode: verifyCode,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || json.error || "Verification failed");
      }
      setVerifySuccess("Handover verified! Rewards distributed and item marked as RECOVERED.");
      toast({
        title: "Handover Verified!",
        description: "Cryptographic PIN match confirmed. Item recovered & rewards deposited.",
        variant: "success",
      });
      fetchItem();
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center font-mono text-slate-500 animate-pulse">
        RETRIEVING ITEM RECORD FROM SECURE LEDGER...
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Record Not Found</h2>
        <p className="text-xs text-slate-400">{error}</p>
        <Link
          href="/lost-and-found"
          className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-mono font-bold"
        >
          Return to Lost & Found
        </Link>
      </div>
    );
  }

  const isLost = item.itemType === "LOST";
  const location = isLost ? item.lastKnownLocationId : item.foundLocationId;
  const custody = item.currentCustodyLocationId;
  const isOwner = item.isOwner;
  const isStaff = item.isStaff;

  const states = ["ACTIVE", "CLAIMED", "VERIFICATION", "RECOVERED", "COMPLETED"];
  const currentStateIdx = states.indexOf(item.status);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/lost-and-found"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Lost & Found Directory
        </Link>
      </div>

      {/* Main Item Card */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                  isLost
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {item.itemType} BELONGING
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-white/10">
                {item.category}
              </span>
              {isOwner && (
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                  YOU ARE THE REPORTER
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">{item.title}</h1>
          </div>

          <div className="flex items-center gap-3">
            {item.linkedQuestId && (
              <Link
                href={`/quests/${item.linkedQuestId._id || item.linkedQuestId}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all"
              >
                <Compass className="w-4 h-4" />
                Active Investigation Room
              </Link>
            )}
          </div>
        </div>

        {/* State Machine Visualizer */}
        <div className="space-y-2 py-2">
          <div className="text-[11px] font-mono uppercase text-slate-400">
            Lifecycle State Machine
          </div>
          <div className="grid grid-cols-5 gap-2">
            {states.map((st, idx) => {
              const passed = idx <= currentStateIdx;
              const isCurrent = idx === currentStateIdx;
              return (
                <div
                  key={st}
                  className={`rounded-xl p-2.5 text-center border font-mono text-[10px] uppercase font-bold transition-all ${
                    isCurrent
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/10"
                      : passed
                      ? "bg-slate-900 border-white/10 text-slate-300"
                      : "bg-slate-950/40 border-white/5 text-slate-600"
                  }`}
                >
                  <div className="truncate">{st}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Public Description & Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-xs font-mono text-slate-400">Public Description</div>
              <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-white/5">
                {item.publicDescription}
              </p>
            </div>

            {(item.hasVerificationQuestion || item.verificationQuestion) && (
              <div className="space-y-1">
                <div className="text-xs font-mono text-cyan-400 flex items-center gap-1.5 bg-cyan-950/20 border border-cyan-500/20 p-3 rounded-xl">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Ownership Verification Protected — Answer required during authenticated claim</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-950/60 border border-white/5 p-4 space-y-3">
              <div className="text-xs font-mono uppercase text-slate-400 border-b border-white/5 pb-2">
                Campus Location Coordinates
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">{location?.name || "AIEM Campus"}</div>
                  {item.spotDetails && (
                    <div className="text-slate-400 mt-0.5">{item.spotDetails}</div>
                  )}
                </div>
              </div>

              {custody && (
                <div className="flex items-start gap-2.5 text-xs text-slate-300 pt-2 border-t border-white/5">
                  <Building className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-emerald-400">
                      Safe-Desk Custody: {custody.name}
                    </div>
                    <div className="text-slate-400 text-[11px] font-mono">
                      {custody.operatingHours || "24/7 Monitored"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reporter details */}
            <div className="rounded-2xl bg-slate-950/60 border border-white/5 p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-slate-300">
                  {item.reporterId?.displayName ? item.reporterId.displayName.charAt(0) : item.finderId?.displayName ? item.finderId.displayName.charAt(0) : <Shield className="w-4 h-4 text-cyan-400" />}
                </div>
                <div>
                  <div className="font-bold text-white">
                    {item.reporterId?.displayName || item.finderId?.displayName || "Verified AIEM Member"}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Reported on {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {item.rewardOffered > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
                  <Coins className="w-3.5 h-3.5" />
                  +{item.rewardOffered} Bounty
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Claim & Dual Handover Verification Hub */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              Claim & Verification Handover Protocol
            </h2>
            <p className="text-xs text-slate-400">
              Ethical Dual-Code Handover: Once identity is established, a 6-digit cryptographic code completes the physical recovery.
            </p>
          </div>
        </div>

        {verifySuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{verifySuccess}</span>
          </div>
        )}

        {/* If Owner / Moderator: Review Claims & Enter 6-digit handover code */}
        {isOwner || isStaff ? (
          <div className="space-y-4">
            <div className="text-xs font-mono uppercase text-slate-400">
              Active Claim Requests ({item.claims?.length || 0})
            </div>

            {item.claims && item.claims.length > 0 ? (
              item.claims.map((claim: any) => (
                <div
                  key={claim._id}
                  className="rounded-2xl bg-slate-950/80 border border-white/10 p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        Claim from: {claim.claimantId?.displayName} (@{claim.claimantId?.username})
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300">
                        {claim.status}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {new Date(claim.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    {(claim.submittedAnswer || claim.proofDetails?.answerProvided) && (
                      <div>
                        <span className="text-slate-400 font-mono">Answer Submitted: </span>
                        <span className="text-emerald-400 font-mono font-bold">
                          &ldquo;{claim.submittedAnswer || claim.proofDetails?.answerProvided}&rdquo;
                        </span>
                      </div>
                    )}
                    {(claim.notes || claim.proofDetails?.proofText) && (
                      <div>
                        <span className="text-slate-400 font-mono">Claimant Statement: </span>
                        <span className="text-slate-200">{claim.notes || claim.proofDetails?.proofText}</span>
                      </div>
                    )}
                  </div>

                  {claim.status === "APPROVED" && (
                    <div className="pt-3 border-t border-white/5 space-y-3">
                      <div className="text-xs font-mono text-amber-400 flex items-center gap-1.5 font-bold">
                        <Lock className="w-3.5 h-3.5" />
                        Handover Ready: Enter Claimant&apos;s 6-Digit Code
                      </div>
                      <p className="text-xs text-slate-400">
                        Ask the claimant or Safe-Desk officer for their 6-digit recovery code to complete the verification.
                      </p>

                      <div className="flex items-center gap-3 max-w-sm">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="6-DIGIT CODE"
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value.trim())}
                          className="w-40 px-3 py-2 rounded-xl bg-slate-900 border border-white/20 text-center font-mono text-sm tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                        <button
                          onClick={() => handleVerifyHandover(claim._id)}
                          disabled={verifyLoading}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all"
                        >
                          {verifyLoading ? "Verifying..." : "Verify Code"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 rounded-2xl bg-slate-950/40 text-center text-xs text-slate-400 font-mono">
                No active claims filed on this item yet.
              </div>
            )}
          </div>
        ) : !item.isAuthenticated ? (
          /* Unauthenticated visitor */
          <div className="rounded-2xl bg-slate-950/60 p-6 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                {isLost ? "Found This Belonging?" : "Claim Your Lost Belonging"}
              </div>
              <p className="text-xs text-slate-400">
                Sign in with your verified AIEM campus credentials to initiate an ownership claim or submit recovery evidence.
              </p>
            </div>
            <Link
              href={`/login?redirect=/items/${id}`}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 font-mono transition-all text-center shrink-0"
            >
              Sign In to Claim
            </Link>
          </div>
        ) : (
          /* If Authenticated Hunter: Claim Item */
          <div className="space-y-4">
            {claimSuccess ? (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-6 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  Claim Submitted Successfully!
                </div>
                <p className="text-xs text-slate-300">
                  {claimSuccess.autoApproved
                    ? "Verification answer matched! Your 6-digit handover code has been generated. Present this code to the owner or safe-desk officer upon handover:"
                    : "Your claim has been submitted for verification. Here is your 6-digit handover code:"}
                </p>

                <div className="inline-block px-6 py-3 rounded-2xl bg-slate-950 border border-emerald-400/50 text-2xl font-mono font-black text-emerald-400 tracking-widest">
                  {claimSuccess.handoverCode}
                </div>
              </div>
            ) : showClaimModal ? (
              <form onSubmit={handleClaimSubmit} className="space-y-4 bg-slate-950/80 p-6 rounded-2xl border border-white/10">
                <h3 className="font-bold text-sm text-white">
                  Submit Claim Verification
                </h3>

                {(item.hasVerificationQuestion || item.verificationQuestion) && (
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">
                      Secret Verification Answer (Optional Instant Match)
                    </label>
                    <input
                      type="text"
                      placeholder="Enter secret answer if known (e.g. engraving, sticker, battery serial)..."
                      value={answerProvided}
                      onChange={(e) => setAnswerProvided(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300">
                    Proof / Recovery Details *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe where and when you found it, or what markings confirm you own this belonging..."
                    value={proofText}
                    onChange={(e) => setProofText(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="flex items-center gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClaimModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={claimLoading}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all font-mono"
                  >
                    {claimLoading ? "Submitting..." : "Submit Claim & Generate Code"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl bg-slate-950/60 p-6 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-white text-sm">
                    {isLost ? "Did you locate this belonging?" : "Is this your lost belonging?"}
                  </div>
                  <p className="text-xs text-slate-400">
                    Submit a claim to verify ownership or physical custody and unlock the 6-digit recovery code.
                  </p>
                </div>
                <button
                  onClick={() => setShowClaimModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 font-mono transition-all"
                >
                  {isLost ? "I Found This Item" : "Claim This Item"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

