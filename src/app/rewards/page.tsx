"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  Coins,
  Shield,
  Sparkles,
  Award,
  CheckCircle2,
  Lock,
  Coffee,
  BookOpen,
  ArrowRight,
  Loader2,
} from "lucide-react";

export default function RewardsShopPage() {
  const [rewards, setRewards] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const fetchData = async () => {
    try {
      const [rRes, uRes] = await Promise.all([
        fetch("/api/rewards"),
        fetch("/api/auth/me"),
      ]);
      const rJson = await rRes.json();
      const uJson = await uRes.json();
      if (rJson.success) setRewards(rJson.data || []);
      if (uJson.success) setUser(uJson.data || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePurchase = async (rewardId: string) => {
    if (purchasingId) return;

    // Prevent duplicate purchase API calls for owned items
    const targetReward = rewards.find((r) => String(r._id) === String(rewardId));
    const isAlreadyOwned = Boolean(
      user?.ownedCosmetics?.some((id: any) => String(id) === String(rewardId)) ||
      (user?.equippedTitle && targetReward && user.equippedTitle === targetReward.title) ||
      (user?.equippedFrame && targetReward && user.equippedFrame === targetReward.title)
    );
    if (isAlreadyOwned) {
      setMessage({ text: "You already own this cosmetic item in your Armory.", error: true });
      return;
    }

    setPurchasingId(rewardId);
    setMessage(null);

    try {
      const clientRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch("/api/rewards/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId, clientRequestId }),
      });

      const json = await res.json();
      if (!json.success) {
        const errorMsg = json.error?.message || (typeof json.error === "string" ? json.error : "Purchase failed");
        throw new Error(errorMsg);
      }

      setMessage({ text: json.message || "Acquired successfully!", error: false });
      if (user && json.data) {
        const freshOwned = Array.isArray(user.ownedCosmetics)
          ? [...user.ownedCosmetics, rewardId]
          : [rewardId];
        setUser({
          ...user,
          coins: json.data.coins,
          equippedTitle: json.data.equippedTitle,
          equippedFrame: json.data.equippedFrame,
          ownedCosmetics: freshOwned,
        });
      }
      fetchData();
    } catch (err: any) {
      setMessage({ text: err.message, error: true });
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              TACTICAL QUARTERMASTER
            </span>
            <span className="text-xs font-mono text-slate-400">Hunter Exchange</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Hunter Shop & Rewards Hub
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Redeem Hunter Coins earned from recoveries and investigations for tactical cosmetic titles, holographic frames, cybernetic themes, and squad prestige badges.
          </p>
        </div>

        {/* Live Hunter Balance */}
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900 border border-amber-500/30 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400">Your Coin Balance</div>
            <div className="text-xl font-mono font-black text-amber-400">
              {user?.coins ?? 0} <span className="text-xs text-amber-300/80 font-normal">Coins</span>
            </div>
          </div>
        </div>
      </div>

      {/* 100% Cosmetic Disclaimer Banner */}
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200">
        <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
        <div className="text-xs font-mono">
          <span className="font-bold text-cyan-300 uppercase tracking-wide mr-2">[Armory Policy]</span>
          <span>All items are cosmetic only — zero gameplay advantage</span>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-mono flex items-center gap-2 ${
            message.error
              ? "bg-rose-500/15 border border-rose-500/30 text-rose-300"
              : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
          }`}
        >
          {message.error ? (
            <Lock className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Grid of Shop Items */}
      {loading ? (
        <div className="py-20 text-center font-mono text-slate-500 text-xs animate-pulse">
          OPENING QUARTERMASTER LOCKERS...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rewards.map((reward) => {
            const isOwned = Boolean(
              user?.ownedCosmetics?.some((id: any) => String(id) === String(reward._id)) ||
              (user?.equippedTitle && user.equippedTitle === reward.title) ||
              (user?.equippedFrame && user.equippedFrame === reward.title)
            );
            const canAfford = user && user.coins >= reward.coinCost;
            const meetsLevel = user && user.level >= reward.minLevelRequired;
            const isSoldOut = reward.stock === 0;

            return (
              <div
                key={reward._id}
                className="glass-panel rounded-3xl p-6 border border-white/10 hover:border-amber-500/40 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-slate-800 text-slate-300 border border-white/10">
                      {reward.type}
                    </span>
                    <div className="flex items-center gap-1 text-amber-400 font-mono font-bold text-sm">
                      <Coins className="w-4 h-4" />
                      <span>{reward.coinCost}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                      {reward.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {reward.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs font-mono text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Requirement:</span>
                      <span className={meetsLevel ? "text-emerald-400" : "text-rose-400 font-bold"}>
                        Level {reward.minLevelRequired}+
                      </span>
                    </div>
                    {reward.stock > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Available Stock:</span>
                        <span className="text-slate-300">{reward.stock} units</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => handlePurchase(reward._id)}
                    disabled={purchasingId === reward._id || isOwned || !canAfford || !meetsLevel || isSoldOut}
                    className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed ${
                      isOwned
                        ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10 cursor-not-allowed"
                        : isSoldOut
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                        : !meetsLevel
                        ? "bg-rose-950/40 border border-rose-500/30 text-rose-300 cursor-not-allowed"
                        : !canAfford
                        ? "bg-slate-900 border border-white/10 text-slate-500 cursor-not-allowed"
                        : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 cursor-pointer"
                    }`}
                  >
                    {purchasingId === reward._id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Acquiring from Armory...</span>
                      </>
                    ) : isOwned ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>✓ Owned in Armory</span>
                      </>
                    ) : isSoldOut ? (
                      "Sold Out"
                    ) : !meetsLevel ? (
                      `Locked (Level ${reward.minLevelRequired} Required)`
                    ) : !canAfford ? (
                      `Insufficient Coins (${reward.coinCost})`
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Acquire for {reward.coinCost} Coins</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

