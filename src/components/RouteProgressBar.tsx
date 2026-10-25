"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentPathRef = useRef(pathname);

  useEffect(() => {
    currentPathRef.current = pathname;
  }, [pathname]);

  // Complete loading when pathname or searchParams change
  useEffect(() => {
    if (loading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  const startProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setLoading(true);
    setProgress(15);

    let current = 15;
    timerRef.current = setInterval(() => {
      current += Math.random() * 18;
      if (current >= 85) {
        current = 85;
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setProgress(current);
    }, 120);
  };

  useEffect(() => {
    // Expose helper on window for programmatic router.push calls
    (window as any).__startRouteLoading = startProgress;

    const handleClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external, hash, target blank, or mailto
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#") ||
        target.getAttribute("target") === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      // Check if it's the exact same page
      const currentFull = window.location.pathname + window.location.search;
      if (href === currentFull || href === currentPathRef.current) {
        return;
      }

      // Start instant loading feedback!
      startProgress();
    };

    const handlePopState = () => {
      startProgress();
    };

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none transition-opacity duration-200"
      style={{ opacity: loading || progress === 100 ? 1 : 0 }}
      aria-hidden="true"
    >
      {/* Top glowing progress bar */}
      <div
        className="h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(16,185,129,0.9)] transition-all ease-out duration-200"
        style={{ width: `${progress}%` }}
      />

      {/* Tactical radar pulse badge in top-right corner */}
      <div className="absolute top-2 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-emerald-500/40 text-[10px] font-mono text-emerald-400 shadow-lg shadow-emerald-500/20 backdrop-blur-md animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        <span>RECON SYNCING...</span>
      </div>
    </div>
  );
}

