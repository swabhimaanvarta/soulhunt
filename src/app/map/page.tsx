"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
  ExternalLink,
  Navigation,
  Crosshair,
  Radio,
  Zap,
  Edit3,
  Check,
  X,
  Move,
  Save,
  AlertCircle,
} from "lucide-react";
import type { CampusLocationPoint } from "@/components/map/CampusRealMap";

// Dynamically import real Leaflet map component with ssr disabled for 100% Next.js SSR safety
const CampusRealMap = dynamic(() => import("@/components/map/CampusRealMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] rounded-2xl bg-[#060A10] border border-emerald-500/20 flex flex-col items-center justify-center font-mono text-xs text-emerald-400 gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
      <span className="tracking-wider">INITIALIZING REAL SATELLITE RECON ENGINE (AIEM ASSAGAO)...</span>
    </div>
  ),
});

// Default authentic AIEM Assagao campus GPS locations calibrated from Google Maps
const DEFAULT_AIEM_LOCATIONS: CampusLocationPoint[] = [
  {
    _id: "loc_admin",
    name: "Admin & BSH Complex",
    code: "BLK-ADMIN",
    zoneType: "ACADEMIC_BLOCK",
    description: "Administration, Examination Cell, Principal's Office, and Basic Sciences & Humanities Department.",
    coordinates: { lat: 15.5975, lng: 73.7942 },
    floors: ["Ground Floor", "1st Floor", "2nd Floor"],
    isSafeDesk: false,
    operatingHours: "08:30 AM - 05:00 PM",
    color: "emerald",
  },
  {
    _id: "loc_safe_lib",
    name: "Central Library Safe-Desk #2",
    code: "SAFE-LIB",
    zoneType: "SAFE_DESK",
    description: "Admin Block 2nd Floor — Supervised custody station, digital repository, and silent study wing.",
    coordinates: { lat: 15.5974, lng: 73.7944 },
    floors: ["2nd Floor Entrance"],
    isSafeDesk: true,
    operatingHours: "08:30 AM - 06:30 PM",
    color: "emerald",
  },
  {
    _id: "loc_comp",
    name: "Computer Engineering & AI Center",
    code: "COMP-AI",
    zoneType: "ACADEMIC_BLOCK",
    description: "High-Performance Computing, AI/ML Labs, Cloud Systems, and Room B-204 Digital Systems Lab.",
    coordinates: { lat: 15.5977, lng: 73.7940 },
    floors: ["Ground Floor", "1st Floor", "2nd Floor"],
    isSafeDesk: false,
    operatingHours: "08:30 AM - 06:00 PM",
    color: "cyan",
  },
  {
    _id: "loc_ece",
    name: "Electronics & Computer Engineering (G-Block)",
    code: "ECE-G",
    zoneType: "ACADEMIC_BLOCK",
    description: "Embedded Systems, IoT Testbed, VLSI Design Lab, and G-Block Lecture Theatres.",
    coordinates: { lat: 15.5973, lng: 73.7941 },
    floors: ["Ground Floor", "1st Floor"],
    isSafeDesk: false,
    operatingHours: "08:30 AM - 05:30 PM",
    color: "violet",
  },
  {
    _id: "loc_mech",
    name: "Mechanical Workshop & Robotics Bay",
    code: "MECH-ROBOT",
    zoneType: "ACADEMIC_BLOCK",
    description: "Automation workshops, CAD/CAM Lab, Heavy Machinery, Robotics Arena, and CNC Bay.",
    coordinates: { lat: 15.5972, lng: 73.7937 },
    floors: ["Ground Floor", "1st Floor"],
    isSafeDesk: false,
    operatingHours: "08:30 AM - 05:30 PM",
    color: "amber",
  },
  {
    _id: "loc_safe_gate",
    name: "Main Gate Security Safe-Desk #1",
    code: "SAFE-GATE",
    zoneType: "SAFE_DESK",
    description: "Assagao Main Entrance — 24/7 guarded security desk, visitor registration, and electronic deposit lockers.",
    coordinates: { lat: 15.5980, lng: 73.7947 },
    floors: ["Ground Checkpoint"],
    isSafeDesk: true,
    operatingHours: "24/7 Guarded Station",
    color: "emerald",
  },
  {
    _id: "loc_futsal",
    name: "Agnel Futsal Arena",
    code: "ARENA-FUTSAL",
    zoneType: "SPORTS",
    description: "All-weather artificial turf futsal arena, floodlit athletic courts, and inter-collegiate sports events.",
    coordinates: { lat: 15.5970, lng: 73.7954 },
    floors: ["Ground Level"],
    isSafeDesk: false,
    operatingHours: "06:00 AM - 10:00 PM",
    color: "emerald",
  },
  {
    _id: "loc_canteen",
    name: "Campus Cafeteria & Courtyard",
    code: "CANTEEN-01",
    zoneType: "CANTEEN",
    description: "Student dining hub, shaded outdoor seating, discussion patio, and kiosk counters.",
    coordinates: { lat: 15.5970, lng: 73.7946 },
    floors: ["Ground Floor", "Terrace"],
    isSafeDesk: false,
    operatingHours: "08:00 AM - 07:00 PM",
    color: "amber",
  },
  {
    _id: "loc_sports",
    name: "Sports Ground & Athletic Arena",
    code: "SPORTS-ARENA",
    zoneType: "SPORTS",
    description: "Football pitch, cricket pavilion, athletics track, and open sports field.",
    coordinates: { lat: 15.5968, lng: 73.7955 },
    floors: ["Open Stadium"],
    isSafeDesk: false,
    operatingHours: "06:00 AM - 08:00 PM",
    color: "emerald",
  },
  {
    _id: "loc_aud",
    name: "Multi-Purpose Hall & South Tech Complex",
    code: "AUD-MPH",
    zoneType: "ACADEMIC_BLOCK",
    description: "Major campus events, hackathons, technical seminars, and south engineering workshops.",
    coordinates: { lat: 15.5965, lng: 73.7944 },
    floors: ["Ground Floor", "Balcony"],
    isSafeDesk: false,
    operatingHours: "08:30 AM - 06:00 PM",
    color: "violet",
  },
];

