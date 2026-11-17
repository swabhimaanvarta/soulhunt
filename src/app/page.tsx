import React from "react";
import Link from "next/link";
import {
  Compass,
  Search,
  Shield,
  MapPin,
  Users,
  Coins,
  ArrowRight,
  PlusCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  HelpCircle,
  Clock,
  Eye,
  Radio,
  Building,
  Navigation,
  ExternalLink,
  Layers,
  Calendar,
  Flame,
} from "lucide-react";
import { connectDB } from "@/lib/db";
import { Quest, LostItem, FoundItem, CampusLocation, Squad, Event } from "@/models";
import { sanitizeItemTitle } from "@/lib/item-dto";
import { sanitizePublicDescription } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let quests: any[] = [];
  let lostItems: any[] = [];
  let foundItems: any[] = [];
  let safeDesks: any[] = [];
  let squads: any[] = [];
  let events: any[] = [];
  let activeReportsCount = 0;
  let totalRecoveredCount = 0;
  let activeHuntsCount = 0;
  let safeDesksCount = 0;

  try {
    await connectDB();

    const [
      qRes,
      lRes,
      fRes,
      sRes,
      sqRes,
      evRes,
      reportsCount,
      recoveredCount,
      huntsCount,
      safeCount,
    ] = await Promise.all([
      Quest.find({ status: "ACTIVE", isArchived: { $ne: true } })
        .populate("targetLocationId", "name code")
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
      LostItem.find({ status: { $in: ["ACTIVE", "CLAIMED"] } })
        .populate("lastKnownLocationId", "name code")
        .populate("reporterId", "displayName username")
        .sort({ createdAt: -1 })
        .limit(4)
        .lean(),
      FoundItem.find({ status: { $in: ["ACTIVE", "CLAIMED"] } })
        .populate("foundLocationId", "name code")
        .populate("currentCustodyLocationId", "name isSafeDesk")
        .sort({ createdAt: -1 })
        .limit(4)
        .lean(),
      CampusLocation.find({ isSafeDesk: true, isActive: true, isArchived: { $ne: true } })
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
      Squad.find().sort({ squadXp: -1 }).limit(3).lean(),
      Event.find({ status: { $in: ["LIVE", "UPCOMING"] }, isArchived: { $ne: true } })
        .sort({ startTime: 1 })
        .limit(2)
        .lean(),
      Promise.all([
        LostItem.countDocuments({ status: { $in: ["ACTIVE", "CLAIMED"] } }),
        FoundItem.countDocuments({ status: { $in: ["ACTIVE", "CLAIMED"] } }),
      ]).then(([l, f]) => l + f),
      Promise.all([
        LostItem.countDocuments({ status: { $in: ["RECOVERED", "COMPLETED"] } }),
        FoundItem.countDocuments({ status: { $in: ["RECOVERED", "COMPLETED"] } }),
      ]).then(([l, f]) => l + f),
      Quest.countDocuments({ status: "ACTIVE", isArchived: { $ne: true } }),
      CampusLocation.countDocuments({ isSafeDesk: true, isActive: true, isArchived: { $ne: true } }),
    ]);

    quests = qRes;
    lostItems = lRes;
    foundItems = fRes;
    safeDesks = sRes;
    squads = sqRes;
    events = evRes;
    activeReportsCount = reportsCount;
    totalRecoveredCount = recoveredCount;
    activeHuntsCount = huntsCount;
    safeDesksCount = safeCount;
  } catch (err) {
    console.error("HomePage SSR DB fetch warning:", err);
  }

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden max-w-full border-b border-emerald-500/20 bg-gradient-to-b from-[#0a1220] via-[#070A0F] to-[#070A0F] py-16 md:py-24">
        {/* Ambient Neon Halos (contained for mobile viewports) */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] sm:w-[650px] h-[200px] sm:h-[320px] bg-emerald-500/15 blur-[90px] sm:blur-[130px] rounded-full pointer-events-none pulse-halo" />
        <div className="absolute top-1/3 right-0 sm:right-10 w-[240px] sm:w-[400px] h-[180px] sm:h-[220px] bg-cyan-500/15 blur-[90px] sm:blur-[110px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 left-0 sm:left-10 w-[200px] sm:w-[300px] h-[150px] sm:h-[200px] bg-violet-500/10 blur-[80px] sm:blur-[100px] rounded-full pointer-events-none" />

        {/* Scanner Line Effect */}
        <div className="scanner-line opacity-40 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] sm:text-xs font-semibold tracking-wide shadow-[0_0_15px_rgba(16,185,129,0.25)] max-w-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981] flex-shrink-0" />
              <span className="truncate sm:hidden">AIEM RECOVERY &amp; RECON RPG</span>
              <span className="hidden sm:inline">AIEM - AGNEL INSTITUTE OF ENGINEERING AND MANAGEMENT • RECOVERY &amp; RECON RPG</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white">
              Recover Belongings. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-300 neon-text-emerald">
                Solve Campus Mysteries.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
              AIEM Hunt transforms Agnel Institute of Engineering and Management&apos;s campus Lost &amp; Found into a privacy-safe, cooperative investigation RPG. Report lost items, turn in found belongings at verified safe-desks, follow location breadcrumbs across Assagao, and earn XP, Hunter Coins, and squad prestige.
            </p>

            {/* Tactical Primary Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/lost-and-found"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all transform hover:-translate-y-0.5"
              >
                <Search className="w-4 h-4 text-cyan-400" />
                Browse Items
              </Link>

              <Link
                href="/lost-and-found/report-lost"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-sm shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all transform hover:-translate-y-0.5"
              >
                <PlusCircle className="w-4 h-4" />
                Report Lost Item
              </Link>

              <Link
                href="/lost-and-found/report-found"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white border border-emerald-500/40 font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all transform hover:-translate-y-0.5"
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                Turn in Found (Safe-Desk)
              </Link>

              <Link
                href="/quests"
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900/70 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 font-bold text-sm transition-all"
              >
                <Compass className="w-4 h-4" />
                Quests
              </Link>

              <Link
                href="/map"
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-400/40 font-bold text-sm transition-all"
              >
                <Navigation className="w-4 h-4 text-emerald-400" />
                Radar Map
              </Link>
            </div>
          </div>

          {/* Quick Metrics HUD — Glowing Neon Blocks */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-16 max-w-4xl mx-auto">
            <div className="neon-block neon-block-emerald rounded-2xl p-5 text-center shadow-[0_0_20px_rgba(16,185,129,0.18)]">
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 neon-text-emerald">
                {activeReportsCount}
              </div>
              <div className="text-xs font-mono uppercase text-slate-300 tracking-wider mt-1 font-semibold">
                Active Reports
              </div>
            </div>

            <div className="neon-block neon-block-cyan rounded-2xl p-5 text-center shadow-[0_0_20px_rgba(6,182,212,0.18)]">
              <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-400 neon-text-cyan">
                {totalRecoveredCount}
              </div>
              <div className="text-xs font-mono uppercase text-slate-300 tracking-wider mt-1 font-semibold">
                Items Recovered
              </div>
            </div>

            <div className="neon-block neon-block-amber rounded-2xl p-5 text-center shadow-[0_0_20px_rgba(245,158,11,0.18)]">
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 neon-text-amber">
                {activeHuntsCount}
              </div>
              <div className="text-xs font-mono uppercase text-slate-300 tracking-wider mt-1 font-semibold">
                Active Hunts
              </div>
            </div>

            <div className="neon-block neon-block-violet rounded-2xl p-5 text-center shadow-[0_0_20px_rgba(139,92,246,0.18)]">
              <div className="text-2xl sm:text-3xl font-black font-mono text-violet-400">
                {safeDesksCount} {safeDesksCount === 1 ? "Station" : "Stations"}
              </div>
              <div className="text-xs font-mono uppercase text-slate-300 tracking-wider mt-1 font-semibold">
                Verified Safe-Desks
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Interactive Campus Map Banner Showcase */}
        <div className="neon-block neon-block-emerald rounded-3xl p-6 sm:p-8 border border-emerald-500/35 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_35px_rgba(16,185,129,0.18)]">
          <div className="space-y-2 text-center md:text-left z-10">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                CAMPUS NAVIGATION RADAR
              </span>
              <span className="text-xs font-mono text-cyan-400">
                HQVW+X2R • Assagao, Bardez, Goa
              </span>
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight">
              Agnel Technical Educational Complex Interactive Map
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Locate 10 campus sectors including the Admin &amp; BSH Complex, Central Library Safe-Desk #2, Computer Engineering AI Labs, and Main Gate Security Locker Station.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 z-10">
            <Link
              href="/map"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold font-mono text-xs shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all"
            >
              <Navigation className="w-4 h-4" />
              Launch Vector Radar →
            </Link>
            <a
              href="https://maps.app.goo.gl/mDk3QbPA3JsPMpha6"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-slate-300 hover:text-white hover:border-emerald-400 text-xs font-mono font-bold transition-all"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Google Maps</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </div>

        {/* Featured Investigation & Active Hunts */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Compass className="w-6 h-6 text-emerald-400" />
                Active Campus Hunts &amp; Investigations
              </h2>
              <p className="text-sm text-slate-400">
                Solve location clues, follow campus breadcrumbs, and earn Hunter XP and Coins.
              </p>
            </div>
            <Link
              href="/quests"
              className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold"
            >
              View All Quests <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quests.map((q: any) => (
              <div
                key={String(q._id)}
                className="neon-block neon-block-emerald rounded-2xl p-6 border border-emerald-500/30 hover:border-emerald-400 transition-all flex flex-col justify-between group shadow-[0_0_20px_rgba(16,185,129,0.1)]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {q.questType}
                    </span>
                    <span className="font-mono text-xs text-amber-400 font-bold">
                      {q.questCode}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                    {q.title}
                  </h3>

                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {q.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300 pt-2 border-t border-white/10">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      ⭐ +{q.xpReward} XP
                    </span>
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      🪙 +{q.coinReward} Coins
                    </span>
                    {q.targetLocationId && (
                      <span className="flex items-center gap-1 text-cyan-300">
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        {q.targetLocationId.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">
                    Difficulty: {"★".repeat(q.difficulty)}{"☆".repeat(Math.max(0, 5 - q.difficulty))}
                  </span>
                  <Link
                    href={`/quests/${q._id}`}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    Open Briefing <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming Campus Operations & Events */}
        {events.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-violet-400" />
                  Upcoming Campus Operations &amp; Events
                </h2>
                <p className="text-sm text-slate-400">
                  Time-limited collaborative sprint operations, inter-department challenges, and special campus treasure hunts.
                </p>
              </div>
              <Link
                href="/events"
                className="text-xs font-mono text-violet-400 hover:text-violet-300 flex items-center gap-1 font-bold"
              >
                All Events <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {events.map((ev: any) => (
                <div
                  key={String(ev._id)}
                  className="glass-panel rounded-2xl p-6 border border-violet-500/30 hover:border-violet-400 transition-all flex flex-col justify-between group shadow-[0_0_20px_rgba(139,92,246,0.1)]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40">
                        {ev.eventType}
                      </span>
                      <span className="font-mono text-xs text-emerald-400 font-bold">
                        {ev.status}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors">
                      {ev.title}
                    </h3>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {ev.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300 pt-2 border-t border-white/10">
                      <span className="flex items-center gap-1 text-amber-400 font-semibold">
                        🪙 1st: {ev.rewardPool?.firstPlaceCoins || 250} Coins
                      </span>
                      <span className="flex items-center gap-1 text-violet-300">
                        <Users className="w-3.5 h-3.5" />
                        {ev.participants?.length || 0} Registered
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400">
                      Starts: {new Date(ev.startTime).toLocaleDateString()}
                    </span>
                    <Link
                      href="/events"
                      className="px-3.5 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/35 text-violet-300 border border-violet-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      View Operation <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Lost & Found Items */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Search className="w-6 h-6 text-cyan-400" />
                Recent Lost &amp; Found Reports
              </h2>
              <p className="text-sm text-slate-400">
                Privacy-protected campus listings. Verified handovers via 6-digit cryptographic code or Safe-Desks.
              </p>
            </div>
            <Link
              href="/lost-and-found"
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold"
            >
              Browse All Items <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {lostItems.map((item: any) => (
              <Link
                key={String(item._id)}
                href={`/items/${item._id}`}
                className="neon-block neon-block-rose rounded-2xl p-4 border border-rose-500/30 hover:border-rose-400 transition-all flex flex-col justify-between group shadow-[0_0_15px_rgba(244,63,94,0.1)]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                      LOST
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.category}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-white group-hover:text-rose-300 transition-colors line-clamp-1">
                    {sanitizeItemTitle(item.title)}
                  </h4>

                  <p className="text-xs text-slate-300 line-clamp-2">
                    {sanitizePublicDescription(item.publicDescription || "").sanitizedText}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-white/10 space-y-1">
                  <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
                    <MapPin className="w-3 h-3 text-rose-400" />
                    <span className="truncate">
                      {item.lastKnownLocationId?.name || "Campus Grounds"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Status: {item.status}</span>
                    <span className="text-rose-400 font-bold">Details →</span>
                  </div>
                </div>
              </Link>
            ))}

            {foundItems.map((item: any) => (
              <Link
                key={String(item._id)}
                href={`/items/${item._id}`}
                className="neon-block neon-block-emerald rounded-2xl p-4 border border-emerald-500/30 hover:border-emerald-400 transition-all flex flex-col justify-between group shadow-[0_0_15px_rgba(16,185,129,0.1)]"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                      FOUND
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.category}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                    {sanitizeItemTitle(item.title)}
                  </h4>

                  <p className="text-xs text-slate-300 line-clamp-2">
                    {sanitizePublicDescription(item.publicDescription || "").sanitizedText}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-white/10 space-y-1">
                  <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
                    <Building className="w-3 h-3 text-emerald-400" />
                    <span className="truncate">
                      Custody: {item.currentCustodyLocationId?.name || "Safe-Desk"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="text-emerald-400 font-semibold">Safe-Desk Secured</span>
                    <span className="text-cyan-400 font-bold">Claim →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 3-Step Physical Safe-Desk Custody Workflow */}
        <section className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
              Reliable Physical Custody Protocol
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-white">
              How AIEM Safe-Desk Handover Works
            </h3>
            <p className="text-xs text-slate-400">
              A secure, student-friendly procedure ensuring recovered belongings reach their true owners without friction or privacy exposure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="rounded-2xl bg-slate-950/70 border border-white/10 p-5 space-y-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm">
                1
              </div>
              <h4 className="font-bold text-sm text-white">Turn In &amp; Locker Deposit</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Finder drops off the item at any verified Safe-Desk counter (Main Gate Security or Central Library). Desk attendant issues a custody receipt and credits finder rewards.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-950/70 border border-white/10 p-5 space-y-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm">
                2
              </div>
              <h4 className="font-bold text-sm text-white">Private Ownership Claim</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Owner identifies their item on the board and answers a private verification question (without exposing serial numbers publicly). Staff reviews and approves the claim.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-950/70 border border-white/10 p-5 space-y-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 font-mono font-bold text-sm">
                3
              </div>
              <h4 className="font-bold text-sm text-white">In-Person PIN Release</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Owner presents their 6-digit recovery PIN in person at the Safe-Desk. Staff certifies handover, releases the item, and recovery rewards are credited.
              </p>
            </div>
          </div>
        </section>

        {/* Safe-Desk Station Directory */}
        <section className="neon-block neon-block-emerald rounded-3xl p-6 sm:p-8 border border-emerald-500/35 space-y-5 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                Verified Campus Safe-Desk Stations
              </h3>
              <p className="text-xs text-slate-300">
                Ethical Campus Drop-Off Points: Hand in found items here to ensure verified security custody and claim your Finder Bonus.
              </p>
            </div>
            <Link
              href="/map?filter=SAFE_DESK"
              className="px-4 py-2 rounded-xl bg-slate-900 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-mono font-bold text-center shadow-sm"
            >
              View on Campus Map →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {safeDesks.map((sd: any) => (
              <div
                key={String(sd._id)}
                className="rounded-2xl bg-slate-950/80 border border-emerald-500/25 p-4 flex items-start justify-between shadow-sm"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{sd.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {sd.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{sd.description}</p>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400 pt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Operating Hours: {sd.operatingHours}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
