"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import { Compass, Radio, Check, Move, Minimize2, Maximize2, Navigation, Layers } from "lucide-react";

export interface CampusLocationPoint {
  _id: string;
  name: string;
  code: string;
  zoneType: string;
  description?: string;
  coordinates: {
    lat: number;
    lng: number;
    mapX?: number;
    mapY?: number;
  };
  floors?: string[];
  isSafeDesk: boolean;
  operatingHours?: string;
  color?: string;
  itemCount?: number;
  questCount?: number;
}

export interface MapSurfacePin {
  id: string;
  name: string;
  code: string;
  zoneType: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  isSafeDesk: boolean;
  operatingHours?: string;
}

export interface MapSurface {
  getCenter(): { lat: number; lng: number };
  recenter(): void;
  calibrateCoordsToSurface(lat: number, lng: number): { mapX: number; mapY: number };
}

interface CampusRealMapProps {
  locations: CampusLocationPoint[];
  selectedLocation: CampusLocationPoint | null;
  onSelectLocation: (loc: CampusLocationPoint) => void;
  adminMode?: boolean;
  onLocationReposition?: (locId: string, coords: { lat: number; lng: number }) => Promise<void>;
  radarSweepActive?: boolean;
}

export { CAMPUS_CENTER, CAMPUS_BOUNDS_COORDS } from "@/lib/campus-constants";
import { CAMPUS_CENTER, CAMPUS_BOUNDS_COORDS } from "@/lib/campus-constants";

export function calibrateCoordsToSurface(lat: number, lng: number): { mapX: number; mapY: number } {
  const minLat = CAMPUS_BOUNDS_COORDS[0][0];
  const maxLat = CAMPUS_BOUNDS_COORDS[1][0];
  const minLng = CAMPUS_BOUNDS_COORDS[0][1];
  const maxLng = CAMPUS_BOUNDS_COORDS[1][1];

  const mapX = Math.max(0, Math.min(100, ((lng - minLng) / (maxLng - minLng)) * 100));
  const mapY = Math.max(0, Math.min(100, ((maxLat - lat) / (maxLat - minLat)) * 100));

  return {
    mapX: Math.round(mapX * 10) / 10,
    mapY: Math.round(mapY * 10) / 10,
  };
}

