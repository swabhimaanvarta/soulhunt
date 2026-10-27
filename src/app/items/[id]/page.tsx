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
  ExternalLink,
  Share2,
  Copy,
  Check,
  Maximize2,
  X,
  Camera,
  Loader2,
  Laptop,
  CreditCard,
  BookOpen,
  Watch,
  Key,
  Briefcase,
  FlaskConical,
  Package,
  ShieldCheck,
  CheckCheck,
  HelpCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ItemActionBanner from "@/components/lost-and-found/ItemActionBanner";
import HandoverOtpCard from "@/components/lost-and-found/HandoverOtpCard";
import HandoverCoordinationChat from "@/components/lost-and-found/HandoverCoordinationChat";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ELECTRONICS: Laptop,
  ID_CARDS_DOCS: CreditCard,
  BOOKS_NOTES: BookOpen,
  ACCESSORIES: Watch,
  BAGS_WALLETS: Briefcase,
  KEYS: Key,
  LAB_GEAR: FlaskConical,
  OTHER: Package,
};

const STEP_ICONS: Record<string, React.ElementType> = {
  ACTIVE: Sparkles,
  CLAIMED: Clock,
  VERIFICATION: KeyRound,
  RECOVERED: ShieldCheck,
  COMPLETED: CheckCheck,
};

