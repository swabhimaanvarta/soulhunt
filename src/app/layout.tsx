import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { ShieldCheck, Lock, Compass, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "AIEM Hunt — Lost & Found & Campus Treasure Hunt",
  description:
    "Tactical campus lost-and-found investigation platform and campus treasure hunt RPG for AIEM.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0B0F17] text-slate-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950 tactical-grid pb-20 md:pb-0">
        <Navbar />
        <main className="flex-1">{children}</main>
        <MobileBottomNav />
        
        {/* Tactical Ethical Footer */}
        <footer className="border-t border-white/10 bg-[#070A0F] py-8 px-4 sm:px-6 lg:px-8 mt-16 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 text-slate-300 font-mono font-bold">
                <Compass className="w-4 h-4 text-emerald-400" />
                <span>AIEM Lost & Found & Campus Treasure Hunt V1.0</span>
              </div>
              <p className="text-slate-400 max-w-xl">
                Strict Ethical Safety Standard: All belongings remain campus property under custody of AIEM Security Safe-Desks.
                No student may conceal, relocate, or withhold any found article.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-400/90">
                <ShieldCheck className="w-3.5 h-3.5" />
                Anti-Collusion Engine Active
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400/90">
                <Lock className="w-3.5 h-3.5" />
                Dual-Code Handover Protocol
              </span>
              <span className="text-slate-500">
                Safe-Desk Help: Main Gate Locker #1 • Library Counter
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

