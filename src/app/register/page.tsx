"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Compass,
  Lock,
  User,
  Shield,
  ArrowRight,
  AlertCircle,
  Mail,
  CheckCircle2,
  KeyRound,
  RotateCcw,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEmail = searchParams?.get("email");
  const queryPending = searchParams?.get("pending");

  const [formData, setFormData] = useState({
    email: "",
    username: "",
    displayName: "",
    password: "",
    department: "Computer Science & Engineering",
    yearOfStudy: 2,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Verification Step state
  const [isVerifying, setIsVerifying] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (queryEmail && queryPending === "true") {
      setTargetEmail(queryEmail);
      setIsVerifying(true);
      setSuccessMsg("Clearance code required. Please enter the 6-digit verification code to activate your account.");
    }
  }, [queryEmail, queryPending]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isVerifying && resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    } else if (resendCooldown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [isVerifying, resendCooldown]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Registration failed.");
      }

      if (json.pendingVerification) {
        setTargetEmail(json.email || formData.email.toLowerCase().trim());
        if (json.devClearanceCode) {
          setDevOtpHint(json.devClearanceCode);
        }
        setIsVerifying(true);
        setResendCooldown(60);
        setCanResend(false);
        setSuccessMsg("Clearance code dispatched! Check your institutional college mailbox.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit clearance code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, code: otpCode }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Verification failed.");
      }

      setSuccessMsg("Clearance verified! Redirecting to Investigator HQ...");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Invalid clearance code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to resend code.");
      }

      if (json.devClearanceCode) {
        setDevOtpHint(json.devClearanceCode);
      }
      setSuccessMsg("A fresh clearance code has been dispatched to your mailbox.");
      setResendCooldown(60);
      setCanResend(false);
    } catch (err: any) {
      setError(err.message || "Failed to resend clearance code.");
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
            {isVerifying ? "Verify Institutional Clearance" : "Register for AIEM Hunt"}
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            AIEM - Agnel Institute of Engineering and Management
          </p>
          <p className="text-[11px] text-emerald-400 font-mono">
            Official institutional emails (@aiemgoa.ac.in or @aitdgoa.edu.in)
          </p>
        </div>

        {isVerifying ? (
          /* Step 2: 6-Digit OTP Verification Form */
          <form onSubmit={handleVerifyOtp} className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-5">
            {error && (
              <div role="alert" className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-mono">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div role="status" className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-mono">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>Clearance code dispatched to:</span>
              </div>
              <p className="font-mono text-emerald-400 font-bold break-all">{targetEmail}</p>
              <p className="text-[11px] text-slate-400">
                Code expires in 15 minutes. Check spam or junk folder if not in inbox.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="otp-input" className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                <span>6-Digit Clearance Code *</span>
              </label>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                autoComplete="one-time-code"
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>

            {devOtpHint && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider block">
                    Dev Clearance Code
                  </span>
                  <span className="text-sm font-mono font-bold text-white tracking-widest">{devOtpHint}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOtpCode(devOtpHint)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  Insert Code
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Clearance...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Enter HQ</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={!canResend || loading}
                className="flex items-center gap-1.5 text-slate-300 hover:text-white disabled:opacity-50 transition-colors font-mono text-[11px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {canResend ? "Resend Code" : `Resend in ${resendCooldown}s`}
              </button>

              <button
                type="button"
                onClick={() => setIsVerifying(false)}
                className="text-slate-400 hover:text-slate-200 underline text-[11px]"
              >
                Change Email
              </button>
            </div>
          </form>
        ) : (
          /* Step 1: Initial Registration Form */
          <form onSubmit={handleRegister} className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-4">
            {error && (
              <div id="reg-error" role="alert" className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-mono">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="reg-email" className="text-xs font-mono text-slate-300">College Email Address *</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5" aria-hidden="true" />
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  aria-required="true"
                  aria-invalid={!!error}
                  aria-describedby={error ? "reg-error" : undefined}
                  placeholder="student.name@aiemgoa.ac.in"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="reg-username" className="text-xs font-mono text-slate-300">Hunter Codename *</label>
                <input
                  id="reg-username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  aria-required="true"
                  aria-invalid={!!error}
                  aria-describedby={error ? "reg-error" : undefined}
                  placeholder="e.g. shadow_scout"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="reg-displayname" className="text-xs font-mono text-slate-300">Full Name *</label>
                <input
                  id="reg-displayname"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  aria-required="true"
                  aria-invalid={!!error}
                  aria-describedby={error ? "reg-error" : undefined}
                  placeholder="e.g. Aryan Das"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="reg-department" className="text-xs font-mono text-slate-300">Department *</label>
              <select
                id="reg-department"
                name="department"
                aria-required="true"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                <option value="Electronics & Communication">Electronics & Communication</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Electrical Engineering">Electrical Engineering</option>
                <option value="Civil Engineering">Civil Engineering</option>
                <option value="Administration & Security">Administration & Security</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="reg-year" className="text-xs font-mono text-slate-300">Year of Study</label>
                <select
                  id="reg-year"
                  name="yearOfStudy"
                  value={formData.yearOfStudy}
                  onChange={(e) => setFormData({ ...formData, yearOfStudy: parseInt(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <option value={1}>1st Year</option>
                  <option value={2}>2nd Year</option>
                  <option value={3}>3rd Year</option>
                  <option value={4}>4th Year</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="reg-password" className="text-xs font-mono text-slate-300">Password (8+ chars) *</label>
                <div className="relative flex items-center">
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    aria-required="true"
                    aria-invalid={!!error}
                    aria-describedby={error ? "reg-error" : undefined}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering Clearance with AIEM Grid...</span>
                </>
              ) : (
                <>
                  <span>Create Hunter Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2 border-t border-white/5 text-xs text-slate-400">
              Already have an operative clearance?{" "}
              <Link href="/login" prefetch={true} className="text-emerald-400 font-bold hover:underline">
                Log in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070A0F] text-slate-400 font-mono text-xs flex items-center justify-center">
          Loading registration terminal...
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
