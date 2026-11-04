"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Coins,
  Shield,
  Sparkles,
  Award,
  CheckCircle2,
  Lock,
  Loader2,
  Layers,
  Cpu,
  User,
  Zap,
} from "lucide-react";
import { isCosmeticOwned, isStarterCosmetic } from "@/lib/cosmetics";
import { sfx } from "@/lib/audio/sfx";

// Visual preview component for cosmetics in shop
function CosmeticVisualPreview({ reward }: { reward: any }) {
  const type = String(reward.type || "").toUpperCase();
  const title = reward.title || reward.name || "";
  const slug = reward.metadata?.value || "";

  if (type === "FRAME" || title.toLowerCase().includes("frame")) {
    return (
      <div className="h-28 w-full rounded-2xl bg-slate-950 flex items-center justify-center p-3 border border-white/5 relative overflow-hidden group-hover:border-cyan-500/30 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/20 via-transparent to-emerald-950/20" />
        <div className="w-16 h-16 rounded-2xl border-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)] ring-2 ring-cyan-400/30 flex items-center justify-center bg-slate-900 relative">
          <Shield className="w-8 h-8 text-cyan-400 animate-pulse" />
          <span className="absolute -bottom-1 text-[8px] font-mono px-1.5 py-0.2 bg-slate-950 border border-cyan-400/50 text-cyan-300 rounded">
            FRAME
          </span>
        </div>
      </div>
    );
  }

  if (type === "TITLE" || title.toLowerCase().includes("title")) {
    return (
      <div className="h-28 w-full rounded-2xl bg-slate-950 flex flex-col items-center justify-center p-3 border border-white/5 relative overflow-hidden group-hover:border-amber-500/30 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/10 via-transparent to-slate-950" />
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">
          OPERATIVE CALLSIGN
        </span>
        <div className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs tracking-wide shadow-md shadow-amber-500/10 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-amber-400" />
          <span>{title}</span>
        </div>
      </div>
    );
  }

  if (type === "THEME" || type === "BANNER" || title.toLowerCase().includes("theme") || title.toLowerCase().includes("banner")) {
    return (
      <div className="h-28 w-full rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/40 flex flex-col justify-between p-3.5 border border-emerald-500/20 relative overflow-hidden group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400/80">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" /> HUD MATRIX
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>
        <div className="h-3 w-3/4 rounded bg-emerald-500/20 border border-emerald-500/30" />
        <div className="h-2 w-1/2 rounded bg-cyan-500/20 border border-cyan-500/30" />
      </div>
    );
  }

  if (type === "EFFECT" || title.toLowerCase().includes("glitch") || title.toLowerCase().includes("effect")) {
    return (
      <div className="h-28 w-full rounded-2xl bg-slate-950 flex flex-col items-center justify-center p-3 border border-purple-500/20 relative overflow-hidden group-hover:border-purple-500/40 transition-colors">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.15),transparent_70%)]" />
        <Cpu className="w-8 h-8 text-purple-400 animate-pulse mb-1" />
        <span className="text-[10px] font-mono text-purple-300 font-bold tracking-wider">
          HOLO-GLITCH DISTORTION
        </span>
      </div>
    );
  }

  // Fallback for DECORATION / BADGE / AVATAR
  return (
    <div className="h-28 w-full rounded-2xl bg-slate-950 flex items-center justify-center p-3 border border-white/5 relative overflow-hidden group-hover:border-emerald-500/30 transition-colors">
      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
        <Sparkles className="w-7 h-7" />
      </div>
    </div>
  );
}