function computeDistance(lat?: number, lng?: number) {
  if (!lat || !lng) return "Campus Hub";
  const R = 6371e3;
  const φ1 = (15.5955 * Math.PI) / 180;
  const φ2 = (lat * Math.PI) / 180;
  const Δφ = ((lat - 15.5955) * Math.PI) / 180;
  const Δλ = ((lng - 73.7945) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const meters = Math.round(R * c);
  return `~${meters}m from Gate 1`;
}

export default function CampusMapPage() {
  const [locations, setLocations] = useState<CampusLocationPoint[]>(DEFAULT_AIEM_LOCATIONS);
  const [items, setItems] = useState<any[]>([]);
  const [quests, setQuests] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<CampusLocationPoint | null>(DEFAULT_AIEM_LOCATIONS[0]);
  const [filterType, setFilterType] = useState<"ALL" | "SAFE_DESK" | "QUESTS" | "LOST_FOUND">("ALL");
  const [viewMode, setViewMode] = useState<"MAP" | "LIST">("MAP");
  const [listSearch, setListSearch] = useState("");
  const [radarActive, setRadarActive] = useState(true);
  const [loading, setLoading] = useState(true);

  // User auth role & admin edit mode
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [editModalLoc, setEditModalLoc] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = useCallback(() => {
    Promise.all([
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/items").then((r) => r.json()),
      fetch("/api/quests").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()).catch(() => ({ success: false })),
    ])
      .then(([locData, itemsData, questsData, meData]) => {
        const loadedItems = itemsData.success ? (itemsData.data || []) : [];
        const loadedQuests = questsData.success ? (questsData.data || []) : [];
        if (itemsData.success) setItems(loadedItems);
        if (questsData.success) setQuests(loadedQuests);
        if (meData.success && meData.data) {
          setCurrentUser(meData.data);
        }

        if (locData.success && Array.isArray(locData.data) && locData.data.length > 0) {
          const enriched = locData.data.map((l: any, idx: number) => {
            const locItems = loadedItems.filter(
              (it: any) =>
                it.lastKnownLocationId?._id === l._id ||
                it.lastKnownLocationId === l._id ||
                it.foundLocationId?._id === l._id ||
                it.foundLocationId === l._id ||
                (l.code && (it.lastKnownLocationId?.code === l.code || it.foundLocationId?.code === l.code))
            );
            const locQuests = loadedQuests.filter(
              (q: any) =>
                q.targetLocationId?._id === l._id ||
                q.targetLocationId === l._id ||
                (l.code && q.targetLocationId?.code === l.code)
            );
            return {
              ...l,
              itemCount: locItems.length,
              questCount: locQuests.length,
              color: l.isSafeDesk ? "emerald" : idx % 3 === 0 ? "cyan" : idx % 3 === 1 ? "amber" : "violet",
            };
          });
          setLocations(enriched);
          setSelectedLocation((prev) => prev || enriched[0]);
        }
      })
      .catch((err) => {
        console.warn("Using offline fallback campus locations:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isAdminOrStaff = currentUser && (currentUser.role === "ADMIN" || currentUser.role === "MODERATOR" || currentUser.role === "SAFE_DESK_STAFF");

  const getBuildingStats = (locId: string, locCode?: string) => {
    const locItems = items.filter(
      (it) =>
        it.lastKnownLocationId?._id === locId ||
        it.lastKnownLocationId === locId ||
        it.foundLocationId?._id === locId ||
        it.foundLocationId === locId ||
        (locCode && (it.lastKnownLocationId?.code === locCode || it.foundLocationId?.code === locCode))
    );
    const locQuests = quests.filter(
      (q) =>
        q.targetLocationId?._id === locId ||
        q.targetLocationId === locId ||
        (locCode && q.targetLocationId?.code === locCode)
    );
    return { items: locItems, quests: locQuests };
  };

  const filteredLocations = locations.filter((loc) => {
    if (filterType === "SAFE_DESK") return loc.isSafeDesk;
    if (filterType === "QUESTS") {
      const { quests: q } = getBuildingStats(loc._id, loc.code);
      return q.length > 0;
    }
    if (filterType === "LOST_FOUND") {
      const { items: it } = getBuildingStats(loc._id, loc.code);
      return it.length > 0;
    }
    return true;
  });

  // Handle live pin repositioning from Leaflet drag
  const handleLocationReposition = async (locId: string, coords: { lat: number; lng: number }) => {
    const res = await fetch(`/api/admin/locations/${locId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: coords.lat,
        lng: coords.lng,
        reason: `Admin dragged pin on satellite map to (${coords.lat}, ${coords.lng})`,
      }),
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Failed to update coordinates.");

    setLocations((prev) =>
      prev.map((l) =>
        l._id === locId
          ? { ...l, coordinates: { ...(l.coordinates || {}), lat: coords.lat, lng: coords.lng } }
          : l
      )
    );

    if (selectedLocation?._id === locId) {
      setSelectedLocation((prev: any) => ({
        ...prev,
        coordinates: { ...(prev?.coordinates || {}), lat: coords.lat, lng: coords.lng },
      }));
    }

    showToast(`Updated GPS coordinates to (${coords.lat}, ${coords.lng})!`);
  };

  // Handle modal save
  const handleSaveLocationDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalLoc) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/locations/${editModalLoc._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editModalLoc.name,
          code: editModalLoc.code,
          zoneType: editModalLoc.zoneType,
          description: editModalLoc.description,
          operatingHours: editModalLoc.operatingHours,
          isSafeDesk: editModalLoc.isSafeDesk,
          lat: Number(editModalLoc.coordinates?.lat ?? 15.5948),
          lng: Number(editModalLoc.coordinates?.lng ?? 73.7947),
          reason: "Admin updated location dossier details.",
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Update failed.");

      showToast(`Updated "${editModalLoc.name}" successfully!`);
      setLocations((prev) =>
        prev.map((l) => (l._id === editModalLoc._id ? { ...l, ...editModalLoc } : l))
      );
      setSelectedLocation(editModalLoc);
      setEditModalLoc(null);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-8 space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-2xl font-mono text-xs flex items-center gap-2.5 border transition-all animate-in fade-in slide-in-from-top-4 ${
            toastMessage.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/60 text-emerald-200 shadow-emerald-500/20"
              : "bg-rose-950/90 border-rose-500/60 text-rose-200 shadow-rose-500/20"
          }`}
        >
          {toastMessage.type === "success" ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Tactical Header with Glow */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/20 pb-6 relative">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              AIEM RECON GRID V2.0
            </span>
            <span className="text-xs font-mono text-cyan-400 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "12s" }} />
              HQVW+X2R • Assagao, Goa 403507
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Campus Real Satellite Recon &amp; Safe-Desks</span>
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_#10B981]" />
          </h1>

          <p className="text-sm text-slate-300 max-w-2xl">
            Agnel Technical Educational Complex (AIEM Goa) interactive topological map. Integrated real satellite
            imagery with GPS telemetry, 24/7 verified custody drop-off lockers, and active clue investigation vectors.
          </p>
        </div>

        {/* Tactical Controls & External Navigation */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Admin Edit Mode Button */}
          {isAdminOrStaff && (
            <button
              onClick={() => {
                setAdminEditMode(!adminEditMode);
                showToast(
                  !adminEditMode
                    ? "Admin Mode Active: Drag any pin across the real satellite map to update its exact coordinates."
                    : "Admin Edit Mode Disabled."
                );
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border shadow-lg ${
                adminEditMode
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                  : "bg-slate-900 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{adminEditMode ? "Exit Admin Drag Mode" : "⚡ Admin Drag & Edit Pins"}</span>
            </button>
          )}

          {/* Open Google Maps Direct Link */}
          <a
            href="https://maps.app.goo.gl/mDk3QbPA3JsPMpha6"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/60 transition-all text-xs font-mono font-bold shadow-[0_0_15px_rgba(16,185,129,0.15)] group"
          >
            <Compass className="w-4 h-4 text-emerald-400 group-hover:rotate-45 transition-transform" />
            <span>Google Maps GPS</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          {/* View Mode Switcher: Map vs Accessible Directory List */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode("MAP")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                viewMode === "MAP"
                  ? "bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("LIST")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                viewMode === "LIST"
                  ? "bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 text-xs font-mono overflow-x-auto no-scrollbar">
            {[
              { id: "ALL", label: "All Sectors" },
              { id: "SAFE_DESK", label: "Safe-Desks" },
              { id: "QUESTS", label: "Hunts" },
              { id: "LOST_FOUND", label: "Lost/Found" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                  filterType === f.id
                    ? "bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === "MAP" ? (
        /* Main Map + Info Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Real Satellite Map Surface */}
        <div className="lg:col-span-8 neon-block neon-block-emerald rounded-3xl p-6 border border-emerald-500/30 relative overflow-hidden min-h-[580px] flex flex-col justify-between shadow-[0_0_30px_rgba(16,185,129,0.15)]">
          {/* Top Radar HUD Telemetry */}
          <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-300 z-10 gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-emerald-400 uppercase tracking-wider">
                REAL SATELLITE RADAR ENGINE: AIEM ASSAGAO
              </span>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span className="text-cyan-400">COORDS: 15.5975° N, 73.7943° E</span>
              <button
                onClick={() => setRadarActive(!radarActive)}
                className="text-[11px] px-2 py-0.5 rounded border border-white/20 hover:border-emerald-400 text-slate-300 transition-colors"
              >
                RADAR SWEEP: {radarActive ? "ONLINE" : "STANDBY"}
              </button>
            </div>
          </div>

          {/* Interactive Leaflet Satellite Component */}
          <div className="my-4">
            <CampusRealMap
              locations={filteredLocations}
              selectedLocation={selectedLocation}
              onSelectLocation={setSelectedLocation}
              adminMode={adminEditMode}
              onLocationReposition={handleLocationReposition}
              radarSweepActive={radarActive}
            />
          </div>

          {/* Map Legend Footer */}
          <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 pt-3 border-t border-white/10 gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-3 h-3 rounded-md bg-emerald-500/40 border border-emerald-400 shadow-[0_0_6px_#10B981]" />
                Verified Safe-Desk (24/7 Custody)
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-md bg-slate-800 border border-white/20" />
                Academic / Lab Complex
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shadow-[0_0_8px_#F59E0B]" />
                Active Clue / Investigation
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {adminEditMode
                ? "⚡ Admin Mode: Drag any marker across the satellite map to reposition"
                : "Select any marker or use zoom controls to inspect rooftops"}
            </span>
          </div>
        </div>

        {/* Selected Zone Dossier Drawer */}
        <div className="lg:col-span-4 space-y-4">
          {selectedLocation ? (
            (() => {
              const { items: locItems, quests: locQuests } = getBuildingStats(
                selectedLocation._id,
                selectedLocation.code
              );

              return (
                <div className="neon-block neon-block-cyan rounded-3xl p-6 border border-cyan-500/30 space-y-6 shadow-[0_0_25px_rgba(6,182,212,0.15)]">
                  {/* Zone Header */}
                  <div className="space-y-2 border-b border-white/10 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        {selectedLocation.zoneType || "SECTOR"}
                      </span>
                      <div className="flex items-center gap-2">
                        {adminEditMode && (
                          <button
                            type="button"
                            onClick={() => setEditModalLoc({ ...selectedLocation })}
                            className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono flex items-center gap-1 hover:bg-amber-500/30 transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Node</span>
                          </button>
                        )}
                        <span className="font-mono text-xs text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                          {selectedLocation.code}
                        </span>
                      </div>
                    </div>

                    <h2 className="text-xl font-black text-white tracking-tight">
                      {selectedLocation.name}
                    </h2>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {selectedLocation.description}
                    </p>
                  </div>

                  {/* Zone Telemetry */}
                  <div className="space-y-2.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" /> Hours:
                      </span>
                      <span className="font-semibold text-white">
                        {selectedLocation.operatingHours || "08:30 AM - 05:00 PM"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" /> Levels:
                      </span>
                      <span className="truncate max-w-[170px] text-slate-200">
                        {selectedLocation.floors?.join(", ") || "Ground Floor"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Crosshair className="w-3.5 h-3.5 text-amber-400" /> GPS Coords:
                      </span>
                      <span className="font-semibold text-white">
                        {selectedLocation.coordinates?.lat?.toFixed(5)}° N, {selectedLocation.coordinates?.lng?.toFixed(5)}° E
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-cyan-400" /> Sector Vector:
                      </span>
                      <span className="font-semibold text-emerald-300 text-[11px]">
                        {computeDistance(selectedLocation.coordinates?.lat, selectedLocation.coordinates?.lng)}
                      </span>
                    </div>

                    {selectedLocation.isSafeDesk && (
                      <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <Lock className="w-4 h-4 shrink-0 text-emerald-400" />
                        <div>
                          <div className="font-bold">Official Campus Safe-Desk</div>
                          <div className="text-[11px] text-emerald-400/80">
                            24/7 Verified item check-in &amp; electronic deposit locker.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Quests in this zone */}
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="text-xs font-mono uppercase text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Active Quests ({locQuests.length})</span>
                      </span>
                    </div>

                    {locQuests.length === 0 ? (
                      <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5 text-slate-500 text-xs font-mono text-center">
                        No active quest targets in this sector.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {locQuests.slice(0, 2).map((q) => (
                          <Link
                            key={q._id}
                            href={`/quests/${q._id}`}
                            className="block p-3 rounded-xl bg-slate-900/80 border border-white/10 hover:border-emerald-500/40 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-xs group-hover:text-emerald-300 transition-colors">
                                {q.title}
                              </span>
                              <span className="text-[10px] font-mono text-emerald-400">
                                +{q.xpReward} XP
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                              {q.description}
                            </p>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Active Lost & Found Items in this zone */}
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="text-xs font-mono uppercase text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Reported Items ({locItems.length})</span>
                      </span>
                    </div>

                    {locItems.length === 0 ? (
                      <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5 text-slate-500 text-xs font-mono text-center">
                        Sector is clean. Zero pending items.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {locItems.slice(0, 2).map((it) => (
                          <Link
                            key={it._id}
                            href={`/items/${it._id}`}
                            className="block p-3 rounded-xl bg-slate-900/80 border border-white/10 hover:border-cyan-500/40 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-xs group-hover:text-cyan-300 transition-colors truncate">
                                {it.title}
                              </span>
                              <span
                                className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                                  it.type === "FOUND"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-rose-500/20 text-rose-300"
                                }`}
                              >
                                {it.type || "ITEM"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                              {it.publicDescription}
                            </p>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Action Navigation */}
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono font-bold">
                      <Link
                        href={`/lost-and-found/report-lost?locationId=${selectedLocation._id}`}
                        className="py-2 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 flex items-center justify-center gap-1.5 transition-all text-center shadow-[0_0_10px_rgba(244,63,94,0.15)]"
                      >
                        <Search className="w-3.5 h-3.5 shrink-0" />
                        <span>Report Lost</span>
                      </Link>

                      <Link
                        href={`/lost-and-found/report-found?locationId=${selectedLocation._id}`}
                        className="py-2 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 flex items-center justify-center gap-1.5 transition-all text-center shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                      >
                        <Shield className="w-3.5 h-3.5 shrink-0" />
                        <span>Turn in Found</span>
                      </Link>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/lost-and-found?location=${selectedLocation._id}`}
                        className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>Filter Records</span>
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                      </Link>

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedLocation.coordinates?.lat},${selectedLocation.coordinates?.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-colors"
                        title="Open exact pin in Google Maps"
                      >
                        <ExternalLink className="w-4 h-4 text-cyan-400" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              Select a sector on the map to view reconnaissance telemetry.
            </div>
          )}
        </div>
      </div>
    ) : (
      /* Accessible Campus Directory List View */
      <div className="space-y-6">
        {/* Search & Counter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-2xl p-4 border border-white/10 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-300 font-bold">
              Showing {
                filteredLocations.filter(
                  (loc) =>
                    !listSearch.trim() ||
                    loc.name.toLowerCase().includes(listSearch.toLowerCase()) ||
                    (loc.code || "").toLowerCase().includes(listSearch.toLowerCase()) ||
                    (loc.description || "").toLowerCase().includes(listSearch.toLowerCase())
                ).length
              } of {locations.length} Campus Sectors
            </span>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by sector name or code..."
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        {/* Location Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLocations
            .filter(
              (loc) =>
                !listSearch.trim() ||
                loc.name.toLowerCase().includes(listSearch.toLowerCase()) ||
                (loc.code || "").toLowerCase().includes(listSearch.toLowerCase()) ||
                (loc.description || "").toLowerCase().includes(listSearch.toLowerCase())
            )
            .map((loc) => {
              const { items: locItems, quests: locQuests } = getBuildingStats(loc._id, loc.code);
              return (
                <div
                  key={loc._id}
                  className={`rounded-3xl p-6 border transition-all flex flex-col justify-between group bg-slate-900/60 ${
                    loc.isSafeDesk
                      ? "border-emerald-500/30 hover:border-emerald-500/60 shadow-lg shadow-emerald-950/20"
                      : "border-white/10 hover:border-cyan-500/40 shadow-lg shadow-slate-950/30"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white/5 text-slate-300 border border-white/10">
                        {loc.code}
                      </span>
                      {loc.isSafeDesk && (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-400" />
                          Official Safe-Desk
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors">
                        {loc.name}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {loc.description}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-white/5 text-xs font-mono text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Operating Hours:</span>
                        <span className="text-slate-300">{loc.operatingHours || "08:30 AM - 05:00 PM"}</span>
                      </div>
                      {loc.floors && loc.floors.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span>Floors:</span>
                          <span className="text-slate-300 truncate max-w-[180px] text-right">{loc.floors.join(", ")}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-cyan-400">
                        <span>Coordinates:</span>
                        <span>{loc.coordinates?.lat?.toFixed(4)}° N, {loc.coordinates?.lng?.toFixed(4)}° E</span>
                      </div>
                    </div>

                    {/* Active Quests & Lost/Found Counts */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                      <Link
                        href={`/quests?locationId=${loc._id}`}
                        className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5 hover:border-emerald-500/40 text-center transition-colors block"
                      >
                        <div className="text-xs font-mono font-bold text-emerald-400">{locQuests.length} Quests</div>
                        <div className="text-[10px] font-mono text-slate-500">Active Hunts</div>
                      </Link>
                      <Link
                        href={`/lost-and-found?locationId=${loc._id}`}
                        className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5 hover:border-cyan-500/40 text-center transition-colors block"
                      >
                        <div className="text-xs font-mono font-bold text-cyan-400">{locItems.length} Items</div>
                        <div className="text-[10px] font-mono text-slate-500">Reported</div>
                      </Link>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLocation(loc);
                        setViewMode("MAP");
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>View on Radar</span>
                    </button>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${loc.coordinates?.lat},${loc.coordinates?.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white font-mono text-xs flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Google Maps</span>
                    </a>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    )}

      {/* Admin Location Edit Modal */}
      {editModalLoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-lg w-full bg-[#0B0F17] rounded-3xl border border-white/20 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-mono font-bold text-white">
                  Edit Campus Node: {editModalLoc.code}
                </h3>
              </div>
              <button
                onClick={() => setEditModalLoc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLocationDetails} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-slate-400">Location Name *</label>
                <input
                  type="text"
                  required
                  value={editModalLoc.name}
                  onChange={(e) => setEditModalLoc({ ...editModalLoc, name: e.target.value })}
                  className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400">Code (Unique)</label>
                  <input
                    type="text"
                    required
                    value={editModalLoc.code}
                    onChange={(e) => setEditModalLoc({ ...editModalLoc, code: e.target.value })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Zone Type</label>
                  <select
                    value={editModalLoc.zoneType}
                    onChange={(e) => setEditModalLoc({ ...editModalLoc, zoneType: e.target.value })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  >
                    <option value="ACADEMIC_BLOCK">Academic Block</option>
                    <option value="SAFE_DESK">Safe-Desk Station</option>
                    <option value="LIBRARY">Central Library</option>
                    <option value="CANTEEN">Campus Canteen</option>
                    <option value="SPORTS">Sports Arena</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={editModalLoc.description || ""}
                  onChange={(e) => setEditModalLoc({ ...editModalLoc, description: e.target.value })}
                  className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400">Operating Hours</label>
                  <input
                    type="text"
                    value={editModalLoc.operatingHours || ""}
                    onChange={(e) => setEditModalLoc({ ...editModalLoc, operatingHours: e.target.value })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400">GPS Coordinates (Lat • Lng)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      value={editModalLoc.coordinates?.lat ?? 15.5948}
                      onChange={(e) =>
                        setEditModalLoc({
                          ...editModalLoc,
                          coordinates: { ...(editModalLoc.coordinates || {}), lat: Number(e.target.value) },
                        })
                      }
                      className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-2 py-2 text-white text-xs font-mono"
                      placeholder="Latitude"
                    />
                    <input
                      type="number"
                      step="any"
                      value={editModalLoc.coordinates?.lng ?? 73.7947}
                      onChange={(e) =>
                        setEditModalLoc({
                          ...editModalLoc,
                          coordinates: { ...(editModalLoc.coordinates || {}), lng: Number(e.target.value) },
                        })
                      }
                      className="w-full bg-[#070A0F] border border-white/10 rounded-xl px-2 py-2 text-white text-xs font-mono"
                      placeholder="Longitude"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="modalSafeDesk"
                  checked={editModalLoc.isSafeDesk || false}
                  onChange={(e) => setEditModalLoc({ ...editModalLoc, isSafeDesk: e.target.checked })}
                  className="rounded bg-slate-900 border-white/20 text-emerald-400 focus:ring-0"
                />
                <label htmlFor="modalSafeDesk" className="text-slate-300 text-xs">
                  Official Campus Safe-Desk (24/7 Custody Drop-Off Locker)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditModalLoc(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25"
                >
                  <Save className="w-4 h-4" />
                  <span>{actionLoading ? "Saving..." : "Save Location"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
