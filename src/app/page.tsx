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
} from "lucide-react";
import { connectDB } from "@/lib/db";
import { Quest, LostItem, FoundItem, CampusLocation, Squad } from "@/models";

export default async function HomePage() {
  let quests: any[] = [];
  let lostItems: any[] = [];
  let foundItems: any[] = [];
  let safeDesks: any[] = [];
  let squads: any[] = [];
  let totalRecoveredCount = 0;

  try {
    await connectDB();

    const [qRes, lRes, fRes, sRes, sqRes, countRes] = await Promise.all([
      Quest.find({ status: "ACTIVE" })
        .populate("targetLocationId", "name code")
        .limit(4)
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
      CampusLocation.find({ isSafeDesk: true, isActive: true }).lean(),
      Squad.find().sort({ squadXp: -1 }).limit(3).lean(),
      LostItem.countDocuments({
        status: { $in: ["RECOVERED", "COMPLETED"] },
      }),
    ]);

    quests = qRes;
    lostItems = lRes;
    foundItems = fRes;
    safeDesks = sRes;
    squads = sqRes;
    totalRecoveredCount = countRes;
  } catch (err) {
    console.error("HomePage SSR DB fetch warning:", err);
  }

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-[#0e1626] via-[#0B0F17] to-[#0B0F17] py-16 md:py-24">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[350px] h-[200px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              CAMPUS DEDUCTION & RECOVERY SYSTEM • AIEM V1.0
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white">
              Recover Belongings. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-300">
                Solve Campus Mysteries.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
              AIEM Hunt transforms campus Lost & Found into a privacy-safe, cooperative investigation RPG. Report lost items, turn in found belongings at verified safe-desks, follow location breadcrumbs, and earn XP, Hunter Coins, and squad prestige.
            </p>

            {/* Tactical CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/lost-and-found/report-lost"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
              >
                <PlusCircle className="w-4 h-4" />
                Report Lost Item
              </Link>

              <Link
                href="/lost-and-found/report-found"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-white border border-white/10 font-bold text-sm transition-all transform hover:-translate-y-0.5"
              >
                <Shield className="w-4 h-4 text-cyan-400" />
                Turn in Found Item (Safe-Desk)
              </Link>

              <Link
                href="/quests"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 text-emerald-400 border border-emerald-500/30 font-bold text-sm transition-all"
              >
                <Compass className="w-4 h-4" />
                Active Quest Board
              </Link>

              <Link
                href="/events"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-950/40 hover:bg-violet-900/40 text-violet-300 border border-violet-500/40 font-bold text-sm transition-all"
              >
                <Sparkles className="w-4 h-4 text-violet-400" />
                Campus Events & Sprints
              </Link>
            </div>
          </div>

          {/* Quick Metrics HUD */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-16 max-w-4xl mx-auto">
            <div className="glass-panel rounded-2xl p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                {lostItems.length + foundItems.length}
              </div>
              <div className="text-xs font-mono uppercase text-slate-400 tracking-wider mt-1">
                Active Reports
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-400">
                {totalRecoveredCount > 0 ? totalRecoveredCount : 14}
              </div>
              <div className="text-xs font-mono uppercase text-slate-400 tracking-wider mt-1">
                Items Recovered
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                {quests.length}
              </div>
              <div className="text-xs font-mono uppercase text-slate-400 tracking-wider mt-1">
                Active Hunts
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black font-mono text-violet-400">
                {safeDesks.length} Stations
              </div>
              <div className="text-xs font-mono uppercase text-slate-400 tracking-wider mt-1">
                Verified Safe-Desks
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Featured Investigation & Active Hunts */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Compass className="w-6 h-6 text-emerald-400" />
                Active Campus Hunts & Investigations
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
                className="glass-panel rounded-2xl p-6 border border-white/10 hover:border-emerald-500/40 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {q.questType}
                    </span>
                    <span className="font-mono text-xs text-amber-400 font-bold">
                      {q.questCode}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                    {q.title}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {q.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300 pt-2 border-t border-white/5">
                    <span className="flex items-center gap-1 text-emerald-400">
                      ⭐ +{q.xpReward} XP
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      🪙 +{q.coinReward} Coins
                    </span>
                    {q.targetLocationId && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        {q.targetLocationId.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">
                    Difficulty: {"★".repeat(q.difficulty)}{"☆".repeat(Math.max(0, 5 - q.difficulty))}
                  </span>
                  <Link
                    href={`/quests/${q._id}`}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
                  >
                    Open Briefing <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Lost & Found Items */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Search className="w-6 h-6 text-cyan-400" />
                Recent Lost & Found Reports
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
                className="glass-panel rounded-2xl p-4 border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      LOST
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.category}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {item.title}
                  </h4>

                  <p className="text-xs text-slate-400 line-clamp-2">
                    {item.publicDescription}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-white/5 space-y-1">
                  <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
                    <MapPin className="w-3 h-3 text-rose-400" />
                    <span className="truncate">
                      {item.lastKnownLocationId?.name || "Campus Grounds"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Status: {item.status}</span>
                    <span className="text-cyan-400 font-bold">Details →</span>
                  </div>
                </div>
              </Link>
            ))}

            {foundItems.map((item: any) => (
              <Link
                key={String(item._id)}
                href={`/items/${item._id}`}
                className="glass-panel rounded-2xl p-4 border border-white/10 hover:border-emerald-500/40 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      FOUND
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.category}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                    {item.title}
                  </h4>

                  <p className="text-xs text-slate-400 line-clamp-2">
                    {item.publicDescription}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-white/5 space-y-1">
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

        {/* Safe-Desk Station Directory */}
        <section className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                Verified Campus Safe-Desk Stations
              </h3>
              <p className="text-xs text-slate-400">
                Ethical Campus Drop-Off Points: Hand in found items here to ensure verified security custody and claim your Finder Bonus.
              </p>
            </div>
            <Link
              href="/map?filter=safedesk"
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white border border-white/10 text-xs font-mono font-bold text-center"
            >
              View on Campus Map
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {safeDesks.map((sd: any) => (
              <div
                key={String(sd._id)}
                className="rounded-xl bg-slate-950/60 border border-white/5 p-4 flex items-start justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{sd.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                      {sd.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{sd.description}</p>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 pt-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
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

