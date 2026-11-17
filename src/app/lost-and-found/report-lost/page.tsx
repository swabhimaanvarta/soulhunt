"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  HelpCircle,
  MapPin,
  Lock,
  Compass,
  Coins,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  Camera,
  Laptop,
  CreditCard,
  BookOpen,
  Watch,
  Key,
  Briefcase,
  FlaskConical,
  Package,
  Eye,
  Check,
  X,
  FileText,
  Calendar,
  Clock,
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
  { id: 1, title: "Item Identity", subtitle: "Name, category & safe visuals" },
  { id: 2, title: "Campus Location", subtitle: "Where & when it was seen" },
  { id: 3, title: "Ownership Proof", subtitle: "Private evidence & challenge" },
  { id: 4, title: "Review & Publish", subtitle: "Summary & optional quest" },
];

export default function ReportLostItemPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    category: "ELECTRONICS",
    photoUrl: "",
    lastKnownLocationId: "",
    spotDetails: "",
    lostAt: new Date().toISOString().split("T")[0],
    approximateTimeRange: "UNSPECIFIED",
    publicDescription: "",
    secretIdentifiers: "",
    verificationQuestion: "",
    verificationAnswer: "",
    rewardOffered: 0,
    recoveryPreference: "HANDOVER_AT_SAFE_DESK",
    convertToQuest: false,
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
        if (locData.data.length > 0) {
          let initialId = locData.data[0]._id;
          if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            const paramId = urlParams.get("locationId");
            if (paramId && locData.data.some((l: any) => l._id === paramId)) {
              initialId = paramId;
            }
          }
          setFormData((prev) => ({ ...prev, lastKnownLocationId: initialId }));
        }
      }
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Real-time PII detection check
  const hasPhoneDetected = /\b\d{10}\b/.test(formData.publicDescription);
  const hasEmailDetected = /[\w.-]+@[\w.-]+\.\w+/.test(formData.publicDescription);

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
        title: "Photo Uploaded",
        description: "Image attached to your lost item dossier.",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Upload Error",
        description: err.message || "Failed to upload image",
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
      if (!formData.lastKnownLocationId) {
        setError("Please select the last seen campus location.");
        return false;
      }
    }
    if (step === 3) {
      // Verification question is optional, but if question is provided, answer should also be provided
      if (formData.verificationQuestion.trim().length > 0 && !formData.verificationAnswer.trim()) {
        setError("If you set a verification question, please provide the correct answer as well.");
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
      setCurrentStep((prev) => Math.min(prev + 1, 4));
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
      setError("Please sign in before submitting your lost item report.");
      router.push("/login?redirect=/lost-and-found/report-lost");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const clientRequestId = `lost_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch("/api/items/lost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, clientRequestId }),
      });

      const json = await res.json();
      if (!json.success) {
        const errorMsg =
          json.error?.message ||
          (typeof json.error === "string" ? json.error : "Failed to submit lost item report.");
        throw new Error(errorMsg);
      }

      toast({
        title: "Lost Report Published",
        description: json.data?.quest
          ? "Report published & campus investigation quest initialized!"
          : "Your lost belonging is registered on the campus directory.",
        variant: "success",
      });

      router.push(`/items/${json.data.item._id}`);
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
  const selectedLocationObj = locations.find((l) => l._id === formData.lastKnownLocationId);

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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-xs font-semibold">
          <Shield className="w-3.5 h-3.5 text-rose-400" />
          OFFICIAL CAMPUS LOST ITEM DOSSIER
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Report a Lost Belonging
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
          File a verified campus lost report. Sensitive student identification is automatically redacted to prevent unauthorized claims and safeguard privacy.
        </p>
      </div>

      {authChecked && !currentUser && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-300">
            <Shield className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              You are currently browsing as a guest. <strong>Sign in</strong> with your college account to ensure claim notifications and recovered item alerts are delivered to your portal.
            </span>
          </div>
          <Link
            href="/login?redirect=/lost-and-found/report-lost"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs shrink-0 transition-all shadow-md text-center"
          >
            Sign In Now
          </Link>
        </div>
      )}

      {/* Structured Stepper Header */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    ? "bg-rose-500/15 border-rose-500/40 text-white shadow-md shadow-rose-500/10"
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
                        ? "bg-rose-500/30 text-rose-300 border border-rose-500/50"
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

        {/* Horizontal Progress Bar */}
        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-300"
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

        {/* STEP 1: Basic Item Identification & Photo */}
        {currentStep === 1 && (
          <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-rose-400" />
                Step 1: Item Identity & Visuals
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Name your belonging and describe its general appearance for public discovery.
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
                  placeholder="e.g. Casio FX-991EX Calculator, Navy Blue HP Backpack"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-400 transition-colors"
                />

                <LiveMatchDrawer
                  type="LOST"
                  title={formData.title}
                  category={formData.category}
                  locationId={formData.lastKnownLocationId}
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
                            ? "bg-rose-500/20 border-rose-500/50 text-white shadow-md shadow-rose-500/10 ring-1 ring-rose-500/40"
                            : "bg-slate-950/70 border-white/5 text-slate-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className={`w-4 h-4 ${isSelected ? "text-rose-400" : "text-slate-500"}`} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-rose-400" />}
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

              {/* Photograph Upload & Privacy Notice */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-950/70 border border-white/5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                    <Camera className="w-4 h-4 text-rose-400" />
                    Belonging Photo (Optional Reference)
                  </span>
                  {uploadingPhoto && <span className="text-rose-400 animate-pulse">Uploading photo...</span>}
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-rose-400" />
                    <span>Photo Privacy Guidance</span>
                  </div>
                  <p>
                    Do NOT upload photos containing faces, student IDs, phone numbers, addresses, or serial numbers. Uploaded photos are scanned and blurred when necessary.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <label className="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-white/10 flex items-center gap-2 transition-all">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Upload Belonging Photo</span>
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
                      alt="Lost item preview"
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

              {/* Public Description with PII Monitor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-300 font-bold">
                    Public Description (Visible to all students) *
                  </label>
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Auto-PII Redaction Enabled
                  </span>
                </div>

                <textarea
                  required
                  rows={3}
                  placeholder="Describe color, scratches, stickers, make, or appearance. Do NOT include your phone number, roll number, or serial numbers here."
                  value={formData.publicDescription}
                  onChange={(e) => setFormData({ ...formData, publicDescription: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-400 leading-relaxed transition-colors"
                />

                {(hasPhoneDetected || hasEmailDetected) && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      Notice: Contact information detected. Our privacy filter will automatically sanitize this before public display.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Campus Location & Approximate Date/Time */}
        {currentStep === 2 && (
          <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400" />
                Step 2: Campus Location & Approximate Time
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Pinpoint where and roughly when you last had your belonging on campus.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-bold">
                  Last Seen Campus Location / Sector *
                </label>
                <select
                  value={formData.lastKnownLocationId}
                  onChange={(e) => setFormData({ ...formData, lastKnownLocationId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-400 font-mono"
                >
                  {locations.map((loc) => (
                    <option key={loc._id} value={loc._id}>
                      {loc.name} ({loc.code}) — {loc.building || "Campus Zone"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Approximate Date & Time Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-rose-400" />
                    <span>Approximate Date Lost (Optional Estimate)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.lostAt}
                    onChange={(e) => setFormData({ ...formData, lostAt: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-400 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                    <span>Approximate Time Window (Optional)</span>
                  </label>
                  <select
                    value={formData.approximateTimeRange}
                    onChange={(e) => setFormData({ ...formData, approximateTimeRange: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-400 font-mono"
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
                  Specific Spot Details / Path Breadcrumbs
                </label>
                <input
                  type="text"
                  placeholder="e.g. Block B Ground Corridor -> Main Canteen -> Microprocessor Lab B-204"
                  value={formData.spotDetails}
                  onChange={(e) => setFormData({ ...formData, spotDetails: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-400"
                />
                <p className="text-[11px] text-slate-400">
                  Providing your walking path helps campus searchers trace the exact route.
                </p>
              </div>

              {selectedLocationObj && (
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-2 text-xs font-mono">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Sector Intelligence</span>
                  </div>
                  <div className="text-white font-bold">{selectedLocationObj.name}</div>
                  <div className="text-slate-400">{selectedLocationObj.description || "Active academic zone"}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Private Ownership Evidence & Optional Challenge */}
        {currentStep === 3 && (
          <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  Step 3: Private Ownership Evidence & Optional Challenge
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Kept strictly confidential. Only authorized reviewers compare this to verify ownership.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 w-fit">
                CONFIDENTIAL &amp; ENCRYPTED
              </span>
            </div>

            <div className="space-y-6">
              {/* Private Ownership Evidence */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/20">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-cyan-300 font-bold flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>Private Ownership Details (Never Shown Publicly)</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">Reviewer Only</span>
                </div>
                <textarea
                  rows={3}
                  placeholder="e.g. Scratched initial on the back cover, lockscreen photo description, invoice number, items inside the zipper compartment..."
                  value={formData.secretIdentifiers}
                  onChange={(e) => setFormData({ ...formData, secretIdentifiers: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-400 leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  This field is completely hidden from public listings, search results, and map pins. Safe-Desk staff will use this to verify claimant descriptions.
                </p>
              </div>

              {/* Optional Verification Question */}
              <div className="space-y-4 p-4 rounded-2xl bg-slate-950/50 border border-white/5">
                <div className="space-y-1">
                  <div className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-cyan-400" />
                    <span>Optional Secret Verification Question</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    If you prefer, you can set a secret question for a finder to answer. The question prompt is NOT exposed publicly. You may leave this blank if your private evidence above is sufficient.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-400">
                    Question (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. What sticker is inside the battery lid? What is on the keychain?"
                    value={formData.verificationQuestion}
                    onChange={(e) => setFormData({ ...formData, verificationQuestion: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                {formData.verificationQuestion.trim().length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono text-slate-400">
                        Answer * (Stored as one-way Bcrypt hash)
                      </label>
                      <span className="text-[10px] text-cyan-400 font-mono">One-way hash verifier</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Blue dragon sticker"
                      value={formData.verificationAnswer}
                      onChange={(e) => setFormData({ ...formData, verificationAnswer: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Bounty, Quest Opt-In & Summary Review */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Quest Activation & Bounty */}
            <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Step 4: Bounty & Handover Preference
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Choose your return preferences and optional community incentives.
                </p>
              </div>

              <div className="space-y-5">
                {/* Handover Preference */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 font-bold">
                    Preferred Handover Protocol
                  </label>
                  <select
                    value={formData.recoveryPreference}
                    onChange={(e) => setFormData({ ...formData, recoveryPreference: e.target.value as any })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400 font-mono"
                  >
                    <option value="HANDOVER_AT_SAFE_DESK">
                      Verified Safe-Desk Handover (Campus Safe-Desk Stations — Recommended)
                    </option>
                    <option value="DIRECT_CAMPUS_MEETUP">
                      Dual 6-Digit PIN Direct Campus Meetup
                    </option>
                    <option value="MODERATOR_OFFICE">
                      Security &amp; Proctor Office Intake
                    </option>
                  </select>
                </div>

                {/* Bounty presets (Default 0) */}
                <div className="space-y-2 p-4 rounded-2xl bg-slate-950/60 border border-white/5">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>Hunter Coin Bounty (Optional Finder Incentive — Default: 0)</span>
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Coins are escrowed and awarded to the finder only upon verified physical handover certification.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {[0, 10, 25, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setFormData({ ...formData, rewardOffered: amt })}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                          formData.rewardOffered === amt
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                            : "bg-slate-950 text-slate-400 border-white/5 hover:text-white"
                        }`}
                      >
                        {amt === 0 ? "No Bounty (0)" : `+${amt} Coins`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quest Opt-In Toggle */}
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-slate-950/80 border border-white/10 cursor-pointer hover:border-emerald-500/40 transition-all">
                  <input
                    type="checkbox"
                    checked={formData.convertToQuest}
                    onChange={(e) => setFormData({ ...formData, convertToQuest: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-800"
                  />
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Deploy Campus Investigation Quest (Opt-in)</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Publishes a collaborative case file on the Quest Board so campus hunters and squads can help look for clues along your route.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Dossier Summary Preview Card */}
            <div className="glass-panel rounded-3xl p-6 border border-white/10 bg-slate-950/70 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  Dossier Summary Preview
                </span>
                <span className="text-[10px] font-mono text-emerald-400">Ready to Publish</span>
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
                    <span className="text-slate-500 font-mono">Last Seen Location:</span>
                    <div className="text-white font-bold mt-0.5">{selectedLocationObj?.name || "Campus Location"}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-mono">Approximate Date &amp; Time:</span>
                    <div className="text-slate-300 font-mono mt-0.5">
                      {formData.lostAt || "Not specified"} ({formData.approximateTimeRange})
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 font-mono">Public Description:</span>
                    <div className="text-slate-300 mt-0.5 text-xs line-clamp-2">{formData.publicDescription}</div>
                  </div>
                </div>
              </div>

              {/* Private Security Details */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Confidential Verification Security (Reviewers Only)
                </span>
                <div className="bg-cyan-950/20 border border-cyan-500/20 p-3 rounded-xl text-xs space-y-1.5">
                  <div>
                    <span className="text-cyan-400/80 font-mono text-[11px]">Private Ownership Evidence:</span>
                    <div className="text-slate-300 font-mono text-[11px]">
                      {formData.secretIdentifiers ? "Configured & Protected" : "None provided"}
                    </div>
                  </div>
                  <div>
                    <span className="text-cyan-400/80 font-mono text-[11px]">Encrypted Verification Challenge:</span>
                    <div className="text-slate-300 font-mono text-[11px]">
                      {formData.verificationQuestion ? "Configured & One-way Hashed" : "None (Evidence-based review)"}
                    </div>
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

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-rose-500/20 transition-all cursor-pointer"
            >
              Next Step <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="px-7 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-xl shadow-rose-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Publishing Lost Report...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" /> Publish Verified Lost Dossier
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
