import React from "react";
import { Compass } from "lucide-react";

export default function MapLoading() {
  return (
    <div className="relative w-full h-[calc(100vh-140px)] bg-[#070A0F] flex flex-col items-center justify-center overflow-hidden">
      {/* Tactical radar scanner circles */}
      <div className="relative flex items-center justify-center">
        <div className="w-72 h-72 rounded-full border border-emerald-500/10 animate-ping" />
        <div className="absolute w-48 h-48 rounded-full border border-emerald-500/20 border-t-emerald-400 animate-spin" />
        <div className="absolute flex flex-col items-center justify-center space-y-3 font-mono">
          <Compass className="w-8 h-8 text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-white tracking-widest uppercase">
            CALIBRATING SATELLITE RADAR
          </span>
          <span className="text-[10px] text-slate-500">
            Fetching Assagao campus zone coordinates & Safe-Desk telemetry...
          </span>
        </div>
      </div>
    </div>
  );
}

