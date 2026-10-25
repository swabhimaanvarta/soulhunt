"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Layers, Compass, Radio, Check, Move, AlertCircle, Crosshair, Maximize2, Minimize2, Navigation } from "lucide-react";

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

export type ImageryLayerType = "ESRI_SATELLITE" | "CARTO_DARK";

export const TILE_LAYERS: Record<ImageryLayerType, { url: string; attribution: string; maxZoom: number }> = {
  ESRI_SATELLITE: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri &mdash; Earthstar Geographics (Imagery without commercial labels)",
    maxZoom: 19,
  },
  CARTO_DARK: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO Tactical Basemap",
    maxZoom: 19,
  },
};

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

  // Default to pure ESRI imagery (no unofficial Google tiles or commercial clutter)
  const [imageryType, setImageryType] = useState<ImageryLayerType>("ESRI_SATELLITE");
  const [localRadarSweep, setLocalRadarSweep] = useState(radarSweepActive);
  const [repositioningId, setRepositioningId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userLocationMarker, setUserLocationMarker] = useState<L.Marker | null>(null);

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(CAMPUS_CENTER, 18, { animate: true, duration: 0.8 });
    setStatusNotice("Radar recentered on AIEM Assagao Campus Hub");
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

        // Verify position is within campus bounds
        const campusBounds = L.latLngBounds(CAMPUS_BOUNDS_COORDS[0], CAMPUS_BOUNDS_COORDS[1]);
        const userLatLng = L.latLng(latitude, longitude);

        const userHtml = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-cyan-400/30 animate-ping"></span>
            <span class="w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_#22D3EE]"></span>
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

        if (campusBounds.contains(userLatLng)) {
          mapInstanceRef.current.flyTo([latitude, longitude], 18, { animate: true, duration: 1 });
        } else {
          setStatusNotice(`Local GPS locked: Coordinates are outside campus perimeter.`);
          setTimeout(() => setStatusNotice(null), 4000);
          return;
        }

        setStatusNotice(`Local GPS lock: ±${Math.round(accuracy)}m (Not transmitted)`);
        setTimeout(() => setStatusNotice(null), 4000);
      },
      (err) => {
        setStatusNotice(`GPS signal unavailable: ${err.message}`);
        setTimeout(() => setStatusNotice(null), 3500);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // 1. Initialize Leaflet Map with strict campus bounds and zoom limits
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const bounds = L.latLngBounds(CAMPUS_BOUNDS_COORDS[0], CAMPUS_BOUNDS_COORDS[1]);

    const map = L.map(mapContainerRef.current, {
      center: CAMPUS_CENTER,
      zoom: 18,
      minZoom: 16,
      maxZoom: 19,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0, // Strictly locks map to campus bounds
      zoomControl: true,
      attributionControl: true,
    });

    const activeConfig = TILE_LAYERS.ESRI_SATELLITE;
    const initialTileLayer = L.tileLayer(activeConfig.url, {
      attribution: activeConfig.attribution,
      maxZoom: activeConfig.maxZoom,
      subdomains: ["a", "b", "c", "d"],
    }).addTo(map);

    tileLayerRef.current = initialTileLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Handle Layer Switching
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const config = TILE_LAYERS[imageryType];
    const newLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      subdomains: ["a", "b", "c", "d"],
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [imageryType]);

  // 3. Render and Synchronize Location Markers
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
      const isRepositioning = repositioningId === loc._id;

      let markerColor = "#10B981"; // emerald default
      if (loc.isSafeDesk) markerColor = "#06B6D4"; // cyan
      if (loc.zoneType === "CANTEEN") markerColor = "#F59E0B"; // amber
      if (loc.zoneType === "HOSTEL") markerColor = "#8B5CF6"; // violet
      if (loc.zoneType === "LIBRARY") markerColor = "#3B82F6"; // blue
      if (isSelected) markerColor = "#F43F5E"; // rose when selected

      const iconHtml = `
        <div class="relative flex items-center justify-center transition-transform ${isSelected ? "scale-125 z-50" : "scale-100"}">
          ${
            loc.isSafeDesk
              ? `<span class="absolute w-10 h-10 rounded-full animate-ping opacity-30" style="background-color: ${markerColor};"></span>`
              : ""
          }
          <div class="w-8 h-8 rounded-full border-2 border-white shadow-2xl flex items-center justify-center font-mono font-bold text-xs text-white" style="background-color: ${markerColor}; box-shadow: 0 0 15px ${markerColor}80;">
            ${loc.isSafeDesk ? "🛡️" : loc.code.slice(0, 3)}
          </div>
          ${
            (loc.itemCount ?? 0) > 0
              ? `<span class="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-bold font-mono text-[9px] px-1 rounded-full border border-black">${loc.itemCount}</span>`
              : ""
          }
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "custom-radar-marker",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
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
          `<div style="font-family: monospace; font-size: 11px; font-weight: bold; color: white; background: #070A0F; padding: 4px 8px; border-radius: 8px; border: 1px solid ${markerColor};">
            ${loc.isSafeDesk ? "🛡️ " : ""}${loc.name} (${loc.code})
          </div>`,
          { direction: "top", offset: [0, -16], opacity: 0.95 }
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

  // 4. Focus when selectedLocation changes
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
      {/* Map Container */}
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
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-white/10 shadow-xl">
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

        <button
          onClick={() => setImageryType("ESRI_SATELLITE")}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold transition-all text-xs ${
            imageryType === "ESRI_SATELLITE"
              ? "bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
              : "text-slate-400 hover:text-white"
          }`}
          title="Esri Pure Aerial Satellite Imagery (No commercial labels)"
        >
          <span>Aerial Imagery</span>
        </button>

        <button
          onClick={() => setImageryType("CARTO_DARK")}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold transition-all text-xs ${
            imageryType === "CARTO_DARK"
              ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(139,92,246,0.4)]"
              : "text-slate-400 hover:text-white"
          }`}
          title="Tactical Dark Cyber Basemap"
        >
          <span>Dark Grid</span>
        </button>
      </div>

      {/* GPS Location Telemetry Badge (Top Left - Desktop/Tablet) */}
      <div className="absolute top-3 left-3 z-20 font-mono text-[10px] text-cyan-300 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-cyan-500/40 backdrop-blur-md shadow-lg hidden md:flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <span>AIEM CAMPUS: 15.5948° N, 73.7947° E • ASSAGAO GOA</span>
      </div>

      {/* Admin Drag Notice Badge */}
      {adminMode && (
        <div className="absolute bottom-4 left-4 z-20 font-mono text-xs bg-amber-500/20 text-amber-200 border-2 border-amber-400/70 px-3 py-1.5 rounded-xl backdrop-blur-md shadow-xl flex items-center gap-2 animate-pulse">
          <Move className="w-4 h-4 text-amber-400" />
          <span>
            <strong>ADMIN MODE:</strong> Pins are draggable. Drag any pin to its exact rooftop or entrance to update.
          </span>
        </div>
      )}

      {/* Status Notice Toast */}
      {statusNotice && (
        <div className="absolute bottom-4 right-4 z-30 font-mono text-xs bg-emerald-950/95 text-emerald-200 border border-emerald-500/60 px-4 py-2 rounded-xl backdrop-blur-md shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{statusNotice}</span>
        </div>
      )}
    </div>
  );
}
