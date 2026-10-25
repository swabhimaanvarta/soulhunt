"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  ArrowLeft,
  Compass,
  Shield,
  Sword,
  Gift,
  Star,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface NotificationData {
  _id: string;
  category: "QUEST_SQUAD" | "LOST_FOUND_MATCH" | "SYSTEM_REWARD" | "CLAIM_UPDATE" | "ACHIEVEMENT_UNLOCK";
  title: string;
  message: string;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  QUEST_SQUAD: { icon: Sword, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30", label: "Quests & Squads" },
  LOST_FOUND_MATCH: { icon: Compass, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "Lost & Found" },
  SYSTEM_REWARD: { icon: Gift, color: "text-amber-400 bg-amber-500/10 border-amber-500/30", label: "Rewards" },
  CLAIM_UPDATE: { icon: Shield, color: "text-violet-400 bg-violet-500/10 border-violet-500/30", label: "Claims" },
  ACHIEVEMENT_UNLOCK: { icon: Star, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", label: "Achievements" },
};

function sanitizeSameOriginPath(url?: string | null): string {
  if (!url) return "/dashboard";
  const trimmed = url.trim();
  // Strictly disallow protocol-relative //, javascript:, http:, https:, vbscript:, etc.
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("\\") &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmed)
  ) {
    return trimmed;
  }
  return "/dashboard";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);

  // Pagination state
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/notifications?limit=20";
      if (filterUnreadOnly) url += "&unread=true";
      if (selectedCategory !== "ALL") url += `&category=${selectedCategory}`;

      const res = await fetch(url);
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        const items = json.data?.notifications || [];
        setNotifications(items);
        setUnreadCount(json.data?.unreadCount || 0);
        setNextCursor(json.data?.pageInfo?.nextCursor || null);
        setHasMore(Boolean(json.data?.pageInfo?.hasMore));
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
    }
  }, [router, filterUnreadOnly, selectedCategory]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const loadMoreNotifications = async () => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      let url = `/api/notifications?limit=20&cursor=${encodeURIComponent(nextCursor)}`;
      if (filterUnreadOnly) url += "&unread=true";
      if (selectedCategory !== "ALL") url += `&category=${selectedCategory}`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const moreItems = json.data?.notifications || [];
        setNotifications((prev) => [...prev, ...moreItems]);
        setNextCursor(json.data?.pageInfo?.nextCursor || null);
        setHasMore(Boolean(json.data?.pageInfo?.hasMore));
      }
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const markAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const handleRowClick = async (notif: NotificationData) => {
    if (pendingRowId) return; // Prevent double navigation and double requests
    setPendingRowId(notif._id);

    // Optimistically update local state idempotently
    if (!notif.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Asynchronously trigger server mark read
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notif._id }),
      }).catch(() => {
        // Retain unread on network error
      });
    }

    const safeDestination = sanitizeSameOriginPath(notif.linkUrl);
    router.push(safeDestination);
  };

  // Group notifications into Today, This Week, and Earlier
  const groupedNotifications = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;

    const today: NotificationData[] = [];
    const thisWeek: NotificationData[] = [];
    const earlier: NotificationData[] = [];

    notifications.forEach((n) => {
      const time = new Date(n.createdAt).getTime();
      if (time >= startOfToday) {
        today.push(n);
      } else if (time >= startOfWeek) {
        thisWeek.push(n);
      } else {
        earlier.push(n);
      }
    });

    return { today, thisWeek, earlier };
  }, [notifications]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" /> Notifications Inbox
              </h1>
              <p className="text-xs text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread mission alert(s)` : "All alerts caught up"}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>{markingAll ? "Marking..." : "Mark all read"}</span>
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="max-w-4xl mx-auto px-4 pb-3 flex items-center gap-2 overflow-x-auto text-xs font-mono scrollbar-none">
          <button
            onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
            className={`px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              filterUnreadOnly
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${filterUnreadOnly ? "bg-amber-400" : "bg-slate-600"}`} />
            <span>Unread Only</span>
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          {["ALL", "LOST_FOUND_MATCH", "QUEST_SQUAD", "SYSTEM_REWARD", "CLAIM_UPDATE", "ACHIEVEMENT_UNLOCK"].map(
            (cat) => {
              const active = selectedCategory === cat;
              const label =
                cat === "ALL"
                  ? "All Categories"
                  : CATEGORY_CONFIG[cat]?.label || cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Notifications List Grouped */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 font-mono text-xs text-slate-400">
            <Compass className="w-8 h-8 text-emerald-400 animate-spin" />
            <span>CONNECTING TO DISPATCH FREQUENCY...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 space-y-3 bg-slate-900/40 rounded-3xl border border-white/5 p-8">
            <Bell className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">No Notifications Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {filterUnreadOnly
                ? "You have no unread notifications matching your active filters."
                : "You don't have any notifications right now. Activity will appear here."}
            </p>
          </div>
        ) : (
          <>
            {/* Group: Today */}
            {groupedNotifications.today.length > 0 && (
              <NotificationSection
                title="Today"
                notifications={groupedNotifications.today}
                pendingRowId={pendingRowId}
                onSelect={handleRowClick}
              />
            )}

            {/* Group: This Week */}
            {groupedNotifications.thisWeek.length > 0 && (
              <NotificationSection
                title="This Week"
                notifications={groupedNotifications.thisWeek}
                pendingRowId={pendingRowId}
                onSelect={handleRowClick}
              />
            )}

            {/* Group: Earlier */}
            {groupedNotifications.earlier.length > 0 && (
              <NotificationSection
                title="Earlier"
                notifications={groupedNotifications.earlier}
                pendingRowId={pendingRowId}
                onSelect={handleRowClick}
              />
            )}

            {/* Pagination Controls */}
            {hasMore && (
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={loadMoreNotifications}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-xl text-xs font-mono font-bold text-slate-300 hover:text-white transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Loading more alerts...</span>
                    </>
                  ) : (
                    <span>Load More Notifications</span>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NotificationSection({
  title,
  notifications,
  pendingRowId,
  onSelect,
}: {
  title: string;
  notifications: NotificationData[];
  pendingRowId: string | null;
  onSelect: (n: NotificationData) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold px-1">
        {title} ({notifications.length})
      </h2>
      <div className="space-y-2">
        {notifications.map((n) => {
          const config = CATEGORY_CONFIG[n.category] || CATEGORY_CONFIG.QUEST_SQUAD;
          const Icon = config.icon;
          const isPending = pendingRowId === n._id;
          const safeLink = sanitizeSameOriginPath(n.linkUrl);

          return (
            <div
              key={n._id}
              onClick={() => onSelect(n)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 relative overflow-hidden group ${
                !n.isRead
                  ? "bg-slate-900 border-emerald-500/30 hover:border-emerald-500/60"
                  : "bg-slate-950/60 border-white/5 hover:border-white/10 text-slate-300"
              } ${isPending ? "opacity-60 pointer-events-none" : ""}`}
            >
              {/* Unread indicator */}
              {!n.isRead && (
                <div className="absolute top-4 left-2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}

              <div className={`p-2.5 rounded-xl border ${config.color} shrink-0 mt-0.5`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    className={`text-sm font-bold truncate ${
                      !n.isRead ? "text-white" : "text-slate-200"
                    }`}
                  >
                    {n.title}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{n.message}</p>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    {config.label}
                  </span>
                  {safeLink && (
                    <span className="text-[10px] font-mono text-cyan-400 group-hover:underline flex items-center gap-1">
                      View details <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
