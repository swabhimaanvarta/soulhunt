"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag,
  Package,
  Shield,
  Search,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Coins,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  FileQuestion,
  ExternalLink,
  ThumbsUp,
  FileText,
  HelpCircle,
  Layers,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";

export interface LiveBadge {
  label: string;
  color: "emerald" | "cyan" | "amber" | "rose" | "purple" | "slate";
  actionable?: boolean;
}

export interface LostItemOp {
  _id: string;
  title: string;
  category: string;
  status: string;
  liveBadge: LiveBadge;
  locationName: string;
  rewardOffered: number;
  spotDetails?: string;
  photoUrl?: string;
  lostAt?: string;
  createdAt: string;
  linkedQuest?: {
    id: string;
    code: string;
    title: string;
  };
}

export interface FoundItemOp {
  _id: string;
  title: string;
  shortTitle?: string;
  category: string;
  status: string;
  custodyStatus: string;
  lockerReceiptCode?: string;
  custodyLocationName: string;
  liveBadge: LiveBadge;
  spotDetails?: string;
  photoUrl?: string;
  foundAt?: string;
  createdAt: string;
}

export interface ClaimOp {
  _id: string;
  itemTitle: string;
  itemType: "LOST" | "FOUND";
  itemId: string;
  category: string;
  status: string;
  liveBadge: LiveBadge;
  counterparty?: {
    _id: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
  };
  stationName: string;
  rejectionReason?: string;
  proofPhotoUrl?: string;
  notes?: string;
  createdAt: string;
  item?: {
    _id: string;
    title: string;
    itemType: string;
    category: string;
    status: string;
    custodyLocation?: string;
    location?: string;
  };
}

export interface ClueOp {
  clueId: string;
  questId: string;
  questCode: string;
  questTitle: string;
  stageOrder: number;
  solvedAt: string;
  liveBadge: LiveBadge;
}

export interface EvidenceOp {
  _id: string;
  questCode: string;
  questTitle: string;
  type: "PHOTO" | "MAP_PIN" | "THEORY";
  title: string;
  content: string;
  upvotesCount: number;
  createdAt: string;
  liveBadge: LiveBadge;
}

export interface OperationsCounts {
  lostTotal: number;
  foundTotal: number;
  claimsTotal: number;
  cluesSolvedTotal: number;
  evidenceTotal?: number;
  lostActive?: number;
  foundInCustody?: number;
  claimsPending?: number;
  claimsReady?: number;
}

export interface OperationsData {
  counts: OperationsCounts;
  lostItems: LostItemOp[];
  foundItems: FoundItemOp[];
  claims: ClaimOp[];
  clues: ClueOp[];
  evidence: EvidenceOp[];
}

interface PersonalOperationsHubProps {
  onOpenHandoverModal?: (claim: ClaimOp) => void;
}

type TabKey = "lost" | "found" | "claims" | "clues";

