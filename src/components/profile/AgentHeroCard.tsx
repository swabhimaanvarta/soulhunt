"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Award,
  Users,
  Share2,
  Check,
  Sparkles,
  Target,
  Compass,
  Cpu,
  Eye,
  Bookmark,
  Calendar,
  Layers,
  Zap,
  Trophy,
} from "lucide-react";
import {
  ProfileUser,
  COSMETIC_FRAMES,
  COSMETIC_THEMES,
} from "./types";
import KineticAvatarFX from "./KineticAvatarFX";
import {
  getXpProgressInLevel,
  getXpRequiredForNextLevel,
  calculateLevelFromXp,
} from "@/lib/progression";

interface AgentHeroCardProps {
  user: ProfileUser;
  isOwnProfile?: boolean;
}

const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  recon: Target,
  sleuth: Compass,
  vanguard: Shield,
  sentinel: Cpu,
  shadow: Eye,
  archivist: Bookmark,
};

export default function AgentHeroCard({ user, isOwnProfile }: AgentHeroCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [sheenPos, setSheenPos] = useState({ x: 50, y: 50, opacity: 0 });
  const [canTilt, setCanTilt] = useState(true);

  // Reduced motion and touch screen detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    if (prefersReducedMotion || isTouchDevice) {
      setCanTilt(false);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canTilt || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Max 10 deg tilt
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;

      setRotate({ x: rotateX, y: rotateY });
      setSheenPos({
        x: (x / rect.width) * 100,
        y: (y / rect.height) * 100,
        opacity: 0.15,
      });
    },
    [canTilt]
  );

  const handleMouseLeave = useCallback(() => {
    if (!canTilt) return;
    setRotate({ x: 0, y: 0 });
    setSheenPos((prev) => ({ ...prev, opacity: 0 }));
  }, [canTilt]);

  const handleShare = async () => {
    try {
      const shareUrl = typeof window !== "undefined" ? window.location.href : `/profile/${user.username}`;
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else if (typeof document !== "undefined") {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Still show feedback so user knows share attempt resolved
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  // Cosmetic styling lookups
  const frameId = user.equippedFrame || "frame-emerald-pulse";
  const activeFrame = COSMETIC_FRAMES.find((f) => f.id === frameId) || COSMETIC_FRAMES[0];
  const themeId = user.equippedTheme || "theme-obsidian-grid";
  const activeTheme = COSMETIC_THEMES.find((t) => t.id === themeId) || COSMETIC_THEMES[0];

  // Non-linear economy Level & XP math
  const currentXp = user.xp || 0;
  const calculatedLevel = calculateLevelFromXp(currentXp);
  const effectiveLevel = typeof user.level === "number" && user.level > 0 ? user.level : calculatedLevel;
  const xpProgression = getXpProgressInLevel(currentXp);
  const xpInLevel = xpProgression.currentXpInLevel;
  const xpRequiredForNextLevel = xpProgression.xpRequiredForNextLevel || getXpRequiredForNextLevel(effectiveLevel);
  const isRanked =
    typeof user.level === "number" &&
    typeof user.xp === "number" &&
    (Boolean(isOwnProfile) || user.isLeaderboardPublic !== false);
  const xpProgressPct = isRanked ? xpProgression.progressPercent : 0;

  // SVG Ring calculation: Radius 38, circumference ~ 238.76
  const ringRadius = 38;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference - (xpProgressPct / 100) * ringCircumference;

  const PresetIcon = PRESET_ICONS[user.avatarPreset || "recon"] || Target;

  return (
    <div
      style={{ perspective: canTilt ? "1200px" : "none" }}
      className="w-full flex justify-center py-2"
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: canTilt
            ? `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`
            : "none",
          transition: "transform 0.18s cubic-bezier(0.2, 0.8, 0.4, 1)",
          transformStyle: "preserve-3d",
        }}
        className={`relative w-full max-w-4xl rounded-2xl border ${activeTheme.bg} p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-shadow duration-300 hover:shadow-cyan-500/10`}
      >
        {/* Tactical HUD Sheen Overlay */}
        {canTilt && (
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle 320px at ${sheenPos.x}% ${sheenPos.y}%, rgba(255, 255, 255, ${sheenPos.opacity}), transparent 75%)`,
            }}
          />
        )}

        {/* Tactical Glowing Corner Brackets */}
        <div className="pointer-events-none absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-400/80" />
        <div className="pointer-events-none absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-400/80" />
        <div className="pointer-events-none absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-400/80" />
        <div className="pointer-events-none absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-400/80" />

        {/* Top Header Row: System Status, Equipped Title, Share Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-mono tracking-widest text-emerald-400 uppercase font-bold">
              AIEM Tactical Dossier // 07-SEC
            </span>
            {user.role && (
              <span className="ml-1 rounded px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                {user.role.replace(/_/g, " ")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user.equippedTitle && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-mono font-semibold border shadow-sm ${
                  user.equippedTitle === "Apex Hunter" || user.equippedTitle.includes("Apex")
                    ? "border-amber-500/50 text-amber-300 title-apex-grandmaster"
                    : user.equippedTitle === "Night Owl" || user.equippedTitle.includes("Shadow")
                    ? "border-purple-500/50 text-purple-300 title-phantom-custodian"
                    : user.equippedTitle === "Dean's Honor Guard" || user.equippedTitle.includes("Campus")
                    ? "border-emerald-500/50 text-emerald-300 title-campus-oracle"
                    : "border-cyan-500/30 text-cyan-300"
                }`}
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>{user.equippedTitle}</span>
              </span>
            )}
            <button
              onClick={handleShare}
              type="button"
              aria-label="Share Dossier"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 px-3 py-1.5 text-xs font-mono font-bold text-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Share Dossier</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Avatar Column with Cosmetic Frame & Level Ring */}
          <div className="md:col-span-4 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center p-3">
              {/* Circular SVG Level Progression Ring */}
              <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 90 90">
                <circle
                  cx="45"
                  cy="45"
                  r={ringRadius}
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  className="text-slate-800/80"
                />
                <circle
                  cx="45"
                  cy="45"
                  r={ringRadius}
                  stroke="currentColor"
                  strokeWidth="4.5"
                  fill="transparent"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={isRanked ? strokeDashoffset : ringCircumference}
                  strokeLinecap="round"
                  className={`${activeFrame.accent} transition-all duration-1000 ease-out`}
                />
              </svg>

              {/* Avatar Preset Box inside the Ring */}
              <div
                className={`absolute w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-950 ${activeFrame.border} ${activeFrame.shadow} border-2`}
              >
                {user.avatarUrl && !user.avatarUrl.includes("recon.png") && user.identityMode !== "ANONYMOUS" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <PresetIcon className={`w-12 h-12 ${activeFrame.accent}`} />
                )}
              </div>

              {/* Kinetic Avatar Canvas Shader FX (Ember Drifter, Ion Arc, Void Singularity, Solar Corona) */}
              <KineticAvatarFX
                streak={user.currentStreak ?? user.streak ?? 0}
                effectId={user.equippedEffect}
                frameId={user.equippedFrame}
                size={96}
              />

              {/* Level Pill floating at bottom of avatar */}
              <div className="absolute -bottom-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-0.5 text-xs font-mono font-bold text-white border border-white/20 shadow-lg">
                  {isRanked ? (
                    <>
                      <Zap className="w-3 h-3 text-amber-400" />
                      Lv.{user.level ?? effectiveLevel}
                    </>
                  ) : (
                    "UNRANKED"
                  )}
                </span>
              </div>
            </div>

            {/* XP readout */}
            <div className="mt-3 text-center">
              {isRanked ? (
                <p className="text-[11px] font-mono text-slate-400">
                  <span className="text-emerald-400 font-bold">{xpInLevel}</span> / {xpRequiredForNextLevel} XP
                  <span className="text-slate-500 ml-1">({Math.round(xpProgressPct)}%)</span>
                </p>
              ) : (
                <p className="text-[11px] font-mono text-slate-500">
                  Leaderboard stats private
                </p>
              )}
            </div>
          </div>

          {/* Identity & Bio Column */}
          <div className="md:col-span-8 space-y-4">
            <div>
              <div className="flex flex-wrap items-baseline gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {user.displayName}
                </h1>
                <span className="text-sm font-mono text-slate-400">
                  @{user.username}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-800/80 px-2.5 py-1 text-xs font-mono text-slate-300 border border-white/5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  {user.department || "Campus Investigator"}
                </span>
                {typeof user.yearOfStudy === "number" && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-800/80 px-2.5 py-1 text-xs font-mono text-slate-300 border border-white/5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    Year {user.yearOfStudy} Operative
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-800/80 px-2.5 py-1 text-xs font-mono text-slate-300 border border-white/5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  {user.rankTitle || "Campus Seeker"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-mono font-bold text-amber-300 border border-amber-500/20">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  {(user.trophies ?? user.weeklyScore ?? 0).toLocaleString()} Trophies
                </span>
              </div>
            </div>

            {/* Bio quote */}
            {user.bio ? (
              <p className="text-sm text-slate-300 font-mono leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-white/5 italic">
                &ldquo;{user.bio}&rdquo;
              </p>
            ) : (
              <p className="text-xs text-slate-500 font-mono italic">
                {isOwnProfile
                  ? "No tactical dossier bio recorded. Personalize your callsign brief in Locker & Settings."
                  : "No public transmission message recorded."}
              </p>
            )}

            {/* Squad Affiliation & Public Milestone Stats */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-white/10">
              {/* Squad Badge */}
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                {user.squad ? (
                  <Link
                    href={`/squads/${user.squad._id || ""}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-mono font-bold text-emerald-400 transition-colors"
                  >
                    <span>[{user.squad.tag}]</span>
                    <span>{user.squad.name}</span>
                  </Link>
                ) : (
                  <span className="text-xs font-mono text-slate-500">
                    Solo Operative (No Squad)
                  </span>
                )}
              </div>

              {/* Coarse Public Activity Metrics (Consent-Gated) */}
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] uppercase block">Trophies</span>
                  <span className="font-bold text-amber-300 flex items-center justify-end gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    {(user.trophies ?? user.weeklyScore ?? 0).toLocaleString()}
                  </span>
                </div>
                {typeof user.stats?.recoveriesCount === "number" && (
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] uppercase block">Returns</span>
                    <span className="font-bold text-emerald-400">{user.stats.recoveriesCount}</span>
                  </div>
                )}
                {typeof user.stats?.questsCompleted === "number" && (
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] uppercase block">Quests</span>
                    <span className="font-bold text-cyan-400">{user.stats.questsCompleted}</span>
                  </div>
                )}
                {typeof user.stats?.cluesSolved === "number" && (
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] uppercase block">Clues</span>
                    <span className="font-bold text-amber-400">{user.stats.cluesSolved}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
