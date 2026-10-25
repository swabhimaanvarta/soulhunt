import React, { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import MobileBottomNav from "@/components/MobileBottomNav";
import Footer from "@/components/Footer";
import RouteProgressBar from "@/components/RouteProgressBar";
import { Toaster } from "@/components/ui/toaster";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0B0F17",
};

export const metadata: Metadata = {
  title: "AIEM Hunt — Lost & Found & Campus Treasure Hunt | AIEM - Agnel Institute of Engineering and Management",
  description:
    "Official campus lost-and-found investigation platform and cooperative treasure hunt RPG for AIEM - Agnel Institute of Engineering and Management.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.ico",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark max-w-full overflow-x-hidden">
      <body className="bg-[#0B0F17] text-slate-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950 tactical-grid pb-28 md:pb-0 w-full max-w-full overflow-x-hidden">
        <Suspense fallback={null}>
          <RouteProgressBar />
        </Suspense>
        <Navbar />
        <main className="flex-1 w-full max-w-full overflow-x-hidden pt-16">{children}</main>
        <MobileBottomNav />
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}

