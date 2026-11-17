"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Compass,
  Star,
  Coins,
  Shield,
  Bell,
  ChevronRight,
  Search,
  PackagePlus,
  Trophy,
  Users,
  Clock,
  Zap,
  Target,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Sparkles,
  Radio,
  Calendar,
  ArrowUpRight,
  Award,
  MapPin,
  RotateCw,
  Eye,
  EyeOff,
  Lock,
  X,
  ShieldAlert,
  Layers,
} from "lucide-react";
import MyRecoveriesSection from "@/components/lost-and-found/MyRecoveriesSection";
import PersonalOperationsHub, { ClaimOp } from "@/components/dashboard/PersonalOperationsHub";
import {
  getXpProgressInLevel,
  getXpRequiredForNextLevel,
  calculateLevelFromXp,
} from "@/lib/progression";

interface UserData {
  _id: string;
  username: string;
  displayName: string;
  xp: number;
  level: number;
  rankTitle: string;
  coins: number;
  trophies?: number;
  weeklyScore?: number;
  role: string;
  department?: string;
  yearOfStudy?: number;
  avatarPreset?: string;
  avatarUrl?: string;
  equippedTitle?: string;
  equippedFrame?: string;
  squadId?: string;
}

interface QuestData {
  _id: string;
  title: string;
  questCode: string;
  difficulty: number;
  xpReward: number;
  coinReward: number;
  trophyReward?: number;
  status: string;
}

interface NotificationData {
  _id: string;
  category: string;
  title: string;
  message: string;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

interface ClaimRecord {
  _id: string;
  itemType: "LOST" | "FOUND";
  itemId: string;
  status: "PENDING" | "APPROVED" | "HANDOVER_COMPLETE" | "REJECTED" | "DISPUTED";
  isClaimant: boolean;
  isCounterparty: boolean;
  item?: {
    _id: string;
    title: string;
    itemType: string;
    category: string;
    status: string;
    location?: string;
    custodyLocation?: string;
    custodyStatus?: string;
  } | null;
  createdAt: string;
}

interface SecureHandoverModalData {
  claimId: string;
  itemTitle: string;
  locationName: string;
  operatingHours: string;
  handoverCode?: string;
  handoverCodeExpiresAt?: string | null;
  loading: boolean;
  revealed: boolean;
  error?: string | null;
}

function formatLastUpdated(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return "Last updated: Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin <= 1) return "Last updated: 1 min ago";
  return `Last updated: ${diffMin} mins ago`;
}

function formatTimeAgo(isoString?: string): string {
  if (!isoString) return "Just now";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Recently";
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

const QUICK_LAUNCH_MATRIX = [
  {
    icon: PackagePlus,
    label: "Report Found",
    href: "/lost-and-found/report-found",
    badge: "Safe-Desk Custody",
    desc: "Deposit discovered belongings at official campus station",
    accentColor: "emerald",
    border: "hover:border-emerald-500/50 hover:bg-emerald-950/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: Search,
    label: "Browse Quests",
    href: "/quests",
    badge: "Field Operations",
    desc: "Accept investigations, solve clues, and earn XP",
    accentColor: "cyan",
    border: "hover:border-cyan-500/50 hover:bg-cyan-950/20",
    iconColor: "text-cyan-400",
  },
  {
    icon: Users,
    label: "Squad Hub",
    href: "/squads",
    badge: "Tactical Unit",
    desc: "Coordinate investigations with your operative squad",
    accentColor: "amber",
    border: "hover:border-amber-500/50 hover:bg-amber-950/20",
    iconColor: "text-amber-400",
  },
  {
    icon: Calendar,
    label: "Campus Events",
    href: "/events",
    badge: "Live Sprints",
    desc: "Department recovery tournaments & campus challenges",
    accentColor: "violet",
    border: "hover:border-violet-500/50 hover:bg-violet-950/20",
    iconColor: "text-violet-400",
  },
];

function sanitizeSameOriginPath(url?: string | null): string {
  if (!url) return "/dashboard";
  const trimmed = url.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    return trimmed;
  }
  return "/dashboard";
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [quests, setQuests] = useState<QuestData[]>([]);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [dailyData, setDailyData] = useState<any>(null);
  const [liveFeed, setLiveFeed] = useState<any[]>([]);
  const [feedLastUpdated, setFeedLastUpdated] = useState<Date>(new Date());
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Secure Handover Modal State
  const [handoverModal, setHandoverModal] = useState<SecureHandoverModalData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.replace("/login");
        return;
      }
      const meData = await meRes.json();
      if (!meData.data && !meData.user) {
        router.replace("/login");
        return;
      }
      setUser(meData.data || meData.user);

