export interface ProfileUser {
  _id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  avatarPreset?: string;
  bio?: string;
  department?: string;
  yearOfStudy?: number;
  role?: string;
  level?: number;
  rankTitle?: string;
  xp?: number;
  coins?: number;
  trophies?: number;
  weeklyScore?: number;
  trustScore?: number;
  trustTier?: string;
  equippedTitle?: string;
  equippedFrame?: string;
  equippedTheme?: string;
  equippedEffect?: string;
  streak?: number;
  currentStreak?: number;
  seasonalTier?: string;
  stats?: {
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
    description?: string;
    emblemIcon?: string;
    squadLevel?: number;
    squadXp?: number;
    memberCap?: number;
  } | null;
  createdAt?: string;
  email?: string;
  phoneNumber?: string;
  studentId?: string;
  preferredContactMethod?: "EMAIL" | "PHONE" | "SAFE_DESK";
  isProfilePublic?: boolean;
  isLeaderboardPublic?: boolean;
  identityMode?: "PSEUDONYMOUS" | "ANONYMOUS" | "PUBLIC";
  publicAttributionPreference?: "HANDLE" | "ANONYMOUS";
  featuredAchievementIds?: string[];
}

export interface AchievementItem {
  _id: string;
  userId?: string;
  progress?: number;
  isUnlocked: boolean;
  unlockedAt?: string | null;
  achievementId: {
    _id: string;
    code: string;
    title: string;
    description: string;
    badgeIcon?: string;
    rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
    metricKey?: string;
    threshold: number;
    xpReward: number;
    coinReward: number;
  };
}

export interface ActivitiesData {
  lostItems: any[];
  foundItems: any[];
  claims: any[];
  achievements: AchievementItem[];
}

export const AVATAR_PRESETS = [
  { id: "recon", name: "Recon Scout", roleDesc: "Field Detection & Zone Patrol", color: "emerald", border: "border-emerald-500", bg: "bg-emerald-950/80 text-emerald-400" },
  { id: "sleuth", name: "Cyber Sleuth", roleDesc: "Digital Clues & Investigation", color: "cyan", border: "border-cyan-500", bg: "bg-cyan-950/80 text-cyan-400" },
  { id: "vanguard", name: "Campus Vanguard", roleDesc: "Safe-Desk Custody & Defense", color: "violet", border: "border-violet-500", bg: "bg-violet-950/80 text-violet-400" },
  { id: "sentinel", name: "AIEM Sentinel", roleDesc: "Station Security & Scanning", color: "amber", border: "border-amber-500", bg: "bg-amber-950/80 text-amber-400" },
  { id: "shadow", name: "Shadow Tracker", roleDesc: "Stealth Recovery & Night Ops", color: "rose", border: "border-rose-500", bg: "bg-rose-950/80 text-rose-400" },
  { id: "archivist", name: "Grand Archivist", roleDesc: "Records, Catalog & Ledger", color: "blue", border: "border-blue-500", bg: "bg-blue-950/80 text-blue-400" },
] as const;

export const DEPARTMENTS = [
  "Computer Engineering",
  "Electronics & Computer Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Basic Sciences & Humanities",
  "Administration & Campus Staff",
] as const;

export const COSMETIC_FRAMES = [
  {
    id: "frame-emerald-pulse",
    name: "Emerald Cyber Pulse",
    border: "border-emerald-400",
    shadow: "shadow-[0_0_20px_rgba(16,185,129,0.6)] ring-2 ring-emerald-400/40 animate-pulse",
    accent: "text-emerald-400",
    glowColor: "rgba(16, 185, 129, 0.5)",
  },
  {
    id: "frame-cyan-matrix",
    name: "Neon Cyan Matrix",
    border: "border-cyan-400",
    shadow: "shadow-[0_0_20px_rgba(6,182,212,0.7)] ring-2 ring-cyan-400/50",
    accent: "text-cyan-400",
    glowColor: "rgba(6, 182, 212, 0.5)",
  },
  {
    id: "frame-amber-hud",
    name: "Tactical HUD Amber",
    border: "border-amber-400",
    shadow: "shadow-[0_0_20px_rgba(245,158,11,0.6)] ring-2 ring-amber-400/40",
    accent: "text-amber-400",
    glowColor: "rgba(245, 158, 11, 0.5)",
  },
  {
    id: "frame-violet-ring",
    name: "Void Violet Ring",
    border: "border-violet-400",
    shadow: "shadow-[0_0_20px_rgba(168,85,247,0.7)] ring-2 ring-violet-400/50",
    accent: "text-violet-400",
    glowColor: "rgba(168, 85, 247, 0.5)",
  },
  {
    id: "frame-obsidian",
    name: "Obsidian Stealth",
    border: "border-slate-500",
    shadow: "shadow-[0_0_15px_rgba(100,116,139,0.5)] ring-1 ring-slate-400/20",
    accent: "text-slate-300",
    glowColor: "rgba(100, 116, 139, 0.3)",
  },
] as const;

export const COSMETIC_THEMES = [
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
] as const;

export const COSMETIC_TITLES = [
  "Campus Pathfinder",
  "Campus Sleuth",
  "Lead Decoder",
  "Tactical Operative",
  "Safe-Desk Custodian",
  "Eagle Eye",
  "The Campus Phantom",
  "Grand Archivist",
] as const;
