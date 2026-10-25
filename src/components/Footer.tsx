"use client";

import React from "react";
import Link from "next/link";
import {
  Compass,
  ShieldCheck,
  Lock,
  MapPin,
  Clock,
  PhoneCall,
  Search,
  PackagePlus,
  PackageSearch,
  Trophy,
  Users,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#070A0F] text-slate-400 text-xs mt-16 relative overflow-hidden">
      {/* Ambient background glow accents */}
      <div className="absolute top-0 left-1/4 w-96 h-32 bg-emerald-500/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-cyan-500/5 blur-3xl pointer-events-none rounded-full" />

      {/* Main 4-Column Grid Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          
          {/* Column 1: Institutional Mission & Live Mesh Telemetry */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-white font-mono font-bold">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
                <Compass className="w-4 h-4" />
              </div>
              <span className="text-sm tracking-tight">AIEM HUNT</span>
            </div>

            <p className="text-slate-400 text-[11px] leading-relaxed">
              Official lost-and-found recovery network and collaborative investigation platform for{" "}
              <strong className="text-slate-200">Agnel Institute of Engineering and Management (AIEM)</strong>, Assagao, Goa.
            </p>

            {/* Verified Campus Service Badge */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20 space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>VERIFIED CAMPUS SERVICE</span>
              </div>
              <p className="text-[10px] text-slate-400">
                AIEM Assagao Campus • Institutional safe-desk custody &amp; privacy-redacted records
              </p>
            </div>
          </div>

          {/* Column 2: Official Safe-Desk Custody Stations */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Safe-Desk Stations</span>
            </h4>
            <div className="space-y-2.5 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 space-y-1">
                <div className="text-white font-semibold flex items-center justify-between">
                  <span>Gate 1 Security Office</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">24/7 OPEN</span>
                </div>
                <p className="text-slate-400 text-[10px]">
                  Emergency drop-offs, physical custody & locker intake.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 space-y-1">
                <div className="text-white font-semibold flex items-center justify-between">
                  <span>Central Library Desk</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">08:30 - 17:30</span>
                </div>
                <p className="text-slate-400 text-[10px]">
                  Secure Locker Bay #2 for calculators, notes & electronics.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 space-y-1">
                <div className="text-white font-semibold flex items-center justify-between">
                  <span>Admin Block Counter 4</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">OFFICE HRS</span>
                </div>
                <p className="text-slate-400 text-[10px]">
                  High-value verification & student identity matching.
                </p>
              </div>
            </div>
          </div>

          {/* Column 3: Rapid Campus Recon Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-cyan-400" />
              <span>Quick Navigation</span>
            </h4>
            <ul className="space-y-1.5 text-[11px] font-mono">
              <li>
                <Link
                  href="/lost-and-found"
                  prefetch={true}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 py-0.5"
                >
                  <span className="text-emerald-500">▸</span> Lost & Found Board
                </Link>
              </li>
              <li>
                <Link
                  href="/lost-and-found/report-found"
                  prefetch={true}
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 py-0.5 text-emerald-400"
                >
                  <PackagePlus className="w-3 h-3" /> Report Found Belonging
                </Link>
              </li>
              <li>
                <Link
                  href="/lost-and-found/report-lost"
                  prefetch={true}
                  className="hover:text-rose-400 transition-colors flex items-center gap-1.5 py-0.5 text-rose-300"
                >
                  <PackageSearch className="w-3 h-3" /> Report Lost Belonging
                </Link>
              </li>
              <li>
                <Link
                  href="/quests"
                  prefetch={true}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-1.5 py-0.5"
                >
                  <span className="text-cyan-500">▸</span> Quests & Mystery Hunts
                </Link>
              </li>
              <li>
                <Link
                  href="/map"
                  prefetch={true}
                  className="hover:text-cyan-400 transition-colors flex items-center gap-1.5 py-0.5"
                >
                  <span className="text-cyan-500">▸</span> Interactive Radar Map
                </Link>
              </li>
              <li>
                <Link
                  href="/leaderboard"
                  prefetch={true}
                  className="hover:text-amber-400 transition-colors flex items-center gap-1.5 py-0.5"
                >
                  <Trophy className="w-3 h-3 text-amber-400" /> Hunter Leaderboard
                </Link>
              </li>
              <li>
                <Link
                  href="/rewards"
                  prefetch={true}
                  className="hover:text-amber-400 transition-colors flex items-center gap-1.5 py-0.5"
                >
                  <ShoppingBag className="w-3 h-3 text-amber-400" /> Rewards Quartermaster
                </Link>
              </li>
              <li>
                <Link
                  href="/squads"
                  prefetch={true}
                  className="hover:text-violet-400 transition-colors flex items-center gap-1.5 py-0.5"
                >
                  <Users className="w-3 h-3 text-violet-400" /> Campus Squads
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Ethics, Custody Helpline & Verification Protocol */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Custody & Protocols</span>
            </h4>
            
            <div className="space-y-2 text-[11px]">
              <div className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  <strong className="text-white">Dual-Code Verification:</strong> Claimant and finder codes must match at the Safe-Desk before release.
                </span>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  <strong className="text-white">Anti-Collusion Audit:</strong> All claims and rewards are tracked on the campus ledger to prevent abuse.
                </span>
              </div>

              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  <strong className="text-white">Zero-Finder-Fee Policy:</strong> Campus community honor system with institutional XP and coin citations.
                </span>
              </div>

              <div className="pt-2 border-t border-white/5 space-y-1">
                <div className="text-[10px] font-mono text-slate-500 uppercase">Emergency Helpline</div>
                <div className="text-slate-300 font-mono flex items-center gap-1.5 text-xs">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                  <span>security@aiemgoa.ac.in • Ext: 204</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Horizontal Bar */}
        <div className="pt-8 mt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-mono text-slate-500">
          <div>
            © 2026 Agnel Technical Education Complex, Assagao, Bardez, Goa 403507. All Rights Reserved.
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="text-slate-400">Institutional Property Custody Protocol</span>
            <span>•</span>
            <Link href="/admin" prefetch={true} className="hover:text-emerald-400 transition-colors">
              Staff Portal
            </Link>
            <span>•</span>
            <span className="text-emerald-400 font-bold">AIEM Hunt v2.4</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

