"use client";

import React, { useState, useRef } from "react";
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
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams?.get("redirect") || "/";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.startsWith("/\\")
      ? rawRedirect
      : "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current || loading) return;
    inFlightRef.current = true;
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
        if (json.pendingVerification) {
          window.location.href = `/register?email=${encodeURIComponent(json.email || identifier)}&pending=true`;
          return;
        }
        throw new Error(json.error?.message || "Invalid credentials.");
      }

      // Role-aware destination: Admins go to /admin, hunters go to /dashboard unless redirectUrl was explicit
      let destination = redirectUrl;
      if (destination === "/" && json.data?.role === "ADMIN") {
        destination = "/admin";
      } else if (destination === "/") {
        destination = "/dashboard";
      }

      window.location.href = destination;
    } catch (err: any) {
      setError(err.message || "Login failed.");
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleQuickFill = (email: string, pass: string) => {
    setIdentifier(email);
    setPassword(pass);
    setError(null);
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
            Sign In to AIEM Hunt
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            AIEM - Agnel Institute of Engineering and Management
          </p>
        </div>

        {/* Official College Portal Notice */}
        <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/20 p-4 space-y-1.5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-emerald-400 font-bold tracking-wide uppercase">
            <Shield className="w-4 h-4" />
            <span>Official Institutional Access</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            Authorized for registered students, faculty & security safe-desks with <span className="text-emerald-400 font-semibold">@aiemgoa.ac.in</span> or <span className="text-cyan-400 font-semibold">@aitdgoa.edu.in</span>.
          </p>
        </div>

        {/* Main Login Form */}
        <form onSubmit={handleLogin} className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-5" noValidate={false}>
          {error && (
            <div id="login-error" role="alert" className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="login-identifier" className="text-xs font-mono text-slate-300">
              College Email or Username
            </label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5" aria-hidden="true" />
              <input
                id="login-identifier"
                name="identifier"
                type="text"
                required
                autoComplete="username"
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
                placeholder="name@aiemgoa.ac.in or username"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-xs font-mono text-slate-300">Password</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5" aria-hidden="true" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating with AIEM Grid...</span>
              </>
            ) : (
              <>
                <span>Sign In to Tactical Network</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Quick Identifier Helper */}
          <div className="pt-2 border-t border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Quick Role Autofill (Dev/Demo)
              </p>
              <span className="text-[9px] font-mono text-slate-500">1-click credentials</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickFill("rahul@aiemgoa.ac.in", "Hunter@123")}
                className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-left transition-all disabled:opacity-50 flex flex-col justify-between"
              >
                <div className="text-[10px] font-mono font-bold leading-tight">Student Hunter</div>
                <div className="text-[8px] text-slate-400 font-mono mt-1 truncate">rahul@aiemgoa.ac.in</div>
                <div className="text-[8px] text-emerald-400/90 font-mono">Hunter@123</div>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickFill("mod@aiemgoa.ac.in", "Mod@123")}
                className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-left transition-all disabled:opacity-50 flex flex-col justify-between"
              >
                <div className="text-[10px] font-mono font-bold leading-tight">Safe-Desk Mod</div>
                <div className="text-[8px] text-slate-400 font-mono mt-1 truncate">mod@aiemgoa.ac.in</div>
                <div className="text-[8px] text-cyan-400/90 font-mono">Mod@123</div>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickFill("admin@aiemgoa.ac.in", "Admin@123")}
                className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-left transition-all disabled:opacity-50 flex flex-col justify-between"
              >
                <div className="text-[10px] font-mono font-bold leading-tight">Admin Control</div>
                <div className="text-[8px] text-slate-400 font-mono mt-1 truncate">admin@aiemgoa.ac.in</div>
                <div className="text-[8px] text-amber-400/90 font-mono">Admin@123</div>
              </button>
            </div>
          </div>

          <div className="text-center pt-2 border-t border-white/5 text-xs text-slate-400">
            Need an AIEM Hunter account?{" "}
            <Link href="/register" prefetch={true} className="text-emerald-400 font-bold hover:underline">
              Register here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#070A0F] text-slate-400 font-mono text-xs flex items-center justify-center">
          Loading login terminal...
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}