      const [questsRes, claimsRes, notifsRes, dailyRes, feedRes, eventsRes] = await Promise.all([
        fetch("/api/quests?status=ACTIVE&limit=4"),
        fetch("/api/claims?role=all"),
        fetch("/api/notifications?limit=5"),
        fetch("/api/content/daily"),
        fetch("/api/content/feed"),
        fetch("/api/events?active=true"),
      ]);

      if (questsRes.ok) {
        const d = await questsRes.json();
        setQuests(d.data || d.quests || []);
      }
      if (claimsRes.ok) {
        const d = await claimsRes.json();
        setClaims(Array.isArray(d.data) ? d.data : []);
      }
      if (notifsRes.ok) {
        const d = await notifsRes.json();
        setNotifications(d.data?.notifications || d.notifications || []);
      }
      if (dailyRes.ok) {
        const d = await dailyRes.json();
        if (d.success) setDailyData(d.data);
      }
      if (feedRes.ok) {
        const d = await feedRes.json();
        if (d.success) {
          setLiveFeed(d.data || []);
          setFeedLastUpdated(new Date());
        }
      }
      if (eventsRes.ok) {
        const d = await eventsRes.json();
        if (d.success && d.data?.length > 0) setActiveEvent(d.data[0]);
      }
    } catch {
      // Non-blocking catch
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side heartbeat ticker for honest relative timestamps
  const [, setTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTicker((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Refresh Campus Activity Wire
  const handleRefreshWire = async () => {
    setRefreshingFeed(true);
    try {
      const res = await fetch("/api/content/feed");
      const json = await res.json();
      if (json.success) {
        setLiveFeed(json.data || []);
        setFeedLastUpdated(new Date());
      }
    } catch {
      // Non-blocking
    } finally {
      setRefreshingFeed(false);
    }
  };

  // Open Secure Handover Modal & Request PIN from Authorized /api/claims/[id]
  const openSecureHandoverModal = async (claim: ClaimRecord | ClaimOp) => {
    const title = claim.item?.title || ("itemTitle" in claim ? claim.itemTitle : "") || "Recovered Campus Belonging";
    const loc =
      claim.item?.custodyLocation ||
      claim.item?.location ||
      ("stationName" in claim ? claim.stationName : "") ||
      "Campus Safe-Desk Station";

    setHandoverModal({
      claimId: claim._id,
      itemTitle: title,
      locationName: loc,
      operatingHours: "08:00 AM - 06:00 PM",
      loading: true,
      revealed: false,
    });

    try {
      const res = await fetch(`/api/claims/${claim._id}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setHandoverModal((prev) =>
          prev
            ? {
                ...prev,
                handoverCode: data.data.handoverCode,
                handoverCodeExpiresAt: data.data.handoverCodeExpiresAt,
                locationName: data.data.safeDeskInstructions?.locationName || prev.locationName,
                operatingHours: data.data.safeDeskInstructions?.operatingHours || prev.operatingHours,
                loading: false,
              }
            : null
        );
      } else {
        setHandoverModal((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: data.error?.message || "Could not retrieve handover authorization.",
              }
            : null
        );
      }
    } catch (err: any) {
      setHandoverModal((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: err.message || "Failed to establish secure handover connection.",
            }
          : null
      );
    }
  };

  // Active High-Priority Approved Claims Awaiting Safe-Desk Handover
  const pendingHandovers = claims.filter(
    (c) => c.status === "APPROVED" && (c.isClaimant || c.isCounterparty)
  );

  // Active In-Review Claims
  const pendingClaims = claims.filter((c) => c.status === "PENDING");

  // Non-linear XP Progress Calculation
  const currentXp = user?.xp || 0;
  const userLevel = user?.level || calculateLevelFromXp(currentXp);
  const xpProgression = getXpProgressInLevel(currentXp);
  const xpInLevel = xpProgression.currentXpInLevel;
  const xpRequiredForNextLevel = xpProgression.xpRequiredForNextLevel || getXpRequiredForNextLevel(userLevel);
  const xpPct = xpProgression.progressPercent;

  // Circular SVG Ring Dimensions
  const ringRadius = 24;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference - (xpPct / 100) * ringCircumference;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Compass className="w-10 h-10 text-emerald-400" />
        </motion.div>
        <p className="text-xs font-mono text-slate-400 mt-3 tracking-wider uppercase">
          Initializing Investigator HQ...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navigation Bar */}
      <div className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-white tracking-wider uppercase font-mono">
                  Investigator HQ
                </h1>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                AIEM Field Operations Matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user?.username && (
              <Link
                href={`/profile/${user.username}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-white/10 hover:border-emerald-500/40 text-slate-200 hover:text-white rounded-lg text-xs font-mono font-bold transition-all shadow-sm"
              >
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                <span>My Dossier</span>
              </Link>
            )}

            {notifications.filter((n) => !n.isRead).length > 0 && (
              <Link href="/notifications" className="relative p-1.5 rounded-lg bg-slate-900 border border-white/10 hover:border-white/20 transition-colors">
                <Bell className="w-4 h-4 text-slate-300" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold font-mono">
                  {notifications.filter((n) => !n.isRead).length}
                </span>
              </Link>
            )}

            {user?.role === "ADMIN" && (
              <Link
                href="/admin"
                className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded text-xs font-mono font-bold hover:bg-amber-500/20 transition-colors"
              >
                Admin CMS
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 pb-32 md:pb-12 space-y-8">
        {/* SECTION 1: Operative Status HUD (No numerical trust score) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Background Corner Brackets */}
          <div className="pointer-events-none absolute top-2 left-2 w-3 h-3 border-t border-l border-emerald-400/60" />
          <div className="pointer-events-none absolute top-2 right-2 w-3 h-3 border-t border-r border-emerald-400/60" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Operative Callsign & Identity */}
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center shrink-0">
                {/* SVG Ring Progress */}
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 60 60">
                  <circle
                    cx="30"
                    cy="30"
                    r={ringRadius}
                    stroke="currentColor"
                    strokeWidth="3.5"
                    fill="transparent"
                    className="text-slate-800"
                  />
                  <circle
                    cx="30"
                    cy="30"
                    r={ringRadius}
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="text-emerald-400 transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Lv</span>
                  <span className="text-sm font-black font-mono text-white leading-none">
                    {userLevel}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black text-white tracking-tight">
                    {user?.displayName}
                  </h2>
                  <span className="text-xs font-mono text-slate-400">
                    @{user?.username}
                  </span>
                  {user?.equippedTitle && (
                    <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      {user.equippedTitle}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                  <span>{user?.department || "Campus Investigator"}</span>
                  <span>•</span>
                  <span>Year {user?.yearOfStudy || 1}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">{user?.rankTitle || "Campus Seeker"}</span>
                </div>
              </div>
            </div>

            {/* Economy & XP Metrics */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Trophies Standings Capsule */}
              <Link
                href="/leaderboard"
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 hover:border-amber-400/80 hover:bg-amber-950/20 shadow-md transition-all group"
                title="View Competitive Standings on Leaderboard"
              >
                <Trophy className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">
                    Trophies
                  </span>
                  <span className="text-sm font-bold font-mono text-amber-300">
                    {(user?.trophies ?? 0).toLocaleString()} 🏆
                  </span>
                </div>
              </Link>

              {/* Hunter Coins Balance */}
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-950 border border-amber-500/30 shadow-md">
                <Coins className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">
                    Hunter Coins
                  </span>
                  <span className="text-sm font-bold font-mono text-amber-300">
                    {user?.coins?.toLocaleString() || 0}
                  </span>
                </div>
              </div>

              {/* XP Progress Capsule */}
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 shadow-md">
                <Zap className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">
                    XP Progression ({xpPct}%)
                  </span>
                  <span className="text-sm font-bold font-mono text-emerald-300">
                    {xpInLevel} / {xpRequiredForNextLevel} XP
                  </span>
                </div>
              </div>

              {/* Operative Standing Badge (Replacing numerical trust score) */}
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/30 shadow-md">
                <Shield className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">
                    Standing
                  </span>
                  <span className="text-sm font-bold font-mono text-cyan-300">
                    Verified Operative
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* SECTION 2: Active Operations Radar (Stratified Urgent Alerts) */}
        {pendingHandovers.length > 0 || pendingClaims.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Active Operations Radar // High Urgency Actions
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* High Urgency: Approved Handovers Awaiting Safe-Desk Verification */}
              {pendingHandovers.map((handover) => {
                const isPinHolder =
                  (handover.itemType === "FOUND" && handover.isClaimant) ||
                  (handover.itemType === "LOST" && handover.isCounterparty);

                return isPinHolder ? (
                  <div
                    key={handover._id}
                    className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 p-5 shadow-lg flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                          Action Required // Safe-Desk Verification
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          PIN Protected
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white tracking-tight">
                        Handover Ready: Safe-Desk Verification Required
                      </h4>

                      <p className="text-xs text-slate-300 font-mono">
                        Item: <span className="font-bold text-white">{handover.item?.title || "Belonging"}</span>
                      </p>

                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        <span>{handover.item?.custodyLocation || "Campus Safe-Desk Station"}</span>
                      </div>

                      {/* Shoulder-Surfing Safe Masked PIN Display */}
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-white/5 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">Verification PIN:</span>
                        <span className="tracking-widest font-black text-slate-300 bg-slate-900 px-3 py-1 rounded border border-white/10">
                          ••••••
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => openSecureHandoverModal(handover)}
                      type="button"
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs font-mono shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>View Secure Handover</span>
                    </button>
                  </div>
                ) : (
                  <div
                    key={handover._id}
                    className="rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 p-5 shadow-lg flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                          Safe-Desk Custody Release in Progress
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          Deposited Item
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white tracking-tight">
                        Safe-Desk Custody Release in Progress
                      </h4>

                      <p className="text-xs text-slate-300 font-mono">
                        Item: <span className="font-bold text-white">{handover.item?.title || "Belonging"}</span>
                      </p>

                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{handover.item?.custodyLocation || "Campus Safe-Desk Station"}</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-white/5 text-xs font-mono text-slate-300">
                        Your deposited item has been approved. Awaiting recipient counter verification.
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Medium Urgency: Pending Claim Review */}
              {pendingClaims.map((claim) => (
                <div
                  key={claim._id}
                  className="rounded-xl border border-cyan-500/30 bg-slate-900/80 p-5 shadow-lg flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase">
                      Claim Under Review
                    </span>
                    <h4 className="text-sm font-bold text-white">
                      {claim.item?.title || "Campus Claim Submission"}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">
                      Your ownership response is pending custodian or Safe-Desk staff review.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    Submitted: {new Date(claim.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-slate-900/40 p-4 flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active Operations Radar // All Sectors Nominal</span>
            </div>
            <span className="text-[11px] text-slate-500">Zero Urgent Handover Actions Pending</span>
          </div>
        )}

        {/* SECTION 3: Quick-Launch Matrix (4 High-Impact Tiles) */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            Quick-Launch Operations Matrix
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_LAUNCH_MATRIX.map((tile) => {
              const Icon = tile.icon;
              return (
                <Link
                  key={tile.label}
                  href={tile.href}
                  className={`group relative rounded-xl border border-slate-800 bg-slate-900/90 p-5 transition-all duration-200 ${tile.border} flex flex-col justify-between shadow-lg`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-center">
                        <Icon className={`w-5 h-5 ${tile.iconColor}`} />
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/5">
                        {tile.badge}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors flex items-center gap-1.5">
                        {tile.label}
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-1 leading-relaxed">
                        {tile.desc}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* SECTION 4: Daily Tactical Quest Briefing (Real /api/content/daily data) */}
        {dailyData?.quest && (() => {
          const isCompleted = dailyData.userInvestigation?.status === "COMPLETED";
          const isInProgress = Boolean(dailyData.userInvestigation && !isCompleted);

          return (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-emerald-950/30 p-6 shadow-xl"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      DAILY TACTICAL QUEST BRIEFING
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Rotates daily at 00:00 IST
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white tracking-tight">
                    {dailyData.quest.title}
                  </h3>

                  <p className="text-xs text-slate-300 font-mono max-w-2xl leading-relaxed">
                    {dailyData.quest.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1 text-slate-400">
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      +{dailyData.quest.xpReward} XP
                    </span>
                    <span className="flex items-center gap-1 text-amber-400 font-bold">
                      <Coins className="w-3.5 h-3.5" />
                      +{dailyData.quest.coinReward} Coins
                    </span>
                    <span className="flex items-center gap-1 text-amber-300 font-bold">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      +{dailyData.quest.trophyReward || 25} Trophies
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400">
                      <MapPin className="w-3.5 h-3.5" />
                      {dailyData.quest.targetLocationId?.name || "Campus Ground"}
                    </span>
                    {isCompleted ? (
                      <span className="text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Investigation Complete // Daily Bounty Secured
                      </span>
                    ) : isInProgress ? (
                      <span className="text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Investigation in progress: Stage {dailyData.userInvestigation.currentStage || 1}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0">
                  <Link
                    href={`/quests/${dailyData.quest._id}`}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Target className="w-4 h-4" />
                    <span>
                      {isCompleted
                        ? "Review Field Debrief"
                        : isInProgress
                        ? "Continue Daily Investigation"
                        : "Launch Daily Investigation"}
                    </span>
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* SECTION 5: Active Event Banner (If any) */}
        {activeEvent && (
          <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-950/40 via-slate-900 to-cyan-950/30 p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  LIVE CAMPUS EVENT
                </span>
                <span className="text-[10px] font-mono text-cyan-400">
                  Top Prize: {activeEvent.rewardPool?.firstPlaceCoins || 250} Coins + {activeEvent.rewardPool?.exclusiveTitle || "Title"}
                </span>
              </div>
              <h4 className="text-base font-bold text-white">{activeEvent.title}</h4>
              <p className="text-xs text-slate-400 font-mono line-clamp-1">
                {activeEvent.description}
              </p>
            </div>
            <Link
              href="/events"
              className="px-4 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-300 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>View Event & Leaderboard</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* SECTION 6: Available Quests & Intel Wire */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Available Quests */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm font-mono">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                Available Investigation Quests
              </h3>
              <Link
                href="/quests"
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <span>View Quest Board</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {quests.length === 0 ? (
                <p className="text-slate-500 text-xs font-mono text-center py-6">
                  No active field quests available right now. Check back shortly.
                </p>
              ) : (
                quests.map((q) => (
                  <Link
                    key={q._id}
                    href={`/quests/${q._id}`}
                    className="block bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/30 rounded-xl p-4 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">{q.title}</p>
                        <p className="text-slate-500 text-xs font-mono mt-0.5">{q.questCode}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0 text-xs font-mono">
                        <span className="text-emerald-400">+{q.xpReward} XP</span>
                        <span className="text-amber-400">+{q.coinReward} 🪙</span>
                        <span className="text-amber-300 font-bold">+{q.trophyReward || (q.difficulty ? q.difficulty * 15 : 25)} 🏆</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Campus Activity Wire (Sanitized Public Telemetry) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm font-mono">
                  Campus Activity Wire
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-500">
                  {formatLastUpdated(feedLastUpdated)}
                </span>
                <button
                  onClick={handleRefreshWire}
                  disabled={refreshingFeed}
                  type="button"
                  title="Refresh Wire"
                  className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${refreshingFeed ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {liveFeed.length === 0 ? (
                <p className="text-slate-500 text-xs font-mono text-center py-6">
                  No public transactions reported in the last interval.
                </p>
              ) : (
                liveFeed.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex items-start gap-3"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        item.badgeColor === "emerald"
                          ? "bg-emerald-400"
                          : item.badgeColor === "cyan"
                          ? "bg-cyan-400"
                          : "bg-amber-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-200 truncate">{item.title}</p>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SECTION 7: Personal Operations & Submissions Activity Center */}
        <div id="personal-ops" className="scroll-mt-20">
          <PersonalOperationsHub onOpenHandoverModal={openSecureHandoverModal} />
        </div>

        {/* SECTION 7B: Private Verified Recovery Receipts Ledger */}
        <MyRecoveriesSection />

        {/* SECTION 8: Bottom Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/lost-and-found"
            className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-emerald-500/30 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Search className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                Lost & Found Directory
              </p>
              <p className="text-slate-500 text-xs font-mono mt-0.5">
                Browse all public active reports and safe-desk custody items
              </p>
            </div>
          </Link>

          <Link
            href="/map"
            className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-cyan-500/30 transition-colors group"
          >
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Compass className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                Tactical Campus Map
              </p>
              <p className="text-slate-500 text-xs font-mono mt-0.5">
                Inspect campus zones, safe-desks, and discovery hotspots
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* SECURE HANDOVER MODAL (Shoulder-Surfing Protected PIN) */}
      <AnimatePresence>
        {handoverModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl space-y-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase font-mono">
                      Safe-Desk Custody Handover PIN
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      Authorized Handover Certificate
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHandoverModal(null)}
                  type="button"
                  aria-label="Close Modal"
                  className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Station Info */}
              <div className="space-y-2 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Item:</span>
                  <span className="text-white font-bold">{handoverModal.itemTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Designated Station:</span>
                  <span className="text-emerald-400 font-bold">{handoverModal.locationName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Operating Hours:</span>
                  <span className="text-slate-300">{handoverModal.operatingHours}</span>
                </div>
              </div>

              {/* PIN Display Area */}
              {handoverModal.loading ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400 animate-pulse">
                  Decrypting one-time custody PIN...
                </div>
              ) : handoverModal.error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                  {handoverModal.error}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-6 rounded-2xl bg-slate-950 border border-amber-500/30 text-center space-y-3">
                    <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase block">
                      Single-Use Custody Verification PIN
                    </span>

                    <div className="flex items-center justify-center gap-3">
                      <span className="text-3xl font-black font-mono tracking-widest text-amber-300 select-all">
                        {handoverModal.revealed && handoverModal.handoverCode
                          ? `${handoverModal.handoverCode.slice(0, 3)} ${handoverModal.handoverCode.slice(3, 6)}`
                          : "••••••"}
                      </span>
                    </div>

                    <button
                      onClick={() =>
                        setHandoverModal((prev) =>
                          prev ? { ...prev, revealed: !prev.revealed } : null
                        )
                      }
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-mono text-slate-300 hover:text-white transition-colors"
                    >
                      {handoverModal.revealed ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                          <span>Mask PIN</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>Reveal PIN</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Security Caution Notice */}
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs font-mono text-amber-300/90 leading-relaxed">
                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-300 block mb-0.5">
                        Physical Custody Invariant:
                      </span>
                      Only present this PIN to verified Safe-Desk staff at the counter along with your AIEM Student Identity Card. Never disclose this code via campus chat, email, or telephone.
                    </div>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setHandoverModal(null)}
                  type="button"
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-white transition-colors"
                >
                  Close Clearance
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
