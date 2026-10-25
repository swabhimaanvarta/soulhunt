"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Award,
  Coins,
  MapPin,
  Users,
  Compass,
  CheckCircle2,
  Lock,
  ArrowLeft,
  ArrowRight,
  Building,
  Sparkles,
  Edit3,
  KeyRound,
  User,
  Phone,
  Mail,
  GraduationCap,
  Calendar,
  Clock,
  Package,
  PackageCheck,
  AlertCircle,
  Eye,
  Check,
  Save,
  Search,
  Target,
  Cpu,
  Bookmark,
  Share2,
  ExternalLink,
} from "lucide-react";

interface ProfileData {
  _id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  avatarPreset: string;
  bio: string;
  department: string;
  yearOfStudy: number;
  role: string;
  level: number;
  rankTitle: string;
  xp: number;
  trustScore: number;
  trustTier: string;
  equippedTitle: string;
  equippedFrame: string;
  equippedTheme: string;
  stats: {
    recoveriesCount?: number;
    safeDeskDepositsCount?: number;
    questsCompleted?: number;
    investigationQuestsCompleted?: number;
    mysteryQuestsNoHints?: number;
    legendaryQuestsCompleted?: number;
    cluesSolved?: number;
    squadQuestsCompleted?: number;
    treasuresFound?: number;
    visitedBlocks?: string[];
  };
  squad?: {
    _id?: string;
    name: string;
    tag: string;
    description: string;
    emblemIcon: string;
    squadLevel: number;
    squadXp: number;
    memberCap: number;
  } | null;
  createdAt: string;
  email?: string;
  phoneNumber?: string;
  studentId?: string;
  preferredContactMethod?: "EMAIL" | "PHONE" | "SAFE_DESK";
  coins?: number;
  isProfilePublic?: boolean;
  isLeaderboardPublic?: boolean;
  featuredAchievementIds?: string[];
}

interface ActivitiesData {
  lostItems: any[];
  foundItems: any[];
  claims: any[];
  achievements: any[];
}

const AVATAR_PRESETS = [
  { id: "recon", name: "Recon Scout", icon: Target, color: "emerald", border: "border-emerald-500", bg: "bg-emerald-950/80 text-emerald-400" },
  { id: "sleuth", name: "Cyber Sleuth", icon: Compass, color: "cyan", border: "border-cyan-500", bg: "bg-cyan-950/80 text-cyan-400" },
  { id: "vanguard", name: "Campus Vanguard", icon: Shield, color: "violet", border: "border-violet-500", bg: "bg-violet-950/80 text-violet-400" },
  { id: "sentinel", name: "AIEM Sentinel", icon: Cpu, color: "amber", border: "border-amber-500", bg: "bg-amber-950/80 text-amber-400" },
  { id: "shadow", name: "Shadow Tracker", icon: Eye, color: "rose", border: "border-rose-500", bg: "bg-rose-950/80 text-rose-400" },
  { id: "archivist", name: "Grand Archivist", icon: Bookmark, color: "blue", border: "border-blue-500", bg: "bg-blue-950/80 text-blue-400" },
];

const DEPARTMENTS = [
  "Computer Engineering",
  "Electronics & Computer Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Basic Sciences & Humanities",
  "Administration & Campus Staff",
];

const COSMETIC_FRAMES = [
  {
    id: "frame-emerald-pulse",
    name: "Emerald Cyber Pulse",
    border: "border-emerald-400",
    shadow: "shadow-[0_0_20px_rgba(16,185,129,0.6)] ring-2 ring-emerald-400/40 animate-pulse",
  },
  {
    id: "frame-cyan-matrix",
    name: "Neon Cyan Matrix",
    border: "border-cyan-400",
    shadow: "shadow-[0_0_20px_rgba(6,182,212,0.7)] ring-2 ring-cyan-400/50",
  },
  {
    id: "frame-amber-hud",
    name: "Tactical HUD Amber",
    border: "border-amber-400",
    shadow: "shadow-[0_0_20px_rgba(245,158,11,0.6)] ring-2 ring-amber-400/40",
  },
  {
    id: "frame-violet-ring",
    name: "Void Violet Ring",
    border: "border-violet-400",
    shadow: "shadow-[0_0_20px_rgba(168,85,247,0.7)] ring-2 ring-violet-400/50",
  },
  {
    id: "frame-obsidian",
    name: "Obsidian Stealth",
    border: "border-slate-500",
    shadow: "shadow-[0_0_15px_rgba(100,116,139,0.5)] ring-1 ring-slate-400/20",
  },
];

