"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  PlusCircle,
  Shield,
  MapPin,
  Clock,
  Filter,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function LostAndFoundDirectoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL"); // ALL, LOST, FOUND
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    { key: "ALL", label: "All Items" },
    { key: "ELECTRONICS", label: "Electronics" },
    { key: "ID_CARDS_DOCS", label: "ID Cards & Docs" },
    { key: "BOOKS_NOTES", label: "Books & Notes" },
    { key: "ACCESSORIES", label: "Accessories" },
    { key: "BAGS_WALLETS", label: "Bags & Wallets" },
    { key: "KEYS", label: "Keys" },
    { key: "LAB_GEAR", label: "Lab Gear" },
    { key: "OTHER", label: "Other" },
  ];

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.append("type", typeFilter);
      if (categoryFilter !== "ALL") params.append("category", categoryFilter);
      if (locationFilter !== "ALL") params.append("locationId", locationFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/items?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => d.success && setLocations(d.data || []));
  }, []);

  useEffect(() => {
    fetchItems();
  }, [typeFilter, categoryFilter, locationFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              CAMPUS DIRECTORY
            </span>
            <span className="text-xs font-mono text-slate-400">
              {items.length} Active Records
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Campus Lost & Found Hub
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Browse and filter reported lost belongings and items turned in to AIEM Safe-Desks. All records protect student privacy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/lost-and-found/report-lost"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Report Lost
          </Link>
          <Link
            href="/lost-and-found/report-found"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/10 font-bold text-xs transition-all"
          >
            <Shield className="w-4 h-4 text-cyan-400" />
            Turn in Found
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <form
            onSubmit={handleSearchSubmit}
            className="md:col-span-5 relative flex items-center"
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3" />
            <input
              type="text"
              placeholder="Search by title, description, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
            />
          </form>

          {/* Type Toggle */}
          <div className="md:col-span-3 flex rounded-xl bg-slate-950/80 p-1 border border-white/10 text-xs font-mono">
            {["ALL", "LOST", "FOUND"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`flex-1 py-1 rounded-lg text-center font-bold transition-all ${
                  typeFilter === t
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t === "ALL" ? "All" : t === "LOST" ? "Lost" : "Found"}
              </button>
            ))}
          </div>

          {/* Location Select */}
          <div className="md:col-span-4">
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-slate-950/80 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">All Campus Locations</option>
              {locations.map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name} {loc.isSafeDesk ? "★ (Safe-Desk)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategoryFilter(c.key)}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-mono transition-all ${
                categoryFilter === c.key
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                  : "bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="py-20 text-center font-mono text-slate-500 text-xs animate-pulse">
          SCANNING CAMPUS RECORDS...
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-4">
          <Shield className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No items found matching criteria</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try adjusting your search terms, campus location filter, or category selection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const isLost = item.itemType === "LOST";
            const location = isLost
              ? item.lastKnownLocationId
              : item.foundLocationId;
            const custody = item.currentCustodyLocationId;

            return (
              <div
                key={item._id}
                className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isLost
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {item.itemType}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {item.publicDescription}
                  </p>

                  {/* Spot and Location Details */}
                  <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs font-mono text-slate-300">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">
                        {location?.name || "Campus Area"}
                      </span>
                    </div>

                    {custody?.isSafeDesk && (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                        <Lock className="w-3 h-3 shrink-0" />
                        <span>Secured at {custody.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-slate-400">
                    Status: <span className="text-white font-bold">{item.status}</span>
                  </span>

                  <Link
                    href={`/items/${item._id}`}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1 transition-all ${
                      isLost
                        ? "bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
                        : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {isLost ? "I Found This" : "Claim Item"}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

