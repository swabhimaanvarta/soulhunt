"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Building,
  KeyRound,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Package,
  MessageSquare,
  ArrowRight,
} from "lucide-react";

interface ItemActionBannerProps {
  item: any;
  currentUser: any;
  activeClaim?: any;
  pendingClaimsCount?: number;
}

export default function ItemActionBanner({
  item,
  currentUser,
  activeClaim,
  pendingClaimsCount = 0,
}: ItemActionBannerProps) {
  if (!item) return null;

  const currentUserId = currentUser?._id?.toString();
  const isReporter = item.reporterId && (item.reporterId._id?.toString() || item.reporterId.toString()) === currentUserId;
  const isFinder = item.finderId && (item.finderId._id?.toString() || item.finderId.toString()) === currentUserId;
  const isStaff = currentUser && ["ADMIN", "MODERATOR", "SAFE_DESK_STAFF"].includes(currentUser.role);

  const myClaim =
    activeClaim &&
    (activeClaim.claimantId?._id?.toString() === currentUserId ||
      activeClaim.claimantId?.toString() === currentUserId)
      ? activeClaim
      : null;
  const hasApprovedClaim = activeClaim && activeClaim.status === "APPROVED";
  const myApprovedClaim = myClaim && myClaim.status === "APPROVED";
  const myPendingClaim = myClaim && myClaim.status === "PENDING";

  const isCompleted = ["COMPLETED", "RECOVERED"].includes(item.status);
  const isSafeDeskCustody = ["DEPOSITED_AT_SAFE_DESK", "SAFE_DESK"].includes(item.custodyStatus);

  // Dynamic custody location details
  const custodyLocation = item.safeDeskLocationId || item.currentCustodyLocationId || item.foundLocationId;
  const stationName = custodyLocation?.name || "Campus Safe-Desk Station";
  const stationHours = custodyLocation?.operatingHours || "08:00 AM - 06:00 PM";
  const stationBuilding = custodyLocation?.building ? ` (${custodyLocation.building})` : "";

  // 1. Completed State
  if (isCompleted) {
    return (
      <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Physical Return Successfully Certified
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-500/30">
                RECOVERED
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              This item was verified and safely returned to its verified owner. The ticket is officially closed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Approved Claimant State (Owner ready to collect)
  if (myApprovedClaim) {
    return (
      <div className="mb-6 rounded-2xl border border-cyan-500/50 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-950 p-5 shadow-xl backdrop-blur-md animate-in fade-in duration-300">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <KeyRound className="h-6 w-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300 border border-cyan-500/30">
                ACTION REQUIRED: PHYSICAL HANDOVER
              </span>
            </div>
            <h3 className="text-base font-bold text-white">
              {isSafeDeskCustody
                ? `Collect Item at ${stationName}${stationBuilding}`
                : "Coordinate Meetup with Finder or Request Safe Desk Transfer"}
            </h3>
            <p className="text-xs text-slate-300">
              {isSafeDeskCustody ? (
                <>
                  Your claim is verified! The item is physically held at <strong>{stationName}</strong>. Visit during counter hours (<strong>{stationHours}</strong>) and show your 6-digit recovery pass below.
                </>
              ) : (
                <>
                  Your claim is approved! The item is held by the finder. Use the secure coordination thread below to arrange a meetup in a public campus zone, or request transfer to the Safe Desk.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Pending Claimant State
  if (myPendingClaim) {
    return (
      <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Clock className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Claim Under Verification Review
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-300 border border-amber-500/30">
                PENDING REVIEW
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Your proof of ownership is queued with the item custodian and Campus Staff. You will receive an in-app alert when reviewed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 4. Custodian / Finder State
  if (isFinder || isReporter) {
    if (pendingClaimsCount > 0) {
      return (
        <div className="mb-6 rounded-2xl border border-violet-500/50 bg-gradient-to-r from-violet-950/40 via-slate-900 to-slate-950 p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/40">
              <ShieldAlert className="h-6 w-6 animate-bounce" />
            </div>
            <div>
              <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-violet-300 border border-violet-500/30">
                ACTION REQUIRED: REVIEW EVIDENCE
              </span>
              <h3 className="text-base font-bold text-white mt-1">
                {pendingClaimsCount} Pending Claim{pendingClaimsCount > 1 ? "s" : ""} Waiting for Review
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                A student has submitted evidence of ownership. Review their verification answers and proof photos below to approve or decline handover.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (hasApprovedClaim) {
      return (
        <div className="mb-6 rounded-2xl border border-emerald-500/50 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                APPROVED CLAIM IN PROGRESS
              </span>
              <h3 className="text-base font-bold text-white mt-1">
                {isSafeDeskCustody
                  ? `Item in Safe-Desk Custody at ${stationName}`
                  : "Enter Owner&apos;s 6-Digit PIN to Verify Return"}
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                {isSafeDeskCustody ? (
                  <>The item is safely deposited at <strong>{stationName}</strong>. Safe-desk personnel will certify the return when the claimant arrives.</>
                ) : (
                  <>You are in physical possession of this item. Meet the owner in a public zone and enter their 6-digit recovery code into the keypad below.</>
                )}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Default custodian state (No active claims yet)
    return (
      <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900/80 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400 border border-white/10">
            <Building className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">
              {isSafeDeskCustody
                ? `Secured at ${stationName}${stationBuilding}`
                : "Item in Personal Finder Custody"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isSafeDeskCustody
                ? `Counter Hours: ${stationHours}. Any claimant will be directed to the Safe-Desk.`
                : "You can deposit this item at any Campus Safe-Desk counter for secure storage."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 5. Safe-Desk Staff State
  if (isStaff) {
    return (
      <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Safe-Desk Station Operations
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-500/30">
                STAFF VIEW
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Custody Status: <strong>{item.custodyStatus?.replace(/_/g, " ") || "FINDER HELD"}</strong>. Authorized staff can certify handovers with the owner&apos;s 6-digit recovery code.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 6. Public Visitor / Other Student State
  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Campus Lost & Found Listing
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Is this item yours? Submit proof of ownership below to initiate secure verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
