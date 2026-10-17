"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MapPin,
  Shield,
  Compass,
  Lock,
  Building,
  Layers,
  Search,
  PlusCircle,
  Clock,
  ArrowRight,
  Filter,
  Sparkles,
} from "lucide-react";

export default function CampusMapPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [quests, setQuests] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "SAFE_DESK" | "QUESTS" | "LOST_FOUND">("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/items").then((r) => r.json()),
      fetch("/api/quests").then((r) => r.json()),
    ])
      .then(([locData, itemsData, questsData]) => {
        if (locData.success) {
          setLocations(locData.data || []);
          if (locData.data?.length > 0) {
            setSelectedLocation(locData.data[0]);
          }
        }
        if (itemsData.success) setItems(itemsData.data || []);
        if (questsData.success) setQuests(questsData.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const getBuildingStats = (locId: string) => {
    const locItems = items.filter(
      (it) =>
        (it.lastKnownLocationId?._id === locId || it.lastKnownLocationId === locId) ||
        (it.foundLocationId?._id === locId || it.foundLocationId === locId)
    );
    const locQuests = quests.filter(
      (q) => q.targetLocationId?._id === locId || q.targetLocationId === locId
    );
    return { items: locItems, quests: locQuests };
  };

  const filteredLocations = locations.filter((loc) => {
    if (filterType === "SAFE_DESK") return loc.isSafeDesk;
    if (filterType === "QUESTS") {
      const { quests: q } = getBuildingStats(loc._id);
      return q.length > 0;
    }
    if (filterType === "LOST_FOUND") {
      const { items: it } = getBuildingStats(loc._id);
      return it.length > 0;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              CAMPUS RECON GRID
            </span>
            <span className="text-xs font-mono text-slate-400">
              AIEM Tactical Vector Map V1.0
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Interactive Campus Map & Safe-Desk Radar
          </h1>
          <p className="text-sm text-slate-400">
            Click any campus academic block, library, or security safe-desk to inspect active reports, drop-off lockers, and mystery clues.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-white/10 text-xs font-mono">
          {[
            { id: "ALL", label: "All Zones" },
            { id: "SAFE_DESK", label: "Safe-Desks" },
            { id: "QUESTS", label: "Hunts" },
            { id: "LOST_FOUND", label: "Lost & Found" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterType === f.id
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Map + Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tactical SVG Map Surface */}
        <div className="lg:col-span-8 glass-panel rounded-3xl p-6 border border-white/10 relative overflow-hidden min-h-[500px] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 z-10">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE RADAR FEED: AIEM CAMPUS
            </span>
            <span>GRID: 22.9868° N, 88.4312° E</span>
          </div>

          {/* Tactical Vector Canvas */}
          <div className="relative w-full h-[420px] my-4 rounded-2xl bg-[#070B12] border border-white/5 overflow-hidden">
            {/* Background Map Grid & Roads */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Campus Roads and Walkways */}
              <path
                d="M 50 400 L 150 350 L 250 150 L 520 140 L 780 180"
                fill="none"
                stroke="rgba(16, 185, 129, 0.15)"
                strokeWidth="4"
                strokeDasharray="6,6"
              />
              <path
                d="M 150 350 L 450 280 L 650 340 L 780 180"
                fill="none"
                stroke="rgba(6, 182, 212, 0.15)"
                strokeWidth="4"
                strokeDasharray="6,6"
              />
              <circle cx="450" cy="280" r="40" fill="none" stroke="rgba(255,255,255,0.05)" />
            </svg>

            {/* Interactive Building Nodes */}
            {filteredLocations.map((loc) => {
              const isSelected = selectedLocation?._id === loc._id;
              const isSafeDesk = loc.isSafeDesk;
              const { items: locItems, quests: locQuests } = getBuildingStats(loc._id);

              return (
                <button
                  key={loc._id}
                  onClick={() => setSelectedLocation(loc)}
                  style={{
                    left: `${loc.coordinates.mapX}%`,
                    top: `${loc.coordinates.mapY}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-transform ${
                    isSelected ? "scale-110 z-30" : "hover:scale-105 z-20"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                        isSafeDesk
                          ? isSelected
                            ? "bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/30"
                            : "bg-emerald-950/90 text-emerald-300 border border-emerald-500/50"
                          : isSelected
                          ? "bg-cyan-500 text-slate-950 ring-4 ring-cyan-500/30"
                          : "bg-slate-900 text-slate-300 border border-white/20 hover:border-cyan-400"
                      }`}
                    >
                      {isSafeDesk ? (
                        <Lock className="w-5 h-5" />
                      ) : (
                        <Building className="w-5 h-5" />
                      )}
                    </div>

                    <div className="mt-1.5 px-2 py-0.5 rounded-md bg-slate-950/90 border border-white/10 text-[10px] font-mono whitespace-nowrap text-white font-bold flex items-center gap-1 shadow-md">
                      <span>{loc.code}</span>
                      {(locItems.length > 0 || locQuests.length > 0) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-white/5">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500/40 border border-emerald-400" />
                Verified Safe-Desk
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-slate-800 border border-white/20" />
                Academic Block
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Active Clue / Investigation
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Click icon to inspect zone</span>
          </div>
        </div>

        {/* Selected Zone Dossier Drawer */}
        <div className="lg:col-span-4 space-y-4">
          {selectedLocation ? (
            (() => {
              const { items: locItems, quests: locQuests } = getBuildingStats(selectedLocation._id);
              return (
                <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-6">
                  <div className="space-y-2 border-b border-white/10 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300">
                        {selectedLocation.zoneType}
                      </span>
                      <span className="font-mono text-xs text-emerald-400 font-bold">
                        {selectedLocation.code}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold text-white">
                      {selectedLocation.name}
                    </h2>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {selectedLocation.description}
                    </p>
                  </div>

                  {/* Operating Hours and Safe-Desk badge */}
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" /> Operating Hours:
                      </span>
                      <span>{selectedLocation.operatingHours}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" /> Floors:
                      </span>
                      <span className="truncate max-w-[150px]">{selectedLocation.floors?.join(", ")}</span>
                    </div>

                    {selectedLocation.isSafeDesk && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>Authorized 24/7 Custody Drop-Off Station</span>
                      </div>
                    )}
                  </div>

                  {/* Active Quests in this zone */}
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div className="text-xs font-mono uppercase text-slate-400 flex items-center justify-between">
                      <span>Active Hunts in Zone ({locQuests.length})</span>
                    </div>

                    {locQuests.length > 0 ? (
                      locQuests.map((q) => (
                        <Link
                          key={q._id}
                          href={`/quests/${q._id}`}
                          className="block p-3 rounded-xl bg-slate-950/70 border border-white/5 hover:border-emerald-500/30 transition-all text-xs space-y-1"
                        >
                          <div className="font-bold text-white flex items-center justify-between">
                            <span>{q.title}</span>
                            <span className="text-amber-400 font-mono text-[10px]">+{q.coinReward} 🪙</span>
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1">
                            {q.description}
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="text-[11px] font-mono text-slate-500 text-center py-2">
                        No active quests in this building.
                      </div>
                    )}
                  </div>

                  {/* Active Lost & Found items in this zone */}
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div className="text-xs font-mono uppercase text-slate-400 flex items-center justify-between">
                      <span>Lost/Found Items ({locItems.length})</span>
                    </div>

                    {locItems.length > 0 ? (
                      locItems.map((it) => (
                        <Link
                          key={it._id}
                          href={`/items/${it._id}`}
                          className="block p-3 rounded-xl bg-slate-950/70 border border-white/5 hover:border-cyan-500/30 transition-all text-xs space-y-1"
                        >
                          <div className="font-bold text-white flex items-center justify-between">
                            <span>{it.title}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-white/10 text-slate-300">
                              {it.itemType}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1">
                            {it.publicDescription}
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="text-[11px] font-mono text-slate-500 text-center py-2">
                        No items reported in this zone.
                      </div>
                    )}
                  </div>

                  {/* Quick Report in this Zone */}
                  <div className="pt-2 border-t border-white/5 flex gap-2">
                    <Link
                      href={`/lost-and-found/report-lost`}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold text-center transition-all"
                    >
                      Report Lost Here
                    </Link>
                    <Link
                      href={`/lost-and-found/report-found`}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold text-center transition-all"
                    >
                      Deposit Found
                    </Link>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="glass-panel rounded-3xl p-8 text-center text-xs font-mono text-slate-500">
              Select a location marker on the campus vector map.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