const COSMETIC_THEMES = [
  {
    id: "theme-obsidian-grid",
    name: "Obsidian Grid (Tactical)",
    bg: "bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border-white/10",
  },
  {
    id: "theme-emerald-recon",
    name: "Emerald Recon",
    bg: "bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-900 border-emerald-500/30",
  },
  {
    id: "theme-cyber-cyan",
    name: "Cyberpunk Cyan",
    bg: "bg-gradient-to-br from-slate-950 via-cyan-950/40 to-slate-900 border-cyan-500/30",
  },
  {
    id: "theme-amber-tactical",
    name: "Tactical Amber",
    bg: "bg-gradient-to-br from-slate-950 via-amber-950/40 to-slate-900 border-amber-500/30",
  },
  {
    id: "theme-violet-void",
    name: "Void Violet",
    bg: "bg-gradient-to-br from-slate-950 via-violet-950/40 to-slate-900 border-violet-500/30",
  },
];

const COSMETIC_TITLES = [
  "Campus Pathfinder",
  "Campus Sleuth",
  "Lead Decoder",
  "Tactical Operative",
  "Safe-Desk Custodian",
  "Eagle Eye",
  "The Campus Phantom",
  "Grand Archivist",
];

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params?.username as string;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileHidden, setProfileHidden] = useState(false);
  const [activities, setActivities] = useState<ActivitiesData>({
    lostItems: [],
    foundItems: [],
    claims: [],
    achievements: [],
  });
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dossier" | "activity" | "achievements" | "settings">("dossier");

  // Edit Profile Form State
  const [editForm, setEditForm] = useState<{
    displayName: string;
    bio: string;
    department: string;
    yearOfStudy: number;
    studentId: string;
    phoneNumber: string;
    preferredContactMethod: "EMAIL" | "PHONE" | "SAFE_DESK";
    avatarPreset: string;
    equippedTitle: string;
    equippedFrame: string;
    equippedTheme: string;
    featuredAchievementIds: string[];
    isProfilePublic: boolean;
    isLeaderboardPublic: boolean;
  }>({
    displayName: "",
    bio: "",
    department: "",
    yearOfStudy: 1,
    studentId: "",
    phoneNumber: "",
    preferredContactMethod: "SAFE_DESK",
    avatarPreset: "recon",
    equippedTitle: "Campus Pathfinder",
    equippedFrame: "frame-emerald-pulse",
    equippedTheme: "theme-obsidian-grid",
    featuredAchievementIds: [],
    isProfilePublic: true,
    isLeaderboardPublic: true,
  });
  const [previewAsVisitor, setPreviewAsVisitor] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Change Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Activity filter state
  const [activityFilter, setActivityFilter] = useState<"ALL" | "LOST" | "FOUND" | "CLAIMS">("ALL");

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const url = username ? `/api/user/profile?username=${encodeURIComponent(username)}` : `/api/user/profile`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.profileHidden) {
        setProfileHidden(true);
        setProfile(data.profile);
        setIsOwnProfile(false);
        setActivities({ lostItems: [], foundItems: [], claims: [], achievements: [] });
      } else if (data.success && data.profile) {
        setProfileHidden(false);
        setProfile(data.profile);
        setIsOwnProfile(data.isOwnProfile || false);
        setActivities(data.activities || { lostItems: [], foundItems: [], claims: [], achievements: [] });

        setEditForm({
          displayName: data.profile.displayName || "",
          bio: data.profile.bio || "",
          department: data.profile.department || "Computer Engineering",
          yearOfStudy: data.profile.yearOfStudy || 1,
          studentId: data.profile.studentId || "",
          phoneNumber: data.profile.phoneNumber || "",
          preferredContactMethod: data.profile.preferredContactMethod || "SAFE_DESK",
          avatarPreset: data.profile.avatarPreset || "recon",
          equippedTitle: data.profile.equippedTitle || "Campus Pathfinder",
          equippedFrame: data.profile.equippedFrame || "frame-emerald-pulse",
          equippedTheme: data.profile.equippedTheme || "theme-obsidian-grid",
          featuredAchievementIds: data.profile.featuredAchievementIds || [],
          isProfilePublic: data.profile.isProfilePublic ?? true,
          isLeaderboardPublic: data.profile.isLeaderboardPublic ?? true,
        });
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();

      if (data.success) {
        setProfileMessage({ text: "Profile dossier successfully updated!", type: "success" });
        if (profile) {
          setProfile({
            ...profile,
            ...editForm,
          });
        }
        setTimeout(() => setProfileMessage(null), 4000);
      } else {
        setProfileMessage({ text: data.error?.message || "Failed to update profile.", type: "error" });
      }
    } catch (err: any) {
      setProfileMessage({ text: err.message || "Network error updating profile.", type: "error" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ text: "New passwords do not match.", type: "error" });
      setSavingPassword(false);
      return;
    }

    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json();

      if (data.success) {
        setPasswordMessage({ text: "Password changed successfully!", type: "success" });
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => setPasswordMessage(null), 4000);
      } else {
        setPasswordMessage({ text: data.error?.message || "Failed to update password.", type: "error" });
      }
    } catch (err: any) {
      setPasswordMessage({ text: err.message || "Network error updating password.", type: "error" });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center font-mono text-xs text-emerald-400 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        <span className="tracking-widest">DECRYPTING INVESTIGATOR DOSSIER...</span>
      </div>
    );
  }

  if (profileHidden) {
    const privateAvatar = AVATAR_PRESETS.find((p) => p.id === (profile?.avatarPreset || "recon")) || AVATAR_PRESETS[0];
    const PrivateAvatarIcon = privateAvatar.icon;

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full glass-panel rounded-3xl p-8 border border-white/10 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <PrivateAvatarIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">{profile?.displayName || "Investigator"}</h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-300">
            <Lock className="w-3.5 h-3.5" />
            <span>Private Investigator Profile</span>
          </div>
          <p className="text-xs text-slate-400">
            This investigator has chosen to keep their campus dossier, rankings, and activities confidential.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-block px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all"
            >
              Return to HQ Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full glass-panel rounded-3xl p-8 border border-white/10 text-center space-y-4">
          <Shield className="w-12 h-12 text-slate-600 mx-auto" />
          <h2 className="text-xl font-bold text-white">Investigator Not Found</h2>
          <p className="text-sm text-slate-400">The profile for @{username} does not exist or has been restricted.</p>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all"
          >
            Return to HQ Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const activeAvatar = AVATAR_PRESETS.find((p) => p.id === (profile.avatarPreset || "recon")) || AVATAR_PRESETS[0];
  const AvatarIcon = activeAvatar.icon;
  const xpInLevel = (profile.xp || 0) % 500;
  const xpProgressPct = Math.min(100, Math.round((xpInLevel / 500) * 100));

  const currentTitle = previewAsVisitor ? editForm.equippedTitle : (profile.equippedTitle || "Campus Pathfinder");
  const activeFrame = COSMETIC_FRAMES.find(
    (f) => f.id === (previewAsVisitor ? editForm.equippedFrame : (profile.equippedFrame || "frame-emerald-pulse"))
  ) || COSMETIC_FRAMES[0];
  const activeTheme = COSMETIC_THEMES.find(
    (t) => t.id === (previewAsVisitor ? editForm.equippedTheme : (profile.equippedTheme || "theme-obsidian-grid"))
  ) || COSMETIC_THEMES[0];

  const currentFeaturedIds = previewAsVisitor
    ? editForm.featuredAchievementIds
    : (profile.featuredAchievementIds || []);
  const featuredAchievements = (activities.achievements || []).filter((ua: any) => {
    const achId = ua.achievementId?._id?.toString() || ua.achievementId?.toString() || ua._id?.toString();
    return currentFeaturedIds.includes(achId);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Top Banner & Breadcrumb */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-xs font-mono text-slate-400">
              CAMPUS RECON / DOSSIER / <span className="text-emerald-400 font-bold">@{profile.username}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isOwnProfile && (
              <>
                <button
                  onClick={() => setPreviewAsVisitor(!previewAsVisitor)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                    previewAsVisitor
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50 ring-1 ring-amber-400"
                      : "bg-slate-900 border-white/10 text-slate-300 hover:text-white"
                  }`}
                  title="Toggle public visitor preview to see how other hunters view your profile"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {previewAsVisitor ? "Exit Visitor Preview" : "Public Preview"}
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold hover:bg-emerald-500/20 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
              </>
            )}
            <Link
              href="/lost-and-found"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300 text-xs font-mono hover:text-white transition-all"
            >
              <Package className="w-3.5 h-3.5 text-cyan-400" />
              L&F Board
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Main Dossier Header Banner styled with activeTheme */}
        <div className={`relative rounded-3xl ${activeTheme.bg} border p-6 md:p-8 shadow-2xl overflow-hidden transition-all duration-300`}>
          {/* Cyber Accent Lines */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Avatar & Identity with activeFrame */}
            <div className="flex items-start sm:items-center gap-5">
              <div
                className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 flex items-center justify-center transition-all ${activeAvatar.border} ${activeAvatar.bg} ${activeFrame.border} ${activeFrame.shadow}`}
              >
                <AvatarIcon className="w-10 h-10 sm:w-12 sm:h-12" />
                <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase bg-slate-950 border border-white/20 text-white">
                  LVL {profile.level}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {profile.rankTitle}
                  </span>
                  {currentTitle && (
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-200 border border-purple-500/40 font-bold shadow-sm shadow-purple-500/20">
                      &ldquo;{currentTitle}&rdquo;
                    </span>
                  )}
                  {profile.role === "ADMIN" && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                      ADMINISTRATOR
                    </span>
                  )}
                  {profile.role === "SAFE_DESK_STAFF" && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                      SAFE-DESK CUSTODIAN
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                  {profile.displayName}
                </h1>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                  <span className="text-slate-300">@{profile.username}</span>
                  <span>•</span>
                  <span>{profile.department}</span>
                  <span>•</span>
                  <span>Year {profile.yearOfStudy}</span>
                  {profile.studentId && (
                    <>
                      <span>•</span>
                      <span className="text-cyan-400">ID: {profile.studentId}</span>
                    </>
                  )}
                </div>

                {/* Squad Syndicate Command Pill */}
                {profile.squad && (
                  <div className="pt-2">
                    <Link
                      href={`/squads/${profile.squad._id || ""}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 hover:border-emerald-500/60 transition-all font-mono text-xs group shadow-sm"
                    >
                      <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                        {profile.squad.tag}
                      </div>
                      <span className="text-white font-bold group-hover:text-emerald-300 transition-colors">
                        {profile.squad.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                        LVL {profile.squad.squadLevel || 1}
                      </span>
                      <ArrowRight className="w-3 h-3 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Trust HUD & Economy */}
            <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
              <div className="px-4 py-3 rounded-2xl bg-slate-950/80 border border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] font-mono uppercase text-slate-400">Campus Trust</span>
                </div>
                <div className="text-lg font-mono font-bold text-cyan-300">
                  {profile.trustTier?.replace(/_/g, " ")}
                </div>
                <div className="text-[10px] font-mono text-slate-500">{profile.trustScore} / 1000 Trust Score</div>
              </div>

              {isOwnProfile && profile.coins !== undefined && (
                <Link
                  href="/rewards"
                  className="px-4 py-3 rounded-2xl bg-slate-950/80 border border-amber-500/30 hover:border-amber-500/60 transition-colors backdrop-blur-md group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Coins className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                    <span className="text-[10px] font-mono uppercase text-slate-400">Hunter Balance</span>
                  </div>
                  <div className="text-lg font-mono font-bold text-amber-300">{profile.coins} 🪙</div>
                  <div className="text-[10px] font-mono text-amber-400/80 flex items-center gap-1">
                    Rewards Shop <ExternalLink className="w-2.5 h-2.5" />
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* XP Level Progress Bar */}
          <div className="mt-6 pt-5 border-t border-white/5 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                XP Progress — Level {profile.level} ({profile.rankTitle})
              </span>
              <span className="text-emerald-400 font-bold">
                {xpInLevel} / 500 XP ({xpProgressPct}%)
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-white/5">
              <div
                className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                style={{ width: `${xpProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Featured Achievements Showcase (Player's Pinned Honours) */}
        {featuredAchievements.length > 0 && (
          <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold font-mono text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Featured Honours &amp; Achievements
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Pinned Showcase ({featuredAchievements.length}/3)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {featuredAchievements.map((ua: any) => {
                const ach = ua.achievementId || ua;
                return (
                  <div
                    key={ach._id || ach.code}
                    className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 hover:border-amber-500/30 transition-all space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                        ach.rarity === "LEGENDARY" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" :
                        ach.rarity === "EPIC" ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" :
                        ach.rarity === "RARE" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" :
                        "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      }`}>
                        {ach.rarity || "HONOUR"}
                      </span>
                      <Award className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                    </div>
                    <div className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors">
                      {ach.title}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {ach.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Navigation Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar font-mono text-xs">
          <button
            onClick={() => setActiveTab("dossier")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "dossier"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <User className="w-4 h-4" />
            Agent Dossier
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "activity"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Package className="w-4 h-4" />
            Lost & Found Records
            <span className="px-1.5 py-0.2 bg-slate-800 rounded-md text-[10px]">
              {(activities.lostItems?.length || 0) + (activities.foundItems?.length || 0)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("achievements")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "achievements"
                ? "bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Award className="w-4 h-4" />
            Achievements
            <span className="px-1.5 py-0.2 bg-slate-800 rounded-md text-[10px]">
              {activities.achievements?.length || 0}
            </span>
          </button>

          {isOwnProfile && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeTab === "settings"
                  ? "bg-violet-500/15 text-violet-300 border border-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Edit3 className="w-4 h-4" />
              Settings & Security
            </button>
          )}
        </div>

        {/* TAB 1: DOSSIER OVERVIEW */}
        {activeTab === "dossier" && (
          <div className="space-y-6">
            {/* Bio & Field Notes */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-3">
              <h3 className="text-sm font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Bookmark className="w-4 h-4" /> Field Notes & Bio
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed font-sans">
                {profile.bio || "No personal bio or field notes recorded for this investigator yet."}
              </p>
            </div>

            {/* Academic & Contact Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
                <h3 className="text-sm font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" /> Institutional Credentials
                </h3>
                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-slate-400">College</span>
                    <span className="text-white font-bold">AIEM — Agnel Institute</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Department</span>
                    <span className="text-white">{profile.department}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Year of Study</span>
                    <span className="text-white">Year {profile.yearOfStudy} (Engineering)</span>
                  </div>
                  {profile.studentId && (
                    <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                      <span className="text-slate-400">Student Roll / PRN</span>
                      <span className="text-cyan-300 font-bold">{profile.studentId}</span>
                    </div>
                  )}
                  {profile.email && (
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-slate-400">Official College Email</span>
                      <span className="text-emerald-400">{profile.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Handover & Recovery Preferences */}
              <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
                <h3 className="text-sm font-bold font-mono text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Custody & Handover Protocols
                </h3>
                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Preferred Handover</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      {profile.preferredContactMethod || "SAFE_DESK"}
                    </span>
                  </div>
                  {profile.phoneNumber && (
                    <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                      <span className="text-slate-400">Contact Phone</span>
                      <span className="text-white font-bold">{profile.phoneNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                    <span className="text-slate-400">Safe-Desk Station</span>
                    <span className="text-cyan-300">Admin Block Ground / Lib 2F</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-400">Investigator Since</span>
                    <span className="text-slate-300">
                      {new Date(profile.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Career Investigation Stats */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
              <h3 className="text-sm font-bold font-mono text-violet-400 uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4" /> Career Investigation Stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-950/70 border border-white/5 rounded-xl p-3.5 text-center">
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {profile.stats?.recoveriesCount || 0}
                  </div>
                  <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Recoveries</div>
                </div>

                <div className="bg-slate-950/70 border border-white/5 rounded-xl p-3.5 text-center">
                  <div className="text-2xl font-black font-mono text-cyan-400">
                    {profile.stats?.safeDeskDepositsCount || 0}
                  </div>
                  <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Safe Deposits</div>
                </div>

                <div className="bg-slate-950/70 border border-white/5 rounded-xl p-3.5 text-center">
                  <div className="text-2xl font-black font-mono text-amber-400">
                    {profile.stats?.questsCompleted || 0}
                  </div>
                  <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Quests Solved</div>
                </div>

                <div className="bg-slate-950/70 border border-white/5 rounded-xl p-3.5 text-center">
                  <div className="text-2xl font-black font-mono text-violet-400">
                    {profile.stats?.cluesSolved || 0}
                  </div>
                  <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Clues Solved</div>
                </div>

                <div className="bg-slate-950/70 border border-white/5 rounded-xl p-3.5 text-center">
                  <div className="text-2xl font-black font-mono text-pink-400">
                    {profile.stats?.visitedBlocks?.length || 0}
                  </div>
                  <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Blocks Visited</div>
                </div>

                <div className="bg-slate-950/70 border border-white/5 rounded-xl p-3.5 text-center">
                  <div className="text-2xl font-black font-mono text-teal-400">
                    {profile.stats?.treasuresFound || 0}
                  </div>
                  <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Treasures</div>
                </div>
              </div>
            </div>

            {/* Squad Affiliation Banner */}
            {profile.squad ? (
              <div className="glass-panel rounded-2xl p-6 border border-emerald-500/20 bg-emerald-950/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-mono font-black text-emerald-400 text-lg">
                    {profile.squad.tag}
                  </div>
                  <div>
                    <div className="text-xs font-mono text-emerald-400">SQUAD AFFILIATION • LVL {profile.squad.squadLevel}</div>
                    <div className="text-lg font-bold text-white">{profile.squad.name}</div>
                    <div className="text-xs text-slate-400">{profile.squad.description}</div>
                  </div>
                </div>
                <Link
                  href="/squads"
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-300 text-xs font-mono hover:bg-slate-800 transition-colors"
                >
                  View Squad Headquarters →
                </Link>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl p-6 border border-white/5 text-center space-y-2">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No Squad Affiliation</p>
                <p className="text-xs text-slate-500">
                  Form or join a campus recovery squad to solve group investigation quests.
                </p>
                <Link
                  href="/squads"
                  className="inline-block mt-2 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono text-slate-300 hover:text-white"
                >
                  Explore Campus Squads
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RECOVERIES & ITEMS ACTIVITY */}
        {activeTab === "activity" && (
          <div className="space-y-6">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 font-mono text-xs">
              {(["ALL", "LOST", "FOUND", "CLAIMS"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActivityFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activityFilter === filter
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30"
                      : "bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lost Items */}
              {(activityFilter === "ALL" || activityFilter === "LOST") &&
                activities.lostItems?.map((item) => (
                  <div
                    key={item._id}
                    className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-emerald-500/30 transition-all space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        LOST REPORT
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          item.status === "RECOVERED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-white">{item.title}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{item.category} • {item.spotDetails || "Campus Grounds"}</p>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-white/5">
                      <span>Reported: {new Date(item.createdAt).toLocaleDateString()}</span>
                      <Link href={`/items/${item._id}`} className="text-emerald-400 hover:underline">
                        View Item →
                      </Link>
                    </div>
                  </div>
                ))}

              {/* Found Items */}
              {(activityFilter === "ALL" || activityFilter === "FOUND") &&
                activities.foundItems?.map((item) => (
                  <div
                    key={item._id}
                    className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-cyan-500/30 transition-all space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        FOUND REPORT
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          item.status === "RECOVERED" || item.custodyStatus === "DEPOSITED_AT_SAFE_DESK"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-cyan-500/20 text-cyan-300"
                        }`}
                      >
                        {item.custodyStatus || item.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-white">{item.shortTitle || item.title}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{item.category} • {item.spotDetails || "Campus Station"}</p>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-white/5">
                      <span>Found: {new Date(item.createdAt).toLocaleDateString()}</span>
                      <Link href={`/items/${item._id}`} className="text-cyan-400 hover:underline">
                        View Item →
                      </Link>
                    </div>
                  </div>
                ))}

              {/* Claims */}
              {(activityFilter === "ALL" || activityFilter === "CLAIMS") &&
                activities.claims?.map((claim) => (
                  <div
                    key={claim._id}
                    className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-violet-500/30 transition-all space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        CLAIM ATTEMPT
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300">
                        {claim.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-white">{claim.itemId?.title || claim.itemId?.shortTitle || "Campus Item"}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">Type: {claim.itemType}</p>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between pt-2 border-t border-white/5">
                      <span>Submitted: {new Date(claim.createdAt).toLocaleDateString()}</span>
                      {claim.itemId?._id && (
                        <Link href={`/items/${claim.itemId._id}`} className="text-violet-400 hover:underline">
                          View Target →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {activities.lostItems.length === 0 && activities.foundItems.length === 0 && activities.claims.length === 0 && (
              <div className="text-center py-16 text-slate-500 font-mono text-sm">
                No activity records logged for this investigator yet.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ACHIEVEMENTS & HONORS */}
        {activeTab === "achievements" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activities.achievements?.map((userAch: any) => {
                const ach = userAch.achievementId;
                if (!ach) return null;

                const rarityColor =
                  ach.rarity === "LEGENDARY"
                    ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
                    : ach.rarity === "EPIC"
                    ? "text-purple-400 border-purple-500/40 bg-purple-500/10"
                    : ach.rarity === "RARE"
                    ? "text-cyan-400 border-cyan-500/40 bg-cyan-500/10"
                    : "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";

                return (
                  <div
                    key={userAch._id}
                    className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-white/20 transition-all flex items-start gap-4"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${rarityColor}`}
                    >
                      <Award className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                          {ach.rarity}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          +{ach.xpReward} XP
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white truncate">{ach.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2">{ach.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {activities.achievements.length === 0 && (
              <div className="text-center py-16 text-slate-500 font-mono text-sm space-y-2">
                <Award className="w-10 h-10 text-slate-700 mx-auto" />
                <p>No achievements unlocked yet.</p>
                <p className="text-xs text-slate-600">Solve campus quests and report items to earn honours.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SETTINGS & EDIT PROFILE (Account Owner Only) */}
        {activeTab === "settings" && isOwnProfile && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form 1: Edit Profile Details */}
            <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-emerald-400" />
                  Edit Profile Information
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Update your public campus dossier, engineering department, and contact preference.
                </p>
              </div>

              {profileMessage && (
                <div
                  className={`p-3 rounded-xl font-mono text-xs flex items-center gap-2 ${
                    profileMessage.type === "success"
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50"
                      : "bg-rose-950/80 text-rose-300 border border-rose-500/50"
                  }`}
                >
                  {profileMessage.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {profileMessage.text}
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                {/* Tactical Avatar Selector */}
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-2">
                    TACTICAL AVATAR PRESET
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {AVATAR_PRESETS.map((p) => {
                      const Icon = p.icon;
                      const isSelected = editForm.avatarPreset === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, avatarPreset: p.id })}
                          className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                            isSelected
                              ? `${p.border} ${p.bg} ring-2 ring-emerald-400/50 scale-105`
                              : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/30"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-[9px] font-mono font-bold truncate max-w-full">
                            {p.name.split(" ")[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    DISPLAY NAME <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors font-sans"
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>

                {/* Bio / Field Notes */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-mono text-slate-300">BIO & FIELD NOTES</label>
                    <span className="text-[10px] font-mono text-slate-500">
                      {editForm.bio.length}/300
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={300}
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors font-sans resize-none"
                    placeholder="Briefly describe yourself, your hobbies, or campus routine..."
                  />
                </div>

                {/* Department & Year of Study */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      DEPARTMENT
                    </label>
                    <select
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      YEAR OF STUDY
                    </label>
                    <select
                      value={editForm.yearOfStudy}
                      onChange={(e) => setEditForm({ ...editForm, yearOfStudy: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                    >
                      <option value={1}>1st Year (FE)</option>
                      <option value={2}>2nd Year (SE)</option>
                      <option value={3}>3rd Year (TE)</option>
                      <option value={4}>4th Year (BE)</option>
                      <option value={5}>Faculty / Staff</option>
                    </select>
                  </div>
                </div>

                {/* Student Roll Number & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      STUDENT ID / ROLL NO.
                    </label>
                    <input
                      type="text"
                      value={editForm.studentId}
                      onChange={(e) => setEditForm({ ...editForm, studentId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono uppercase focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. 22CS045"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      PHONE NUMBER (FOR RECOVERY)
                    </label>
                    <input
                      type="tel"
                      value={editForm.phoneNumber}
                      onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                {/* Handover Preference */}
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    HANDOVER COORDINATION PREFERENCE
                  </label>
                  <select
                    value={editForm.preferredContactMethod}
                    onChange={(e) => setEditForm({ ...editForm, preferredContactMethod: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  >
                    <option value="SAFE_DESK">Safe-Desk Custody Drop (Recommended)</option>
                    <option value="PHONE">Direct Contact via Phone</option>
                    <option value="EMAIL">Official College Email Exchange</option>
                  </select>
                </div>

                {/* Profile Customization: Titles, Frames, Themes, and Featured Honours */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4">
                  <div className="text-xs font-mono font-bold text-violet-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    COSMETIC CUSTOMIZATION &amp; ARMORY FLAIR
                  </div>

                  {/* Equipped Title */}
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      EQUIPPED OPERATIVE TITLE
                    </label>
                    <select
                      value={editForm.equippedTitle}
                      onChange={(e) => setEditForm({ ...editForm, equippedTitle: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
                    >
                      {COSMETIC_TITLES.map((t) => (
                        <option key={t} value={t}>
                          &ldquo;{t}&rdquo;
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Avatar Frame Selector */}
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">
                      AVATAR FRAME GLOW
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {COSMETIC_FRAMES.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, equippedFrame: f.id })}
                          className={`p-2 rounded-xl border text-left font-mono text-[10px] transition-all flex items-center gap-2 ${
                            editForm.equippedFrame === f.id
                              ? "bg-violet-500/20 border-violet-500 text-white ring-1 ring-violet-400"
                              : "bg-slate-950/60 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full border-2 ${f.border}`} />
                          <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Profile Theme Selector */}
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">
                      DOSSIER THEME
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {COSMETIC_THEMES.map((th) => (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, equippedTheme: th.id })}
                          className={`p-2 rounded-xl border text-left font-mono text-[10px] transition-all ${
                            editForm.equippedTheme === th.id
                              ? "bg-violet-500/20 border-violet-500 text-white ring-1 ring-violet-400"
                              : "bg-slate-950/60 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          <span className="truncate">{th.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pin Featured Achievements */}
                  {activities.achievements?.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-mono text-slate-300">
                          FEATURED SHOWCASE HONOURS (MAX 3)
                        </label>
                        <span className="text-[10px] font-mono text-amber-400">
                          {editForm.featuredAchievementIds?.length || 0}/3 Pinned
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar pr-1">
                        {activities.achievements.map((ua: any) => {
                          const ach = ua.achievementId || ua;
                          const achId = ach._id?.toString() || ach.code;
                          const isPinned = editForm.featuredAchievementIds?.includes(achId);

                          return (
                            <label
                              key={achId}
                              className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer font-mono text-xs transition-colors ${
                                isPinned
                                  ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                                  : "bg-slate-950/60 border-white/5 text-slate-400 hover:text-white"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="truncate text-[11px] font-bold">{ach.title}</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={isPinned}
                                onChange={(e) => {
                                  const current = editForm.featuredAchievementIds || [];
                                  if (e.target.checked) {
                                    if (current.length < 3) {
                                      setEditForm({
                                        ...editForm,
                                        featuredAchievementIds: [...current, achId],
                                      });
                                    }
                                  } else {
                                    setEditForm({
                                      ...editForm,
                                      featuredAchievementIds: current.filter((id) => id !== achId),
                                    });
                                  }
                                }}
                                disabled={!isPinned && (editForm.featuredAchievementIds?.length || 0) >= 3}
                                className="rounded border-white/20 bg-slate-950 text-amber-500 focus:ring-amber-500/50"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Privacy & Visibility Toggles */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
                  <div className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    PRIVACY &amp; VISIBILITY CONTROLS
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isProfilePublic}
                      onChange={(e) => setEditForm({ ...editForm, isProfilePublic: e.target.checked })}
                      className="mt-0.5 rounded border-white/20 bg-slate-950 text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white">Public Profile Visibility</div>
                      <div className="text-[11px] text-slate-400 leading-normal">
                        Allow other campus investigators to view your agent dossier, rank, and unlocked achievements.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer border-t border-white/5 pt-2">
                    <input
                      type="checkbox"
                      checked={editForm.isLeaderboardPublic}
                      onChange={(e) => setEditForm({ ...editForm, isLeaderboardPublic: e.target.checked })}
                      className="mt-0.5 rounded border-white/20 bg-slate-950 text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white">Public Leaderboard Standings</div>
                      <div className="text-[11px] text-slate-400 leading-normal">
                        Display your agent handle and XP score on the campus leaderboard. Unchecking hides you from public rankings.
                      </div>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingProfile ? "Updating Profile..." : "Save Profile Changes"}
                </button>
              </form>
            </div>

            {/* Form 2: Change Password & Security */}
            <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-violet-400" />
                  Security & Password
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Change your institutional account password. Passwords require letters, numbers, and symbols.
                </p>
              </div>

              {passwordMessage && (
                <div
                  className={`p-3 rounded-xl font-mono text-xs flex items-center gap-2 ${
                    passwordMessage.type === "success"
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50"
                      : "bg-rose-950/80 text-rose-300 border border-rose-500/50"
                  }`}
                >
                  {passwordMessage.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {passwordMessage.text}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    CURRENT PASSWORD
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors font-mono"
                    placeholder="••••••••••••"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    NEW PASSWORD
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors font-mono"
                    placeholder="At least 8 characters with Aa & 123"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    CONFIRM NEW PASSWORD
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors font-mono"
                    placeholder="Re-enter new password"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1 text-[11px] font-mono text-slate-400">
                  <div className="font-bold text-slate-300">Security Requirements:</div>
                  <div>• Minimum 8 characters long</div>
                  <div>• At least 1 uppercase and 1 lowercase letter</div>
                  <div>• At least 1 numerical digit</div>
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  {savingPassword ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
