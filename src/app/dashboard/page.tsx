"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Compass, Star, Coins, Shield, Bell, ChevronRight,
  Search, PackagePlus, Trophy, Users, Clock, Zap,
  Target, CheckCircle2, AlertTriangle, BookOpen,
  Sparkles, Radio, Calendar, Flame, ArrowUpRight, Award, MapPin
} from "lucide-react";
import MyRecoveriesSection from "@/components/lost-and-found/MyRecoveriesSection";

interface UserData {
  _id: string;
  username: string;
  displayName: string;
  xp: number;
  level: number;
  rankTitle: string;
  coins: number;
  trustScore: number;
  trustTier: string;
  role: string;
  squadId?: string;
}

interface QuestData {
  _id: string;
  title: string;
  questCode: string;
  difficulty: number;
  xpReward: number;
  coinReward: number;
  status: string;
}

interface NotificationData {
  _id: string;
  category: string;
  title: string;
  message: string;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

const XP_PER_LEVEL = 500;

const QUICK_ACTIONS = [
  { icon: PackagePlus, label: "Report Found Item", href: "/lost-and-found/report-found", color: "emerald", desc: "Deposit belongings at Safe-Desk" },
  { icon: Search, label: "Browse Quests", href: "/quests", color: "cyan", desc: "Accept an investigation quest" },
  { icon: Calendar, label: "Campus Events", href: "/events", color: "violet", desc: "Department sprints & festivals" },
  { icon: Users, label: "My Squad", href: "/squads", color: "amber", desc: "Coordinate with your team" },
];

const TRUST_COLORS: Record<string, string> = {
  NEWCOMER: "text-slate-400",
  TRUSTED_HUNTER: "text-cyan-400",
  ELITE_INVESTIGATOR: "text-emerald-400",
  CAMPUS_GUARDIAN: "text-amber-400",
};

function sanitizeSameOriginPath(url?: string | null): string {
  if (!url) return "/dashboard";
  const trimmed = url.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    return trimmed;
  }
  return "/dashboard";
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [quests, setQuests] = useState<QuestData[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [dailyData, setDailyData] = useState<any>(null);
  const [liveFeed, setLiveFeed] = useState<any[]>([]);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) { router.replace("/login"); return; }
      const meData = await meRes.json();
      if (!meData.data && !meData.user) { router.replace("/login"); return; }
      setUser(meData.data || meData.user);

      const [questsRes, notifsRes, dailyRes, feedRes, eventsRes] = await Promise.all([
        fetch("/api/quests?status=ACTIVE&limit=4"),
        fetch("/api/notifications?limit=5"),
        fetch("/api/content/daily"),
        fetch("/api/content/feed"),
        fetch("/api/events?active=true"),
      ]);