// Vector SVG markup for tactical cyberpunk pins (no cartoon emojis)
function getTacticalSvgIcon(zoneType: string, code: string, isSafeDesk: boolean, markerColor: string): string {
  if (isSafeDesk) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${markerColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  }
  if (zoneType === "CANTEEN") {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${markerColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`;
  }
  if (zoneType === "SPORTS") {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${markerColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
  }
  if (code?.includes("COMP") || code?.includes("AI")) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${markerColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>`;
  }
  if (code?.includes("ECE")) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${markerColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19.1"/></svg>`;
  }
  if (code?.includes("MECH")) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${markerColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  }
  if (zoneType === "LIBRARY") {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${markerColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${markerColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/></svg>`;
}

export default function CampusRealMap({
  locations,
  selectedLocation,
  onSelectLocation,
  adminMode = false,
  onLocationReposition,
  radarSweepActive = true,
}: CampusRealMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapTheme, setMapTheme] = useState<"dark" | "satellite">("dark");
  const [localRadarSweep, setLocalRadarSweep] = useState(radarSweepActive);
  const [repositioningId, setRepositioningId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userLocationMarker, setUserLocationMarker] = useState<L.Marker | null>(null);

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(CAMPUS_CENTER, 18, { animate: true, duration: 0.8 });
    setStatusNotice("Radar recentered on AIEM Assagao Campus (15.5975° N, 73.7943° E)");
    setTimeout(() => setStatusNotice(null), 2500);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 200);
      return next;
    });
  };

  const handleLocateMe = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatusNotice("Geolocation is not supported by your browser");
      setTimeout(() => setStatusNotice(null), 3000);
      return;
    }
    setStatusNotice("Locking local GPS position (one-shot, never uploaded)...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!mapInstanceRef.current) return;

        const userHtml = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-cyan-400/40 animate-ping"></span>
            <span class="w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_14px_#22D3EE]"></span>
          </div>
        `;
        const userIcon = L.divIcon({
          html: userHtml,
          className: "user-gps-marker",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        if (userLocationMarker) {
          mapInstanceRef.current.removeLayer(userLocationMarker);
        }

        const marker = L.marker([latitude, longitude], { icon: userIcon }).addTo(mapInstanceRef.current);
        marker.bindTooltip(
          `<div style="font-family:monospace;font-size:11px;font-weight:bold;color:#22D3EE;background:#070A0F;padding:4px 8px;border-radius:8px;border:1px solid #22D3EE;">Local Position (Approx ±${Math.round(accuracy)}m)</div>`,
          { direction: "top", offset: [0, -12], opacity: 0.95 }
        ).openTooltip();

        setUserLocationMarker(marker);

        mapInstanceRef.current.flyTo([latitude, longitude], 18, { animate: true, duration: 1 });
        setStatusNotice(`Local GPS lock: ±${Math.round(accuracy)}m`);
        setTimeout(() => setStatusNotice(null), 4000);
      },
      (err) => {
        setStatusNotice(`GPS signal unavailable: ${err.message}`);
        setTimeout(() => setStatusNotice(null), 3500);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // Helper to attach appropriate tile layer based on mapTheme
  const applyTileLayer = useCallback((map: L.Map, theme: "dark" | "satellite") => {
    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
      activeTileLayerRef.current = null;
    }

    let layer: L.TileLayer;
    if (theme === "dark") {
      // CartoDB Dark Matter with smooth high-resolution scaling up to zoom 20
      layer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
          maxZoom: 20,
          maxNativeZoom: 19,
          subdomains: ["a", "b", "c", "d"],
        }
      );
    } else {
      // Esri Satellite Recon with maxNativeZoom: 17 so deep zooming (18, 19, 20) smoothly upscales without blank tile errors
      layer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "&copy; Esri &mdash; Earthstar Geographics Aerial Recon",
          maxZoom: 20,
          maxNativeZoom: 17,
        }
      );
    }

    layer.addTo(map);
    activeTileLayerRef.current = layer;
  }, []);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: CAMPUS_CENTER,
      zoom: 18,
      minZoom: 15,
      maxZoom: 20,
      zoomControl: true,
      attributionControl: true,
    });

    applyTileLayer(map, mapTheme);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [applyTileLayer, mapTheme]);

  // Handle mapTheme toggle dynamically
  const toggleMapTheme = () => {
    const nextTheme = mapTheme === "dark" ? "satellite" : "dark";
    setMapTheme(nextTheme);
    if (mapInstanceRef.current) {
      applyTileLayer(mapInstanceRef.current, nextTheme);
      setStatusNotice(nextTheme === "dark" ? "Tactical Dark Vector Surface Active" : "Aerial Satellite Recon Active");
      setTimeout(() => setStatusNotice(null), 2500);
    }
  };

  // 2. Render and Synchronize Location Markers with Sleek Theme-Matching Tactical SVG Pins
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear removed markers
    const currentLocIds = new Set(locations.map((l) => l._id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentLocIds.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    locations.forEach((loc) => {
      const isSelected = selectedLocation?._id === loc._id;

      // Theme-matching colors (emerald, amber, cyan, violet, orange, sky)
      let markerColor = "#10B981"; // emerald default
      if (loc.isSafeDesk) {
        markerColor = "#10B981";
      } else if (loc.zoneType === "CANTEEN") {
        markerColor = "#F59E0B";
      } else if (loc.zoneType === "SPORTS") {
        markerColor = "#22C55E";
      } else if (loc.code?.includes("COMP") || loc.code?.includes("AI")) {
        markerColor = "#06B6D4";
      } else if (loc.code?.includes("ECE")) {
        markerColor = "#8B5CF6";
      } else if (loc.code?.includes("MECH")) {
        markerColor = "#F97316";
      } else if (loc.zoneType === "LIBRARY") {
        markerColor = "#38BDF8";
      }

      if (isSelected) {
        markerColor = "#F43F5E"; // rose-red focus
      }

      const svgIconMarkup = getTacticalSvgIcon(loc.zoneType, loc.code, loc.isSafeDesk, markerColor);

      // Cyberpunk teardrop tactical pin with exact needle anchor tip and no emojis
      const iconHtml = `
        <div class="relative flex flex-col items-center cursor-pointer transition-transform duration-200 ${
          isSelected ? "scale-125 z-50 -translate-y-1" : "scale-100 hover:scale-110"
        }">
          ${
            loc.isSafeDesk
              ? `<span class="absolute -top-1 w-11 h-11 rounded-full animate-ping opacity-35" style="background-color: ${markerColor};"></span>`
              : ""
          }
          <!-- Tactical HUD Pin Badge -->
          <div class="relative flex items-center justify-center w-9 h-9 rounded-2xl bg-slate-950/95 border-2 shadow-2xl transition-all" style="border-color: ${markerColor}; box-shadow: 0 0 16px ${markerColor}80;">
            <div class="flex items-center justify-center select-none">
              ${svgIconMarkup}
            </div>
            ${
              (loc.itemCount ?? 0) > 0
                ? `<span class="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 font-black font-mono text-[9px] px-1.5 py-0.2 rounded-full border border-black shadow-md">${loc.itemCount}</span>`
                : ""
            }
          </div>
          <!-- Sharp Downward Pointing Needle for Exact Campus Pinning -->
          <div class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] -mt-0.5" style="border-top-color: ${markerColor};"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "custom-cyber-pin",
        iconSize: [36, 44],
        iconAnchor: [18, 42], // Exact bottom needle tip
      });

      const lat = loc.coordinates?.lat || CAMPUS_CENTER[0];
      const lng = loc.coordinates?.lng || CAMPUS_CENTER[1];

      if (!markersRef.current[loc._id]) {
        const marker = L.marker([lat, lng], {
          icon: customIcon,
          draggable: adminMode,
        }).addTo(map);

        marker.on("click", () => {
          onSelectLocation(loc);
        });

        marker.on("dragend", async (e: any) => {
          const newPos = e.target.getLatLng();
          setRepositioningId(loc._id);
          setStatusNotice(`Updating coordinates for ${loc.name}...`);
          try {
            if (onLocationReposition) {
              await onLocationReposition(loc._id, { lat: newPos.lat, lng: newPos.lng });
              setStatusNotice(`Location updated: ${loc.name} -> ${newPos.lat.toFixed(5)}, ${newPos.lng.toFixed(5)}`);
            }
          } catch (err: any) {
            setStatusNotice(`Reposition failed: ${err.message}`);
            marker.setLatLng([lat, lng]); // revert
          } finally {
            setRepositioningId(null);
            setTimeout(() => setStatusNotice(null), 3000);
          }
        });

        marker.bindTooltip(
          `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; font-weight: bold; color: #F1F5F9; background: rgba(11, 15, 23, 0.95); padding: 5px 9px; border-radius: 10px; border: 1px solid ${markerColor}; box-shadow: 0 4px 20px rgba(0,0,0,0.6);">
            ${loc.isSafeDesk ? "🛡️ " : ""}${loc.name} <span style="color: ${markerColor};">(${loc.code})</span>
          </div>`,
          { direction: "top", offset: [0, -42], opacity: 0.98 }
        );

        markersRef.current[loc._id] = marker;
      } else {
        const existingMarker = markersRef.current[loc._id];
        existingMarker.setIcon(customIcon);
        existingMarker.setLatLng([lat, lng]);
        if (existingMarker.dragging) {
          if (adminMode) {
            existingMarker.dragging.enable();
          } else {
            existingMarker.dragging.disable();
          }
        }
      }
    });
  }, [locations, selectedLocation, adminMode, repositioningId, onLocationReposition, onSelectLocation]);

  // 3. Focus when selectedLocation changes
  useEffect(() => {
    if (!selectedLocation || !mapInstanceRef.current) return;
    const lat = selectedLocation.coordinates?.lat || CAMPUS_CENTER[0];
    const lng = selectedLocation.coordinates?.lng || CAMPUS_CENTER[1];

    mapInstanceRef.current.flyTo([lat, lng], 19, {
      animate: true,
      duration: 1,
    });

    const m = markersRef.current[selectedLocation._id];
    if (m) {
      m.openTooltip();
    }
  }, [selectedLocation]);

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl transition-all duration-300 ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none h-screen w-screen" : "h-[450px] md:h-[550px] lg:h-[620px]"
      }`}
    >
      {/* Map Surface Container */}
      <div ref={mapContainerRef} className="w-full h-full bg-[#070A0F]" />

      {/* Futuristic Radar Sweep Overlay */}
      {localRadarSweep && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 opacity-30">
          <div
            className="w-[200%] h-[200%] absolute -top-1/2 -left-1/2 bg-gradient-to-tr from-emerald-500/10 via-transparent to-transparent rounded-full animate-spin"
            style={{ animationDuration: "8s" }}
          />
        </div>
      )}

      {/* Floating Tactical Overlay Controls (Top Right) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-white/10 shadow-xl">
        <button
          type="button"
          onClick={handleRecenter}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 font-bold transition-all text-xs font-mono"
          title="Recenter Camera on AIEM Campus"
        >
          <Compass className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Recenter</span>
        </button>

        <button
          type="button"
          onClick={handleLocateMe}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 font-bold transition-all text-xs font-mono"
          title="Approximate Local GPS (One-shot • Not Uploaded)"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">My GPS</span>
        </button>

        <button
          type="button"
          onClick={() => setLocalRadarSweep(!localRadarSweep)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold transition-all text-xs font-mono ${
            localRadarSweep
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "text-slate-400 hover:text-white"
          }`}
          title="Toggle Radar Sweep Beam"
        >
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Radar</span>
        </button>

        {/* Toggle between Tactical Dark and Satellite Layer */}
        <button
          type="button"
          onClick={toggleMapTheme}
          className="flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-xs font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-all"
          title="Toggle Map Surface: Tactical Dark / Satellite Recon"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">{mapTheme === "dark" ? "Dark Grid" : "Satellite"}</span>
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center gap-1 px-2 py-1 rounded-lg font-bold bg-slate-900 border border-white/20 text-slate-200 hover:text-white hover:border-white/40 transition-all text-xs font-mono"
          title={isFullscreen ? "Exit Fullscreen" : "Expand to Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-amber-400" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-300" />}
          <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Expand"}</span>
        </button>
      </div>

      {/* Admin Drag Notice Badge */}
      {adminMode && (
        <div className="absolute bottom-12 left-3 z-20 font-mono text-xs bg-amber-500/20 text-amber-200 border-2 border-amber-400/70 px-3 py-1.5 rounded-xl backdrop-blur-md shadow-xl flex items-center gap-2 animate-pulse">
          <Move className="w-4 h-4 text-amber-400" />
          <span>
            <strong>ADMIN MODE:</strong> Drag any pin to its exact rooftop or entrance to update.
          </span>
        </div>
      )}

      {/* Status Notice Toast */}
      {statusNotice && (
        <div className="absolute bottom-3 right-3 z-30 font-mono text-xs bg-emerald-950/95 text-emerald-200 border border-emerald-500/60 px-4 py-2 rounded-xl backdrop-blur-md shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{statusNotice}</span>
        </div>
      )}
    </div>
  );
}
