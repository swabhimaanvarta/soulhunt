"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
  X,
  RotateCcw,
  Loader2,
  Tag,
  Building,
} from "lucide-react";

const CATEGORIES = [
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

const CUSTODY_STATES = [
  { key: "ALL", label: "All Custody States" },
  { key: "DEPOSITED_AT_SAFE_DESK", label: "Deposited at Safe-Desk" },
  { key: "HELD_BY_FINDER", label: "Held by Student Finder" },
  { key: "HANDED_TO_MODERATOR", label: "Staff Office" },
];

const LIFECYCLE_STATUSES = [
  { key: "ALL", label: "All Statuses" },
  { key: "ACTIVE", label: "Active" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "CLAIMED", label: "Claimed" },
  { key: "RECOVERED", label: "Recovered" },
];

function LostAndFoundDirectoryContent() {
  const router = useRouter();
  const pathname = usePathname() || "/lost-and-found";
  const searchParams = useSearchParams();

  // URL state synchronization
  const initialType = searchParams?.get("type") || "ALL";
  const initialCategory = searchParams?.get("category") || "ALL";
  const initialLocation = searchParams?.get("locationId") || "ALL";
  const initialStatus = searchParams?.get("status") || "ALL";
  const initialCustody = searchParams?.get("custodyStatus") || "ALL";
  const initialSort = searchParams?.get("sort") || "newest";
  const initialSearch = searchParams?.get("search") || "";

  const [typeFilter, setTypeFilter] = useState(initialType);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [locationFilter, setLocationFilter] = useState(initialLocation);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [custodyFilter, setCustodyFilter] = useState(initialCustody);
  const [sortOrder, setSortOrder] = useState(initialSort);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Sync state back to URL query parameters
  const updateQueryParams = useCallback(
    (params: Record<string, string>) => {
      const sp = new URLSearchParams(searchParams ? searchParams.toString() : "");
      Object.entries(params).forEach(([key, val]) => {
        if (!val || val === "ALL" || (key === "sort" && val === "newest")) {
          sp.delete(key);
        } else {
          sp.set(key, val);
        }
      });
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const fetchItems = useCallback(
    async (cursorToFetch?: string | null, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setErrorNotice(null);

      try {
        if (typeFilter === "RECOVERED") {
          const recParams = new URLSearchParams();
          if (categoryFilter !== "ALL") recParams.set("category", categoryFilter);
          const res = await fetch(`/api/items/recovered?${recParams.toString()}`);
          const json = await res.json();
          if (json.success) {
            const list = (json.data || []).map((r: any) => ({
              _id: r._id,
              title: r.title,
              category: r.category,
              itemType: "RECOVERED",
              status: "RECOVERED",
              publicDescription: `Successfully returned to owner in ${r.broadZone}. Certified via ${r.handoverMethod}.`,
              location: { name: r.broadZone },
              coarseDate: r.coarseDate,
              finderAttribution: r.finderAttribution,
              handoverMethod: r.handoverMethod,
              createdAt: r.coarseDate,
            }));
            setItems(list);
            setTotalCount(json.pagination?.total ?? list.length);
            setHasMore(false);
            setNextCursor(null);
          } else {
            setErrorNotice(json.error?.message || "Failed to load recovered items.");
          }
          return;
        }

        const params = new URLSearchParams();
        if (typeFilter !== "ALL") params.set("type", typeFilter);
        if (categoryFilter !== "ALL") params.set("category", categoryFilter);
        if (locationFilter !== "ALL") params.set("locationId", locationFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (custodyFilter !== "ALL") params.set("custodyStatus", custodyFilter);
        if (sortOrder !== "newest") params.set("sort", sortOrder);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        params.set("limit", "20");

        if (cursorToFetch) {
          params.set("cursor", cursorToFetch);
        }

        const res = await fetch(`/api/items?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
          const newItems = json.data || [];
          if (append) {
            setItems((prev) => [...prev, ...newItems]);
          } else {
            setItems(newItems);
          }
          setNextCursor(json.pageInfo?.nextCursor || null);
          setHasMore(Boolean(json.pageInfo?.hasMore));
          setTotalCount(json.total ?? null);
        } else {
          setErrorNotice(json.error?.message || "Failed to load directory items.");
        }
      } catch (err: any) {
        setErrorNotice(err.message || "Network error loading items.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [typeFilter, categoryFilter, locationFilter, statusFilter, custodyFilter, sortOrder, searchQuery]
  );

  // Fetch campus locations for filter selector
  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => d.success && setLocations(d.data || []))
      .catch(() => {});
  }, []);

  // Fetch items when primary filters change
  useEffect(() => {
    fetchItems(null, false);
  }, [typeFilter, categoryFilter, locationFilter, statusFilter, custodyFilter, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueryParams({ search: searchQuery });
    fetchItems(null, false);
  };

  const handleClearAll = () => {
    setTypeFilter("ALL");
    setCategoryFilter("ALL");
    setLocationFilter("ALL");
    setStatusFilter("ALL");
    setCustodyFilter("ALL");
    setSortOrder("newest");
    setSearchQuery("");
    router.replace(pathname, { scroll: false });
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchItems(nextCursor, true);
    }
  };

  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (typeFilter !== "ALL") {
    activeChips.push({
      label: `Mode: ${typeFilter}`,
      onRemove: () => {
        setTypeFilter("ALL");
        updateQueryParams({ type: "ALL" });
      },
    });
  }
  if (categoryFilter !== "ALL") {
    activeChips.push({
      label: `Category: ${CATEGORIES.find((c) => c.key === categoryFilter)?.label || categoryFilter}`,
      onRemove: () => {
        setCategoryFilter("ALL");
        updateQueryParams({ category: "ALL" });
      },
    });
  }
  if (locationFilter !== "ALL") {
    const locName = locations.find((l) => l._id === locationFilter)?.name || "Location";
    activeChips.push({
      label: `Zone: ${locName}`,
      onRemove: () => {
        setLocationFilter("ALL");
        updateQueryParams({ locationId: "ALL" });
      },
    });
  }
  if (statusFilter !== "ALL") {
    activeChips.push({
      label: `Status: ${statusFilter}`,
      onRemove: () => {
        setStatusFilter("ALL");
        updateQueryParams({ status: "ALL" });
      },
    });
  }
  if (custodyFilter !== "ALL") {
    activeChips.push({
      label: `Custody: ${custodyFilter.replace(/_/g, " ")}`,
      onRemove: () => {
        setCustodyFilter("ALL");
        updateQueryParams({ custodyStatus: "ALL" });
      },
    });
  }
  if (searchQuery.trim()) {
    activeChips.push({
      label: `Search: "${searchQuery}"`,
      onRemove: () => {
        setSearchQuery("");
        updateQueryParams({ search: "" });
        fetchItems(null, false);
      },
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              CAMPUS SERVICE
            </span>
            <span className="text-xs font-mono text-slate-400">
              {totalCount !== null ? `${totalCount} Records Listed` : `${items.length} Records`}
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Campus Lost & Found Hub
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Verified lost belongings and secure custody turn-ins across AIEM Safe-Desks. All records protect student identities.
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

      {/* Filter and Mode Control Surface */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4 shadow-xl">
        {/* Mode Toggle: Segmented control on mobile, tabs on desktop */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex rounded-xl bg-slate-950/80 p-1 border border-white/10 text-xs font-mono w-full sm:w-auto">
            {[
              { key: "ALL", label: "Unified Directory" },
              { key: "LOST", label: "Lost Items" },
              { key: "FOUND", label: "Found at Safe-Desks" },
              { key: "RECOVERED", label: "Recovered Feed" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTypeFilter(t.key);
                  updateQueryParams({ type: t.key });
                }}
                className={`flex-1 sm:flex-initial sm:px-5 py-2 rounded-lg text-center font-bold transition-all ${
                  typeFilter === t.key
                    ? t.key === "LOST"
                      ? "bg-rose-500 text-slate-950 shadow-md shadow-rose-500/30"
                      : t.key === "FOUND"
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                      : t.key === "RECOVERED"
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                      : "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono">
            <span className="text-slate-500 hidden sm:inline">Sort:</span>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                updateQueryParams({ sort: e.target.value });
              }}
              className="py-1.5 px-2.5 rounded-lg bg-slate-900 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="category">By Category</option>
            </select>
          </div>
        </div>

        {/* Search & Location Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="md:col-span-5 relative flex items-center">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3" />
            <input
              type="text"
              placeholder="Search title, broad zone, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
            />
          </form>

          {/* Location / Zone Select */}
          <div className="md:col-span-4">
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                updateQueryParams({ locationId: e.target.value });
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-950/80 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">All Campus Zones</option>
              {locations.map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name} {loc.isSafeDesk ? "★ Safe-Desk" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Custody or Lifecycle Status Select */}
          <div className="md:col-span-3">
            {typeFilter === "FOUND" ? (
              <select
                value={custodyFilter}
                onChange={(e) => {
                  setCustodyFilter(e.target.value);
                  updateQueryParams({ custodyStatus: e.target.value });
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-950/80 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-cyan-400"
              >
                {CUSTODY_STATES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  updateQueryParams({ status: e.target.value });
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-950/80 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-cyan-400"
              >
                {LIFECYCLE_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs max-w-full scrollbar-none">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setCategoryFilter(c.key);
                updateQueryParams({ category: c.key });
              }}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-mono transition-all flex-shrink-0 ${
                categoryFilter === c.key
                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 font-bold"
                  : "bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Active Filter Chips and Clear All */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5 text-xs font-mono">
            <span className="text-slate-500">Active Filters:</span>
            {activeChips.map((chip, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-200 border border-white/10"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="hover:text-rose-400 transition-colors"
                  aria-label="Remove filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={handleClearAll}
              className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 ml-auto text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Error state */}
      {errorNotice && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center justify-between">
          <span>{errorNotice}</span>
          <button onClick={() => fetchItems(null, false)} className="underline hover:text-white">
            Retry
          </button>
        </div>
      )}

      {/* Items Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-6 bg-slate-900/40 border border-white/5 space-y-4 animate-pulse"
            >
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-6 bg-slate-800 rounded w-3/4" />
              <div className="h-16 bg-slate-800 rounded w-full" />
              <div className="h-4 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center space-y-4 border border-white/10 max-w-xl mx-auto">
          <Shield className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Items Found</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            No active campus records match your selected filters. Try broadening your category or zone
            criteria, or check in with a Safe-Desk custodian.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={handleClearAll}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-white hover:bg-slate-700 transition-colors font-mono"
            >
              Reset Filters
            </button>
            <Link
              href="/lost-and-found/report-lost"
              className="px-4 py-2 rounded-xl bg-emerald-500 text-xs text-slate-950 font-bold hover:bg-emerald-400 transition-colors font-mono"
            >
              Report an Item
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const isLost = item.itemType === "LOST";
              const isRecovered = item.itemType === "RECOVERED" || item.status === "RECOVERED";
              const loc = item.location || item.lastKnownLocationId || item.foundLocationId;

              return (
                <div
                  key={item._id}
                  className={`rounded-2xl p-5 border transition-all flex flex-col justify-between group bg-slate-900/60 ${
                    isRecovered
                      ? "border-cyan-500/30 hover:border-cyan-500/60 shadow-lg shadow-cyan-950/20"
                      : isLost
                      ? "border-rose-500/20 hover:border-rose-500/50 shadow-lg shadow-rose-950/20"
                      : "border-emerald-500/20 hover:border-emerald-500/50 shadow-lg shadow-emerald-950/20"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                          isRecovered
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            : isLost
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        {item.itemType}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.category?.replace(/_/g, " ")}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors">
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                      {item.publicDescription}
                    </p>

                    {/* Safe Broad Zone & Custody Details */}
                    <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs font-mono text-slate-300">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <MapPin
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isLost ? "text-rose-400" : "text-emerald-400"
                          }`}
                        />
                        <span className="truncate">
                          {loc?.name || "AIEM Campus Zone"}
                        </span>
                      </div>

                      {item.custodyStatus && (
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Shield className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate">
                            {item.custodyStatus.replace(/_/g, " ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500">
                      {item.dateReported
                        ? new Date(item.dateReported).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })
                        : "Recent"}
                    </span>

                    <Link
                      href={`/items/${item._id}`}
                      className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 font-bold hover:text-cyan-300 transition-colors"
                    >
                      <span>View Record</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cursor-based Load More Button */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-3 rounded-xl bg-slate-900 border border-white/10 hover:border-cyan-500/40 text-xs font-mono font-bold text-slate-200 hover:text-white transition-all disabled:opacity-50 inline-flex items-center gap-2 shadow-lg"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Loading next page...</span>
                  </>
                ) : (
                  <span>Load More Records</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LostAndFoundDirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-400 font-mono text-xs flex items-center justify-center">
          Loading Lost & Found Hub...
        </div>
      }
    >
      <LostAndFoundDirectoryContent />
    </Suspense>
  );
}
