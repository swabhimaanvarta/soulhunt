"use client";

import React from "react";
import Link from "next/link";
import {
  MapPin,
  Shield,
  Building,
  Clock,
  ArrowRight,
  CheckCircle2,
  Laptop,
  CreditCard,
  BookOpen,
  Watch,
  Briefcase,
  Key,
  FlaskConical,
  Package,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ELECTRONICS: Laptop,
  ID_CARDS_DOCS: CreditCard,
  BOOKS_NOTES: BookOpen,
  ACCESSORIES: Watch,
  BAGS_WALLETS: Briefcase,
  KEYS: Key,
  LAB_GEAR: FlaskConical,
  OTHER: Package,
};

interface DirectoryItemCardProps {
  item: any;
  isGreyedOut?: boolean;
  layout?: "grid" | "list";
}

export default function DirectoryItemCard({
  item,
  isGreyedOut = false,
  layout = "grid",
}: DirectoryItemCardProps) {
  const isLost = item.itemType === "LOST";
  const isRecovered = item.itemType === "RECOVERED" || item.status === "RECOVERED";
  const isClaimed = ["CLAIMED", "COMPLETED", "HANDOVER_COMPLETE"].includes(item.status);
  const loc = item.location || item.lastKnownLocationId || item.foundLocationId;
  const CategoryIcon = CATEGORY_ICONS[item.category] || Package;

  // Determine badge label and color
  let badgeLabel = item.itemType;
  let badgeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

  if (isGreyedOut) {
    if (isClaimed) {
      badgeLabel = "CLAIMED";
      badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
    } else if (isRecovered) {
      badgeLabel = "RECOVERED";
      badgeColor = "bg-cyan-950/80 text-cyan-300 border-cyan-500/30";
    } else if (item.itemType === "FOUND") {
      badgeLabel = item.custodyStatus?.replace(/_/g, " ") || "FOUND AT SAFE-DESK";
      badgeColor = "bg-slate-800/90 text-cyan-300 border-cyan-500/30";
    }
  } else {
    if (isLost) {
      badgeLabel = "LOST";
      badgeColor = "bg-rose-500/90 text-white border-rose-400 shadow-sm shadow-rose-500/30";
    } else {
      badgeLabel = "FOUND (ACTIVE)";
      badgeColor = "bg-emerald-500/90 text-slate-950 font-bold border-emerald-400 shadow-sm shadow-emerald-500/30";
    }
  }

  const photoSrc =
    item.photoUrl && item.photoUrl.trim() !== "" ? item.photoUrl : "/placeholder-item.png";

  // -------------------------------------------------------------
  // DENSE LIST LAYOUT (Fits 6-8 items on a single mobile screen)
  // -------------------------------------------------------------
  if (layout === "list") {
    return (
      <Link
        href={`/items/${item._id}`}
        className={`rounded-xl p-2.5 sm:p-3 border flex items-center gap-3 group transition-all duration-200 ${
          isGreyedOut
            ? "border-slate-800/80 bg-slate-950/70 opacity-80 hover:opacity-100 hover:border-slate-700 hover:bg-slate-900/80"
            : isLost
            ? "border-rose-500/25 bg-slate-900/80 hover:border-rose-500/60 hover:bg-slate-900 shadow-md shadow-rose-950/10"
            : "border-emerald-500/25 bg-slate-900/80 hover:border-emerald-500/60 hover:bg-slate-900 shadow-md shadow-emerald-950/10"
        }`}
      >
        {/* Compact Square Thumbnail */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg overflow-hidden bg-slate-950 border border-white/5 flex items-center justify-center">
          <img
            src={photoSrc}
            alt={item.title || "Belonging item photo"}
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.endsWith("/placeholder-item.png")) {
                target.src = "/placeholder-item.png";
              }
            }}
            className={`w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 ${
              isGreyedOut ? "grayscale-[35%]" : ""
            }`}
          />
        </div>

        {/* Content Details */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border ${badgeColor}`}
            >
              {badgeLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <CategoryIcon className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">{item.category?.replace(/_/g, " ")}</span>
            </span>
          </div>

          <h3
            className={`font-bold text-xs sm:text-sm line-clamp-1 transition-colors ${
              isGreyedOut
                ? "text-slate-300 group-hover:text-white"
                : "text-white group-hover:text-cyan-300"
            }`}
          >
            {item.title}
          </h3>

          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1 truncate max-w-[130px] sm:max-w-[200px]">
              <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
              <span className="truncate">{loc?.name || "Campus"}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0 text-slate-500">
              <Clock className="w-2.5 h-2.5" />
              {item.dateReported
                ? new Date(item.dateReported).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })
                : "Recent"}
            </span>
          </div>
        </div>

        {/* Right Arrow */}
        <div className="shrink-0 pl-1 text-slate-500 group-hover:text-cyan-400 transition-colors">
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    );
  }

  // -------------------------------------------------------------
  // COMPACT 2-COLUMN GRID LAYOUT (Fits 4-6 cards on mobile screens)
  // -------------------------------------------------------------
  return (
    <div
      className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border flex flex-col justify-between group transition-all duration-200 ${
        isGreyedOut
          ? "border-slate-800/80 bg-slate-950/70 opacity-80 hover:opacity-100 hover:border-slate-700 hover:bg-slate-900/80 shadow-md"
          : isLost
          ? "border-rose-500/30 bg-slate-900/90 hover:border-rose-500/60 hover:bg-slate-900 shadow-md shadow-rose-950/20"
          : "border-emerald-500/30 bg-slate-900/90 hover:border-emerald-500/60 hover:bg-slate-900 shadow-md shadow-emerald-950/20"
      }`}
    >
      <div>
        {/* Compact Responsive Photo Container */}
        <div className="relative w-full h-28 xs:h-32 sm:h-36 lg:h-40 rounded-lg sm:rounded-xl overflow-hidden bg-slate-950 border border-white/5 mb-2 sm:mb-3 flex items-center justify-center group/img shadow-inner">
          <img
            src={photoSrc}
            alt={item.title || "Belonging item photo"}
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.endsWith("/placeholder-item.png")) {
                target.src = "/placeholder-item.png";
              }
            }}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105 ${
              isGreyedOut ? "filter grayscale-[35%] contrast-90 group-hover:grayscale-0 group-hover:contrast-100" : ""
            }`}
          />

          {/* Status Badge overlay on top-left of image */}
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex items-center pointer-events-none">
            <span
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider backdrop-blur-md shadow-md border ${badgeColor}`}
            >
              {badgeLabel}
            </span>
          </div>

          {/* Category Icon overlay on top-right of image */}
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-mono bg-slate-950/80 backdrop-blur-md text-slate-300 border border-white/10 shadow-sm">
              <CategoryIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400" />
              <span className="hidden sm:inline">{item.category?.replace(/_/g, " ")}</span>
            </span>
          </div>

          {/* Greyed-out banner indicator if claimed */}
          {isGreyedOut && isClaimed && (
            <div className="absolute inset-x-0 bottom-0 py-0.5 px-1 bg-emerald-950/90 backdrop-blur-md border-t border-emerald-500/30 flex items-center justify-center gap-1 text-[9px] font-mono font-bold text-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">Reunited with Owner</span>
            </div>
          )}
        </div>

        {/* Text Details */}
        <div className="space-y-1 sm:space-y-1.5">
          <h3
            className={`font-bold text-xs sm:text-sm transition-colors line-clamp-1 ${
              isGreyedOut ? "text-slate-300 group-hover:text-white" : "text-white group-hover:text-cyan-300"
            }`}
          >
            {item.title}
          </h3>

          <p className="text-[11px] text-slate-400 line-clamp-1 hidden sm:block leading-relaxed">
            {item.publicDescription || "No additional description provided."}
          </p>

          {/* Location & Custody details */}
          <div className="pt-1 sm:pt-1.5 border-t border-white/5 space-y-0.5 text-[10px] sm:text-[11px] font-mono text-slate-300">
            <div className="flex items-center gap-1 text-slate-300">
              <MapPin
                className={`w-3 h-3 shrink-0 ${
                  isLost && !isGreyedOut ? "text-rose-400" : "text-emerald-400"
                }`}
              />
              <span className="truncate">{loc?.name || "Campus Zone"}</span>
            </div>

            {item.custodyStatus && (
              <div className="flex items-center gap-1 text-slate-400 text-[9px] sm:text-[10px] truncate">
                <Shield className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                <span className="truncate">{item.custodyStatus.replace(/_/g, " ")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer / Action */}
      <div className="mt-2.5 sm:mt-3 pt-1.5 sm:pt-2 border-t border-white/10 flex items-center justify-between">
        <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {item.dateReported
            ? new Date(item.dateReported).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })
            : "Recent"}
        </span>

        <Link
          href={`/items/${item._id}`}
          className={`inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-mono font-bold transition-colors ${
            isGreyedOut
              ? "text-slate-400 hover:text-slate-200"
              : isLost
              ? "text-rose-400 hover:text-rose-300"
              : "text-cyan-400 hover:text-cyan-300"
          }`}
        >
          <span>{isLost && !isGreyedOut ? "Help Find" : "Inspect"}</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