// Ownership and Equipped Resolution Helpers (Fixing slug vs title mismatch bug)
function checkRewardOwnership(reward: any, user: any): boolean {
  if (!user || !reward) return false;
  const rewardIdStr = String(reward._id || "");
  const slug = (reward.metadata?.value || "").toLowerCase();
  const code = (reward.code || "").toLowerCase();
  const title = (reward.title || reward.name || "").toLowerCase();

  // 1. Starter cosmetics are always freely owned
  if (
    isStarterCosmetic(slug) ||
    isStarterCosmetic(code) ||
    isStarterCosmetic(title)
  ) {
    return true;
  }

  // 2. Direct match in user.ownedCosmetics array
  if (Array.isArray(user.ownedCosmetics)) {
    const isDirectlyOwned = user.ownedCosmetics.some((entry: any) => {
      if (!entry) return false;
      const str = typeof entry === "object"
        ? (entry._id ? String(entry._id) : (entry.code || entry.title || entry.metadata?.value || ""))
        : String(entry);
      const strLower = str.toLowerCase();
      return (
        str === rewardIdStr ||
        (slug && strLower === slug) ||
        (code && strLower === code) ||
        (title && strLower === title)
      );
    });
    if (isDirectlyOwned) return true;
  }

  // 3. EquippedFrame comparison fix: check against slug, code, and title
  if (user.equippedFrame) {
    const eqFrame = String(user.equippedFrame).toLowerCase();
    if (
      eqFrame === slug ||
      eqFrame === code ||
      eqFrame === title ||
      (slug && slug.includes(eqFrame)) ||
      (slug && eqFrame.includes(slug))
    ) {
      return true;
    }
  }

  // 4. EquippedTitle comparison
  if (user.equippedTitle) {
    const eqTitle = String(user.equippedTitle).toLowerCase();
    if (eqTitle === title || eqTitle === slug || eqTitle === code) {
      return true;
    }
  }

  // 5. EquippedTheme comparison
  if (user.equippedTheme) {
    const eqTheme = String(user.equippedTheme).toLowerCase();
    if (eqTheme === slug || eqTheme === code || eqTheme === title) {
      return true;
    }
  }

  // 6. Catalogue level / achievement unlock
  if (
    (slug && isCosmeticOwned(user, slug, user.level)) ||
    (code && isCosmeticOwned(user, code, user.level)) ||
    (title && isCosmeticOwned(user, title, user.level)) ||
    isCosmeticOwned(user, rewardIdStr, user.level)
  ) {
    return true;
  }

  return false;
}

function checkRewardEquipped(reward: any, user: any): boolean {
  if (!user || !reward) return false;
  const slug = (reward.metadata?.value || "").toLowerCase();
  const code = (reward.code || "").toLowerCase();
  const title = (reward.title || reward.name || "").toLowerCase();

  if (user.equippedFrame) {
    const eq = String(user.equippedFrame).toLowerCase();
    if (eq === slug || eq === code || eq === title) return true;
  }
  if (user.equippedTitle) {
    const eq = String(user.equippedTitle).toLowerCase();
    if (eq === title || eq === slug || eq === code) return true;
  }
  if (user.equippedTheme) {
    const eq = String(user.equippedTheme).toLowerCase();
    if (eq === slug || eq === code || eq === title) return true;
  }
  return false;
}

export default function RewardsShopPage() {
  const [rewards, setRewards] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const fetchData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePurchase = async (rewardId: string) => {
    if (purchasingId) return;

    // Prevent duplicate purchase API calls for owned items
    const targetReward = rewards.find((r) => String(r._id) === String(rewardId));
    if (checkRewardOwnership(targetReward, user)) {
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

      sfx.playLevelUpFanfare();
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
            const isOwned = checkRewardOwnership(reward, user);
            const isEquipped = checkRewardEquipped(reward, user);
            const canAfford = user && user.coins >= reward.coinCost;
            const meetsLevel = user && user.level >= reward.minLevelRequired;
            const isSoldOut = reward.stock === 0;

            return (
              <div
                key={reward._id}
                className="glass-panel rounded-3xl p-6 border border-white/10 hover:border-amber-500/40 transition-all flex flex-col justify-between group bg-slate-900/60"
              >
                <div className="space-y-4">
                  {/* Visual Cosmetic Preview */}
                  <CosmeticVisualPreview reward={reward} />

                  {/* Header Badges */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-slate-800 text-slate-300 border border-white/10">
                      {reward.type}
                    </span>

                    {/* Status Badges: Equipped, Owned, or Price */}
                    {isEquipped ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                        Equipped
                      </span>
                    ) : isOwned ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Owned
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-400 font-mono font-bold text-sm bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        <Coins className="w-4 h-4" />
                        <span>{reward.coinCost}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                      {reward.title || reward.name}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-mono">
                      {reward.description}
                    </p>
                  </div>

                  {/* Unlock Requirements */}
                  <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs font-mono text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Requirement:</span>
                      <span className={meetsLevel ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
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

                {/* Purchase Button */}
                <div className="pt-5 mt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => handlePurchase(reward._id)}
                    disabled={purchasingId === reward._id || isOwned || !canAfford || !meetsLevel || isSoldOut}
                    className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed ${
                      isEquipped
                        ? "bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 shadow-sm cursor-not-allowed"
                        : isOwned
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
                    ) : isEquipped ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Active (Equipped)</span>
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