export default function ItemDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lightbox & Share State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Claim Form State
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [answerProvided, setAnswerProvided] = useState("");
  const [proofText, setProofText] = useState("");
  const [proofPhotoUrl, setProofPhotoUrl] = useState("");
  const [handoverPreference, setHandoverPreference] = useState<"SAFE_DESK" | "DIRECT">("SAFE_DESK");
  const [uploadingProofPhoto, setUploadingProofPhoto] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<any>(null);

  // Active Claim Tracking State
  const [activeClaimDetail, setActiveClaimDetail] = useState<any>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Claim Review State (Owner / Staff)
  const [reviewLoading, setReviewLoading] = useState(false);
  const [rejectingClaimId, setRejectingClaimId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchActiveClaim = async (claimId: string) => {
    try {
      const res = await fetch(`/api/claims/${claimId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setActiveClaimDetail(json.data);
      }
    } catch {
      // non-blocking
    }
  };

  const fetchItem = async () => {
    try {
      const res = await fetch(`/api/items/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setItem(json.data);
        if (json.data.claims && json.data.claims.length > 0) {
          const targetClaim =
            json.data.claims.find((c: any) => c.status === "APPROVED") || json.data.claims[0];
          if (targetClaim?._id) {
            fetchActiveClaim(targetClaim._id);
          }
        }
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

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied!",
        description: "Direct link to this belonging dossier copied to clipboard.",
        variant: "success",
      });
    }
  };

  const handleCopyId = () => {
    if (id && typeof window !== "undefined") {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      toast({
        title: "Record ID Copied",
        description: `Ledger ID: ${id}`,
        variant: "success",
      });
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleProofPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProofPhoto(true);
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

      setProofPhotoUrl(json.url);
      toast({
        title: "Proof Photo Attached",
        description: "Image attached to your claim submission.",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Upload Error",
        description: err.message || "Failed to upload photo",
        variant: "destructive",
      });
    } finally {
      setUploadingProofPhoto(false);
    }
  };

  const handleReviewClaim = async (
    claimId: string,
    action: "APPROVE" | "REJECT",
    decisionReason?: string
  ) => {
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/claims/${claimId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          decisionReason:
            decisionReason ||
            (action === "APPROVE" ? "Proof of ownership and details verified." : "Proof insufficient."),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || json.error || "Claim review failed.");
      }
      toast({
        title: action === "APPROVE" ? "Claim Approved!" : "Claim Rejected",
        description:
          action === "APPROVE"
            ? "Recovery code generated and delivery notification sent."
            : "Claim marked as rejected.",
        variant: action === "APPROVE" ? "success" : "default",
      });
      setRejectingClaimId(null);
      setRejectReason("");
      fetchItem();
      fetchActiveClaim(claimId);
    } catch (err: any) {
      toast({
        title: "Review Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleCancelClaim = async (claimId: string) => {
    if (!confirm("Are you sure you want to withdraw your claim?")) return;
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/claims/${claimId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to withdraw claim.");
      }
      toast({
        title: "Claim Withdrawn",
        description: "Your claim has been withdrawn and the item is available for other claimants.",
        variant: "success",
      });
      setActiveClaimDetail(null);
      setClaimSuccess(null);
      fetchItem();
    } catch (err: any) {
      toast({
        title: "Withdrawal Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (proofText.trim().length < 5) {
      toast({
        title: "Proof Required",
        description: "Please provide at least 5 characters describing your proof of ownership.",
        variant: "destructive",
      });
      return;
    }

    setClaimLoading(true);
    try {
      const clientRequestId = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch(`/api/items/${id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerProvided: answerProvided.trim() || undefined,
          proofText: proofText.trim(),
          proofPhotoUrl: proofPhotoUrl || undefined,
          handoverPreference,
          clientRequestId,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        const errorMsg =
          json.error?.message || (typeof json.error === "string" ? json.error : "Claim submission failed.");
        throw new Error(errorMsg);
      }
      setClaimSuccess(json.data);
      if (json.data?.claimId) {
        fetchActiveClaim(json.data.claimId);
      }
      toast({
        title: "Claim Submitted Successfully",
        description: json.data?.autoApproved
          ? "Verification answer matched! 6-digit recovery code generated."
          : "Your claim has been submitted to the custodian/staff for review.",
        variant: "success",
      });
      setShowClaimModal(false);
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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
        <p className="font-mono text-xs uppercase tracking-widest text-slate-400">
          Retrieving Item Record from Campus Ledger...
        </p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Record Not Found</h2>
        <p className="text-xs text-slate-400">{error || "This item record could not be found."}</p>
        <Link
          href="/lost-and-found"
          className="inline-block px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-bold transition-all"
        >
          Return to Lost & Found
        </Link>
      </div>
    );
  }

  const isLost = item.itemType === "LOST";
  const location = isLost ? item.lastKnownLocationId : item.foundLocationId;
  const custody = item.currentCustodyLocationId || item.safeDeskLocationId;
  const isOwner = Boolean(item.isOwner);
  const isStaff = Boolean(item.isStaff);
  const CategoryIcon = CATEGORY_ICONS[item.category] || Package;

  const states = ["ACTIVE", "CLAIMED", "VERIFICATION", "RECOVERED", "COMPLETED"];
  const isStandardState = states.includes(item.status);
  const currentStateIdx = isStandardState ? states.indexOf(item.status) : -1;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Bar Navigation & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/lost-and-found");
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Lost & Found Directory
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-mono transition-all cursor-pointer"
            title="Copy Record ID"
          >
            {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span className="truncate max-w-[100px] sm:max-w-none">ID: {id?.slice(-6)}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold transition-all cursor-pointer"
            title="Share Belonging Link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Role-Aware Contextual Action Banner */}
      <ItemActionBanner
        item={item}
        currentUser={{ _id: item.currentUserId, role: item.currentUserRole }}
        activeClaim={
          activeClaimDetail || item.claims?.find((c: any) => c.status === "APPROVED") || item.claims?.[0]
        }
        pendingClaimsCount={item.claims?.filter((c: any) => c.status === "PENDING").length || 0}
      />

      {/* Main Item Dossier Card */}
      <div className="glass-panel rounded-3xl p-5 sm:p-7 md:p-8 border border-white/10 space-y-6 backdrop-blur-xl">
        {/* Header Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase flex items-center gap-1.5 ${
                  isLost
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isLost ? "bg-rose-400 animate-pulse" : "bg-emerald-400"}`} />
                {item.itemType} BELONGING
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-white/10">
                <CategoryIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>{item.category?.replace(/_/g, " ")}</span>
              </span>

              {isOwner && (
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                  YOU ARE THE REPORTER
                </span>
              )}

              {item.rewardOffered > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>+{item.rewardOffered} Bounty</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{item.title}</h1>
          </div>

          <div className="flex items-center gap-3">
            {item.linkedQuestId && (
              <Link
                href={`/quests/${item.linkedQuestId._id || item.linkedQuestId}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all shadow-md shadow-emerald-500/10"
              >
                <Compass className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: "12s" }} />
                <span>Active Investigation Room</span>
              </Link>
            )}
          </div>
        </div>

        {/* Responsive State Machine Visualizer */}
        <div className="space-y-3 py-1">
          <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-2">
            <span className="uppercase tracking-wider">Lifecycle State Machine</span>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">Current: {item.status}</span>
              {!isStandardState && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    item.status === "REJECTED" || item.status === "DISPUTED"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  {item.status?.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>

          {/* Stepper container */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {states.map((st, idx) => {
              const passed = currentStateIdx !== -1 && idx < currentStateIdx;
              const isCurrent = currentStateIdx !== -1 && idx === currentStateIdx;
              const StepIcon = STEP_ICONS[st] || ShieldCheck;

              return (
                <div
                  key={st}
                  className={`rounded-xl p-2 sm:p-2.5 text-center border font-mono transition-all flex flex-col items-center justify-center gap-1 ${
                    isCurrent
                      ? "bg-gradient-to-b from-emerald-500/25 to-emerald-950/40 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-400/50"
                      : passed
                      ? "bg-slate-900/90 border-white/10 text-slate-300"
                      : "bg-slate-950/40 border-white/5 text-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-center">
                    {passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <StepIcon className={`w-3.5 h-3.5 ${isCurrent ? "text-emerald-400 animate-pulse" : "text-slate-600"}`} />
                    )}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-bold uppercase truncate max-w-full">
                    {st}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Item Details Grid: Photo, Description & Coordinates */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-white/5">
          {/* Photo Preview Container with Lightbox Trigger */}
          <div className="md:col-span-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Belonging Photograph</span>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Zoom</span>
              </button>
            </div>

            <div
              onClick={() => setLightboxOpen(true)}
              className="relative rounded-2xl overflow-hidden bg-slate-950/80 border border-white/10 aspect-video md:aspect-square flex items-center justify-center group shadow-inner cursor-pointer"
            >
              <img
                src={item.photoUrl || "/placeholder-item.png"}
                alt={item.title || "Belonging item photo"}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith("/placeholder-item.png")) {
                    target.src = "/placeholder-item.png";
                  }
                }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-slate-300 opacity-80 group-hover:opacity-100 transition-opacity">
                AIEM VERIFIED
              </div>

              {!item.photoUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 p-3 text-center pointer-events-none">
                  <Shield className="w-7 h-7 text-slate-500 mb-1" />
                  <span className="text-[11px] font-mono text-slate-300 font-bold">Privacy Derivative</span>
                  <span className="text-[10px] text-slate-500">Derivative placeholder displayed</span>
                </div>
              )}
            </div>
          </div>

          {/* Description & Verification Challenge */}
          <div className="md:col-span-4 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Public Description</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Auto-PII Redacted
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-950/70 p-4 rounded-2xl border border-white/5 shadow-inner">
                {item.publicDescription}
              </p>
            </div>

            {(item.hasVerificationQuestion || item.verificationQuestion) && (
              <div className="space-y-1">
                <div className="text-xs font-mono text-cyan-300 flex items-start gap-2.5 bg-cyan-950/30 border border-cyan-500/30 p-3.5 rounded-2xl shadow-sm">
                  <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-cyan-200">Ownership Challenge Protected</div>
                    <div className="text-[11px] text-slate-300 leading-relaxed">
                      Instant cryptographic match available. Submit your secret answer during claim to immediately unlock handover pass.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Location & Reporter Details */}
          <div className="md:col-span-4 space-y-4">
            <div className="rounded-2xl bg-slate-950/70 border border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-400 border-b border-white/5 pb-2">
                <span>Campus Location</span>
                <Link
                  href={`/map?locationId=${location?._id || ""}`}
                  className="text-cyan-400 hover:text-cyan-300 text-[10px] normal-case flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" />
                  <span>View Map</span>
                </Link>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white text-sm">{location?.name || "AIEM Campus"}</div>
                  {item.spotDetails && <div className="text-slate-400 mt-0.5">{item.spotDetails}</div>}
                </div>
              </div>

              {custody && (
                <div className="flex items-start gap-2.5 text-xs text-slate-300 pt-2.5 border-t border-white/5">
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
            <div className="rounded-2xl bg-slate-950/70 border border-white/5 p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-cyan-400">
                  {item.reporterId?.displayName
                    ? item.reporterId.displayName.charAt(0).toUpperCase()
                    : item.finderId?.displayName
                    ? item.finderId.displayName.charAt(0).toUpperCase()
                    : <Shield className="w-4 h-4 text-cyan-400" />}
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

              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-white/10">
                VERIFIED
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Safe Community Match Suggestions */}
      {item.possibleMatches && item.possibleMatches.length > 0 && (
        <div className="glass-panel rounded-3xl p-5 sm:p-7 md:p-8 border border-cyan-500/20 bg-cyan-950/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Possible Campus Matches ({item.possibleMatches.length})</span>
              </h2>
              <p className="text-xs text-slate-400">
                Privacy-safe suggestions matching this {item.category?.replace(/_/g, " ")} item.
              </p>
            </div>
            <span className="text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-0.5 rounded-full w-fit">
              AIEM Match Matrix
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {item.possibleMatches.map((match: any) => (
              <Link
                key={match._id}
                href={`/items/${match._id}`}
                className="group rounded-2xl bg-slate-900/90 border border-white/10 hover:border-cyan-500/40 p-3.5 space-y-3 transition-all hover:-translate-y-0.5 shadow-md flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {match.category?.replace(/_/g, " ")}
                    </span>
                    <span className="text-slate-500">
                      {new Date(match.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {match.title}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">{match.locationName}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Inspect Belonging</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Claim & Dual Handover Verification Hub */}
      <div className="glass-panel rounded-3xl p-5 sm:p-7 md:p-8 border border-white/10 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              Claim & Verification Handover Protocol
            </h2>
            <p className="text-xs text-slate-400">
              Ethical Dual-Code Handover: Once ownership is established, a 6-digit cryptographic PIN completes the physical return.
            </p>
          </div>
        </div>

        {/* If Owner / Moderator: Review Claims & Enter 6-digit handover code */}
        {isOwner || isStaff ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-400">
              <span>Active Claim Requests ({item.claims?.length || 0})</span>
              <span className="text-slate-500">Custodian / Staff View</span>
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
                        Claim from: {claim.claimantId?.displayName || "Student"} (@{claim.claimantId?.username || "user"})
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          claim.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : claim.status === "PENDING"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        }`}
                      >
                        {claim.status}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {new Date(claim.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    {(claim.submittedAnswer || claim.proofDetails?.answerProvided) && (
                      <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
                        <span className="text-slate-400 font-mono">Answer Submitted: </span>
                        <span className="text-emerald-400 font-mono font-bold">
                          &ldquo;{claim.submittedAnswer || claim.proofDetails?.answerProvided}&rdquo;
                        </span>
                      </div>
                    )}

                    {(claim.notes || claim.proofDetails?.proofText) && (
                      <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
                        <span className="text-slate-400 font-mono">Claimant Statement: </span>
                        <span className="text-slate-200">{claim.notes || claim.proofDetails?.proofText}</span>
                      </div>
                    )}

                    {claim.proofPhotoUrl && (
                      <div className="space-y-1 pt-1">
                        <span className="text-slate-400 font-mono text-[11px]">Attached Proof Photo:</span>
                        <div className="rounded-xl overflow-hidden border border-white/10 max-h-48 max-w-sm bg-black/40">
                          <img
                            src={claim.proofPhotoUrl}
                            alt="Claimant proof attachment"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (!target.src.endsWith("/placeholder-item.png")) {
                                target.src = "/placeholder-item.png";
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {claim.status === "PENDING" && (
                    <div className="pt-3 border-t border-white/5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-amber-300 font-mono flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                          <span>Review required to authorize item handover</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={reviewLoading}
                            onClick={() => {
                              setRejectingClaimId(claim._id);
                              setRejectReason("");
                            }}
                            className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-mono font-bold transition-all disabled:opacity-50 cursor-pointer"
                          >
                            Reject Claim
                          </button>
                          <button
                            type="button"
                            disabled={reviewLoading}
                            onClick={() => handleReviewClaim(claim._id, "APPROVE", "Proof and details verified")}
                            className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {reviewLoading ? "Processing..." : "Approve Claim"}
                          </button>
                        </div>
                      </div>

                      {rejectingClaimId === claim._id && (
                        <div className="p-4 rounded-xl bg-slate-900 border border-rose-500/30 space-y-3">
                          <div className="text-xs font-bold text-rose-300">Specify Rejection Reason:</div>
                          <input
                            type="text"
                            placeholder="Reason for rejection (e.g. proof does not match item markings)..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-rose-400"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingClaimId(null);
                                setRejectReason("");
                              }}
                              className="px-3 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={reviewLoading || !rejectReason.trim()}
                              onClick={() => handleReviewClaim(claim._id, "REJECT", rejectReason.trim())}
                              className="px-3.5 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs font-mono disabled:opacity-50 cursor-pointer"
                            >
                              Confirm Rejection
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {claim.status === "APPROVED" && (
                    <div className="pt-3 border-t border-white/5 space-y-5">
                      <HandoverOtpCard
                        mode={isOwner && isLost ? "RECIPIENT" : "CUSTODIAN"}
                        claimId={claim._id}
                        handoverCode={isOwner && isLost ? (activeClaimDetail?.handoverCode || "******") : undefined}
                        handoverAttempts={claim.handoverAttempts}
                        handoverLocked={claim.handoverLocked}
                        lockoutUntil={claim.lockoutUntil}
                        onVerifySuccess={() => {
                          fetchItem();
                          fetchActiveClaim(claim._id);
                        }}
                      />

                      <HandoverCoordinationChat
                        claimId={claim._id}
                        isFinder={Boolean(!isLost || isStaff)}
                        isClaimant={Boolean(isLost && !isStaff)}
                        custodyStatus={item.custodyStatus}
                        safeDeskLocationName={
                          item.safeDeskLocationId?.name ||
                          item.currentCustodyLocationId?.name ||
                          "Campus Safe-Desk"
                        }
                      />
                    </div>
                  )}

                  {claim.status === "HANDOVER_COMPLETE" && (
                    <div className="pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-emerald-400 font-mono">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Physical handover verified and completed. Ledger settled.</span>
                    </div>
                  )}

                  {claim.status === "REJECTED" && (
                    <div className="pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-rose-400 font-mono">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>Claim was reviewed and rejected.</span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 rounded-2xl bg-slate-950/40 text-center text-xs text-slate-400 font-mono border border-white/5">
                No active claims filed on this item yet.
              </div>
            )}
          </div>
        ) : !item.isAuthenticated ? (
          /* Unauthenticated visitor */
          <div className="rounded-2xl bg-slate-950/70 p-6 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                {isLost ? "Found This Belonging?" : "Claim Your Lost Belonging"}
              </div>
              <p className="text-xs text-slate-400">
                Sign in with your verified AIEM campus credentials to submit an ownership claim or return notification.
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
          /* Authenticated Hunter: Claim Item or View Active Claim Status */
          <div className="space-y-4">
            {claimSuccess ? (
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    Claim Submitted Successfully!
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setClaimSuccess(null);
                      fetchItem();
                    }}
                    className="px-3 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold transition-all cursor-pointer"
                  >
                    View Active Ticket & Chat →
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {claimSuccess.autoApproved
                    ? (claimSuccess.handoverCode
                        ? "Verification answer matched! Your 6-digit handover code has been generated. Present this code to the custodian upon handover:"
                        : "Verification answer matched! The custodian has been notified. When you meet them, ask them for their 6-digit PIN to verify the handover.")
                    : (claimSuccess.handoverCode
                        ? "Your claim has been submitted. Here is your 6-digit handover code:"
                        : "Your claim has been submitted for review. You will receive an alert once authorized.")}
                </p>

                {claimSuccess.handoverCode && (
                  <div className="inline-block px-6 py-3 rounded-2xl bg-slate-950 border border-emerald-400/50 text-2xl font-mono font-black text-emerald-400 tracking-widest shadow-lg shadow-emerald-500/10">
                    {claimSuccess.handoverCode}
                  </div>
                )}
              </div>
            ) : (!isOwner && !isStaff && item.claims && item.claims.length > 0) ? (
              (() => {
                const myClaim = item.claims[0];
                const activeStatus = activeClaimDetail?.status || myClaim.status;
                const activePin =
                  activeClaimDetail?.handoverCode ||
                  (claimSuccess?.claimId === myClaim._id ? claimSuccess?.handoverCode : null);

                return (
                  <div className="rounded-2xl bg-slate-950/80 border border-white/10 p-6 space-y-5 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">Your Active Claim Ticket</span>
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            activeStatus === "APPROVED"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : activeStatus === "PENDING"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : activeStatus === "HANDOVER_COMPLETE"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          }`}
                        >
                          {activeStatus === "APPROVED"
                            ? "Approved for Pickup"
                            : activeStatus === "PENDING"
                            ? "Pending Review"
                            : activeStatus === "HANDOVER_COMPLETE"
                            ? "Handover Complete"
                            : activeStatus}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Filed {new Date(myClaim.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {activeStatus === "PENDING" && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 space-y-2">
                          <div className="flex items-center gap-2 font-bold text-amber-300">
                            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                            <span>Under Custodian / Safe-Desk Review</span>
                          </div>
                          <p className="leading-relaxed">
                            Your proof of ownership is currently being verified. The finder or campus Safe-Desk custodian will review your submitted statements. You will receive an alert once authorized.
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] font-mono text-slate-400">
                            No longer need this claim or entered incorrect details?
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCancelClaim(myClaim._id)}
                            disabled={cancelLoading}
                            className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-mono font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {cancelLoading ? "Withdrawing..." : "Withdraw Claim"}
                          </button>
                        </div>
                      </div>
                    )}

                    {activeStatus === "APPROVED" && (
                      <div className="space-y-5">
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 space-y-2">
                          <div className="flex items-center gap-2 font-bold text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Claim Verified & Approved for Handover!</span>
                          </div>
                          <p className="leading-relaxed">
                            {isLost
                              ? "Your report that you found this item was approved! Meet the owner or campus Safe-Desk to hand over the item and enter their 6-digit recovery code to complete handover."
                              : "Ownership confirmed! Present the persistent 6-digit recovery PIN below at the designated campus Safe-Desk or to the custodian to receive your belonging."}
                          </p>
                        </div>

                        {/* Asymmetric Visual Recovery Pass */}
                        <HandoverOtpCard
                          mode={isLost ? "CUSTODIAN" : "RECIPIENT"}
                          claimId={myClaim._id}
                          handoverCode={!isLost ? (activePin || activeClaimDetail?.handoverCode) : undefined}
                          handoverCodeExpiresAt={activeClaimDetail?.handoverCodeExpiresAt}
                          handoverAttempts={myClaim.handoverAttempts}
                          handoverLocked={activeClaimDetail?.handoverLocked || myClaim.handoverLocked}
                          lockoutUntil={activeClaimDetail?.lockoutUntil || myClaim.lockoutUntil}
                          onVerifySuccess={() => {
                            fetchItem();
                            fetchActiveClaim(myClaim._id);
                          }}
                        />

                        {/* Handover Coordination Chat */}
                        <HandoverCoordinationChat
                          claimId={myClaim._id}
                          isFinder={Boolean(isLost)}
                          isClaimant={Boolean(!isLost)}
                          custodyStatus={item.custodyStatus}
                          safeDeskLocationName={
                            item.safeDeskLocationId?.name ||
                            item.currentCustodyLocationId?.name ||
                            "Campus Safe-Desk"
                          }
                        />

                        {/* Safe-Desk Instructions */}
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-2.5 text-xs">
                          <div className="font-mono text-cyan-400 font-bold flex items-center gap-1.5">
                            <Building className="w-4 h-4 text-cyan-400" />
                            Safe-Desk Custody & Collection Instructions
                          </div>
                          <p className="text-slate-300 leading-relaxed">
                            {activeClaimDetail?.safeDeskInstructions?.guidance ||
                              "Proceed to the campus Safe-Desk station with your official AIEM Student Identity Card and present your 6-digit recovery PIN to complete physical custody handover."}
                          </p>
                          <div className="flex flex-wrap gap-4 pt-2 font-mono text-[11px] text-slate-400 border-t border-white/5">
                            <div>
                              <span className="text-slate-500">Designated Station: </span>
                              <span className="text-white font-bold">
                                {activeClaimDetail?.safeDeskInstructions?.locationName ||
                                  custody?.name ||
                                  location?.name ||
                                  "Campus Safe-Desk"}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Desk Hours: </span>
                              <span className="text-white">
                                {activeClaimDetail?.safeDeskInstructions?.operatingHours ||
                                  custody?.operatingHours ||
                                  "08:00 AM - 06:00 PM"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {activeClaimDetail?.handoverLocked && (
                          <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>
                              PIN verification is temporarily locked after 5 incorrect attempts. Please bring your AIEM student ID card to the Safe-Desk officer in person to reset.
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {activeStatus === "HANDOVER_COMPLETE" && (
                      <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-cyan-400">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                          <span>Belonging Recovered Successfully</span>
                        </div>
                        <p className="leading-relaxed">
                          Dual-code cryptographic verification complete. Record closed on campus ledger.
                        </p>
                      </div>
                    )}

                    {activeStatus === "REJECTED" && (
                      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-rose-400">
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                          <span>Claim Rejected</span>
                        </div>
                        <p className="leading-relaxed">
                          {myClaim.decisionNote ||
                            myClaim.notes ||
                            "The submitted details did not match verified item attributes. Visit the campus Safe-Desk in person if you need assistance."}
                        </p>
                      </div>
                    )}

                    <div className="text-xs text-slate-400 border-t border-white/5 pt-2">
                      <span className="font-mono text-slate-500">Submitted statement: </span>
                      <span className="text-slate-300">{myClaim.notes || myClaim.proofDetails?.proofText || "Proof provided"}</span>
                    </div>
                  </div>
                );
              })()
            ) : showClaimModal ? (
              <form onSubmit={handleClaimSubmit} className="space-y-4 bg-slate-950/90 p-6 rounded-2xl border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Submit Claim Verification
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowClaimModal(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {(item.hasVerificationQuestion || item.verificationQuestion) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Secret Verification Answer (Optional Instant Match)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter secret answer if known (e.g. sticker inside case, battery serial)..."
                      value={answerProvided}
                      onChange={(e) => setAnswerProvided(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 font-mono"
                    />
                    <p className="text-[11px] text-slate-400">
                      Matches the reporter&apos;s secret hash instantly without waiting for manual review.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                    <label>Proof & Recovery Details *</label>
                    <span className={`text-[10px] ${proofText.length < 5 ? "text-amber-400" : "text-emerald-400"}`}>
                      {proofText.length}/500 chars (min 5)
                    </span>
                  </div>
                  <textarea
                    required
                    rows={3}
                    maxLength={500}
                    placeholder="Describe markings, scratches, stickers, purchase receipts, or where you lost it..."
                    value={proofText}
                    onChange={(e) => setProofText(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 leading-relaxed"
                  />
                </div>

                {/* Handover Preference */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Preferred Handover Channel</label>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setHandoverPreference("SAFE_DESK")}
                      className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                        handoverPreference === "SAFE_DESK"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-slate-900 text-slate-400 border-white/5"
                      }`}
                    >
                      Safe-Desk Station (Recommended)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHandoverPreference("DIRECT")}
                      className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                        handoverPreference === "DIRECT"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-slate-900 text-slate-400 border-white/5"
                      }`}
                    >
                      Direct Meetup via 6-Digit PIN
                    </button>
                  </div>
                </div>

                {/* Optional Photo Proof Upload */}
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-cyan-400" />
                      Attach Ownership Proof Photo (Optional)
                    </span>
                    {uploadingProofPhoto && <span className="text-cyan-400 animate-pulse">Uploading...</span>}
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-white/10 flex items-center gap-1.5 transition-all">
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Upload Proof Receipt/Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofPhotoUpload}
                        disabled={uploadingProofPhoto}
                        className="hidden"
                      />
                    </label>

                    {proofPhotoUrl && (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Photo Attached
                      </span>
                    )}
                  </div>

                  {proofPhotoUrl && (
                    <div className="relative mt-2 rounded-lg overflow-hidden border border-white/10 h-24 max-w-xs bg-black/40">
                      <img
                        src={proofPhotoUrl}
                        alt="Proof attachment"
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

                <div className="flex items-center gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClaimModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={claimLoading || proofText.trim().length < 5}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs transition-all font-mono disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    {claimLoading ? "Submitting..." : "Submit Claim & Request Code"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl bg-slate-950/70 p-6 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-white text-sm">
                    {isLost ? "Did you locate this belonging?" : "Is this your lost belonging?"}
                  </div>
                  <p className="text-xs text-slate-400">
                    Submit a claim to verify ownership or physical custody and unlock the 6-digit recovery code.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClaimModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 font-mono transition-all shrink-0 cursor-pointer"
                >
                  {isLost ? "I Found This Item" : "Claim This Item"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[85vh] rounded-3xl overflow-hidden border border-white/20 bg-slate-950 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/80">
              <div className="font-mono text-xs text-slate-300 font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Belonging Photograph Dossier</span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 bg-black/60 overflow-hidden">
              <img
                src={item.photoUrl || "/placeholder-item.png"}
                alt={item.title}
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
