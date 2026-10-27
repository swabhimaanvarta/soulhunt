"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  KeyRound,
  Lock,
  Mail,
  User,
  Shield,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  X,
} from "lucide-react";

function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams?.get("email") || "";

  // Step 1: Request Code | Step 2: Enter Code & New Password | Step 3: Success
  const [step, setStep] = useState<"REQUEST" | "RESET" | "SUCCESS">("REQUEST");

  // Form states
  const [identifier, setIdentifier] = useState(initialEmail);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Resend cooldown timer
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inFlightRef = useRef(false);

  // Cooldown countdown effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "RESET" && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  // Password rules validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  // Handler: Request Recovery Code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current || loading) return;
    if (!identifier.trim()) {
      setError("Please enter your college email or username.");
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to initiate password recovery.");
      }

      setMaskedEmail(json.maskedEmail || identifier);
      setStep("RESET");
      setResendCooldown(60);
      setCanResend(false);
      setSuccessMsg("Recovery clearance code dispatched! Check your institutional college inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to dispatch recovery code.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  // Handler: Resend Code
  const handleResendCode = async () => {
    if (!canResend || inFlightRef.current || loading) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to resend recovery code.");
      }

      setSuccessMsg("A fresh recovery code has been dispatched to your mailbox.");
      setResendCooldown(60);
      setCanResend(false);
    } catch (err: any) {
      setError(err.message || "Failed to resend recovery code.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  // Handler: Submit Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current || loading) return;

    if (code.trim().length !== 6) {
      setError("Please enter the complete 6-digit recovery clearance code.");
      return;
    }
    if (!isPasswordValid) {
      setError("Please ensure your new password satisfies all security requirements.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          code: code.trim(),
          newPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to reset password.");
      }

      setStep("SUCCESS");
      // Auto-redirect to login with success indicator after 2.5 seconds
      setTimeout(() => {
        router.push("/login?reset=success");
      }, 2500);
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-emerald-600 p-0.5 shadow-xl shadow-amber-500/20 mb-2">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {step === "SUCCESS"
              ? "Access Restored"
              : step === "RESET"
              ? "Reset Password"
              : "Recover Operative Access"}
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            AIEM - Agnel Institute of Engineering and Management
          </p>
        </div>

        {/* Security Notice */}
        <div className="rounded-2xl bg-slate-900/90 border border-amber-500/20 p-4 space-y-1.5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-amber-400 font-bold tracking-wide uppercase">
            <Shield className="w-4 h-4" />
            <span>Cryptographic Identity Recovery</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            {step === "RESET"
              ? "Verify the 6-digit clearance code sent to your registered college mailbox."
              : "Enter your registered college email or hunter callsign to dispatch a single-use clearance challenge."}
          </p>
        </div>

        {/* Global Notifications */}
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

        {/* Step 1: Identifier Entry */}
        {step === "REQUEST" && (
          <form onSubmit={handleRequestCode} className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="recovery-identifier" className="text-xs font-mono text-slate-300">
                Registered College Email or Username
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5" aria-hidden="true" />
                <input
                  id="recovery-identifier"
                  name="identifier"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="name@aiemgoa.ac.in or username"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
              <p className="text-[10px] font-mono text-slate-500">
                Must be an active student, staff, or moderator account on the AIEM Grid.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !identifier.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs font-mono shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching Clearance Code...</span>
                </>
              ) : (
                <>
                  <span>Dispatch Recovery Challenge</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2 border-t border-white/5 text-xs text-slate-400 flex items-center justify-between">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors font-mono"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </Link>
              <Link
                href="/register"
                className="text-emerald-400 hover:underline font-mono font-medium"
              >
                Create Account
              </Link>
            </div>
          </form>
        )}

        {/* Step 2: Enter Code & New Password */}
        {step === "RESET" && (
          <form onSubmit={handleResetPassword} className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-5">
            {/* Target Address Info Card */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs font-mono text-amber-300">
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-[240px]">
                  {maskedEmail || identifier}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep("REQUEST");
                  setCode("");
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-[11px] font-mono text-amber-400 hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>

            {/* 6-Digit Code Input */}
            <div className="space-y-1.5">
              <label htmlFor="recovery-code" className="text-xs font-mono text-slate-300 flex items-center justify-between">
                <span>6-Digit Clearance Code *</span>
                <span className="text-[10px] text-slate-500 font-mono">Expires in 15m</span>
              </label>
              <input
                id="recovery-code"
                name="code"
                type="text"
                maxLength={6}
                autoFocus
                required
                placeholder="123456"
                value={code}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(cleaned);
                  if (error) setError(null);
                }}
                className="w-full text-center tracking-[0.5em] text-lg font-mono py-2.5 rounded-xl bg-slate-950 border border-white/10 text-amber-400 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label htmlFor="recovery-new-password" className="text-xs font-mono text-slate-300">
                New Password *
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5" aria-hidden="true" />
                <input
                  id="recovery-new-password"
                  name="newPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Min 8 chars, 1 uppercase, 1 digit"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
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

              {/* Password Requirements Checklist */}
              {newPassword.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 pt-1.5 font-mono text-[10px]">
                  <div className={`flex items-center gap-1 ${hasMinLength ? "text-emerald-400" : "text-slate-500"}`}>
                    {hasMinLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>8+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1 ${hasUppercase ? "text-emerald-400" : "text-slate-500"}`}>
                    {hasUppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>1 uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1 ${hasLowercase ? "text-emerald-400" : "text-slate-500"}`}>
                    {hasLowercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>1 lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1 ${hasNumber ? "text-emerald-400" : "text-slate-500"}`}>
                    {hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    <span>1 number</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <label htmlFor="recovery-confirm-password" className="text-xs font-mono text-slate-300">
                Confirm New Password *
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5" aria-hidden="true" />
                <input
                  id="recovery-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-[10px] font-mono text-rose-400">Passwords do not match.</p>
              )}
            </div>

            {/* Submit Reset Button */}
            <button
              type="submit"
              disabled={loading || code.length !== 6 || !isPasswordValid || !passwordsMatch}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Credentials...</span>
                </>
              ) : (
                <>
                  <span>Save Password & Restore Access</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Resend Code Action */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Didn't receive the code?</span>
              <button
                type="button"
                disabled={!canResend || loading}
                onClick={handleResendCode}
                className="text-amber-400 hover:text-amber-300 font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                <span>{canResend ? "Resend Code" : `Resend in ${resendCooldown}s`}</span>
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Success Display */}
        {step === "SUCCESS" && (
          <div className="glass-panel rounded-3xl p-8 border border-emerald-500/30 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Password Updated!</h3>
              <p className="text-xs text-slate-300 font-mono">
                Your operative credentials have been successfully refreshed. Your session has been secured.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/login?reset=success"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#070A0F] text-slate-400 font-mono text-xs flex items-center justify-center">
          Loading recovery terminal...
        </div>
      }
    >
      <ForgotPasswordForm />
    </React.Suspense>
  );
}
