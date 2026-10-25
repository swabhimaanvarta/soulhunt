"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Search,
  MapPin,
  Users,
  User,
  Plus,
  PackagePlus,
  PackageSearch,
  X,
  Trophy,
} from "lucide-react";

export default function MobileBottomNav() {
  const pathname = usePathname() || "";
  const [fabOpen, setFabOpen] = useState(false);

  // If in admin mode or print view, can keep or suppress
  const navItems = [
    {
      label: "HQ",
      href: "/dashboard",
      icon: Compass,
      isActive: pathname === "/dashboard" || pathname === "/",
    },
    {
      label: "Lost & Found",
      href: "/lost-and-found",
      icon: Search,
      isActive: pathname.startsWith("/lost-and-found"),
    },
    {
      label: "Map",
      href: "/map",
      icon: MapPin,
      isActive: pathname.startsWith("/map"),
    },
    {
      label: "Quests",
      href: "/quests",
      icon: Trophy,
      isActive: pathname.startsWith("/quests") || pathname.startsWith("/investigations"),
    },
    {
      label: "Squad",
      href: "/squads",
      icon: Users,
      isActive: pathname.startsWith("/squads"),
    },
  ];

  return (
    <>
      {/* Backdrop for open FAB menu */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Floating Action Menu for Quick Field Actions */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2.5 md:hidden">
        {fabOpen && (
          <div className="flex flex-col items-end gap-2 animate-in slide-in-from-bottom-3 duration-200">
            <Link
              href="/lost-and-found/report-found"
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-xl shadow-emerald-500/30 border border-emerald-400 active:scale-95 transition-all"
            >
              <span>Report Found Item</span>
              <PackagePlus className="w-4 h-4" />
            </Link>

            <Link
              href="/lost-and-found/report-lost"
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900 text-rose-300 font-bold text-xs font-mono shadow-xl border border-rose-500/30 active:scale-95 transition-all"
            >
              <span>Report Lost Item</span>
              <PackageSearch className="w-4 h-4 text-rose-400" />
            </Link>

            <Link
              href="/quests"
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900 text-cyan-300 font-bold text-xs font-mono shadow-xl border border-cyan-500/30 active:scale-95 transition-all"
            >
              <span>Join Active Hunt</span>
              <Trophy className="w-4 h-4 text-cyan-400" />
            </Link>
          </div>
        )}

        <button
          type="button"
          aria-label="Quick Action Menu"
          onClick={() => setFabOpen(!fabOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 ${
            fabOpen
              ? "bg-slate-800 text-white rotate-45 border border-white/20"
              : "bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-emerald-500/40 active:scale-95"
          }`}
        >
          {fabOpen ? <Plus className="w-6 h-6" /> : <Plus className="w-7 h-7 stroke-[2.5]" />}
        </button>
      </div>

      {/* Thumb-friendly Fixed Bottom Nav Bar (Mobile-only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#070A0F]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 safe-area-pb">
        <div className="grid grid-cols-5 items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                prefetch={true}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 ${
                  item.isActive
                    ? "text-emerald-400 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <div
                  className={`relative p-1 rounded-lg ${
                    item.isActive ? "bg-emerald-500/15" : ""
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