export default function PersonalOperationsHub({ onOpenHandoverModal }: PersonalOperationsHubProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("lost");
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [data, setData] = useState<OperationsData>({
    counts: {
      lostTotal: 0,
      foundTotal: 0,
      claimsTotal: 0,
      cluesSolvedTotal: 0,
      evidenceTotal: 0,
    },
    lostItems: [],
    foundItems: [],
    claims: [],
    clues: [],
    evidence: [],
  });

  const fetchOperations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/user/operations");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch personal operations ledger:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOperations();
  }, [fetchOperations]);

  // Reset filter on tab change
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setFilter("all");
  };

  const handleCopyLockerCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const getBadgeStyle = (color: LiveBadge["color"]) => {
    switch (color) {
      case "emerald":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "cyan":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      case "amber":
        return "bg-amber-500/10 text-amber-300 border-amber-500/30";
      case "purple":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "rose":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return "Recently";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return "Recently";
    }
  };

  // Filter items per active tab
  const filteredLostItems = data.lostItems.filter((item) => {
    if (filter === "all") return true;
    if (filter === "active") return item.status === "ACTIVE" || item.status === "APPROVED";
    if (filter === "review") return item.status === "UNDER_REVIEW" || item.status === "SUBMITTED";
    if (filter === "recovered") return item.status === "RECOVERED" || item.status === "COMPLETED";
    if (filter === "rejected") return item.status === "REJECTED";
    return true;
  });

  const filteredFoundItems = data.foundItems.filter((item) => {
    if (filter === "all") return true;
    if (filter === "custody")
      return (
        item.custodyStatus === "SAFE_DESK" || item.custodyStatus === "DEPOSITED_AT_SAFE_DESK"
      );
    if (filter === "held")
      return item.custodyStatus === "HELD_BY_FINDER" || item.custodyStatus === "FINDER_HELD";
    if (filter === "returned")
      return item.status === "RECOVERED" || item.status === "COMPLETED";
    return true;
  });

  const filteredClaims = data.claims.filter((c) => {
    if (filter === "all") return true;
    if (filter === "ready") return c.status === "APPROVED";
    if (filter === "pending") return c.status === "PENDING";
    if (filter === "complete") return c.status === "HANDOVER_COMPLETE";
    if (filter === "rejected") return c.status === "REJECTED";
    return true;
  });

  const combinedCluesAndEvidence = [
    ...data.clues.map((c) => ({ ...c, _subType: "CLUE" as const })),
    ...data.evidence.map((e) => ({ ...e, _subType: "EVIDENCE" as const })),
  ];

  const filteredCluesAndEvidence = combinedCluesAndEvidence.filter((entry) => {
    if (filter === "all") return true;
    if (filter === "clues") return entry._subType === "CLUE";
    if (filter === "evidence") return entry._subType === "EVIDENCE";
    return true;
  });

  return (
    <div
      id="personal-ops"
      className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900/90 p-5 sm:p-6 shadow-2xl backdrop-blur-md space-y-5 scroll-mt-24"
    >
      {/* Header & Activity Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Personal Operations & Submissions
              </h3>
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300 border border-cyan-500/30">
                LIVE LEDGER
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Real-time activity ledger for your lost reports, deposits, claims, and field clues.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {data.counts.claimsReady ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{data.counts.claimsReady} Handover Ready</span>
            </div>
          ) : null}

          <button
            onClick={() => fetchOperations(true)}
            disabled={refreshing || loading}
            type="button"
            title="Refresh Operations Ledger"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 text-xs font-mono transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => handleTabChange("lost")}
          type="button"
          aria-label="Items Reported Lost by Me"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
            activeTab === "lost"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-md shadow-emerald-500/10"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Reported Lost by Me</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === "lost"
                ? "bg-emerald-500/30 text-emerald-200"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {data.counts.lostTotal}
          </span>
        </button>

        <button
          onClick={() => handleTabChange("found")}
          type="button"
          aria-label="Items Turned In by Me"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
            activeTab === "found"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-500/10"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Items Turned In by Me</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === "found"
                ? "bg-cyan-500/30 text-cyan-200"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {data.counts.foundTotal}
          </span>
        </button>

        <button
          onClick={() => handleTabChange("claims")}
          type="button"
          aria-label="My Active Claims & Safe-Desk Matches"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
            activeTab === "claims"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/10"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>My Active Claims & Matches</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === "claims"
                ? "bg-amber-500/30 text-amber-200"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {data.counts.claimsTotal}
          </span>
        </button>

        <button
          onClick={() => handleTabChange("clues")}
          type="button"
          aria-label="Clues & Evidence Submitted by Me"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
            activeTab === "clues"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-500/10"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Clues & Evidence Submitted by Me</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === "clues"
                ? "bg-purple-500/30 text-purple-200"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {data.counts.cluesSolvedTotal + (data.counts.evidenceTotal || 0)}
          </span>
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none pt-1">
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <SlidersHorizontal className="w-3 h-3 text-slate-500 mr-1" />
          {activeTab === "lost" && (
            <>
              {[
                { id: "all", label: "All Reports" },
                { id: "active", label: "Active Search" },
                { id: "review", label: "Under Review" },
                { id: "recovered", label: "Recovered" },
                { id: "rejected", label: "Rejected" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setFilter(pill.id)}
                  type="button"
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    filter === pill.id
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </>
          )}

          {activeTab === "found" && (
            <>
              {[
                { id: "all", label: "All Deposits" },
                { id: "custody", label: "In Safe-Desk" },
                { id: "held", label: "Finder Held" },
                { id: "returned", label: "Returned" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setFilter(pill.id)}
                  type="button"
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    filter === pill.id
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </>
          )}

          {activeTab === "claims" && (
            <>
              {[
                { id: "all", label: "All Claims" },
                { id: "ready", label: "Handover Ready ⚡" },
                { id: "pending", label: "Pending Review" },
                { id: "complete", label: "Completed" },
                { id: "rejected", label: "Rejected" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setFilter(pill.id)}
                  type="button"
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    filter === pill.id
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </>
          )}

          {activeTab === "clues" && (
            <>
              {[
                { id: "all", label: "All Senses" },
                { id: "clues", label: "Solved Clues" },
                { id: "evidence", label: "Case Evidence" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setFilter(pill.id)}
                  type="button"
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    filter === pill.id
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-white/5 bg-slate-950/60 p-5 space-y-3 animate-pulse"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 bg-slate-800 rounded w-24" />
                <div className="h-4 bg-slate-800 rounded w-16" />
              </div>
              <div className="h-5 bg-slate-800 rounded w-3/4" />
              <div className="h-4 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        /* Tab Content Panes */
        <div className="space-y-4">
          {/* TAB 1: LOST ITEMS */}
          {activeTab === "lost" && (
            <>
              {filteredLostItems.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                    <Tag className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                      Zero Active Lost Reports
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {filter === "all"
                        ? "You have not filed any lost item reports. If you've misplaced campus gear or books, broadcast a triage report."
                        : `No lost items matching filter "${filter}".`}
                    </p>
                  </div>
                  {filter === "all" && (
                    <Link
                      href="/lost-and-found"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-emerald-500/20 transition-all"
                    >
                      <Tag className="w-4 h-4" />
                      <span>Report Lost Belonging</span>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredLostItems.map((item) => (
                    <div
                      key={item._id}
                      className="rounded-xl border border-slate-800 hover:border-emerald-500/30 bg-slate-950/70 p-4 sm:p-5 flex flex-col justify-between gap-3 transition-all group"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${getBadgeStyle(
                              item.liveBadge.color
                            )}`}
                          >
                            {item.liveBadge.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 shrink-0">
                            {formatTimeAgo(item.createdAt)}
                          </span>
                        </div>

                        <div>
                          <Link href={`/items/${item._id}`} className="group/link flex items-center gap-1.5">
                            <h4 className="text-sm sm:text-base font-bold text-white group-hover/link:text-emerald-400 transition-colors">
                              {item.title}
                            </h4>
                            <ExternalLink className="w-3 h-3 text-slate-500 group-hover/link:text-emerald-400 shrink-0" />
                          </Link>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                            Category: {item.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{item.locationName}</span>
                        </div>

                        {item.spotDetails && (
                          <p className="text-xs text-slate-400 font-mono line-clamp-2 bg-slate-900/60 p-2 rounded-lg border border-white/5">
                            {item.spotDetails}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                        {item.rewardOffered > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-300">
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            {item.rewardOffered} Coin Bounty
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500">
                            No bounty attached
                          </span>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                          {item.linkedQuest ? (
                            <Link
                              href={`/quests/${item.linkedQuest.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-mono transition-colors"
                            >
                              <span>{item.linkedQuest.code}</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          ) : null}
                          <Link
                            href={`/items/${item._id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono transition-colors"
                            title="Track Item Status"
                          >
                            <span>Track Item</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TAB 2: FOUND DEPOSITS */}
          {activeTab === "found" && (
            <>
              {filteredFoundItems.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center">
                    <Package className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                      Zero Physical Deposits Logged
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {filter === "all"
                        ? "You have not deposited any found campus belongings. Turn in lost items at any Safe-Desk to earn investigator rewards."
                        : `No found deposits matching filter "${filter}".`}
                    </p>
                  </div>
                  {filter === "all" && (
                    <Link
                      href="/lost-and-found/report-found"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-cyan-500/20 transition-all"
                    >
                      <Package className="w-4 h-4" />
                      <span>Deposit Found Item</span>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredFoundItems.map((item) => (
                    <div
                      key={item._id}
                      className="rounded-xl border border-slate-800 hover:border-cyan-500/30 bg-slate-950/70 p-4 sm:p-5 flex flex-col justify-between gap-3 transition-all group"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${getBadgeStyle(
                              item.liveBadge.color
                            )}`}
                          >
                            {item.liveBadge.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 shrink-0">
                            {formatTimeAgo(item.createdAt)}
                          </span>
                        </div>

                        <div>
                          <Link href={`/items/${item._id}`} className="group/link flex items-center gap-1.5">
                            <h4 className="text-sm sm:text-base font-bold text-white group-hover/link:text-cyan-400 transition-colors">
                              {item.title}
                            </h4>
                            <ExternalLink className="w-3 h-3 text-slate-500 group-hover/link:text-cyan-400 shrink-0" />
                          </Link>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                            Category: {item.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">Custody: {item.custodyLocationName}</span>
                        </div>

                        {item.spotDetails && (
                          <p className="text-xs text-slate-400 font-mono line-clamp-2 bg-slate-900/60 p-2 rounded-lg border border-white/5">
                            {item.spotDetails}
                          </p>
                        )}
                      </div>

                      {/* Locker Receipt Code / Safe-Desk Token */}
                      <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                        {item.lockerReceiptCode ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400">Locker Receipt:</span>
                            <button
                              onClick={() => handleCopyLockerCode(item.lockerReceiptCode!)}
                              type="button"
                              title="Click to copy locker receipt code"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold transition-all"
                            >
                              <span>{item.lockerReceiptCode}</span>
                              {copiedCode === item.lockerReceiptCode ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono text-amber-300/80">
                            Deposit pending intake
                          </span>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                            {item.custodyStatus}
                          </span>
                          <Link
                            href={`/items/${item._id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono transition-colors"
                            title="Track Custody & Intake"
                          >
                            <span>Track Deposit</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TAB 3: FILED CLAIMS */}
          {activeTab === "claims" && (
            <>
              {filteredClaims.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                      Zero Ownership Claims Filed
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {filter === "all"
                        ? "You haven't claimed any recovered belongings. Browse the campus directory to locate matching items and verify ownership."
                        : `No claims matching filter "${filter}".`}
                    </p>
                  </div>
                  {filter === "all" && (
                    <Link
                      href="/lost-and-found"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-amber-500/20 transition-all"
                    >
                      <Search className="w-4 h-4" />
                      <span>Browse Found Belongings</span>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredClaims.map((claim) => (
                    <div
                      key={claim._id}
                      className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all ${
                        claim.liveBadge.actionable
                          ? "border-amber-500/50 bg-gradient-to-br from-amber-950/20 via-slate-950 to-slate-950 shadow-lg shadow-amber-500/5"
                          : "border-slate-800 bg-slate-950/70"
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${getBadgeStyle(
                              claim.liveBadge.color
                            )}`}
                          >
                            {claim.liveBadge.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 shrink-0">
                            {formatTimeAgo(claim.createdAt)}
                          </span>
                        </div>

                        <div>
                          <Link href={`/items/${claim.itemId}`} className="group/link flex items-center gap-1.5">
                            <h4 className="text-sm sm:text-base font-bold text-white group-hover/link:text-amber-300 transition-colors">
                              {claim.itemTitle}
                            </h4>
                            <ExternalLink className="w-3 h-3 text-slate-500 group-hover/link:text-amber-300 shrink-0" />
                          </Link>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                            Type: {claim.itemType} Claim • {claim.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{claim.stationName}</span>
                        </div>

                        {claim.counterparty && (
                          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                            <span className="text-slate-500">Desk Staff / Attendant:</span>
                            <span className="text-slate-300 font-bold">
                              {claim.counterparty.displayName}
                            </span>
                          </div>
                        )}

                        {/* Rejection Alert if Claim was rejected */}
                        {claim.status === "REJECTED" && (
                          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono space-y-1">
                            <div className="flex items-center gap-1.5 font-bold">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Claim Rejected</span>
                            </div>
                            <p className="text-[11px] text-rose-300/80">
                              {claim.rejectionReason || "Ownership proof could not be verified by custodian."}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Action Area */}
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        {claim.status === "APPROVED" ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-900 border border-amber-500/20">
                              <span className="text-slate-400">Custody PIN:</span>
                              <span className="tracking-widest font-black text-amber-300">
                                ••••••
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {onOpenHandoverModal && (
                                <button
                                  onClick={() => onOpenHandoverModal(claim)}
                                  type="button"
                                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs font-mono shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>View Handover PIN</span>
                                </button>
                              )}
                              <Link
                                href={`/items/${claim.itemId}`}
                                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 text-xs font-mono flex items-center justify-center gap-1 transition-colors"
                                title="Track Item Details"
                              >
                                <span>Track</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            {claim.status === "HANDOVER_COMPLETE" ? (
                              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Custody Settled & Verified</span>
                              </div>
                            ) : (
                              <span className="text-xs font-mono text-slate-500">
                                Awaiting custodian review
                              </span>
                            )}

                            <Link
                              href={`/items/${claim.itemId}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 text-[11px] font-mono transition-colors"
                              title="Track Claimed Item"
                            >
                              <span>Track Item</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TAB 4: CLUES & EVIDENCE */}
          {activeTab === "clues" && (
            <>
              {filteredCluesAndEvidence.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                      Zero Deductions or Evidence Logged
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {filter === "all"
                        ? "You haven't submitted any field clues or corkboard evidence yet. Launch an investigation quest to test your deductive prowess."
                        : `No entries matching filter "${filter}".`}
                    </p>
                  </div>
                  {filter === "all" && (
                    <Link
                      href="/quests"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-purple-500/20 transition-all"
                    >
                      <Search className="w-4 h-4" />
                      <span>Accept Investigation Quest</span>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCluesAndEvidence.map((entry, idx) => {
                    const isClue = entry._subType === "CLUE";
                    return (
                      <div
                        key={isClue ? `clue-${(entry as ClueOp).clueId}-${idx}` : `ev-${(entry as EvidenceOp)._id}`}
                        className="rounded-xl border border-slate-800 hover:border-purple-500/30 bg-slate-950/70 p-4 sm:p-5 flex flex-col justify-between gap-3 transition-all"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${getBadgeStyle(
                                entry.liveBadge.color
                              )}`}
                            >
                              {entry.liveBadge.label}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 shrink-0">
                              {formatTimeAgo(isClue ? (entry as ClueOp).solvedAt : (entry as EvidenceOp).createdAt)}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold">
                                {entry.questCode}
                              </span>
                              <h4 className="text-sm font-bold text-white truncate">
                                {entry.questTitle}
                              </h4>
                            </div>
                            <p className="text-xs text-slate-300 font-mono mt-1">
                              {isClue ? (
                                <span className="text-emerald-400 font-bold">
                                  Stage #{(entry as ClueOp).stageOrder} Solved
                                </span>
                              ) : (
                                <span>{(entry as EvidenceOp).title}</span>
                              )}
                            </p>
                          </div>

                          {!isClue && (entry as EvidenceOp).content && (
                            <p className="text-xs text-slate-400 font-mono line-clamp-2 bg-slate-900/60 p-2 rounded-lg border border-white/5">
                              {(entry as EvidenceOp).content}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                          {isClue ? (
                            <div className="flex items-center gap-1.5 text-emerald-400">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Deduction Confirmed</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-cyan-400">
                              <ThumbsUp className="w-3.5 h-3.5" />
                              <span>{(entry as EvidenceOp).upvotesCount} Corkboard Upvotes</span>
                            </div>
                          )}

                          {isClue && (entry as ClueOp).questId && (
                            <Link
                              href={`/quests/${(entry as ClueOp).questId}`}
                              className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                            >
                              <span>Inspect Quest</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
