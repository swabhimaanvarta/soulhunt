"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Compass, Radio, Check, Move, Minimize2, Maximize2, Navigation } from "lucide-react";

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
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [localRadarSweep, setLocalRadarSweep] = useState(radarSweepActive);
  const [repositioningId, setRepositioningId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userLocationMarker, setUserLocationMarker] = useState<L.Marker | null>(null);

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(CAMPUS_CENTER, 18, { animate: true, duration: 0.8 });
    setStatusNotice("Radar recentered on AIEM Assagao Campus (15.5948° N, 73.7947° E)");
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

  // 1. Initialize Leaflet Map with smooth zooming and verified satellite imagery
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

    // Esri Aerial Imagery with maxNativeZoom: 18 so zoom 19 & 20 upscale smoothly without failing
    const aerialTileLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "&copy; Esri &mdash; Earthstar Geographics Aerial Recon",
        maxZoom: 20,
        maxNativeZoom: 18,
        subdomains: ["a", "b", "c", "d"],
      }
    ).addTo(map);

    tileLayerRef.current = aerialTileLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render and Synchronize Location Markers with Theme-Matching Tactical Teardrop Pins
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

      // Theme-matching colors
      let markerColor = "#10B981"; // emerald default
      let glyph = "🏛️";
      if (loc.isSafeDesk) {
        markerColor = "#10B981";
        glyph = "🛡️";
      } else if (loc.zoneType === "CANTEEN") {
        markerColor = "#F59E0B";
        glyph = "☕";
      } else if (loc.zoneType === "SPORTS") {
        markerColor = "#22C55E";
        glyph = "⚽";
      } else if (loc.code?.includes("COMP") || loc.code?.includes("AI")) {
        markerColor = "#06B6D4";
        glyph = "⚡";
      } else if (loc.code?.includes("ECE")) {
        markerColor = "#8B5CF6";
        glyph = "📡";
      } else if (loc.code?.includes("MECH")) {
        markerColor = "#F97316";
        glyph = "⚙️";
      } else if (loc.zoneType === "LIBRARY") {
        markerColor = "#38BDF8";
        glyph = "📚";
      }

      if (isSelected) {
        markerColor = "#F43F5E"; // rose-red focus
      }

      // Cyberpunk teardrop pointer pin with exact bottom needle anchor
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
          <div class="relative flex items-center justify-center w-9 h-9 rounded-2xl bg-slate-950/95 border-2 shadow-2xl transition-all" style="border-color: ${markerColor}; box-shadow: 0 0 16px ${markerColor}90;">
            <span class="text-sm select-none">${glyph}</span>
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

      const lat = loc.coordinates?.lat || 15.5948;
      const lng = loc.coordinates?.lng || 73.7947;

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
    const lat = selectedLocation.coordinates?.lat || 15.5948;
    const lng = selectedLocation.coordinates?.lng || 73.7947;

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

        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center gap-1 px-2 py-1 rounded-lg font-bold bg-slate-900 border border-white/20 text-slate-200 hover:text-white hover:border-white/40 transition-all text-xs font-mono"
          title={isFullscreen ? "Exit Fullscreen" : "Expand to Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-amber-400" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-300" />}
          <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Expand"}</span>
        </button>

        <div className="w-[1px] h-4 bg-white/20 mx-0.5 hidden sm:block" />

        <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-xs">
          <span>Aerial Satellite</span>
        </div>
      </div>

      {/* GPS Location Telemetry Badge (Bottom Left - Non-overlapping) */}
      <div className="absolute bottom-3 left-3 z-20 font-mono text-[10px] text-cyan-300 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-cyan-500/40 backdrop-blur-md shadow-lg hidden sm:flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <span>AIEM CAMPUS: 15.5948° N, 73.7947° E • ASSAGAO GOA</span>
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
