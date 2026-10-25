"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Trophy,
  Shield,
  Clock,
  Sparkles,
  Users,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Compass,
  AlertCircle,
} from "lucide-react";

export default function CampusEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events?active=true");
      const json = await res.json();
      if (json.success && json.data) {
        setEvents(json.data);
      }
    } catch (e) {
      console.error("Failed to load events", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleJoin = async (eventId: string) => {
    setJoiningId(eventId);
    setJoinSuccess(null);
    setJoinError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/join`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        setJoinError(json.error || "Failed to join event.");
        return;
      }
      setJoinSuccess(json.message || "Registered successfully!");
      fetchEvents();
    } catch (e: any) {
      setJoinError(e.message || "Failed to register.");
    } finally {
      setJoiningId(null);
    }
  };

  const featured = events[0];
  const others = events.slice(1);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pb-20 selection:bg-emerald-500 selection:text-black">
      {/* Top Banner */}
      <div className="border-b border-white/5 bg-slate-950/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Campus Events & Mystery Hunts
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                Department competitions, festivals & live campus expeditions
              </p>
            </div>
          </div>
          <Link
            href="/quests"
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>Solo & Squad Quests</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
        {joinSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{joinSuccess}</span>
          </div>
        )}

        {joinError && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{joinError}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-500 font-mono text-sm animate-pulse">
            Scanning campus telemetry for active events...
          </div>
        ) : !featured ? (
          <div className="text-center py-20 text-slate-500 font-mono text-sm">
            No active events at this moment. Check back soon for upcoming department sprints!
          </div>
        ) : (
          <>
            {/* Featured Event Spotlight */}
            <div className="relative rounded-3xl overflow-hidden border border-violet-500/30 bg-gradient-to-br from-violet-950/60 via-slate-900/90 to-emerald-950/40 p-6 md:p-10 shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  LIVE EXPEDITION
                </span>
                <span className="px-3 py-1 rounded-full text-[11px] font-mono bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {featured.eventType?.replace(/_/g, " ")}
                </span>
                {featured.isSquadEvent && (
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                    <Users className="w-3 h-3" /> SQUAD SPRINT
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-4">
                  <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight leading-tight">
                    {featured.title}
                  </h2>
                  <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-mono">
                    {featured.description}
                  </p>

                  {/* Rules Pill List */}
                  {featured.rules && featured.rules.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                        Expedition Protocols:
                      </div>
                      <div className="space-y-1.5">
                        {featured.rules.map((rule: string, i: number) => (
                          <div
                            key={i}
                            className="text-xs font-mono text-slate-300 flex items-start gap-2 bg-slate-950/60 p-2 rounded-xl border border-white/5"
                          >
                            <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                            <span>{rule}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Rewards Card & Action */}
                <div className="lg:col-span-5 bg-slate-950/80 border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      PRIZE POOL & HONORS
                    </span>
                    <span className="text-xs font-mono text-amber-400 font-bold">
                      {featured.rewardPool?.exclusiveTitle || "Campus Vanguard"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <div className="text-[10px] text-amber-400 font-bold">1ST PLACE</div>
                      <div className="text-sm font-black text-white mt-1">
                        {featured.rewardPool?.firstPlaceCoins || 250} 🪙
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/60 border border-white/10">
                      <div className="text-[10px] text-slate-400 font-bold">2ND PLACE</div>
                      <div className="text-sm font-black text-white mt-1">
                        {featured.rewardPool?.secondPlaceCoins || 150} 🪙
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/60 border border-white/10">
                      <div className="text-[10px] text-slate-400 font-bold">3RD PLACE</div>
                      <div className="text-sm font-black text-white mt-1">
                        {featured.rewardPool?.thirdPlaceCoins || 75} 🪙
                      </div>
                    </div>
                  </div>

                  <div className="text-xs font-mono text-slate-400 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Registered Agents:</span>
                      <span className="text-white font-bold">{featured.participants?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Timeline:</span>
                      <span className="text-slate-300">
                        {new Date(featured.startTime).toLocaleDateString()} — {new Date(featured.endTime).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoin(featured._id)}
                    disabled={joiningId === featured._id}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-xs font-mono bg-gradient-to-r from-violet-500 via-emerald-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-slate-950 shadow-lg shadow-violet-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {joiningId === featured._id ? "Enrolling Squad..." : "REGISTER FOR EXPEDITION"}
                  </button>
                </div>
              </div>
            </div>

            {/* Other Sprints & Challenges */}
            {others.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  Upcoming Campus Sprints
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {others.map((evt) => (
                    <div
                      key={evt._id}
                      className="rounded-2xl bg-slate-900/80 border border-white/10 p-5 space-y-4 hover:border-violet-500/40 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                          {evt.eventType}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(evt.startTime).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-white text-sm">{evt.title}</h4>
                        <p className="text-xs text-slate-400 font-mono mt-1 line-clamp-2">
                          {evt.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-xs font-mono text-amber-400">
                          +{evt.rewardPool?.firstPlaceCoins || 200} 🪙 Top Prize
                        </span>
                        <button
                          onClick={() => handleJoin(evt._id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-white transition-all"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

