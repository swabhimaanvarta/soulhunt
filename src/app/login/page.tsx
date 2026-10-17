"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Compass,
  Lock,
  User,
  Shield,
  ArrowRight,
  AlertCircle,
  Sparkles,
  UserCheck,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Invalid credentials.");
      }

      router.push(redirectUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (roleOrEmail: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleOrEmail }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Quick switch failed.");
      }

      router.push(redirectUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 p-0.5 shadow-xl shadow-emerald-500/20 mb-2">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Compass className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Agent Authentication
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            AIEM Lost & Found • Cryptographic Recon Network
          </p>
        </div>

        {/* Quick Demo Personas Bar */}
        <div className="rounded-2xl bg-slate-900/90 border border-white/10 p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 font-bold uppercase">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Instant Demo Evaluation Login (1-Click)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => handleQuickLogin("admin@aiem.edu")}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-left truncate transition-colors"
            >
              👑 Admin (Chatterjee)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin("mod@aiem.edu")}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-left truncate transition-colors"
            >
              🛡️ Safe-Desk Mod (Sen)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin("rahul@student.aiem.edu")}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-left truncate transition-colors"
            >
              🔍 Rahul (Squad Leader)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin("priya@student.aiem.edu")}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-left truncate transition-colors"
            >
              📱 Priya (Item Reporter)
            </button>
          </div>
        </div>

        {/* Main Login Form */}
        <form onSubmit={handleLogin} className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-300">
              College Email or Username
            </label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                type="text"
                required
                placeholder="name@aiemgoa.ac.in or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-300">Password</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
          >
            {loading ? "Authenticating..." : "Sign In to Tactical Network"}
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center pt-2 border-t border-white/5 text-xs text-slate-400">
            Need an AIEM Hunter account?{" "}
            <Link href="/register" className="text-emerald-400 font-bold hover:underline">
              Register here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

