"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  LogOut,
  ChevronDown,
  Coins,
  CheckCircle2,
  Lock,
  Sparkles,
  Menu,
  X,
  PackagePlus,
  PackageSearch,
  Calendar,
  LayoutDashboard,
  Loader2,
} from "lucide-react";

interface UserSession {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: "STUDENT" | "SAFE_DESK_STAFF" | "MODERATOR" | "ADMIN";
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
  const pathname = usePathname() || "";
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
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
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const json = await res.json();
      if (json.success && json.data) {
        setUser(json.data);
        fetchNotifications();
      } else {
        setUser(null);
        setNotifications([]);
        setUnreadNotifications(0);
      }
    } catch {
      setUser(null);
      setNotifications([]);
      setUnreadNotifications(0);
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications]);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 30000);
    return () => clearInterval(interval);
  }, [fetchSession, pathname]);

  // Sync notifications immediately when active in-chat or when notifications are marked read
  useEffect(() => {
    const handleNotificationsUpdated = () => {
      fetchNotifications();
    };
    window.addEventListener("notificationsUpdated", handleNotificationsUpdated);
    return () => window.removeEventListener("notificationsUpdated", handleNotificationsUpdated);
  }, [fetchNotifications]);

  // Close menus on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
    setUserMenuOpen(false);
    setNotificationsOpen(false);
    setMoreMenuOpen(false);
  }, [pathname]);

  const logoutInFlightRef = useRef(false);

  const handleLogout = async () => {
    if (logoutInFlightRef.current || isLoggingOut) return;
    logoutInFlightRef.current = true;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed:", err);
      logoutInFlightRef.current = false;
      setIsLoggingOut(false);
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

  interface NavItem {
    href: string;
    label: string;
    icon: any;
    highlight?: boolean;
    desc?: string;
  }

  // Navigation priorities: Lost & Found, Map, Quests, Events
  const primaryNavLinks: NavItem[] = [
    { href: "/lost-and-found", label: "Lost & Found", icon: Search },
    { href: "/map", label: "Map", icon: MapPin },
    { href: "/quests", label: "Quests", icon: Compass },
    { href: "/events", label: "Events", icon: Calendar },
  ];

  // Secondary links cleanly grouped into "More ▾" dropdown on desktop
  const secondaryNavLinks: NavItem[] = [
    { href: "/squads", label: "Squads", icon: Users, desc: "Syndicates & team chat" },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy, desc: "Top ranks & squads" },
    { href: "/rewards", label: "Shop", icon: ShoppingBag, desc: "Hunter cosmetics & helpers" },
    { href: "/achievements", label: "Badges", icon: Award, desc: "Honors & citations" },
    { href: "/notifications", label: "Notifications", icon: Bell, desc: "Inbox & mission alerts" },
    ...(user && (user.role === "SAFE_DESK_STAFF" || user.role === "ADMIN" || user.role === "MODERATOR")
      ? [{ href: "/staff", label: "Safe-Desk", icon: Shield, desc: "Custody & Handover Station" }]
      : []),
    ...(user && (user.role === "ADMIN" || user.role === "MODERATOR")
      ? [{ href: "/admin", label: "Admin Console", icon: Shield, desc: "Operations & CMS" }]
      : []),
  ];

  // All links combined for mobile drawer navigation
  const navLinks: NavItem[] = [
    ...primaryNavLinks,
    ...secondaryNavLinks,
  ];

  const isSecondaryActive = secondaryNavLinks.some(
    (l) => pathname === l.href || pathname.startsWith(l.href + "/")
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-white/10 bg-[#0B0F17]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-4 xl:gap-6">
              <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all flex-shrink-0">
                  <div className="w-full h-full bg-[#0B0F17] rounded-[10px] flex items-center justify-center">
                    <Compass className="w-5 h-5 text-emerald-400 group-hover:rotate-45 transition-transform duration-300" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-base font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
                    AIEM <span className="text-emerald-400">HUNT</span>
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono tracking-widest uppercase mt-1">
                    Campus Recon
                  </span>
                </div>
              </Link>

              {/* Large Screens (xl+ / 1280px+): Display ALL core destinations directly */}
              <nav className="hidden xl:flex items-center gap-1">
                {[
                  { href: "/lost-and-found", label: "Lost & Found", icon: Search },
                  { href: "/map", label: "Map", icon: MapPin },
                  { href: "/quests", label: "Quests", icon: Compass },
                  { href: "/events", label: "Events", icon: Calendar },
                  { href: "/squads", label: "Squads", icon: Users },
                  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
                  { href: "/rewards", label: "Shop", icon: ShoppingBag },
                  { href: "/achievements", label: "Badges", icon: Award },
                ].map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href + "/"));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}

                {/* Staff / Admin Quick Pill if authorized */}
                {user && (user.role === "SAFE_DESK_STAFF" || user.role === "ADMIN" || user.role === "MODERATOR") && (
                  <div className="relative ml-1">
                    <button
                      type="button"
                      onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all"
                    >
                      <Shield className="w-3 h-3" />
                      <span>Staff</span>
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${moreMenuOpen ? "rotate-180" : ""}`} />
                    </button>

                    {moreMenuOpen && (
                      <div className="absolute left-0 mt-2 w-52 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                        {(user.role === "SAFE_DESK_STAFF" || user.role === "ADMIN" || user.role === "MODERATOR") && (
                          <Link
                            href="/staff"
                            onClick={() => setMoreMenuOpen(false)}
                            className="flex items-start gap-2.5 px-3 py-2 rounded-xl text-emerald-400 hover:bg-white/5 transition-all"
                          >
                            <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="font-semibold text-white">Safe-Desk Station</div>
                              <div className="text-[10px] text-slate-400 font-mono">Custody & Locker Handover</div>
                            </div>
                          </Link>
                        )}
                        {(user.role === "ADMIN" || user.role === "MODERATOR") && (
                          <Link
                            href="/admin"
                            onClick={() => setMoreMenuOpen(false)}
                            className="flex items-start gap-2.5 px-3 py-2 rounded-xl text-amber-400 hover:bg-white/5 transition-all"
                          >
                            <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="font-semibold text-white">Admin Console</div>
                              <div className="text-[10px] text-slate-400 font-mono">Operations & Content CMS</div>
                            </div>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </nav>

              {/* Medium / Large Screens (lg:flex xl:hidden): 5 Primary Links + "More ▾" */}
              <nav className="hidden lg:flex xl:hidden items-center gap-1">
                {primaryNavLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href + "/"));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}

                {/* More ▾ Dropdown on lg screens */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSecondaryActive
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold"
                        : "text-slate-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span>More</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${moreMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {moreMenuOpen && (
                    <div className="absolute left-0 mt-2 w-52 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                      {secondaryNavLinks.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMoreMenuOpen(false)}
                            className={`flex items-start gap-2.5 px-3 py-2 rounded-xl transition-all ${
                              isActive
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold"
                                : "text-slate-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <Icon className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-200">{item.label}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{item.desc}</div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </nav>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* User Stats / Controls */}
              {user ? (
                <div className="flex items-center gap-2 sm:gap-2.5">
                  {/* Compact Coins & XP Pill */}
                  <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-white/10 text-xs font-mono">
                    <div className="flex items-center gap-1 text-amber-400 font-bold">
                      <Coins className="w-3.5 h-3.5" />
                      <span>{user.coins}</span>
                    </div>
                    <span className="text-slate-600">|</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      Lv.{user.level}
                    </span>
                  </div>

                  {/* Notifications Bell (Compact Badge linking to /notifications) */}
                  <Link
                    href="/notifications"
                    className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center"
                    aria-label="Notifications"
                    title="Mission Notifications & Alerts"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadNotifications > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 px-1 min-w-[16px] h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-mono font-black flex items-center justify-center shadow-lg shadow-amber-400/30">
                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      </span>
                    )}
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
                            {user.trustTier?.replace(/_/g, " ")}
                          </div>
                        </div>

                        <Link
                          href="/dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Investigator HQ</span>
                        </Link>

                        <Link
                          href={`/profile/${user.username}`}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white"
                        >
                          <Award className="w-3.5 h-3.5 text-cyan-400" />
                          <span>My Profile & Dossier</span>
                          <span className="ml-auto text-[10px] font-mono text-emerald-400">Edit</span>
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

                        {(user.role === "SAFE_DESK_STAFF" || user.role === "ADMIN" || user.role === "MODERATOR") && (
                          <Link
                            href="/staff"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-emerald-400 hover:bg-emerald-400/10"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            Safe-Desk Station
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
                          type="button"
                          onClick={handleLogout}
                          disabled={isLoggingOut}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 text-left mt-1 border-t border-white/5 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer font-medium text-xs font-mono"
                        >
                          {isLoggingOut ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Logging Out...</span>
                            </>
                          ) : (
                            <>
                              <LogOut className="w-3.5 h-3.5" />
                              <span>Log Out</span>
                            </>
                          )}
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
                className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
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
        <div className="fixed inset-0 z-[70] lg:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Content */}
          <div className="fixed top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-slate-950 border-l border-white/10 p-5 flex flex-col justify-between shadow-2xl z-[70] overflow-y-auto">
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
                <Link
                  href={`/profile/${user.username}`}
                  onClick={() => setMobileDrawerOpen(false)}
                  className="block p-3 rounded-xl bg-slate-900 border border-white/10 hover:border-emerald-500/40 transition-all space-y-2 group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono font-bold flex items-center justify-center text-sm group-hover:scale-105 transition-transform">
                      {user.displayName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white text-xs truncate group-hover:text-emerald-300 transition-colors">{user.displayName}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">@{user.username} • View Profile</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] font-mono">
                    <span className="text-amber-400 flex items-center gap-1 font-bold">
                      <Coins className="w-3.5 h-3.5" /> {user.coins} Coins
                    </span>
                    <span className="text-emerald-400">LVL {user.level}</span>
                  </div>
                </Link>
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

              {/* Institutional Safe-Desk & Security Desk Notice */}
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/20 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 font-mono text-[11px]">
                    <Shield className="w-3.5 h-3.5" />
                    <span>AIEM Campus Safe-Desk</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Official recovery verification and physical item drop-offs are processed at the Gate 1 Safe-Desk.
                  </p>
                  <p className="text-[10px] font-mono text-slate-400">
                    Agnel Institute of Engineering and Management
                  </p>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-4 border-t border-white/10 space-y-2 text-xs">
              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-bold disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  {isLoggingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Logging Out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </>
                  )}
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
