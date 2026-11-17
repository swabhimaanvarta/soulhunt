"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  PackagePlus,
  ShieldCheck,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

interface OperationsLedgerTabProps {
  lostItems: any[];
  foundItems: any[];
  claims: any[];
}

type LedgerFilter = "ALL" | "LOST" | "FOUND" | "CLAIMS";

export default function OperationsLedgerTab({
  lostItems = [],
  foundItems = [],
  claims = [],
}: OperationsLedgerTabProps) {
  const [filter, setFilter] = useState<LedgerFilter>("ALL");
  const [displayCount, setDisplayCount] = useState<number>(10);

  // Normalize all activities into a unified timeline
  const unifiedActivities = useMemo(() => {
    const list: Array<{
      id: string;
      kind: "LOST" | "FOUND" | "CLAIM";
      title: string;
      category: string;
      status: string;
      date: string;
      location?: string;
      linkUrl?: string;
      badgeColor: "emerald" | "amber" | "cyan" | "rose" | "slate";
    }> = [];

    // Map lost items
    lostItems.forEach((item) => {
      let badgeColor: "emerald" | "amber" | "cyan" | "rose" | "slate" = "amber";
      if (item.status === "RESOLVED" || item.status === "CLAIMED") badgeColor = "emerald";
      if (item.status === "CANCELLED") badgeColor = "slate";

      const coarseLocation = item.lastKnownLocationId?.name || "AIEM Campus Complex";

      list.push({
        id: `lost-${item._id}`,
        kind: "LOST",
        title: item.title || "Lost Item Report",
        category: item.category || "Campus Belonging",
        status: item.status || "REPORTED",
        date: item.createdAt || item.lostAt || new Date().toISOString(),
        location: coarseLocation,
        linkUrl: `/items/${item._id}`,
        badgeColor,
      });
    });

    // Map found items
    foundItems.forEach((item) => {
      let badgeColor: "emerald" | "amber" | "cyan" | "rose" | "slate" = "cyan";
      if (item.status === "RESOLVED") badgeColor = "emerald";
      if (item.custodyStatus === "AT_SAFE_DESK") badgeColor = "emerald";

      const coarseLocation =
        item.currentCustodyLocationId?.name ||
        item.foundLocationId?.name ||
        "Safe-Desk Custody Station";

      list.push({
        id: `found-${item._id}`,
        kind: "FOUND",
        title: item.shortTitle || item.title || "Found Item Deposit",
        category: item.category || "Campus Belonging",
        status: item.custodyStatus || item.status || "DEPOSITED",
        date: item.createdAt || item.foundAt || new Date().toISOString(),
        location: coarseLocation,
        linkUrl: `/items/${item._id}`,
        badgeColor,
      });
    });

    // Map claims
    claims.forEach((c) => {
      let badgeColor: "emerald" | "amber" | "cyan" | "rose" | "slate" = "amber";
      if (c.status === "HANDOVER_COMPLETE" || c.status === "APPROVED") badgeColor = "emerald";
      if (c.status === "REJECTED") badgeColor = "rose";

      const itemRef = c.itemId;
      const title = itemRef?.title || itemRef?.shortTitle || "Campus Claim";

      list.push({
        id: `claim-${c._id}`,
        kind: "CLAIM",
        title: `Claim: ${title}`,
        category: itemRef?.category || "Claim Dispute",
        status: c.status || "PENDING",
        date: c.createdAt || new Date().toISOString(),
        location: "Campus Safe-Desk Verification",
        linkUrl: `/dashboard`,
        badgeColor,
      });
    });

    // Sort descending by date
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [lostItems, foundItems, claims]);

  // Filter list
  const filteredActivities = useMemo(() => {
    if (filter === "ALL") return unifiedActivities;
    if (filter === "LOST") return unifiedActivities.filter((a) => a.kind === "LOST");
    if (filter === "FOUND") return unifiedActivities.filter((a) => a.kind === "FOUND");
    if (filter === "CLAIMS") return unifiedActivities.filter((a) => a.kind === "CLAIM");
    return unifiedActivities;
  }, [unifiedActivities, filter]);

  const visibleList = filteredActivities.slice(0, displayCount);
  const hasMore = filteredActivities.length > displayCount;

  return (
    <div className="space-y-6">
      {/* Header controls: Filter pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Operations Ledger
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {filteredActivities.length} Records
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Chronological log of personal reports, custody deposits, and recovery claims.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {[
            { id: "ALL", label: "All Activity" },
            { id: "LOST", label: "Lost Reports" },
            { id: "FOUND", label: "Found Deposits" },
            { id: "CLAIMS", label: "Claims" },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => {
                setFilter(pill.id as LedgerFilter);
                setDisplayCount(10);
              }}
              type="button"
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                filter === pill.id
                  ? "bg-slate-800 text-white border-white/30 font-bold shadow-sm"
                  : "bg-slate-950/60 text-slate-400 border-white/5 hover:text-slate-200"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activities List */}
      {visibleList.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">No Operations Recorded</h3>
          <p className="text-xs text-slate-500 font-mono mt-1 max-w-sm mx-auto">
            You have not submitted any reports or claims matching this filter yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleList.map((entry) => (
            <div
              key={entry.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                    entry.badgeColor === "emerald"
                      ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                      : entry.badgeColor === "cyan"
                      ? "bg-cyan-400 shadow-sm shadow-cyan-400/50"
                      : entry.badgeColor === "rose"
                      ? "bg-rose-400 shadow-sm shadow-rose-400/50"
                      : "bg-amber-400 shadow-sm shadow-amber-400/50"
                  }`}
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/5 uppercase">
                      {entry.kind}
                    </span>
                    <h4 className="text-sm font-bold text-white tracking-tight">
                      {entry.title}
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
                    <span>{entry.category}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {entry.location}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(entry.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 justify-end shrink-0">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold border uppercase ${
                    entry.badgeColor === "emerald"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : entry.badgeColor === "cyan"
                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                      : entry.badgeColor === "rose"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  }`}
                >
                  {entry.status.replace(/_/g, " ")}
                </span>
                {entry.linkUrl && (
                  <Link
                    href={entry.linkUrl}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    aria-label="View Details"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show More Button */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={() => setDisplayCount((prev) => prev + 10)}
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono font-bold text-slate-300 hover:text-white transition-all shadow-sm"
          >
            <span>Show More Activity ({filteredActivities.length - displayCount} remaining)</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
