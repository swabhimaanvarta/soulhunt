"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  PackageCheck,
  Coins,
  Sparkles,
  MapPin,
  Calendar,
  ShieldCheck,
  Receipt,
  ArrowRight,
} from "lucide-react";

interface RecoveryReceipt {
  claimId: string;
  itemTitle: string;
  category: string;
  userRole: "OWNER_RECIPIENT" | "FINDER_HELPER";
  completedAt: string;
  stationName: string;
  coinsAwarded: number;
  xpAwarded: number;
  transactionId?: string | null;
  settlementIdempotencyKey?: string | null;
}

export default function MyRecoveriesSection() {
  const [receipts, setReceipts] = useState<RecoveryReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReceipts() {
      try {
        const res = await fetch("/api/user/recoveries");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setReceipts(json.data);
        }
      } catch {
        // non-blocking
      } finally {
        setLoading(false);
      }
    }
    loadReceipts();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 animate-pulse text-xs font-mono text-slate-500">
        Loading verified recovery ledger...
      </div>
    );
  }

  if (receipts.length === 0) {
    return null;
  }

  const totalCoins = receipts.reduce((acc, r) => acc + (r.coinsAwarded || 0), 0);
  const totalXp = receipts.reduce((acc, r) => acc + (r.xpAwarded || 0), 0);

  return (
    <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/20 p-6 shadow-xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <PackageCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              My Recovery Receipts & Ledger
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-500/30">
                {receipts.length} Complete
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Verified campus returns with cryptographic proof and rewards ledger.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-amber-300 border border-amber-500/20">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            +{totalCoins} Coins Earned
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-emerald-300 border border-emerald-500/20">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            +{totalXp} XP
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {receipts.map((r) => {
          const isFinder = r.userRole === "FINDER_HELPER";
          const formattedDate = new Date(r.completedAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

          return (
            <div
              key={r.claimId}
              className="flex flex-col justify-between rounded-xl border border-white/10 bg-slate-900/80 p-4 hover:border-emerald-500/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                      isFinder
                        ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                        : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                    }`}
                  >
                    {isFinder ? "ITEM RETURNED BY YOU" : "YOUR ITEM RECOVERED"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    {formattedDate}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white mb-1 line-clamp-1">
                  {r.itemTitle}
                </h4>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                  <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{r.stationName}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                <span className="text-[10px] text-slate-400">
                  {r.coinsAwarded > 0 ? `+${r.coinsAwarded} Coins` : "Verified Return"}
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                  <ShieldCheck className="h-3 w-3" />
                  Handover Complete
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
