"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Shield,
  PlusCircle,
  Trophy,
  Compass,
  ArrowRight,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function SquadsDirectoryPage() {
  const [squads, setSquads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create squad modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [emblemIcon, setEmblemIcon] = useState("Shield");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    fetchSquads();
  }, [search]);

  const handleCreateSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/squads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tag, description, emblemIcon }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to create squad.");
      }

      setShowCreateModal(false);
      setName("");
      setTag("");
      setDescription("");
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
          {squads.map((squad, idx) => (
            <Link
              key={squad._id}
              href={`/squads/${squad._id}`}
              className="glass-panel rounded-2xl p-6 border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-black text-emerald-400 text-sm">
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

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">
                    LVL {squad.squadLevel || 1}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {squad.description || "Active campus deduction unit."}
                </p>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center font-mono text-xs">
                  <div className="rounded-lg bg-slate-950/60 p-2">
                    <div className="text-emerald-400 font-bold">{squad.squadXp}</div>
                    <div className="text-[9px] uppercase text-slate-500">Squad XP</div>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 p-2">
                    <div className="text-cyan-400 font-bold">{squad.memberCount} / 8</div>
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
          ))}
        </div>
      )}

      {/* Create Squad Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="rounded-2xl bg-slate-900 border border-white/10 p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Charter a Campus Investigation Squad
            </h3>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateSquad} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Squad Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. THE ARCHIVISTS, NIGHT WATCH"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Squad Tag * (2-5 Uppercase Letters)</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  placeholder="e.g. ARCH, SEEK, DET"
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono uppercase focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Motto / Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Dedicated to uncovering misplaced electronics across Block B."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all"
                >
                  {submitting ? "Chartering..." : "Establish Squad"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

