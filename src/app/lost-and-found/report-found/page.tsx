"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  HelpCircle,
  MapPin,
  Lock,
  Coins,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Building,
  Camera,
  Loader2,
  Laptop,
  CreditCard,
  BookOpen,
  Watch,
  Key,
  Briefcase,
  FlaskConical,
  Package,
  Check,
  X,
  FileText,
  Award,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LiveMatchDrawer from "@/components/lost-and-found/LiveMatchDrawer";

const CATEGORIES = [
  { id: "ELECTRONICS", label: "Electronics", icon: Laptop, desc: "Laptops, Calculators, Phones, Chargers" },
  { id: "ID_CARDS_DOCS", label: "ID Cards & Docs", icon: CreditCard, desc: "College ID, Library Cards, Documents" },
  { id: "BOOKS_NOTES", label: "Books & Notes", icon: BookOpen, desc: "Textbooks, Notebooks, Lab Manuals" },
  { id: "BAGS_WALLETS", label: "Bags & Wallets", icon: Briefcase, desc: "Backpacks, Wallets, Pouches" },
  { id: "ACCESSORIES", label: "Accessories", icon: Watch, desc: "Watches, Earphones, Glasses, Bottles" },
  { id: "KEYS", label: "Keys", icon: Key, desc: "Hostel, Locker, Vehicle Keys" },
  { id: "LAB_GEAR", label: "Lab Gear", icon: FlaskConical, desc: "Lab Coats, Breadboards, Components" },
  { id: "OTHER", label: "Other Belongings", icon: Package, desc: "Miscellaneous campus items" },
];

const STEPS = [
  { id: 1, title: "Item Found", subtitle: "Name, category & photo" },
  { id: 2, title: "Location Discovered", subtitle: "Where on campus" },
  { id: 3, title: "Custody & Deposit", subtitle: "Safe-Desk deposit & rewards" },
];

