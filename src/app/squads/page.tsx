"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Shield,
  ShieldAlert,
  PlusCircle,
  Trophy,
  Compass,
  ArrowRight,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Coins,
  Lock,
  Target,
  Award,
} from "lucide-react";

export default function SquadsDirectoryPage() {
  const [squads, setSquads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Create squad modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [emblemIcon, setEmblemIcon] = useState("ShieldAlert");
  const [joinType, setJoinType] = useState<"OPEN" | "INVITE_ONLY" | "CLOSED">("OPEN");
  const [minLevelRequired, setMinLevelRequired] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const json = await res.json();
      if (json.success && json.data) {
        setCurrentUser(json.data);
      }
    } catch {
      // unauthenticated
    }
  };

  const fetchSquads = async () => {
    try {
      const url = search.trim() ? `/api/squads?search=${encodeURIComponent(search.trim())}` : "/api/squads";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) setSquads(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  useEffect(() => {
    fetchSquads();
  }, [search]);

  const isLevelEligible = (currentUser?.level || 0) >= 5;
  const isCoinsEligible = (currentUser?.coins || 0) >= 50;
  const canCharter = isLevelEligible && isCoinsEligible && !currentUser?.squadId;

  const handleCreateSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canCharter) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/squads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          tag,
          description,
          emblemIcon,
          joinType,
          minLevelRequired,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        const errText = typeof json.error === "object" ? json.error?.message : json.error;
        throw new Error(errText || "Failed to create squad.");
      }

      setShowCreateModal(false);
      setName("");
      setTag("");
      setDescription("");
      setMinLevelRequired(1);
      fetchSession();
      fetchSquads();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              CAMPUS DEDUCTION SYNDICATES
            </span>
            <span className="text-xs font-mono text-slate-400">
              {squads.length} Active Squads
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Cooperative Investigation Squads
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Team up with fellow students. Solve campus mysteries together, pool investigation clues on shared corkboards, and compete for squad leaderboard supremacy.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-emerald-500/20 transition-all self-start md:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Form New Squad
        </button>
      </div>

      {/* Search Bar */}
      <div className="max-w-md relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search squad by name or tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
        />
      </div>

      {/* Squads Grid */}
      {loading ? (
        <div className="py-20 text-center font-mono text-slate-500 text-xs animate-pulse">
          LOADING SQUAD ROSTERS...
        </div>
      ) : squads.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-3">
          <Users className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No squads found</h3>
          <p className="text-xs text-slate-400">
            Be the first to establish a campus investigation syndicate.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {squads.map((squad, idx) => {
            const isSquadOpen = (squad.joinType === "OPEN") || (!squad.joinType && squad.privacy === "PUBLIC");
            const isSquadInviteOnly = (squad.joinType === "INVITE_ONLY") || (!squad.joinType && squad.privacy === "INVITE_ONLY");
            const isSquadClosed = (squad.joinType === "CLOSED") || (!squad.joinType && squad.privacy === "PRIVATE");

            return (
              <Link
                key={squad._id}
                href={`/squads/${squad._id}`}
                className="glass-panel rounded-2xl p-6 border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-black text-emerald-400 text-sm shrink-0">
                        {squad.tag}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors">
                          {squad.name}
                        </h3>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Leader: {squad.leaderId?.displayName || "Agent"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        LVL {squad.squadLevel || 1}
                      </span>
                      {isSquadOpen && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Anyone Can Join
                        </span>
                      )}
                      {isSquadInviteOnly && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Invite Only
                        </span>
                      )}
                      {isSquadClosed && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {squad.description || "Active campus deduction unit."}
                  </p>

                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/5 text-cyan-300 font-bold">
                      Req Lv.{squad.minLevelRequired || 1}+
                    </span>
                    <span className="text-slate-500">•</span>
                    <span>Capacity: {squad.memberCount || 1}/8</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center font-mono text-xs">
                    <div className="rounded-lg bg-slate-950/60 p-2">
                      <div className="text-emerald-400 font-bold">{squad.squadXp || 0}</div>
                      <div className="text-[9px] uppercase text-slate-500">Squad XP</div>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 p-2">
                      <div className="text-cyan-400 font-bold">{squad.memberCount || 1} / 8</div>
                      <div className="text-[9px] uppercase text-slate-500">Members</div>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 p-2">
                      <div className="text-amber-400 font-bold">{squad.completedHuntsCount || 0}</div>
                      <div className="text-[9px] uppercase text-slate-500">Hunts Won</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Rank #{idx + 1}</span>
                  <span className="text-cyan-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    View Squad Command Hub <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Squad Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-hidden">
          <div className="relative rounded-3xl bg-slate-900 border border-white/15 max-w-xl w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/90 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    Charter a Campus Syndicate
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400">
                    Form an official investigation squad at AIEM
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center font-mono text-sm"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Pre-Submission Requirements Card */}
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-white/10 space-y-2.5 font-mono text-xs">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Charter Prerequisites</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                      isLevelEligible
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}
                  >
                    {isLevelEligible ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Lock className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <div>
                      <div className="font-bold text-[11px]">Hunter Level 5+</div>
                      <div className="text-[10px] text-slate-400">
                        Current: Lv.{currentUser?.level || 1}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                      isCoinsEligible
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}
                  >
                    {isCoinsEligible ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Coins className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <div>
                      <div className="font-bold text-[11px]">50 Hunter Coins</div>
                      <div className="text-[10px] text-slate-400">
                        Balance: {currentUser?.coins ?? 0} 🪙
                      </div>
                    </div>
                  </div>
                </div>

                {currentUser?.squadId && (
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                    ⚠️ You are currently in a squad. Resign before founding a new syndicate.
                  </div>
                )}

                {!canCharter && !currentUser?.squadId && (
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5 text-[11px] text-slate-400 flex items-center justify-between flex-wrap gap-2">
                    <span>Need more XP or coins? Solve campus mystery quests.</span>
                    <Link
                      href="/quests"
                      className="text-cyan-400 hover:text-cyan-300 font-bold underline"
                    >
                      Browse Quests →
                    </Link>
                  </div>
                )}
              </div>

              {/* Live Card Preview */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/30 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  <span>Live Syndicate Card Preview</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
                    {emblemIcon === "ShieldAlert" && <ShieldAlert className="w-6 h-6" />}
                    {emblemIcon === "Shield" && <Shield className="w-6 h-6" />}
                    {emblemIcon === "Compass" && <Compass className="w-6 h-6" />}
                    {emblemIcon === "Target" && <Target className="w-6 h-6" />}
                    {emblemIcon === "Trophy" && <Trophy className="w-6 h-6" />}
                    {emblemIcon === "Award" && <Award className="w-6 h-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm truncate">
                        {name.trim() || "NEW SYNDICATE"}
                      </span>
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
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form Fields */}
              <form id="squadCharterForm" onSubmit={handleCreateSquad} className="space-y-4">
                {/* Squad Name */}
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                    <span>Squad Name *</span>
                    <span className="text-[10px] text-slate-500">{name.length}/30</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    placeholder="e.g. THE ARCHIVISTS, NIGHT WATCH"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 transition-colors"
                  />
                </div>

                {/* Squad Tag & Min Level */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                      <span>Squad Tag *</span>
                      <span className="text-[10px] text-slate-500">2-5 Capital Letters</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      placeholder="e.g. ARCH, SEEK"
                      value={tag}
                      onChange={(e) => setTag(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono uppercase focus:outline-none focus:border-emerald-400 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Minimum Level Required</label>
                    <select
                      value={minLevelRequired}
                      onChange={(e) => setMinLevelRequired(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 transition-colors cursor-pointer"
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
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Recruitment Access Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setJoinType("OPEN")}
                      className={`p-3 rounded-xl border text-left font-mono transition-all ${
                        joinType === "OPEN"
                          ? "bg-emerald-500/20 border-emerald-500 text-white ring-1 ring-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                          : "bg-slate-950/70 border-white/10 text-slate-400 hover:border-white/20"
                      }`}
                    >
                      <div className="text-xs font-bold text-emerald-400">Anyone can join</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">Instant entry if level is met</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setJoinType("INVITE_ONLY")}
                      className={`p-3 rounded-xl border text-left font-mono transition-all ${
                        joinType === "INVITE_ONLY"
                          ? "bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                          : "bg-slate-950/70 border-white/10 text-slate-400 hover:border-white/20"
                      }`}
                    >
                      <div className="text-xs font-bold text-amber-400">Invite only</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">Requires leadership approval</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setJoinType("CLOSED")}
                      className={`p-3 rounded-xl border text-left font-mono transition-all ${
                        joinType === "CLOSED"
                          ? "bg-rose-500/20 border-rose-500 text-white ring-1 ring-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.2)]"
                          : "bg-slate-950/70 border-white/10 text-slate-400 hover:border-white/20"
                      }`}
                    >
                      <div className="text-xs font-bold text-rose-400">Closed</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">No new applicants accepted</div>
                    </button>
                  </div>
                </div>

                {/* Tactical Emblem Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Emblem Crest</label>
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      { id: "ShieldAlert", icon: ShieldAlert, label: "Alert" },
                      { id: "Shield", icon: Shield, label: "Shield" },
                      { id: "Compass", icon: Compass, label: "Compass" },
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
                          className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                            isSelected
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 ring-1 ring-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                              : "bg-slate-950/70 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                          <span className="text-[9px] font-mono">{emb.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Motto */}
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                    <span>Motto / Description</span>
                    <span className="text-[10px] text-slate-500">{description.length}/300</span>
                  </label>
                  <textarea
                    rows={2}
                    maxLength={300}
                    placeholder="e.g. Dedicated to uncovering misplaced electronics across Block B."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 leading-relaxed resize-none transition-colors"
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-slate-950/90 backdrop-blur-md flex items-center justify-between shrink-0">
              <div className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                <span className="text-slate-400">Charter Fee:</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> 50 Coins
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="squadCharterForm"
                  disabled={submitting || !canCharter}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Chartering...</span>
                    </>
                  ) : (
                    <span>Establish Squad</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

