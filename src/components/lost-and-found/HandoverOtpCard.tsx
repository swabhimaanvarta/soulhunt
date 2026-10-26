"use client";

import React, { useState } from "react";
import {
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  Clock,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HandoverOtpCardProps {
  mode: "RECIPIENT" | "CUSTODIAN";
  claimId: string;
  handoverCode?: string;
  handoverCodeExpiresAt?: string;
  handoverLocked?: boolean;
  lockoutUntil?: string | null;
  handoverAttempts?: number;
  onVerifySuccess?: () => void;
}

export default function HandoverOtpCard({
  mode,
  claimId,
  handoverCode,
  handoverCodeExpiresAt,
  handoverLocked,
  lockoutUntil,
  handoverAttempts = 0,
  onVerifySuccess,
}: HandoverOtpCardProps) {
  const { toast } = useToast();

  // Recipient state
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Custodian state
  const [inputCode, setInputCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(Math.max(0, 5 - handoverAttempts));
  const [isLocked, setIsLocked] = useState(Boolean(handoverLocked));

  const handleCopy = () => {
    if (!handoverCode) return;
    navigator.clipboard.writeText(handoverCode);
    setCopied(true);
    toast({
      title: "Recovery Code Copied",
      description: "Keep it private. Only show it in-person upon receiving your item.",
      variant: "success",
    });
    setTimeout(() => setCopied(false), 3000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim().length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid 6-digit handover code.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/claims/verify-handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId,
          handoverCode: inputCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 423 || data.error?.code === "HANDOVER_LOCKED") {
          setIsLocked(true);
          throw new Error("Verification locked due to excessive failed attempts. Please visit Safe-Desk staff to re-issue.");
        }
        if (data.error?.code === "CODE_MISMATCH") {
          setAttemptsRemaining((prev) => Math.max(0, prev - 1));
        }
        throw new Error(data.error?.message || "Invalid handover code.");
      }

      toast({
        title: "Handover Verified!",
        description: "Physical return successfully certified. Virtual rewards credited.",
        variant: "success",
      });
      onVerifySuccess?.();
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // RECIPIENT MODE: High-Contrast Visual Recovery Pass
  if (mode === "RECIPIENT") {
    const formattedCode = handoverCode
      ? `${handoverCode.slice(0, 3)} ${handoverCode.slice(3, 6)}`
      : "------";

    return (
      <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/40 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Your Official Recovery Pass
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-500/30">
                  CONFIDENTIAL
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Show this 6-digit code to the custodian at the time of physical return.
              </p>
            </div>
          </div>
        </div>

        {/* 6-Digit Code Presentation Box */}
        <div className="my-6 flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-black/60 p-6 text-center">
          <span className="text-[11px] font-mono tracking-widest text-emerald-400 uppercase mb-2">
            One-Time Recovery Pass
          </span>

          <div className="flex items-center gap-4">
            <span
              className={`font-mono text-4xl sm:text-5xl font-black tracking-widest transition-all duration-200 select-all ${
                revealed ? "text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "text-slate-600 tracking-wider"
              }`}
            >
              {revealed ? formattedCode : "••• •••"}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-mono font-medium text-slate-200 transition-colors"
            >
              {revealed ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  Hide Pass
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Reveal Code
                </>
              )}
            </button>

            {revealed && handoverCode && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-3 py-1.5 text-xs font-mono font-medium text-emerald-300 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Safety Invariant Guidelines */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-200/90 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>Strict Handover Protocol:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
            <li>Only present this code <strong>in person</strong> after you have physically inspected your item.</li>
            <li><strong>Never</strong> post or paste this code in chats, messages, or emails.</li>
            <li>Once the custodian enters this code, ownership recovery is permanently certified.</li>
          </ul>
        </div>
      </div>
    );
  }

  // CUSTODIAN MODE: Keypad & Verification Input Box
  return (
    <div className="rounded-2xl border-2 border-cyan-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/40 p-6 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Certify Physical Handover
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                CUSTODIAN KEYPAD
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Ask the owner to present their 6-digit recovery code and enter it below.
            </p>
          </div>
        </div>
      </div>

      {isLocked ? (
        <div className="my-6 rounded-xl border border-rose-500/40 bg-rose-950/20 p-5 text-center space-y-2">
          <Lock className="h-8 w-8 text-rose-400 mx-auto" />
          <h4 className="text-sm font-bold text-white">Verification Temporarily Locked</h4>
          <p className="text-xs text-slate-300 max-w-sm mx-auto">
            Maximum verification attempts exceeded. For security, code entry has been locked for 15 minutes. Please visit an authorized Safe-Desk counter for supervisor re-issuance.
          </p>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="my-6 space-y-4">
          <div className="flex flex-col items-center">
            <label htmlFor="otp-input" className="text-xs font-mono text-slate-300 mb-2">
              Enter Owner&apos;s 6-Digit Passcode:
            </label>
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-56 text-center font-mono text-3xl tracking-[0.5em] px-4 py-3 rounded-xl border border-cyan-500/40 bg-slate-900/90 text-cyan-300 placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              autoComplete="off"
            />
            <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-slate-400">
              <span>{attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining</span>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={submitting || inputCode.length !== 6}
              className="w-full sm:w-auto min-w-[200px] rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold font-mono text-xs px-6 py-3 transition-all duration-200 shadow-lg shadow-cyan-500/20"
            >
              {submitting ? "Verifying Passcode..." : "Certify Physical Return"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-[11px] text-slate-400 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
        <span>Upon certification, ownership ledger closes and rewards are credited immediately.</span>
      </div>
    </div>
  );
}
