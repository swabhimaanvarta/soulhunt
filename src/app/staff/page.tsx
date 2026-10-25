"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Building,
  KeyRound,
  PackagePlus,
  PackageCheck,
  RotateCcw,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Clock,
  MapPin,
  ChevronRight,
  Loader2,
  X,
  Filter,
  User,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type StaffTab = "CUSTODY_QUEUE" | "INTAKE_DEPOSIT" | "VERIFY_HANDOVER" | "PIN_RESET";

interface SafeDeskStation {
  _id: string;
  name: string;
  code: string;
  operatingHours?: string;
  zoneType?: string;
  isSafeDesk?: boolean;
}

interface QueueItem {
  _id: string;
  title: string;
  category: string;
  publicDescription: string;
  spotDetails?: string;
  lockerReceiptCode: string | null;
  custodyStatus: string;
  custodyDate: string;
  foundAt: string;
  createdAt: string;
  updatedAt: string;
  photoUrl: string | null;
  finder?: {
    _id?: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
  } | null;
  foundLocation?: {
    _id?: string;
    name: string;
    code: string;
    zoneType?: string;
  } | null;
  safeDeskLocation?: {
    _id?: string;
    name: string;
    code: string;
    operatingHours?: string;
    zoneType?: string;
  } | null;
  activeClaim?: {
    _id: string;
    status: string;
    handoverLocked: boolean;
    handoverAttempts: number;
    lockoutUntil: string | null;
    claimant?: {
      _id?: string;
      displayName: string;
      username: string;
    } | null;
    createdAt: string;
  } | null;
}

