"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  Search,
  Shield,
  MapPin,
  Users,
  Trophy,
  ShoppingBag,
  Award,
  Bell,
  PlusCircle,
  LogOut,
  ChevronDown,
  Coins,
  CheckCircle2,
  Lock,
  UserCheck,
  Sparkles,
  Menu,
  X,
  PackagePlus,
  PackageSearch,
  Calendar,
} from "lucide-react";

interface UserSession {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: "STUDENT" | "MODERATOR" | "ADMIN";
  level: number;
  rankTitle: string;
  coins: number;
  xp: number;
  trustScore: number;
  trustTier: string;
  avatarUrl?: string;
  squad?: { name: string; tag: string } | null;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const json = await res.json();
      if (json.success && json.data) {
        setUser(json.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success && json.data) {
        setNotifications(json.data.notifications || []);
        setUnreadNotifications(json.data.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchSession();
    fetchNotifications();
    const interval = setInterval(fetchSession, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  // Close menus on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
    setUserMenuOpen(false);
    setNotificationsOpen(false);
    setDemoMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  };

  const handleDemoSwitch = async (roleOrEmail: string) => {
    setDemoMenuOpen(false);
    setMobileDrawerOpen(false);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleOrEmail }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchSession();
        router.refresh();
      }
    } catch {
      // ignore
    }
  };

  const markAllNotificationsRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setUnreadNotifications(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const navLinks = [
    { href: "/lost-and-found", label: "Lost & Found", icon: Search },
    { href: "/quests", label: "Quests & Hunts", icon: Compass },
    { href: "/events", label: "Events", icon: Calendar },
    { href: "/map", label: "Campus Map", icon: MapPin },
    { href: "/squads", label: "Squads", icon: Users },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/rewards", label: "Shop", icon: ShoppingBag },
    { href: "/achievements", label: "Badges", icon: Award },
    ...(user && (user.role === "ADMIN" || user.role === "MODERATOR")
      ? [{ href: "/admin", label: "Admin Panel", icon: Shield, highlight: true }]
      : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0B0F17]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all">
                  <div className="w-full h-full bg-[#0B0F17] rounded-[10px] flex items-center justify-center">
                    <Compass className="w-5 h-5 text-emerald-400 group-hover:rotate-45 transition-transform duration-300" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-base font-black tracking-tight text-white flex items-center gap-1.5">
                    AIEM <span className="text-emerald-400">HUNT</span>
                  </span>
                  <span className="text-[10px] text-slate-400 tracking-widest font-mono uppercase">
                    Lost & Found RPG
                  </span>
                </div>
              </Link>

              {/* Desktop Navigation (Visible only on xl screens) */}
              <nav className="hidden xl:flex items-center gap-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold"
                          : link.highlight
                          ? "text-amber-400 hover:bg-amber-400/10 border border-amber-400/20"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Quick Demo Persona Switcher (Desktop) */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setDemoMenuOpen(!demoMenuOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-white/10 transition-colors"
                  title="Switch Persona"
                >
                  <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Persona:</span>
                  <span className="text-white font-semibold">{user ? user.username : "Guest"}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {demoMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-white/10 shadow-2xl p-2 z-50 text-xs">
                    <div className="px-2 py-1.5 text-[10px] font-mono uppercase text-slate-400 border-b border-white/5 mb-1">
                      Instant Persona Switch
                    </div>
                    <button
                      onClick={() => handleDemoSwitch("admin@aiem.edu")}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 flex items-center justify-between text-slate-200"
                    >
                      <div>
                        <div className="font-semibold text-rose-400">Prof. Chatterjee (Admin)</div>
                        <div className="text-[10px] text-slate-400">admin@aiem.edu</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">ADMIN</span>
                    </button>
                    <button
                      onClick={() => handleDemoSwitch("mod@aiem.edu")}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 flex items-center justify-between text-slate-200"
                    >
                      <div>
                        <div className="font-semibold text-amber-400">Anirban Sen (Safe-Desk Mod)</div>
                        <div className="text-[10px] text-slate-400">mod@aiem.edu</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">MOD</span>
                    </button>
                    <button
                      onClick={() => handleDemoSwitch("rahul@student.aiem.edu")}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 flex items-center justify-between text-slate-200"
                    >
                      <div>
                        <div className="font-semibold text-emerald-400">Rahul Sharma (Squad Leader)</div>
                        <div className="text-[10px] text-slate-400">rahul_seeker • The Seekers</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">HUNTER</span>
                    </button>
                    <button
                      onClick={() => handleDemoSwitch("priya@student.aiem.edu")}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 flex items-center justify-between text-slate-200"
                    >
                      <div>
                        <div className="font-semibold text-cyan-400">Priya Mukherjee (Item Reporter)</div>
                        <div className="text-[10px] text-slate-400">priya_cipher</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">STUDENT</span>
                    </button>
                  </div>
                )}
              </div>

              {/* User Stats / Controls */}
              {user ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Coins & XP Pill */}
                  <div className="hidden sm:flex items-center gap-2.5 px-3 py-1 rounded-xl bg-slate-900/90 border border-white/10 text-xs">
                    <div className="flex items-center gap-1 text-amber-400 font-mono font-bold">
                      <Coins className="w-3.5 h-3.5" />
                      <span>{user.coins}</span>
                    </div>
                    <span className="text-slate-600">|</span>
                    <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        LVL {user.level}
                      </span>
                      <span className="text-slate-400 text-[11px] hidden md:inline">
                        {user.rankTitle}
                      </span>
                    </div>
                  </div>

                  {/* Notifications Bell */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setNotificationsOpen(!notificationsOpen);
                        if (!notificationsOpen && unreadNotifications > 0) {
                          fetchNotifications();
                        }
                      }}
                      className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                      aria-label="Notifications"
                    >
                      <Bell className="w-4 h-4" />
                      {unreadNotifications > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 animate-pulse" />
                      )}
                    </button>

