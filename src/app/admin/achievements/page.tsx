"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Trophy,
  ArrowLeft,
  PlusCircle,
  RefreshCw,
  Search,
  Filter,
  Edit3,
  Archive,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Save,
  Check,
  Shield,
  Clock,
} from "lucide-react";

interface AchievementDef {
  _id: string;
  code: string;
  title: string;
  description: string;
  badgeIcon: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  metricKey: string;
  threshold: number;
  xpReward: number;
  coinReward: number;
  scope: "PLAYER" | "SQUAD";
  version: number;
  isActive: boolean;
  isArchived: boolean;
  unlockCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminAchievementsPage() {
  const [achievements, setAchievements] = useState<AchievementDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: "",
    title: "",
    description: "",
    badgeIcon: "Award",
    rarity: "COMMON",
    metricKey: "RECOVERIES_COUNT",
    threshold: 1,
    xpReward: 100,
    coinReward: 25,
    scope: "PLAYER",
  });

  // Edit modal state
  const [editingAchievement, setEditingAchievement] = useState<AchievementDef | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    badgeIcon: "Award",
    rarity: "COMMON" as "COMMON" | "RARE" | "EPIC" | "LEGENDARY",
    threshold: 1,
    xpReward: 100,
    coinReward: 25,
    scope: "PLAYER" as "PLAYER" | "SQUAD",
    revisionNote: "",
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Status feedback toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchAchievements = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/achievements?status=${statusFilter}`;
      if (rarityFilter !== "ALL") url += `&rarity=${rarityFilter}`;
      if (scopeFilter !== "ALL") url += `&scope=${scopeFilter}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetch(url);
      if (res.status === 403) {
        showToast("Access denied: Content management permissions required.", "error");
        return;
      }
      const json = await res.json();
      if (json.success) {
        setAchievements(json.data || []);
      } else {
        showToast(json.error || "Failed to load achievements", "error");
      }
    } catch (e: any) {
      showToast(e.message || "Failed to connect to achievements service", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, rarityFilter, scopeFilter, search]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCreate(true);
    try {
      const res = await fetch("/api/admin/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to create achievement");
      }
      showToast(`Achievement ${createForm.code} created successfully (v1).`);
      setCreateForm({
        code: "",
        title: "",
        description: "",
        badgeIcon: "Award",
        rarity: "COMMON",
        metricKey: "RECOVERIES_COUNT",
        threshold: 1,
        xpReward: 100,
        coinReward: 25,
        scope: "PLAYER",
      });
      setShowCreateForm(false);
      fetchAchievements();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleOpenEdit = (ach: AchievementDef) => {
    setEditingAchievement(ach);
    setEditForm({
      title: ach.title,
      description: ach.description,
      badgeIcon: ach.badgeIcon || "Award",
      rarity: ach.rarity,
      threshold: ach.threshold,
      xpReward: ach.xpReward,
      coinReward: ach.coinReward,
      scope: ach.scope,
      revisionNote: "",
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAchievement) return;
    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/admin/achievements/${editingAchievement._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          ...editForm,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to update achievement");
      }
      showToast(`Achievement ${editingAchievement.code} updated to v${json.data?.version}.`);
      setEditingAchievement(null);
      fetchAchievements();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleToggleArchive = async (ach: AchievementDef) => {
    const isArchived = Boolean(ach.isArchived || !ach.isActive);
    const action = isArchived ? "REACTIVATE" : "ARCHIVE";
    try {
      const res = await fetch(`/api/admin/achievements/${ach._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to toggle status");
      }
      showToast(
        action === "ARCHIVE"
          ? `Achievement ${ach.code} archived successfully (v${json.data?.version}).`
          : `Achievement ${ach.code} reactivated successfully (v${json.data?.version}).`
      );
      fetchAchievements();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDelete = async (ach: AchievementDef) => {
    if (!confirm(`Are you sure you want to delete achievement ${ach.code}? If players have already unlocked it, it will be safely soft-archived instead of permanently destroyed.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/achievements/${ach._id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to delete achievement");
      }
      if (json.archived) {
        showToast(json.message, "info");
      } else {
        showToast(json.message || `Achievement ${ach.code} permanently deleted.`);
      }
      fetchAchievements();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              OPERATIONS CMS
            </span>
            <span className="text-xs font-mono text-slate-400">Progression System</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-amber-400" />
            Admin Achievements & Citations Registry
          </h1>
          <p className="text-xs text-slate-400">
            Define, update, version, and manage achievement citations with strict reference-guarded archiving.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchAchievements()}
            className="px-3 py-2 bg-slate-900 border border-white/10 hover:border-white/20 rounded-xl text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showCreateForm ? "Close Form" : "Create Achievement"}</span>
          </button>
        </div>
      </div>

      {/* Toast Banner */}
      {toast && (
        <div
          className={`p-4 rounded-xl text-xs font-mono flex items-center gap-2.5 transition-all ${
            toast.type === "error"
              ? "bg-rose-950/80 border border-rose-500/50 text-rose-300"
              : toast.type === "info"
              ? "bg-cyan-950/80 border border-cyan-500/50 text-cyan-300"
              : "bg-emerald-950/80 border border-emerald-500/50 text-emerald-300"
          }`}
        >
          {toast.type === "error" ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Create Achievement Form Panel */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-[#0B0F17] p-6 rounded-2xl border border-amber-500/30 space-y-4 shadow-xl animate-in fade-in"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-amber-400" />
              REGISTER NEW ACHIEVEMENT DEFINITION
            </h3>
            <span className="text-[10px] font-mono text-slate-400">All fields validated on submission</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Unique Citation Code (UPPERCASE_SNAKE) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. RECOVERY_LEGEND_50"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase().trim() })}
                className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Recovery Legend"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Rarity Tier</label>
              <select
                value={createForm.rarity}
                onChange={(e) => setCreateForm({ ...createForm, rarity: e.target.value })}
                className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
              >
                <option value="COMMON">Common (Slate)</option>
                <option value="RARE">Rare (Cyan)</option>
                <option value="EPIC">Epic (Violet)</option>
                <option value="LEGENDARY">Legendary (Amber)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Description / Unlock Condition *</label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Verify and return 50 lost property items to Safe-Desk stations across campus."
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Metric Key</label>
              <select
                value={createForm.metricKey}
                onChange={(e) => setCreateForm({ ...createForm, metricKey: e.target.value })}
                className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
              >
                <option value="RECOVERIES_COUNT">Recoveries Count</option>
                <option value="SAFE_DESK_DEPOSITS">Safe Desk Deposits</option>
                <option value="VISITED_BLOCKS_COUNT">Visited Blocks</option>
                <option value="INVESTIGATION_QUESTS">Investigation Quests</option>
                <option value="MYSTERY_NO_HINTS">Mystery (No Hints)</option>
                <option value="PLAYER_LEVEL">Player Level</option>
                <option value="SPEED_RECOVERY">Speed Recovery</option>
                <option value="SQUAD_QUESTS">Squad Quests</option>
                <option value="SQUAD_LEVEL">Squad Level</option>
                <option value="LEGENDARY_QUESTS">Legendary Quests</option>
                <option value="TREASURES_FOUND">Treasures Found</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Threshold *</label>
              <input
                type="number"
                min={1}
                required
                value={createForm.threshold}
                onChange={(e) => setCreateForm({ ...createForm, threshold: Number(e.target.value) })}
                className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">XP Reward</label>
              <input
                type="number"
                min={0}
                required
                value={createForm.xpReward}
                onChange={(e) => setCreateForm({ ...createForm, xpReward: Number(e.target.value) })}
                className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Coins Reward 🪙</label>
              <input
                type="number"
                min={0}
                required
                value={createForm.coinReward}
                onChange={(e) => setCreateForm({ ...createForm, coinReward: Number(e.target.value) })}
                className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-slate-400">Scope:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="PLAYER"
                  checked={createForm.scope === "PLAYER"}
                  onChange={() => setCreateForm({ ...createForm, scope: "PLAYER" })}
                  className="accent-amber-400"
                />
                <span>Individual Player</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="SQUAD"
                  checked={createForm.scope === "SQUAD"}
                  onChange={() => setCreateForm({ ...createForm, scope: "SQUAD" })}
                  className="accent-amber-400"
                />
                <span>Squad Team</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submittingCreate}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submittingCreate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{submittingCreate ? "Registering..." : "Save Definition"}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0B0F17] p-4 rounded-2xl border border-white/10">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search code, title, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#070A0F] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto text-xs font-mono scrollbar-none">
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
            className="bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white"
          >
            <option value="ALL">All Rarities</option>
            <option value="COMMON">Common</option>
            <option value="RARE">Rare</option>
            <option value="EPIC">Epic</option>
            <option value="LEGENDARY">Legendary</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="ARCHIVED">Archived Only</option>
          </select>

          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white"
          >
            <option value="ALL">All Scopes</option>
            <option value="PLAYER">Player Only</option>
            <option value="SQUAD">Squad Only</option>
          </select>
        </div>
      </div>

      {/* Achievements Cards Grid */}
      {loading ? (
        <div className="py-20 text-center font-mono text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <span>LOADING ACHIEVEMENT CITATIONS...</span>
        </div>
      ) : achievements.length === 0 ? (
        <div className="py-20 text-center bg-[#0B0F17] rounded-3xl border border-white/10 space-y-3">
          <Trophy className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Achievements Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto font-mono">
            No achievement definitions match your query. Click &quot;Create Achievement&quot; above to register one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((ach) => {
            const isArchived = Boolean(ach.isArchived || !ach.isActive);
            const rarityStyles: Record<string, string> = {
              COMMON: "bg-slate-800 text-slate-300 border-slate-700",
              RARE: "bg-cyan-950/60 text-cyan-400 border-cyan-800/60",
              EPIC: "bg-purple-950/60 text-purple-400 border-purple-800/60",
              LEGENDARY: "bg-amber-950/60 text-amber-400 border-amber-800/60",
            };

            return (
              <div
                key={ach._id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isArchived
                    ? "bg-[#0B0F17]/50 border-white/5 opacity-60"
                    : "bg-[#0B0F17] border-white/10 hover:border-white/20"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        rarityStyles[ach.rarity] || rarityStyles.COMMON
                      }`}
                    >
                      {ach.rarity}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                        {ach.scope}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                        v{ach.version || 1}
                      </span>
                      {isArchived ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800/40 font-bold">
                          ARCHIVED
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white font-mono">{ach.title}</h4>
                    <span className="text-[10px] font-mono text-slate-500">{ach.code}</span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{ach.description}</p>

                  <div className="pt-2 border-t border-white/5 text-[11px] font-mono text-slate-400 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Condition:</span>
                      <span className="text-slate-200 font-bold">
                        {ach.threshold} × {ach.metricKey}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Rewards:</span>
                      <span className="text-emerald-400">
                        +{ach.xpReward} XP / +{ach.coinReward} Coins 🪙
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Player Unlocks:</span>
                      <span className="text-amber-400 font-bold">
                        {ach.unlockCount ?? 0} Hunters
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 mt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(ach)}
                    className="px-2.5 py-1 text-xs font-mono rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3 text-cyan-400" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleArchive(ach)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                      isArchived
                        ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {isArchived ? "Reactivate" : "Archive"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(ach)}
                    className="px-2.5 py-1 text-xs font-mono rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Achievement Modal */}
      {editingAchievement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-xl w-full bg-[#0B0F17] rounded-3xl border border-white/20 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-mono font-bold text-white">
                  Edit Achievement: {editingAchievement.code}
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  Next: v{(editingAchievement.version || 1) + 1}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingAchievement(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description *</label>
                <textarea
                  rows={3}
                  required
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Rarity Tier</label>
                  <select
                    value={editForm.rarity}
                    onChange={(e) => setEditForm({ ...editForm, rarity: e.target.value as any })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="COMMON">Common</option>
                    <option value="RARE">Rare</option>
                    <option value="EPIC">Epic</option>
                    <option value="LEGENDARY">Legendary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Threshold Target</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.threshold}
                    onChange={(e) => setEditForm({ ...editForm, threshold: Number(e.target.value) })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">XP Reward</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editForm.xpReward}
                    onChange={(e) => setEditForm({ ...editForm, xpReward: Number(e.target.value) })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Coins Reward 🪙</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editForm.coinReward}
                    onChange={(e) => setEditForm({ ...editForm, coinReward: Number(e.target.value) })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Revision Audit Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Adjusted threshold for campus season 2"
                  value={editForm.revisionNote}
                  onChange={(e) => setEditForm({ ...editForm, revisionNote: e.target.value })}
                  className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingAchievement(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save &amp; Increment Version</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
