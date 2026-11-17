"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Calendar,
  Clock,
  UserCheck,
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
  { id: 1, title: "Item Found", subtitle: "Name, category & safe details" },
  { id: 2, title: "Location & Photo", subtitle: "Where on campus" },
  { id: 3, title: "Custody & Verification", subtitle: "Deposit, private detail & review" },
];

export default function ReportFoundItemPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
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
    foundAt: new Date().toISOString().split("T")[0],
    approximateTimeRange: "UNSPECIFIED",
    publicDescription: "",
    secretIdentifiers: "",
    custodyStatus: "SAFE_DESK",
    currentCustodyLocationId: "",
    photoUrl: "",
  });

  const fetchInitialData = useCallback(async () => {
    try {
      const authRes = await fetch("/api/auth/me");
      const authData = await authRes.json();
      if (authData.success && authData.data) {
        setCurrentUser(authData.data);
      }
    } catch {
      // non-blocking
    } finally {
      setAuthChecked(true);
    }

    try {
      const locRes = await fetch("/api/locations");
      const locData = await locRes.json();
      if (locData.success && locData.data) {
        setLocations(locData.data);
        const sds = locData.data.filter((l: any) => l.isSafeDesk && l.isActive !== false);
        setSafeDesks(sds);

        if (locData.data.length > 0) {
          let initialFoundId = locData.data[0]._id;
          if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            const paramId = urlParams.get("locationId");
            if (paramId && locData.data.some((l: any) => l._id === paramId)) {
              initialFoundId = paramId;
            }
          }

          setFormData((prev) => ({
            ...prev,
            foundLocationId: initialFoundId,
            currentCustodyLocationId: sds[0]?._id || "",
          }));
        }
      }
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

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
        description: "Image processed & securely registered in evidence storage.",
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
    if (step === 3) {
      if (formData.custodyStatus === "SAFE_DESK" && !formData.currentCustodyLocationId) {
        setError("Please select an authorized Safe-Desk station for deposit.");
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

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    if (!currentUser) {
      setError("Please sign in before submitting your found item report.");
      router.push("/login?redirect=/lost-and-found/report-found");
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

      // Context-aware success notification
      let toastTitle = "Found Report Published";
      let toastDesc = "Your found report has been registered on the campus network.";
      if (formData.custodyStatus === "SAFE_DESK") {
        toastTitle = "Deposit Reported at Safe-Desk";
        toastDesc = "Report submitted! Awaiting staff physical intake verification at the Safe-Desk station.";
      } else if (formData.custodyStatus === "FINDER_HELD") {
        toastTitle = "Found Report Published";
        toastDesc = "You are holding this item. You will be alerted when an owner files a claim.";
      } else if (formData.custodyStatus === "ADMIN_OFFICE") {
        toastTitle = "Office Turn-In Registered";
        toastDesc = "Handed to department office. Awaiting staff intake confirmation.";
      }

      toast({
        title: toastTitle,
        description: toastDesc,
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
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Lost &amp; Found Directory
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-2 border-b border-white/10 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          OFFICIAL CAMPUS FOUND ITEM TURN-IN
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Turn In a Found Belonging
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
          Report an item you found on campus. Your contact details remain confidential. Unique identifying marks are omitted from public cards to prevent fraudulent claims.
        </p>
      </div>

      {authChecked && !currentUser && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-300">
            <Shield className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              You are currently browsing as a guest. <strong>Sign in</strong> with your college account to receive recovery credit, badges, and trust points when the item is recovered.
            </span>
          </div>
          <Link
            href="/login?redirect=/lost-and-found/report-found"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs shrink-0 transition-all shadow-md text-center"
          >
            Sign In Now
          </Link>
        </div>
      )}

      {/* Structured Stepper Header */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                className={`p-3 rounded-2xl border text-left font-mono transition-all cursor-pointer ${
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
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Multi-Step Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Basic Item Identification */}
        {currentStep === 1 && (
          <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                Step 1: Found Item Basics
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Name the item and describe its general appearance so the rightful owner can recognize it.
              </p>
            </div>

            <div className="space-y-5">
              {/* Title & Live Matches */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-bold">
                  Item Title / Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scientific Calculator, Black Dell Laptop Charger, Silver Metal Key"
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

              {/* Category Grid */}
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

              {/* Public Description with Anti-Fraud Guidance */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-300 font-bold">
                    Public Description *
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Anti-Fraud Safe Guidance
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-[11px] text-slate-400 space-y-1">
                  <span className="font-semibold text-slate-300">Keep unique secrets private:</span>
                  <p>
                    Describe general appearance (color, brand, broad model). <strong>Omit</strong> unique details (exact stickers, keychain charms, serial numbers, wallpaper, wallet contents) so claimants must prove ownership themselves.
                  </p>
                </div>

                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Found a black Casio calculator with a protective slide cover. Minor scratches on the outer shell."
                  value={formData.publicDescription}
                  onChange={(e) => setFormData({ ...formData, publicDescription: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400 leading-relaxed transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Location Discovered & Approximate Date/Time */}
        {currentStep === 2 && (
          <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                Step 2: Campus Location &amp; Photo
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Where and when was the item discovered?
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-bold">
                  Location Found / Campus Sector *
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

              {/* Approximate Date & Time Found */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Date Discovered (Approximate)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.foundAt}
                    onChange={(e) => setFormData({ ...formData, foundAt: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Approximate Time Window</span>
                  </label>
                  <select
                    value={formData.approximateTimeRange}
                    onChange={(e) => setFormData({ ...formData, approximateTimeRange: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400 font-mono"
                  >
                    <option value="UNSPECIFIED">Approximate / Unsure</option>
                    <option value="MORNING">Morning (08:00 AM - 12:00 PM)</option>
                    <option value="AFTERNOON">Afternoon (12:00 PM - 04:00 PM)</option>
                    <option value="EVENING">Evening (04:00 PM - 08:00 PM)</option>
                    <option value="NIGHT">Night (08:00 PM - 12:00 AM)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-bold">
                  Spot Details (Desk, floor, bench)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Second bench from the projector, near power strip, canteen counter"
                  value={formData.spotDetails}
                  onChange={(e) => setFormData({ ...formData, spotDetails: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Photo Upload with Privacy Notice */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-950/70 border border-white/5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    Belonging Photo (Optional)
                  </span>
                  {uploadingPhoto && <span className="text-emerald-400 animate-pulse">Uploading photo...</span>}
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Photo Privacy Notice</span>
                  </div>
                  <p>
                    Do not capture personal ID cards, student roll numbers, faces, or readable addresses. Public images are processed and blurred where sensitive.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <label className="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-white/10 flex items-center gap-2 transition-all">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Upload Item Photo</span>
                    <input
                      type="file"
                      accept="image/*"
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
                      alt="Found item preview"
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

        {/* STEP 3: Custody Choice & Private Verification Detail */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-400" />
                  Step 3: Physical Custody &amp; Private Ownership Check
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Specify who currently holds the physical item and add confidential details to verify future claims.
                </p>
              </div>

              <div className="space-y-5">
                {/* Custody Choices */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-300 font-bold">
                    Where is the item right now? *
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Option 1: Safe-Desk */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, custodyStatus: "SAFE_DESK" })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                        formData.custodyStatus === "SAFE_DESK"
                          ? "bg-emerald-500/15 border-emerald-500/50 text-white ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-500/10"
                          : "bg-slate-950/70 border-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Building className="w-4 h-4 text-emerald-400" />
                        {formData.custodyStatus === "SAFE_DESK" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">Deposited at Safe-Desk</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                          Handed to verified campus security or library desk. Staff will confirm intake.
                        </div>
                      </div>
                    </button>

                    {/* Option 2: Finder Held */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, custodyStatus: "FINDER_HELD" })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                        formData.custodyStatus === "FINDER_HELD"
                          ? "bg-emerald-500/15 border-emerald-500/50 text-white ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-500/10"
                          : "bg-slate-950/70 border-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <UserCheck className="w-4 h-4 text-cyan-400" />
                        {formData.custodyStatus === "FINDER_HELD" && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">Kept by Me (Finder)</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                          You keep the item safely. Coordinate an authorized handover once owner claim is approved.
                        </div>
                      </div>
                    </button>

                    {/* Option 3: Admin / Department Office */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, custodyStatus: "ADMIN_OFFICE" })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                        formData.custodyStatus === "ADMIN_OFFICE"
                          ? "bg-emerald-500/15 border-emerald-500/50 text-white ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-500/10"
                          : "bg-slate-950/70 border-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Shield className="w-4 h-4 text-amber-400" />
                        {formData.custodyStatus === "ADMIN_OFFICE" && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">Department Office</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                          Handed to lab in-charge or proctor office. Awaiting staff intake receipt.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Safe-Desk Station Selector (Only shown if Safe-Desk selected) */}
                {formData.custodyStatus === "SAFE_DESK" && (
                  <div className="space-y-2 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30">
                    <label className="text-xs font-mono text-emerald-300 font-bold flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Select Deposit Safe-Desk Station *</span>
                    </label>
                    <select
                      value={formData.currentCustodyLocationId}
                      onChange={(e) => setFormData({ ...formData, currentCustodyLocationId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
                    >
                      {safeDesks.map((sd) => (
                        <option key={sd._id} value={sd._id}>
                          {sd.name} ({sd.operatingHours || "08:00 AM - 06:00 PM"}) — {sd.building || "Campus Station"}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">
                      The listing will display: <span className="text-amber-300 font-mono">Reported as deposited — awaiting staff intake confirmation</span> until staff verifies physical receipt.
                    </p>
                  </div>
                )}

                {/* Private Identifying Detail (Omitted from public) */}
                <div className="space-y-2 p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono text-cyan-300 font-bold flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-cyan-400" />
                      <span>Private Identifying Detail (For Claim Verification — Never Shown Publicly)</span>
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">Reviewers Only</span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="e.g. Scratched logo on bottom, specific keychain, wallpaper description, exact contents of pocket, unique mark..."
                    value={formData.secretIdentifiers}
                    onChange={(e) => setFormData({ ...formData, secretIdentifiers: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-400 leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-400">
                    Keep this secret from public descriptions. Authorized staff will use this detail to compare against claimant statements to prevent false claims.
                  </p>
                </div>
              </div>
            </div>

            {/* Dossier Summary Preview Card */}
            <div className="glass-panel rounded-3xl p-6 border border-white/10 bg-slate-950/70 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  Turn-In Summary Preview
                </span>
                <span className="text-[10px] font-mono text-emerald-400">Ready to Register</span>
              </div>

              {/* Public Information Grid */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Public Listing Details (Visible to seekers)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-900/50 p-3 rounded-xl border border-white/5">
                  <div>
                    <span className="text-slate-500 font-mono">Title:</span>
                    <div className="text-white font-bold text-sm mt-0.5">{formData.title}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono">Category:</span>
                    <div className="text-white font-bold mt-0.5">{selectedCategoryObj.label}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono">Location Found:</span>
                    <div className="text-white font-bold mt-0.5">{selectedLocationObj?.name || "Campus Location"}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono">Custody Status:</span>
                    <div className="text-emerald-400 font-bold font-mono mt-0.5">
                      {formData.custodyStatus === "SAFE_DESK"
                        ? `Safe-Desk (${selectedSafeDeskObj?.name || "Pending Staff Intake"})`
                        : formData.custodyStatus === "FINDER_HELD"
                        ? "Kept by Finder (Campus Handover)"
                        : "Department Office"}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 font-mono">Public Description:</span>
                    <div className="text-slate-300 mt-0.5 text-xs line-clamp-2">{formData.publicDescription}</div>
                  </div>
                </div>
              </div>

              {/* Private Verification Details */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Confidential Security Check (Reviewers Only)
                </span>
                <div className="bg-cyan-950/20 border border-cyan-500/20 p-3 rounded-xl text-xs space-y-1">
                  <span className="text-cyan-400/80 font-mono text-[11px]">Private Identifying Detail:</span>
                  <div className="text-slate-300 font-mono text-[11px]">
                    {formData.secretIdentifiers ? "Stored confidentially for claim verification" : "None entered"}
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
              className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              Next Step <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="px-7 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-mono font-bold flex items-center gap-2 shadow-xl shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Registering Turn-In...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" /> Turn In Found Belonging
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