      if (questsRes.ok) {
        const d = await questsRes.json();
        setQuests(d.data || d.quests || []);
      }
      if (notifsRes.ok) {
        const d = await notifsRes.json();
        setNotifications(d.data?.notifications || d.notifications || []);
      }
      if (dailyRes.ok) {
        const d = await dailyRes.json();
        if (d.success) setDailyData(d.data);
      }
      if (feedRes.ok) {
        const d = await feedRes.json();
        if (d.success) setLiveFeed(d.data || []);
      }
      if (eventsRes.ok) {
        const d = await eventsRes.json();
        if (d.success && d.data?.length > 0) setActiveEvent(d.data[0]);
      }
    } catch { /* network error */ } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const xpInLevel = user ? user.xp % XP_PER_LEVEL : 0;
  const xpPct = Math.round((xpInLevel / XP_PER_LEVEL) * 100);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <Compass className="w-10 h-10 text-emerald-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Investigator HQ</h1>
            <p className="text-slate-400 text-sm">Welcome back, {user?.displayName}</p>
          </div>
          <div className="flex items-center gap-3">
            {user?.username && (
              <Link
                href={`/profile/${user.username}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-mono font-bold hover:bg-emerald-500/20 transition-colors"
              >
                <Award className="w-3.5 h-3.5" />
                Profile
              </Link>
            )}
            {notifications.filter(n => !n.isRead).length > 0 && (
              <Link href="/notifications" className="relative">
                <Bell className="w-6 h-6 text-slate-400 hover:text-white transition-colors" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              </Link>
            )}
            {user?.role === "ADMIN" && (
              <Link href="/admin" className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded text-sm hover:bg-amber-500/30 transition-colors">
                Admin
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 pb-36 md:pb-12 space-y-8">
        {/* Stats Grid */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Star, label: "Level", value: `Lv.${user?.level}`, sub: user?.rankTitle, color: "emerald" },
            { icon: Zap, label: "Total XP", value: user?.xp.toLocaleString(), sub: `${xpPct}% to next level`, color: "cyan" },
            { icon: Coins, label: "Coins", value: user?.coins.toLocaleString(), sub: "Campus currency", color: "amber" },
            { icon: Shield, label: "Trust Score", value: user?.trustScore, sub: user?.trustTier?.replace(/_/g, " "), color: "violet" },
          ].map(({ icon: Icon, label, value, sub, color }, i) => (
            <motion.div key={label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
              className={`bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-${color}-500/30 transition-colors`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-5 h-5 text-${color}-400`} />
                <span className="text-slate-400 text-sm">{label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500 mt-1">{sub}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* XP Progress Bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-400">XP Progress — Level {user?.level}</span>
            <span className="text-sm text-emerald-400">{xpInLevel} / {XP_PER_LEVEL} XP</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3">
            <motion.div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-3 rounded-full"
              initial={{ width: 0 }} animate={{ width: `${xpPct}%` }} transition={{ duration: 1, delay: 0.5 }} />
          </div>
        </motion.div>

        {/* Living Campus Engine: Daily Mystery Spotlight */}
        {dailyData?.quest && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-emerald-950/30 p-6 shadow-xl"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    TODAY&apos;S DAILY MYSTERY
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Rotates daily at 00:00 UTC
                  </span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">
                  {dailyData.quest.title}
                </h3>
                <p className="text-xs text-slate-300 font-mono max-w-2xl leading-relaxed">
                  {dailyData.quest.description}
                </p>
                <div className="flex items-center gap-4 text-xs font-mono pt-1 text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400">
                    ⭐ +{dailyData.quest.xpReward} XP
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    🪙 +{dailyData.quest.coinReward} Coins
                  </span>
                  <span className="flex items-center gap-1 text-cyan-400">
                    <MapPin className="w-3 h-3" />
                    {dailyData.quest.targetLocationId?.name || "Campus Ground"}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/quests/${dailyData.quest._id}`}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Target className="w-4 h-4" />
                  Solve Daily Clues
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* Active Campus Event Banner */}
        {activeEvent && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-950/40 via-slate-900 to-cyan-950/30 p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  LIVE CAMPUS EVENT
                </span>
                <span className="text-[10px] font-mono text-cyan-400">
                  Top Prize: {activeEvent.rewardPool?.firstPlaceCoins || 250} Coins + {activeEvent.rewardPool?.exclusiveTitle || "Title"}
                </span>
              </div>
              <h4 className="text-base font-bold text-white">{activeEvent.title}</h4>
              <p className="text-xs text-slate-400 font-mono line-clamp-1">
                {activeEvent.description}
              </p>
            </div>
            <Link
              href="/events"
              className="px-4 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-300 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>View Event & Leaderboard</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" /> Quick Actions
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map(({ icon: Icon, label, href, color, desc }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}>
                <Link href={href} className={`block bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-${color}-500/40 hover:bg-slate-900/80 transition-all group`}>
                  <Icon className={`w-7 h-7 text-${color}-400 mb-3`} />
                  <p className="font-semibold text-white text-sm group-hover:text-emerald-400 transition-colors">{label}</p>
                  <p className="text-slate-500 text-xs mt-1">{desc}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Active Quests */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" /> Available Quests
              </h2>
              <Link href="/quests" className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {quests.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">No active quests. Check the quest board!</p>
              )}
              {quests.map((q) => (
                <Link key={q._id} href={`/quests/${q._id}`}
                  className="block bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-cyan-500/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-white text-sm">{q.title}</p>
                      <p className="text-slate-500 text-xs mt-1">{q.questCode}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs text-emerald-400">+{q.xpReward} XP</span>
                      <span className="text-xs text-amber-400">+{q.coinReward} 🪙</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {Array.from({ length: 5 }, (_, idx) => (
                      <div key={idx} className={`h-1.5 w-4 rounded-full ${idx < q.difficulty ? "bg-amber-400" : "bg-slate-700"}`} />
                    ))}
                    <span className="text-xs text-slate-500 ml-1">Difficulty</span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" /> Notifications
              </h2>
              <Link href="/notifications" className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {notifications.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">No notifications yet.</p>
              )}
              {notifications.map((n) => (
                <Link key={n._id} href={sanitizeSameOriginPath(n.linkUrl)}
                  className={`block rounded-lg p-3 border transition-colors ${
                    n.isRead ? "border-slate-800 bg-slate-800/30" : "border-emerald-500/20 bg-emerald-500/5"
                  } hover:border-slate-600`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${n.isRead ? "bg-slate-600" : "bg-emerald-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Living Campus Live Telemetry Feed */}
        {liveFeed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="font-semibold text-white text-sm font-mono flex items-center gap-2">
                  Living Campus Telemetry
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    LIVE NETWORK
                  </span>
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Autonomous activity ledger</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {liveFeed.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex items-start gap-3 hover:border-emerald-500/30 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    item.badgeColor === "emerald" ? "bg-emerald-400 shadow-sm shadow-emerald-400" : item.badgeColor === "cyan" ? "bg-cyan-400 shadow-sm shadow-cyan-400" : "bg-amber-400 shadow-sm shadow-amber-400"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{item.title}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 line-clamp-2">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Private Verified Recovery Receipts Ledger */}
        <MyRecoveriesSection />

        {/* Footer CTAs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/lost-and-found" className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-emerald-500/30 transition-colors group">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Search className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-white group-hover:text-emerald-400 transition-colors">Lost & Found Board</p>
              <p className="text-slate-500 text-sm">Browse reported lost & found items</p>
            </div>
          </Link>
          <Link href="/map" className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-cyan-500/30 transition-colors group">
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <Compass className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="font-semibold text-white group-hover:text-cyan-400 transition-colors">Campus Map</p>
              <p className="text-slate-500 text-sm">View campus investigation zones</p>
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
