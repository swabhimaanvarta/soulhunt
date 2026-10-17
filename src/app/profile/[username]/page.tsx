"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Award,
  Coins,
  MapPin,
  Users,
  Compass,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Building,
  Sparkles,
} from "lucide-react";

export default function UserProfilePage() {
  const params = useParams();
  const username = params?.username as string;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user profile or me
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProfile(d.data);
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center font-mono text-slate-500 animate-pulse">
        DECRYPTING AGENT DOSSIER...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <Shield className="w-12 h-12 text-slate-600 mx-auto" />
        <h2 className="text-xl font-bold text-white">Agent Dossier Unavailable</h2>
        <Link href="/login" className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-mono">
          Please Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>

      {/* Main Dossier Header Card */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
          <div className="flex items-center gap-5">
            <div className={`w-20 h-20 rounded-2xl bg-slate-900 border-2 border-emerald-500/50 flex items-center justify-center font-mono text-3xl font-black text-emerald-400 shadow-xl ${profile.equippedFrame || ""}`}>
              {profile.displayName?.charAt(0)}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300">
                  LEVEL {profile.level} • {profile.rankTitle}
                </span>
                {profile.equippedTitle && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    "{profile.equippedTitle}"
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{profile.displayName}</h1>
              <div className="text-xs text-slate-400 font-mono">
                @{profile.username} • {profile.department} (Year {profile.yearOfStudy})
              </div>
            </div>
          </div>

          {/* Trust Tier HUD */}
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-950/80 border border-white/10">
            <Shield className="w-8 h-8 text-cyan-400" />
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-400">Campus Trust Rating</div>
              <div className="text-base font-mono font-bold text-cyan-300">
                {profile.trustTier} ({profile.trustScore} / 1000)
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-emerald-400">
              {profile.stats?.recoveriesCount || 0}
            </div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Verified Recoveries</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-cyan-400">
              {profile.stats?.safeDeskDepositsCount || 0}
            </div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Safe-Desk Deposits</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-amber-400">
              {profile.stats?.questsCompleted || 0}
            </div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Quests Solved</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-violet-400">
              {profile.coins} 🪙
            </div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Hunter Coins</div>
          </div>
        </div>
      </div>
    </div>
  );
}