                    {notificationsOpen && (
                      <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-3 z-50 text-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                          <span className="font-mono font-bold text-white uppercase text-[11px]">
                            Notifications ({unreadNotifications})
                          </span>
                          {unreadNotifications > 0 && (
                            <button
                              onClick={markAllNotificationsRead}
                              className="text-[10px] text-emerald-400 hover:underline"
                            >
                              Mark all read
                            </button>
                          )}
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="text-center py-6 text-slate-500">
                              No notifications yet
                            </div>
                          ) : (
                            notifications.map((n) => (
                              <div
                                key={n._id}
                                className={`p-2.5 rounded-lg border transition-all ${
                                  !n.isRead
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-white"
                                    : "bg-white/[0.02] border-white/5 text-slate-300"
                                }`}
                              >
                                <div className="font-semibold text-emerald-400 text-[11px] mb-0.5">
                                  {n.title}
                                </div>
                                <p className="text-[11px] text-slate-300">{n.message}</p>
                                {n.linkUrl && (
                                  <Link
                                    href={n.linkUrl}
                                    onClick={() => setNotificationsOpen(false)}
                                    className="text-[10px] text-cyan-400 hover:underline mt-1 inline-block"
                                  >
                                    View Details →
                                  </Link>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Report Item Button */}
                  <Link
                    href="/lost-and-found/report-lost"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Report Item</span>
                  </Link>

                  {/* User Profile Avatar Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-white/5 transition-colors"
                      aria-label="User Menu"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-emerald-500/40 flex items-center justify-center font-mono text-xs font-bold text-emerald-400">
                        {user.displayName.charAt(0)}
                      </div>
                    </button>

                    {userMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-2 z-50 text-xs">
                        <div className="px-3 py-2 border-b border-white/5 mb-1">
                          <div className="font-bold text-white">{user.displayName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">@{user.username}</div>
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                            <Shield className="w-3 h-3" />
                            {user.trustTier?.replace(/_/g, " ")} ({user.trustScore})
                          </div>
                        </div>

                        <Link
                          href={`/profile/${user.username}`}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white"
                        >
                          <Award className="w-3.5 h-3.5 text-cyan-400" />
                          Hunter Dossier
                        </Link>

                        {user.squad && (
                          <Link
                            href="/squads"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white"
                          >
                            <Users className="w-3.5 h-3.5 text-emerald-400" />
                            Squad: [{user.squad.tag}] {user.squad.name}
                          </Link>
                        )}

                        {(user.role === "ADMIN" || user.role === "MODERATOR") && (
                          <Link
                            href="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-amber-400 hover:bg-amber-400/10"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            Admin Console
                          </Link>
                        )}

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 text-left mt-1 border-t border-white/5"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Log Out
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
                  >
                    Join
                  </Link>
                </div>
              )}

              {/* Mobile Drawer Trigger (Replaces the duplicate nav row) */}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
                className="xl:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Toggle Navigation Menu"
              >
                {mobileDrawerOpen ? <X className="w-5 h-5 text-emerald-400" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay / Slide-Over for Secondary Links */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Content */}
          <div className="fixed top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-slate-950 border-l border-white/10 p-5 flex flex-col justify-between shadow-2xl z-50 overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="font-mono text-xs uppercase tracking-widest text-slate-400 font-bold">
                  Tactical Recon Menu
                </span>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Mini-Card if logged in */}
              {user && (
                <div className="p-3 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono font-bold flex items-center justify-center text-sm">
                      {user.displayName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white text-xs truncate">{user.displayName}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">@{user.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] font-mono">
                    <span className="text-amber-400 flex items-center gap-1 font-bold">
                      <Coins className="w-3.5 h-3.5" /> {user.coins} Coins
                    </span>
                    <span className="text-emerald-400">LVL {user.level}</span>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                  Explore Network
                </p>
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
                          : link.highlight
                          ? "text-amber-300 bg-amber-500/10 border border-amber-500/20 font-bold"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Quick Persona Switcher in Mobile Drawer */}
              <div className="pt-3 border-t border-white/10 space-y-2">
                <p className="px-2 text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                  <UserCheck className="w-3 h-3" /> Quick Persona Switch (1-Click)
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <button
                    onClick={() => handleDemoSwitch("admin@aiem.edu")}
                    className="p-2 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 text-left truncate"
                  >
                    👑 Admin
                  </button>
                  <button
                    onClick={() => handleDemoSwitch("mod@aiem.edu")}
                    className="p-2 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-left truncate"
                  >
                    🛡️ Moderator
                  </button>
                  <button
                    onClick={() => handleDemoSwitch("rahul@student.aiem.edu")}
                    className="p-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-left truncate"
                  >
                    🔍 Hunter
                  </button>
                  <button
                    onClick={() => handleDemoSwitch("priya@student.aiem.edu")}
                    className="p-2 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-left truncate"
                  >
                    📱 Student
                  </button>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-4 border-t border-white/10 space-y-2 text-xs">
              {user ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-bold"
                >
                  <LogOut className="w-4 h-4" /> Log Out
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="py-2.5 text-center rounded-xl bg-slate-900 border border-white/10 text-slate-200 font-bold"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="py-2.5 text-center rounded-xl bg-emerald-500 text-slate-950 font-bold"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