export default function ReportFoundItemPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [locations, setLocations] = useState<any[]>([]);
  const [safeDesks, setSafeDesks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    category: "ELECTRONICS",
    foundLocationId: "",
    spotDetails: "",
    publicDescription: "",
    custodyStatus: "SAFE_DESK",
    currentCustodyLocationId: "",
    photoUrl: "",
  });

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setLocations(d.data);
          const sds = d.data.filter((l: any) => l.isSafeDesk);
          setSafeDesks(sds);

          if (d.data.length > 0) {
            let initialFoundId = d.data[0]._id;
            if (typeof window !== "undefined") {
              const urlParams = new URLSearchParams(window.location.search);
              const paramId = urlParams.get("locationId");
              if (paramId && d.data.some((l: any) => l._id === paramId)) {
                initialFoundId = paramId;
              }
            }

            setFormData((prev) => ({
              ...prev,
              foundLocationId: initialFoundId,
              currentCustodyLocationId: sds[0]?._id || d.data[0]._id,
            }));
          }
        }
      });
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!json.success) {
        toast({
          title: "Upload Failed",
          description: json.error || "Failed to upload photo",
          variant: "destructive",
        });
        return;
      }

      setFormData((prev) => ({ ...prev, photoUrl: json.url }));
      toast({
        title: "Photo Attached",
        description: "Image processed & securely encrypted in evidence storage.",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Upload Error",
        description: err.message || "Failed to upload photo",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const validateStep = (step: number): boolean => {
    setError(null);
    if (step === 1) {
      if (!formData.title.trim() || formData.title.trim().length < 3) {
        setError("Item title must be at least 3 characters long.");
        return false;
      }
      if (!formData.publicDescription.trim() || formData.publicDescription.trim().length < 10) {
        setError("Public description must be at least 10 characters long.");
        return false;
      }
    }
    if (step === 2) {
      if (!formData.foundLocationId) {
        setError("Please select the campus location where the item was found.");
        return false;
      }
    }
    return true;
  };

  const canGoToStep = (targetStep: number): boolean => {
    if (targetStep <= currentStep) return true;
    for (let s = 1; s < targetStep; s++) {
      if (!validateStep(s)) return false;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!validateStep(1) || !validateStep(2)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const clientRequestId = `found_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch("/api/items/found", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, clientRequestId }),
      });

      const json = await res.json();
      if (!json.success) {
        const errorMsg =
          json.error?.message ||
          (typeof json.error === "string" ? json.error : "Failed to submit found item report.");
        throw new Error(errorMsg);
      }

      toast({
        title: "Found Item Turned In",
        description: "Deposit logged in Safe-Desk custody ledger! Rewards queued upon intake.",
        variant: "success",
      });
      router.push(`/items/${json.data._id}`);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      toast({
        title: "Report Failed",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedCategoryObj = CATEGORIES.find((c) => c.id === formData.category) || CATEGORIES[0];
  const selectedLocationObj = locations.find((l) => l._id === formData.foundLocationId);
  const selectedSafeDeskObj = safeDesks.find((sd) => sd._id === formData.currentCustodyLocationId);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/lost-and-found"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Lost & Found Directory
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-2 border-b border-white/10 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          ETHICAL FINDER RECOVERY DESK
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Turn in a Found Belonging
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
          Thank you for keeping AIEM honest. Report belongings discovered across campus. Safe-Desk handovers earn immediate XP, Hunter Coins, and Trust tier boosts.
        </p>
      </div>

      {/* Ethical Bounty Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-transparent border border-emerald-500/30 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="font-bold text-white text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Ethical Samaritan Payout
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
            Depositing an item at an authorized campus Safe-Desk counter awards you recovery credit and badges upon staff intake verification.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
            ⭐ +80 XP
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
            🪙 +20 Coins
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
            🛡️ +20 Trust
          </span>
        </div>
      </div>

      {/* Structured Stepper Header */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {STEPS.map((s) => {
            const isCurrent = currentStep === s.id;
            const isCompleted = currentStep > s.id;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (canGoToStep(s.id)) {
                    setCurrentStep(s.id);
                  }
                }}
                className={`p-3 sm:p-3.5 rounded-2xl border text-left font-mono transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-emerald-500/15 border-emerald-500/40 text-white shadow-md shadow-emerald-500/10"
                    : isCompleted
                    ? "bg-slate-900/80 border-white/15 text-slate-300 hover:border-white/30"
                    : "bg-slate-950/40 border-white/5 text-slate-600 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCompleted
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : isCurrent
                        ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50"
                        : "bg-slate-800 text-slate-600"
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3" /> : s.id}
                  </span>
                  <span className="text-[10px] uppercase text-slate-500">Step {s.id}</span>
                </div>
                <div className="text-xs font-bold truncate text-white">{s.title}</div>
                <div className="text-[10px] text-slate-400 truncate hidden sm:block">{s.subtitle}</div>
              </button>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Found Item Identity & Photo */}
        {currentStep === 1 && (
          <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Step 1: Found Item Details & Photo
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Describe the item you discovered to check for active missing reports.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-bold">
                  Item Title / Summary *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Blue Dell Wireless Mouse, Water Bottle, USB Drive, Casio Calculator"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400 transition-colors"
                />

                <LiveMatchDrawer
                  type="FOUND"
                  title={formData.title}
                  category={formData.category}
                  locationId={formData.foundLocationId}
                />
              </div>

              {/* Category Visual Grid */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-300 font-bold">Category *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = formData.category === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat.id })}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? "bg-emerald-500/20 border-emerald-500/50 text-white shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/40"
                            : "bg-slate-950/70 border-white/5 text-slate-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className={`w-4 h-4 ${isSelected ? "text-emerald-400" : "text-slate-500"}`} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{cat.label}</div>
                          <div className="text-[10px] text-slate-500 line-clamp-1">{cat.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Public Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-300 font-bold">
                    Public Description *
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Keep sensitive serial numbers private
                  </span>
                </div>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe general condition, color, and appearance without revealing private ID numbers or owner names."
                  value={formData.publicDescription}
                  onChange={(e) => setFormData({ ...formData, publicDescription: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400 leading-relaxed transition-colors"
                />
              </div>

              {/* Photo Capture Input */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-950/70 border border-white/5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    Belonging Photo / Snapshot
                  </span>
                  {uploadingPhoto && <span className="text-emerald-400 animate-pulse">Uploading photo...</span>}
                </div>

                <p className="text-xs text-slate-400">
                  Take a photo of the item. Automatic privacy blur is applied for official identity documents.
                </p>

                <div className="flex items-center gap-3 pt-1">
                  <label className="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-white/10 flex items-center gap-2 transition-all">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Snap Photo / Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="hidden"
                    />
                  </label>

                  {formData.photoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, photoUrl: "" })}
                      className="text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>

                {formData.photoUrl && (
                  <div className="relative mt-2 rounded-xl overflow-hidden border border-white/10 h-32 max-w-sm bg-black/40">
                    <img
                      src={formData.photoUrl}
                      alt="Found item"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.endsWith("/placeholder-item.png")) {
                          target.src = "/placeholder-item.png";
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Location Discovered */}
        {currentStep === 2 && (
          <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                Step 2: Campus Location Discovered
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Where exactly on campus was this item found?
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-bold">
                  Campus Location / Sector *
                </label>
                <select
                  value={formData.foundLocationId}
                  onChange={(e) => setFormData({ ...formData, foundLocationId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400 font-mono"
                >
                  {locations.map((loc) => (
                    <option key={loc._id} value={loc._id}>
                      {loc.name} ({loc.code}) — {loc.building || "Campus Zone"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-bold">
                  Specific Spot Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Left on bench #3 outside Block B micro lab, or 2nd floor library study table"
                  value={formData.spotDetails}
                  onChange={(e) => setFormData({ ...formData, spotDetails: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              {selectedLocationObj && (
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-2 text-xs font-mono">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sector Details</span>
                  </div>
                  <div className="text-white font-bold">{selectedLocationObj.name}</div>
                  <div className="text-slate-400">{selectedLocationObj.description || "Active campus zone"}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Custody Status & Safe-Desk Deposit */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Building className="w-4 h-4 text-cyan-400" />
                  Step 3: Custody Status & Safe-Desk Deposit
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Choose how the belonging will be held until claimed by its owner.
                </p>
              </div>

              <div className="space-y-5">
                {/* Visual Custody Cards */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-300 font-bold">
                    Custody Option *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, custodyStatus: "SAFE_DESK" })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        formData.custodyStatus === "SAFE_DESK"
                          ? "bg-emerald-500/20 border-emerald-500/50 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-400/40"
                          : "bg-slate-950/70 border-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Building className={`w-5 h-5 ${formData.custodyStatus === "SAFE_DESK" ? "text-emerald-400" : "text-slate-500"}`} />
                        <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                          RECOMMENDED
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Deposit at Safe-Desk</div>
                        <div className="text-[11px] text-slate-400 leading-relaxed mt-1">
                          Drop off at an authorized campus Safe-Desk counter for secure locker custody and verified return.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, custodyStatus: "FINDER_HELD" })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        formData.custodyStatus === "FINDER_HELD"
                          ? "bg-cyan-500/20 border-cyan-500/50 text-white shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/40"
                          : "bg-slate-950/70 border-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Key className={`w-5 h-5 ${formData.custodyStatus === "FINDER_HELD" ? "text-cyan-400" : "text-slate-500"}`} />
                        <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                          DIRECT
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Finder-Held Custody</div>
                        <div className="text-[11px] text-slate-400 leading-relaxed mt-1">
                          You temporarily keep the item. Coordinate a campus meetup via the 6-digit handover PIN.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, custodyStatus: "ADMIN_OFFICE" })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        formData.custodyStatus === "ADMIN_OFFICE"
                          ? "bg-amber-500/20 border-amber-500/50 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/40"
                          : "bg-slate-950/70 border-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Lock className={`w-5 h-5 ${formData.custodyStatus === "ADMIN_OFFICE" ? "text-amber-400" : "text-slate-500"}`} />
                        <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                          DEPT
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Department Office</div>
                        <div className="text-[11px] text-slate-400 leading-relaxed mt-1">
                          Turned in to department head, lab technician, or administrative office staff.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {formData.custodyStatus === "SAFE_DESK" && (
                  <div className="space-y-1.5 p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30">
                    <label className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-emerald-400" />
                      <span>Select Safe-Desk Deposit Counter *</span>
                    </label>
                    <select
                      value={formData.currentCustodyLocationId}
                      onChange={(e) => setFormData({ ...formData, currentCustodyLocationId: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400 font-mono"
                    >
                      {(safeDesks.length > 0 ? safeDesks : locations).map((sd) => (
                        <option key={sd._id} value={sd._id}>
                          {sd.name} — {sd.building || "Campus Zone"} ({sd.operatingHours || "08:00 AM - 06:00 PM"})
                        </option>
                      ))}
                    </select>

                    {selectedSafeDeskObj && (
                      <p className="text-[11px] text-emerald-300/80 mt-1">
                        ✓ Operating hours: {selectedSafeDeskObj.operatingHours || "08:00 AM - 06:00 PM"}. Hand over item to the on-duty Safe-Desk officer.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Final Summary Card */}
            <div className="glass-panel rounded-3xl p-6 border border-white/10 bg-slate-950/70 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  Turn-In Summary Preview
                </span>
                <span className="text-[10px] font-mono text-emerald-400">Ready to Submit</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-mono">Found Item:</span>
                  <div className="text-white font-bold text-sm mt-0.5">{formData.title}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-mono">Category:</span>
                  <div className="text-white font-bold mt-0.5">{selectedCategoryObj.label}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-mono">Found Location:</span>
                  <div className="text-white font-bold mt-0.5">{selectedLocationObj?.name || "Campus Location"}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-mono">Custody Plan:</span>
                  <div className="text-emerald-400 font-bold mt-0.5">
                    {formData.custodyStatus === "SAFE_DESK"
                      ? (selectedSafeDeskObj?.name || "Campus Safe-Desk Station")
                      : formData.custodyStatus === "FINDER_HELD"
                      ? "Finder-Held Personal Custody"
                      : "Department / Admin Office"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stepper Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-slate-800 text-xs font-mono text-slate-300 font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <Link
              href="/lost-and-found"
              className="px-5 py-2.5 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
            >
              Cancel
            </Link>
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || uploadingPhoto}
              className="px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-xl shadow-emerald-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer font-mono"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Turn-In...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Found Report & Claim Bounty</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
