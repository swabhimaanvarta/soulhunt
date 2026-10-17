"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell, CheckCheck, ArrowLeft, Compass,
  Shield, Sword, Gift, AlertCircle, Star
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

const CATEGORY_CONFIG = {
  QUEST_SQUAD: { icon: Sword, color: "cyan", label: "Quest & Squad" },
  LOST_FOUND_MATCH: { icon: Compass, color: "emerald", label: "Lost & Found" },
  SYSTEM_REWARD: { icon: Gift, color: "amber", label: "Reward" },
  CLAIM_UPDATE: { icon: Shield, color: "violet", label: "Claim Update" },
  ACHIEVEMENT_UNLOCK: { icon: Star, color: "yellow", label: "Achievement" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications?limit=50");
    if (res.status === 401) { router.replace("/login"); return; }
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.data?.notifications || data.notifications || []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAllRead = async () => {
    setMarkingAll(true);
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAllRead: true }) });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setMarkingAll(false);
  };

  const markOne = async (id: string) => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id, isRead: true }) });
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" /> Notifications
              </h1>
              {unreadCount > 0 && <p className="text-xs text-slate-400">{unreadCount} unread</p>}
            </div>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} disabled={markingAll}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50">
              <CheckCheck className="w-4 h-4" />
              {markingAll ? "Marking..." : "Mark all read"}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Compass className="w-8 h-8 text-emerald-400" />
            </motion.div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400">No notifications yet.</p>
            <p className="text-slate-600 text-sm mt-1">Complete quests and report items to get notified.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {notifications.map((n, i) => {
                const cfg = CATEGORY_CONFIG[n.category] || CATEGORY_CONFIG.SYSTEM_REWARD;
                const Icon = cfg.icon;
                return (
                  <motion.div key={n._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Link href={n.linkUrl || "/dashboard"} onClick={() => !n.isRead && markOne(n._id)}
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                        n.isRead
                          ? "border-slate-800 bg-slate-900/40 hover:bg-slate-900"
                          : `border-${cfg.color}-500/20 bg-${cfg.color}-500/5 hover:bg-${cfg.color}-500/10`
                      }`}>
                      <div className={`w-10 h-10 rounded-full bg-${cfg.color}-500/10 flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 text-${cfg.color}-400`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium text-sm ${n.isRead ? "text-slate-300" : "text-white"}`}>{n.title}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!n.isRead && <div className="w-2 h-2 bg-emerald-400 rounded-full" />}
                            <span className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{n.message}</p>
                        <span className={`inline-flex items-center gap-1 text-xs mt-2 text-${cfg.color}-400`}>
                          <AlertCircle className="w-3 h-3" />{cfg.label}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
