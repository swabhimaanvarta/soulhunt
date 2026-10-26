"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  MapPin,
  Clock,
  ExternalLink,
  CheckCircle,
  X,
  Laptop,
  CreditCard,
  BookOpen,
  Watch,
  Briefcase,
  Key,
  FlaskConical,
  Package,
} from "lucide-react";

interface MatchItem {
  _id: string;
  title: string;
  category: string;
  locationName: string;
  date: string;
  itemType: "LOST" | "FOUND";
}

interface LiveMatchDrawerProps {
  type: "LOST" | "FOUND";
  title: string;
  category?: string;
  locationId?: string;
  onDismiss?: () => void;
}

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

export default function LiveMatchDrawer({
  type,
  title,
  category,
  locationId,
  onDismiss,
}: LiveMatchDrawerProps) {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!title || title.trim().length < 3) {
      setMatches([]);
      setDismissed(false);
      return;
    }

    setDismissed(false);
    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          type,
          q: title.trim(),
        });
        if (category && category !== "ALL") {
          queryParams.set("category", category);
        }
        if (locationId) {
          queryParams.set("locationId", locationId);
        }

        const res = await fetch(`/api/items/match-suggestions?${queryParams.toString()}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setMatches(data.data);
        } else {
          setMatches([]);
        }
      } catch {
        setMatches([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [title, type, category, locationId]);

  if (dismissed || matches.length === 0) {
    return null;
  }

  const counterpartLabel = type === "LOST" ? "Found" : "Lost";

  return (
    <div className="my-6 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-950 p-5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-emerald-500/20">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Potential {counterpartLabel} Listings Found
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-500/30">
                {matches.length} Match{matches.length > 1 ? "es" : ""}
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Before submitting a new report, check if another campus member has already reported this counterpart:
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Dismiss suggestions"
          aria-label="Dismiss match suggestions"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {matches.map((item) => {
          const CategoryIcon = CATEGORY_ICONS[item.category] || Package;
          const formattedDate = new Date(item.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });

          return (
            <div
              key={item._id}
              className="flex flex-col justify-between rounded-xl border border-white/10 bg-slate-900/80 p-3 hover:border-emerald-500/50 hover:bg-slate-850 transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-300 border border-emerald-500/20">
                    <CategoryIcon className="h-3 w-3" />
                    {item.category.replace(/_/g, " ")}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                    <Clock className="h-2.5 w-2.5" />
                    {formattedDate}
                  </span>
                </div>

                <p className="text-xs font-semibold text-white line-clamp-2 mb-1.5">
                  {item.title}
                </p>

                <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-3">
                  <MapPin className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span className="truncate">{item.locationName}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <Link
                  href={`/items/${item._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  Inspect Listing
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <Link
                  href={`/items/${item._id}`}
                  className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 transition-colors"
                >
                  Claim This
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[11px] text-slate-400">
          None of these match your item?
        </span>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          className="text-xs font-mono text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
        >
          Continue filing your new report &rarr;
        </button>
      </div>
    </div>
  );
}
