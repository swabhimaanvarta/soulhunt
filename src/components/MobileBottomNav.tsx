"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Search,
  MapPin,
  Users,
  Trophy,
} from "lucide-react";

export default function MobileBottomNav() {
  const pathname = usePathname() || "";

  // 5 thumb-friendly bottom nav destinations
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#070A0F]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 safe-area-pb">
      <div className="grid grid-cols-5 items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              prefetch={true}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 ${
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
  );
}