export default function SafeDeskStaffPortal() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<StaffTab>("CUSTODY_QUEUE");
  const [loading, setLoading] = useState(true);
  const [station, setStation] = useState<SafeDeskStation | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [availableStations, setAvailableStations] = useState<SafeDeskStation[]>([]);
  const [pendingHandovers, setPendingHandovers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Custody intake state & modal
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [intakeItemId, setIntakeItemId] = useState("");
  const [intakeLockerCode, setIntakeLockerCode] = useState("");
  const [intakeCondition, setIntakeCondition] = useState("");
  const [intakeReason, setIntakeReason] = useState("Direct student deposit at safe-desk counter.");
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  // Custody transfer state & modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedTransferItem, setSelectedTransferItem] = useState<QueueItem | null>(null);
  const [transferItemId, setTransferItemId] = useState("");
  const [transferToStationId, setTransferToStationId] = useState("");
  const [transferCondition, setTransferCondition] = useState("");
  const [transferReason, setTransferReason] = useState("Inter-station balancing / student requested transfer.");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [lastTransferResult, setLastTransferResult] = useState<any>(null);

  // Handover verify state
  const [handoverClaimId, setHandoverClaimId] = useState("");
  const [handoverPin, setHandoverPin] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifySuccessMsg, setVerifySuccessMsg] = useState<string | null>(null);

  // PIN reset state
  const [resetClaimId, setResetClaimId] = useState("");
  const [resetReason, setResetReason] = useState("In-person student ID verified at Safe-Desk counter.");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [newlyIssuedPin, setNewlyIssuedPin] = useState<string | null>(null);

  // 1. Fetch Safe-Desk station queue
  const fetchQueueData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Query the official queue API
      const res = await fetch("/api/staff/queue");
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || "Failed to load station custody queue.");
      }

      setQueueItems(json.data.items || []);
      if (json.data.station) {
        setStation(json.data.station);
      }

      // Concurrently query overview to populate pending handover list and fallback stats
      const overviewRes = await fetch("/api/staff/overview");
      const overviewJson = await overviewRes.json();
      if (overviewJson.success && overviewJson.data) {
        if (!json.data.station && overviewJson.data.station) {
          setStation(overviewJson.data.station);
        }
        setPendingHandovers(overviewJson.data.pendingHandovers || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to station custody ledger.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch available Safe-Desk stations for inter-station transfers
  const fetchSafeDeskStations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations?safeDesk=true");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAvailableStations(json.data);
      }
    } catch {
      // Non-critical background fetch
    }
  }, []);

  useEffect(() => {
    fetchQueueData();
    fetchSafeDeskStations();
  }, [fetchQueueData, fetchSafeDeskStations]);

  // Handle Custody Intake Submit
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeItemId.trim()) {
      toast({
        title: "Item ID Required",
        description: "Please enter the Found Item database ID.",
        variant: "destructive",
      });
      return;
    }

    setIntakeSubmitting(true);
    try {
      const res = await fetch("/api/staff/custody", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: intakeItemId.trim(),
          action: "DEPOSIT",
          stationId: station?._id,
          lockerCode: intakeLockerCode.trim() || undefined,
          conditionNote: intakeCondition.trim() || "Good condition",
          reason: intakeReason.trim(),
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Custody intake failed.");
      }

      setLastReceipt(json.data);
      toast({
        title: "Custody Intake Complete",
        description: `Item secured in locker with receipt ${json.data.lockerReceiptCode}.`,
        variant: "success",
      });

      setIntakeItemId("");
      setIntakeLockerCode("");
      setIntakeCondition("");
      fetchQueueData();
    } catch (err: any) {
      toast({
        title: "Custody Intake Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIntakeSubmitting(false);
    }
  };

  // Handle Transfer Modal Open
  const openTransferModal = (item?: QueueItem) => {
    if (item) {
      setSelectedTransferItem(item);
      setTransferItemId(item._id);
    } else {
      setSelectedTransferItem(null);
      setTransferItemId("");
    }
    setTransferToStationId("");
    setTransferCondition("");
    setLastTransferResult(null);
    setIsTransferModalOpen(true);
  };

  // Handle Transfer Submit
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferItemId.trim() || !transferToStationId) {
      toast({
        title: "Validation Error",
        description: "Specify both Found Item ID and destination Safe-Desk station.",
        variant: "destructive",
      });
      return;
    }

    setTransferSubmitting(true);
    try {
      const res = await fetch("/api/staff/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: transferItemId.trim(),
          toStationId: transferToStationId,
          conditionNote: transferCondition.trim() || undefined,
          reason: transferReason.trim(),
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Custody transfer failed.");
      }

      setLastTransferResult(json.data);
      toast({
        title: "Custody Transferred",
        description: `Transferred to ${json.data.stationName} [Receipt: ${json.data.lockerReceiptCode}].`,
        variant: "success",
      });

      fetchQueueData();
    } catch (err: any) {
      toast({
        title: "Transfer Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Handle Handover Verification Submit
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverClaimId.trim() || handoverPin.trim().length !== 6) {
      toast({
        title: "Validation Error",
        description: "Provide Claim ID and exact 6-digit PIN code.",
        variant: "destructive",
      });
      return;
    }

    setVerifySubmitting(true);
    setVerifySuccessMsg(null);
    try {
      const res = await fetch("/api/claims/verify-handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: handoverClaimId.trim(),
          handoverCode: handoverPin.trim(),
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Verification failed");
      }

      setVerifySuccessMsg("Handover verified! Belonging released and finder bounty credited on ledger.");
      toast({
        title: "Handover Verified",
        description: "Physical handover certified successfully.",
        variant: "success",
      });
      setHandoverClaimId("");
      setHandoverPin("");
      fetchQueueData();
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setVerifySubmitting(false);
    }
  };

  // Handle PIN Reset Submit
  const handlePinResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetClaimId.trim() || resetReason.trim().length < 5) {
      toast({
        title: "Validation Error",
        description: "Provide Claim ID and detailed audit reason.",
        variant: "destructive",
      });
      return;
    }

    setResetSubmitting(true);
    setNewlyIssuedPin(null);
    try {
      const res = await fetch("/api/staff/reset-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: resetClaimId.trim(),
          reason: resetReason.trim(),
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Reset failed");
      }

      setNewlyIssuedPin(json.data.newHandoverCode);
      toast({
        title: "PIN Reissued",
        description: "New 6-digit recovery code generated and claim unlocked.",
        variant: "success",
      });
      fetchQueueData();
    } catch (err: any) {
      toast({
        title: "PIN Reset Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setResetSubmitting(false);
    }
  };

  // Filtered Queue
  const filteredItems = useMemo(() => {
    return queueItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "ALL" || item.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.lockerReceiptCode && item.lockerReceiptCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.finder?.displayName && item.finder.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.publicDescription && item.publicDescription.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [queueItems, selectedCategory, searchQuery]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 text-center font-mono text-slate-400 animate-pulse flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-sm tracking-wide">CONNECTING TO SAFE-DESK CUSTODY LEDGER...</span>
      </div>
    );
  }

  if (error || !station) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Safe-Desk Access Denied</h2>
        <p className="text-xs text-slate-400 leading-relaxed font-mono">
          {error || "Staff account is not assigned to an active Safe-Desk station."}
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-bold transition-all focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Station Scope Header Banner */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shadow-black/40">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-400" />
              STATION-SCOPED CUSTODY
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-white/10 font-bold">
              {station.code}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{station.name}</h1>
          <p className="text-xs text-slate-400 font-mono flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Hours: {station.operatingHours || "08:00 - 18:00"}
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Zone: {station.zoneType || "CAMPUS"}
            </span>
            <span>&bull;</span>
            <span>Station ID: {station._id}</span>
          </p>
        </div>

        {/* Quick Station Stats & Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 text-center min-w-[110px]">
            <div className="text-2xl font-mono font-black text-emerald-400">{queueItems.length}</div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-0.5">In Locker Storage</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 text-center min-w-[110px]">
            <div className="text-2xl font-mono font-black text-amber-400">{pendingHandovers.length}</div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-0.5">Pending Pickup</div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setIsIntakeModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-emerald-500/20 focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <PackagePlus className="w-4 h-4" />
              Intake Item
            </button>
            <button
              onClick={fetchQueueData}
              title="Refresh Station Ledger"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white font-mono text-xs flex items-center justify-center gap-2 cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Ledger
            </button>
          </div>
        </div>
      </div>

      {/* 2. Staff Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab("CUSTODY_QUEUE")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            activeTab === "CUSTODY_QUEUE"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "bg-slate-900/60 text-slate-400 hover:text-white border border-transparent"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          Active Custody Queue ({queueItems.length})
        </button>

        <button
          onClick={() => setActiveTab("INTAKE_DEPOSIT")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            activeTab === "INTAKE_DEPOSIT"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "bg-slate-900/60 text-slate-400 hover:text-white border border-transparent"
          }`}
        >
          <PackagePlus className="w-3.5 h-3.5" />
          Custody Intake
        </button>

        <button
          onClick={() => setActiveTab("VERIFY_HANDOVER")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            activeTab === "VERIFY_HANDOVER"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "bg-slate-900/60 text-slate-400 hover:text-white border border-transparent"
          }`}
        >
          <PackageCheck className="w-3.5 h-3.5" />
          Handover Verification
        </button>

        <button
          onClick={() => setActiveTab("PIN_RESET")}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            activeTab === "PIN_RESET"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "bg-slate-900/60 text-slate-400 hover:text-white border border-transparent"
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          PIN Reset &amp; Unlock
        </button>
      </div>

      {/* TAB 1: Active Custody Queue */}
      {activeTab === "CUSTODY_QUEUE" && (
        <div className="space-y-6">
          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search items by title, locker receipt (e.g. SD-LIB-102), finder..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="ELECTRONICS">Electronics</option>
                <option value="ID_CARDS_DOCS">ID Cards &amp; Docs</option>
                <option value="BOOKS_NOTES">Books &amp; Notes</option>
                <option value="ACCESSORIES">Accessories</option>
                <option value="BAGS_WALLETS">Bags &amp; Wallets</option>
                <option value="KEYS">Keys</option>
                <option value="LAB_GEAR">Lab Gear</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Custody Items Grid */}
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item._id}
                  className="rounded-2xl bg-slate-950/70 border border-white/10 p-5 space-y-4 hover:border-white/20 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header Badges */}
                    <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                            {item.category}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {item.lockerReceiptCode || "RECEIPT PENDING"}
                          </span>
                          {/* Active Claim Badge */}
                          {item.activeClaim ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                                item.activeClaim.handoverLocked
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : item.activeClaim.status === "APPROVED"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              }`}
                            >
                              {item.activeClaim.handoverLocked
                                ? "PIN LOCKED"
                                : `CLAIM ${item.activeClaim.status}`}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                              NO CLAIM
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-white text-base mt-2">{item.title}</h3>
                      </div>

                      <Link
                        href={`/items/${item._id}`}
                        target="_blank"
                        className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
                        title="Open Item Record"
                      >
                        Inspect <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {item.publicDescription}
                    </p>

                    {/* Metadata Card */}
                    <div className="text-[11px] font-mono text-slate-400 space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-500" /> Deposited by:
                        </span>
                        <span className="text-white font-bold">
                          {item.finder?.displayName || "Student Member"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-500" /> Found at:
                        </span>
                        <span className="text-slate-300">
                          {item.foundLocation?.name || "Campus Ground"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-500" /> Custody Date:
                        </span>
                        <span className="text-slate-300">
                          {new Date(item.custodyDate).toLocaleDateString()}
                        </span>
                      </div>
                      {item.activeClaim?.claimant && (
                        <div className="flex justify-between items-center pt-1 border-t border-white/5">
                          <span className="text-amber-400">Claimant:</span>
                          <span className="text-white font-bold">
                            {item.activeClaim.claimant.displayName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Item Action Triggers */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => {
                        if (item.activeClaim?._id) {
                          setHandoverClaimId(item.activeClaim._id);
                        } else {
                          setHandoverClaimId("");
                        }
                        setActiveTab("VERIFY_HANDOVER");
                      }}
                      className="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all text-center cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      Verify Handover
                    </button>

                    <button
                      onClick={() => openTransferModal(item)}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400"
                      title="Transfer Custody to Another Station"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                      Transfer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 rounded-3xl bg-slate-950/40 text-center space-y-3 border border-white/5 font-mono">
              <PackageCheck className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-400">
                {searchQuery || selectedCategory !== "ALL"
                  ? "No matching belongings found in custody."
                  : "No items currently stored at this station."}
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Items accepted at this counter via Custody Intake will appear here with unique tracked locker receipts.
              </p>
              <button
                onClick={() => setIsIntakeModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-emerald-400 transition-all focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <PackagePlus className="w-4 h-4" />
                Intake Found Item
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Custody Intake / Deposit */}
      {activeTab === "INTAKE_DEPOSIT" && (
        <div className="max-w-2xl mx-auto glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
          <div className="space-y-1 border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-emerald-400" />
              Custody Intake &amp; Locker Assignment
            </h2>
            <p className="text-xs text-slate-400">
              Station Scoping: Items are safely deposited into {station.name}. Generates a cryptographically tracked receipt format:{" "}
              <code className="text-emerald-300 font-mono">SD-{station.code}-XXX</code>.
            </p>
          </div>

          {lastReceipt && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Custody Receipt Generated!
              </div>
              <div className="text-xs text-slate-300">
                Assigned Locker Receipt Code:{" "}
                <span className="font-mono font-black text-emerald-300 text-sm tracking-wider">
                  {lastReceipt.lockerReceiptCode}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Item ID: {lastReceipt.itemId} &bull; Secured at {lastReceipt.stationName}
              </p>
            </div>
          )}

          <form onSubmit={handleIntakeSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">
                Found Item Database ID *
              </label>
              <input
                required
                type="text"
                placeholder="Paste Found Item ObjectId (e.g. 6ade14baf09c...)"
                value={intakeItemId}
                onChange={(e) => setIntakeItemId(e.target.value.trim())}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">
                Custom Locker Slot / Receipt Code (Optional - auto-generated if left blank)
              </label>
              <input
                type="text"
                placeholder={`Leave blank for auto SD-${station.code}-XXX`}
                value={intakeLockerCode}
                onChange={(e) => setIntakeLockerCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">
                Inspection &amp; Physical Condition Note
              </label>
              <input
                type="text"
                placeholder="e.g. Screen intact, slight scratch on corner, charging cable attached"
                value={intakeCondition}
                onChange={(e) => setIntakeCondition(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">
                Audit Log Reason (Required for custody accountability) *
              </label>
              <input
                required
                minLength={5}
                type="text"
                value={intakeReason}
                onChange={(e) => setIntakeReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={intakeSubmitting}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {intakeSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Accepting Custody...
                  </>
                ) : (
                  <>
                    <PackagePlus className="w-4 h-4" />
                    Deposit into Safe-Desk &amp; Generate Receipt
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: Handover Verification */}
      {activeTab === "VERIFY_HANDOVER" && (
        <div className="max-w-2xl mx-auto glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
          <div className="space-y-1 border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              Station Handover Dual-Code Verification
            </h2>
            <p className="text-xs text-slate-400">
              Verify the claimant&apos;s physical student identity card and enter their 6-digit cryptographic recovery code.
            </p>
          </div>

          {verifySuccessMsg && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-mono">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{verifySuccessMsg}</span>
            </div>
          )}

          {/* Pending handovers quick picker */}
          {pendingHandovers && pendingHandovers.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase text-slate-400">
                Awaiting Handover at this Station ({pendingHandovers.length})
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {pendingHandovers.map((claim: any) => (
                  <div
                    key={claim._id}
                    onClick={() => setHandoverClaimId(claim._id)}
                    className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/5 flex items-center justify-between text-xs cursor-pointer transition-all"
                  >
                    <div>
                      <div className="font-bold text-white">{claim.claimantId?.displayName || "Student"}</div>
                      <div className="text-[10px] font-mono text-slate-400">Claim ID: {claim._id}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      APPROVED
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">Claim Request ID *</label>
              <input
                required
                type="text"
                placeholder="Enter Claim ObjectId (e.g. 6ade14baf09c...)"
                value={handoverClaimId}
                onChange={(e) => setHandoverClaimId(e.target.value.trim())}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">
                Claimant&apos;s 6-Digit Handover PIN *
              </label>
              <input
                required
                type="text"
                maxLength={6}
                placeholder="6-DIGIT CODE"
                value={handoverPin}
                onChange={(e) => setHandoverPin(e.target.value.trim())}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/20 text-center font-mono text-xl tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={verifySubmitting}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {verifySubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking PIN &amp; Distributing Rewards...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Verify PIN &amp; Release Custody
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: PIN Reset & Unlock */}
      {activeTab === "PIN_RESET" && (
        <div className="max-w-2xl mx-auto glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
          <div className="space-y-1 border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-400" />
              Safe-Desk PIN Reset &amp; Unlock
            </h2>
            <p className="text-xs text-slate-400">
              When a student exhausts 5 PIN attempts or experiences lockout, staff can verify photo ID in person and re-issue a fresh 6-digit recovery PIN.
            </p>
          </div>

          {newlyIssuedPin && (
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-center">
              <div className="text-xs font-mono uppercase text-amber-300 font-bold">
                Fresh Handover PIN Generated:
              </div>
              <div className="text-3xl font-mono font-black text-amber-400 tracking-widest">
                {newlyIssuedPin}
              </div>
              <p className="text-xs text-slate-400">
                Provide this PIN to the verified claimant. The claim status is preserved and attempt counters reset to 0.
              </p>
            </div>
          )}

          <form onSubmit={handlePinResetSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">Claim Request ID *</label>
              <input
                required
                type="text"
                placeholder="Paste Claim ObjectId to unlock"
                value={resetClaimId}
                onChange={(e) => setResetClaimId(e.target.value.trim())}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">
                Mandatory Verification Note &amp; ID Proof Confirmation *
              </label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={resetSubmitting}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {resetSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resetting PIN &amp; Unlocking...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Reset PIN &amp; Clear Lockout
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CUSTODY INTAKE MODAL */}
      {isIntakeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-white/20 bg-slate-950/95 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setIsIntakeModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-emerald-400" />
                Custody Intake Quick Modal
              </h3>
              <p className="text-xs text-slate-400">
                Deposit found belonging into <strong className="text-white">{station.name}</strong>.
              </p>
            </div>

            {lastReceipt && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-mono space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Locker Receipt Generated:
                </div>
                <div className="text-base font-black text-emerald-200">
                  {lastReceipt.lockerReceiptCode}
                </div>
              </div>
            )}

            <form onSubmit={handleIntakeSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Found Item ObjectId *</label>
                <input
                  required
                  type="text"
                  placeholder="Paste Found Item ObjectId"
                  value={intakeItemId}
                  onChange={(e) => setIntakeItemId(e.target.value.trim())}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">
                  Custom Locker Receipt (Optional - defaults to SD-{station.code}-XXX)
                </label>
                <input
                  type="text"
                  placeholder={`SD-${station.code}-XXX`}
                  value={intakeLockerCode}
                  onChange={(e) => setIntakeLockerCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Condition Note</label>
                <input
                  type="text"
                  placeholder="e.g. Scratched screen, charging cable attached"
                  value={intakeCondition}
                  onChange={(e) => setIntakeCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Audit Reason *</label>
                <input
                  required
                  minLength={5}
                  type="text"
                  value={intakeReason}
                  onChange={(e) => setIntakeReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIntakeModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={intakeSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {intakeSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Deposit & Issue Receipt"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTODY TRANSFER MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-white/20 bg-slate-950/95 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setIsTransferModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                Inter-Station Custody Transfer
              </h3>
              <p className="text-xs text-slate-400">
                Transfer custody from <strong className="text-white">{station.name}</strong> to another registered Safe-Desk. A fresh locker receipt will be generated.
              </p>
            </div>

            {selectedTransferItem && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono space-y-1">
                <div className="text-slate-400">Transferring Item:</div>
                <div className="text-white font-bold text-sm">{selectedTransferItem.title}</div>
                <div className="text-[11px] text-emerald-400">
                  Current Locker Receipt: {selectedTransferItem.lockerReceiptCode || "NONE"}
                </div>
              </div>
            )}

            {lastTransferResult && (
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300 font-mono space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Transfer Certified!
                </div>
                <div>New Station: {lastTransferResult.stationName}</div>
                <div className="text-base font-black text-cyan-200">
                  New Locker Receipt: {lastTransferResult.lockerReceiptCode}
                </div>
              </div>
            )}

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">Found Item ID *</label>
                <input
                  required
                  type="text"
                  placeholder="Found Item ID"
                  value={transferItemId}
                  onChange={(e) => setTransferItemId(e.target.value.trim())}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">
                  Destination Safe-Desk Station *
                </label>
                <select
                  required
                  value={transferToStationId}
                  onChange={(e) => setTransferToStationId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
                >
                  <option value="">Select Destination Safe-Desk...</option>
                  {availableStations
                    .filter((s) => s._id !== station._id)
                    .map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.code}) - {s.operatingHours || "08:00 - 18:00"}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">
                  Condition Note upon Transfer (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Packed in sealed anti-tamper pouch #41"
                  value={transferCondition}
                  onChange={(e) => setTransferCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-300">
                  Transfer Reason &amp; Courier Log *
                </label>
                <input
                  required
                  minLength={5}
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-emerald-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold cursor-pointer transition-all"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {transferSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Transferring...
                    </>
                  ) : (
                    "Authorize Transfer"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
