"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Shield,
  ShieldAlert,
  Compass,
  Target,
  Trophy,
  Award,
  Coins,
  CheckCircle2,
  Lock,
  Sparkles,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  LogIn,
} from "lucide-react";

export default function CreateSquadPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [emblemIcon, setEmblemIcon] = useState("Shield");
  const [joinType, setJoinType] = useState<"OPEN" | "INVITE_ONLY" | "CLOSED">("OPEN");
  const [minLevelRequired, setMinLevelRequired] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      setLoadingSession(true);
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        setCurrentUser(json.data || json.user || null);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const isLevelEligible = (currentUser?.level || 0) >= 5;
  const isCoinsEligible = (currentUser?.coins || 0) >= 50;
  const canCharter = currentUser && isLevelEligible && isCoinsEligible && !currentUser?.squadId;

  const handleCreateSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!currentUser) {
      setError("Please log in with your AIEM student account to charter a squad.");
      return;
    }

    if (currentUser?.squadId) {
      setError("You are already in a squad. Resign or leave your squad before founding a new syndicate.");
      return;
    }

    if (!isLevelEligible) {
      setError(`Hunter Level 5 required (Current: Level ${currentUser?.level || 1}). Complete campus quests to level up!`);
      return;
    }

    if (!isCoinsEligible) {
      setError(`50 Hunter Coins required (Current: ${currentUser?.coins || 0} 🪙). Report found belongings or solve clues to earn coins!`);
      return;
    }

    if (name.trim().length < 3) {
      setError("Squad name must be at least 3 characters long.");
      return;
    }

    if (tag.trim().length < 2) {
      setError("Squad tag must be between 2 and 5 capital letters.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/squads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          tag: tag.trim().toUpperCase(),
          description: description.trim(),
          emblemIcon,
          joinType,
          minLevelRequired,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        const errText = typeof json.error === "object" ? json.error?.message : json.error;
        throw new Error(errText || "Failed to charter squad.");
      }

      // Navigate straight to the newly created Squad Command Hub
      const newSquadId = json.data?._id || json.data?.id;
      if (newSquadId) {
        router.push(`/squads/${newSquadId}`);
      } else {
        router.push("/squads");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while creating the squad.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Back button & Breadcrumb */}
      <div>
        <Link
          href="/squads"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Squads Syndicate Directory</span>
        </Link>
      </div>

      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-400">
            OFFICIAL CAMPUS SYNDICATE CHARTER
          </span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <Users className="w-8 h-8 text-emerald-400" />
          Charter an Investigation Squad
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
          Form a tactical student syndicate at Agnel Institute of Engineering & Management. Complete joint mystery hunts, climb the clan leaderboards, and coordinate lost & found recoveries.
        </p>
      </div>

      {/* Prerequisites & Balance Verification Card */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Charter Prerequisites & Requirements</span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Charter Fee: <strong className="text-amber-400">50 Hunter Coins</strong>
          </span>
        </div>

        {loadingSession ? (
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Checking operative clearance and coin balance...</span>
          </div>
        ) : !currentUser ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Authentication Required</span>
              </p>
              <p className="text-[11px] text-slate-300">
                You must log in with your verified AIEM campus account to charter a squad.
              </p>
            </div>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-400/20"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In Now</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
            {/* Level Requirement Check */}
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${
                isLevelEligible
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {isLevelEligible ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : (
                <Lock className="w-5 h-5 shrink-0 text-rose-400" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs">Hunter Level 5+ Required</div>
                <div className="text-[11px] text-slate-400">
                  Your Current Level: <strong className="text-white">Lv.{currentUser.level || 1}</strong>
                </div>
              </div>
            </div>

            {/* Coins Balance Check */}
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${
                isCoinsEligible
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {isCoinsEligible ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : (
                <Coins className="w-5 h-5 shrink-0 text-rose-400" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs">50 Hunter Coins Charter Fee</div>
                <div className="text-[11px] text-slate-400">
                  Your Balance: <strong className="text-amber-400">{currentUser.coins || 0} 🪙</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* In-squad Warning */}
        {currentUser?.squadId && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 flex-wrap">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>You are already an active member of a squad. You must resign from your current squad before founding a new one.</span>
            </span>
            <Link
              href={`/squads/${currentUser.squadId}`}
              className="text-cyan-400 hover:text-cyan-300 underline font-mono font-bold text-xs"
            >
              Go to My Squad →
            </Link>
          </div>
        )}
      </div>

      {/* Main Chartering Form & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleCreateSquad} className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-5 shadow-2xl">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Squad Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                <span className="font-bold">Squad Name *</span>
                <span className="text-[10px] text-slate-500">{name.length}/30</span>
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={30}
                placeholder="e.g. THE ARCHIVISTS, NIGHT WATCH, SHADOW PROTOCOL"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-sans focus:outline-none focus:border-emerald-400 transition-colors"
              />
              <p className="text-[10px] font-mono text-slate-500">Official name shown across campus leaderboards (3-30 chars)</p>
            </div>

            {/* Squad Tag & Min Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span className="font-bold">Squad Tag *</span>
                  <span className="text-[10px] text-slate-500">2-5 Letters</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={5}
                  placeholder="e.g. ARCH, SEEK, WATCH"
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono uppercase focus:outline-none focus:border-emerald-400 transition-colors tracking-widest font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-bold">Minimum Level to Join</label>
                <select
                  value={minLevelRequired}
                  onChange={(e) => setMinLevelRequired(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 transition-colors cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Level {lvl}+ {lvl === 1 ? "(All Welcome)" : lvl >= 5 ? "(Veterans Only)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clash of Clans Style Recruitment Mode */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-300 font-bold">Recruitment Access Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setJoinType("OPEN")}
                  className={`p-3 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                    joinType === "OPEN"
                      ? "bg-emerald-500/20 border-emerald-500 text-white ring-1 ring-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.2)]"
                      : "bg-slate-950/70 border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <div className="text-xs font-bold text-emerald-400">Anyone can join</div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">Instant entry if minimum level is met</div>
                </button>

                <button
                  type="button"
                  onClick={() => setJoinType("INVITE_ONLY")}
                  className={`p-3 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                    joinType === "INVITE_ONLY"
                      ? "bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.2)]"
                      : "bg-slate-950/70 border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <div className="text-xs font-bold text-amber-400">Invite only</div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">Requires leader or co-leader review</div>
                </button>

                <button
                  type="button"
                  onClick={() => setJoinType("CLOSED")}
                  className={`p-3 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                    joinType === "CLOSED"
                      ? "bg-rose-500/20 border-rose-500 text-white ring-1 ring-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.2)]"
                      : "bg-slate-950/70 border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <div className="text-xs font-bold text-rose-400">Closed</div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">No new applicants accepted</div>
                </button>
              </div>
            </div>

            {/* Emblem Crest Picker */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-300 font-bold">Tactical Crest Emblem</label>
              <div className="grid grid-cols-6 gap-2">
                {[
                  { id: "Shield", icon: Shield, label: "Shield" },
                  { id: "ShieldAlert", icon: ShieldAlert, label: "Alert" },
                  { id: "Compass", icon: Compass, label: "Recon" },
                  { id: "Target", icon: Target, label: "Target" },
                  { id: "Trophy", icon: Trophy, label: "Trophy" },
                  { id: "Award", icon: Award, label: "Honor" },
                ].map((emb) => {
                  const IconComponent = emb.icon;
                  const isSelected = emblemIcon === emb.id;
                  return (
                    <button
                      key={emb.id}
                      type="button"
                      onClick={() => setEmblemIcon(emb.id)}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 ring-1 ring-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                          : "bg-slate-950/70 border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      <IconComponent className="w-5 h-5" />
                      <span className="text-[10px] font-mono">{emb.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description / Motto */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                <span className="font-bold">Motto & Recon Focus</span>
                <span className="text-[10px] text-slate-500">{description.length}/300</span>
              </label>
              <textarea
                rows={3}
                maxLength={300}
                placeholder="e.g. Dedicated to uncovering misplaced electronics and lab items across Block B."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs leading-relaxed resize-none focus:outline-none focus:border-emerald-400 transition-colors"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-4">
              <div className="text-xs font-mono text-slate-300">
                <span className="text-slate-400">Total Charter Cost: </span>
                <span className="text-amber-400 font-bold font-mono">50 Coins</span>
              </div>

              <button
                type="submit"
                disabled={submitting || !canCharter}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Chartering Syndicate...</span>
                  </>
                ) : !currentUser ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Log In Required</span>
                  </>
                ) : currentUser?.squadId ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Already In A Squad</span>
                  </>
                ) : !isLevelEligible ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Level 5 Required</span>
                  </>
                ) : !isCoinsEligible ? (
                  <>
                    <Coins className="w-4 h-4" />
                    <span>50 Coins Required</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Found Official Squad (50 🪙)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-3xl bg-slate-900 border border-white/10 space-y-4 shadow-xl">
            <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Live Syndicate Card Preview</span>
            </div>

            {/* Card Mockup */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/30 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
                  {emblemIcon === "ShieldAlert" && <ShieldAlert className="w-6 h-6" />}
                  {emblemIcon === "Shield" && <Shield className="w-6 h-6" />}
                  {emblemIcon === "Compass" && <Compass className="w-6 h-6" />}
                  {emblemIcon === "Target" && <Target className="w-6 h-6" />}
                  {emblemIcon === "Trophy" && <Trophy className="w-6 h-6" />}
                  {emblemIcon === "Award" && <Award className="w-6 h-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base truncate">
                      {name.trim() || "NEW SYNDICATE"}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      [{tag.trim() || "TAG"}]
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold border ${
                        joinType === "OPEN"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : joinType === "INVITE_ONLY"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      }`}
                    >
                      {joinType === "OPEN" ? "Anyone Can Join" : joinType === "INVITE_ONLY" ? "Invite Only" : "Closed"}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-white/5 border border-white/10">
                      Req Lv.{minLevelRequired}+
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {description.trim() || "Dedicated to uncovering misplaced belongings and solving campus mystery hunts."}
              </p>

              <div className="pt-3 border-t border-white/5 grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase">Members</div>
                  <div className="text-xs font-bold text-white mt-0.5">1 / 50</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase">Squad XP</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">100 XP</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                  <div className="text-[10px] text-slate-500 uppercase">Clan Level</div>
                  <div className="text-xs font-bold text-cyan-400 mt-0.5">Level 1</div>
                </div>
              </div>
            </div>

            {/* Clan rules explanation card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-white/5 space-y-2 text-xs font-mono text-slate-400">
              <div className="text-slate-300 font-bold text-[11px] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Syndicate Governance & Roles</span>
              </div>
              <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-400">
                <li>• <strong>Leader:</strong> Full permissions, recruit management, clan settings, promotions.</li>
                <li>• <strong>Co-Leader:</strong> Accepts applications, invites members, manages events.</li>
                <li>• <strong>Elder:</strong> Initiates mystery quests, invites vetted operatives.</li>
                <li>• <strong>Member:</strong> Contributes squad XP and coordinates discoveries.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
