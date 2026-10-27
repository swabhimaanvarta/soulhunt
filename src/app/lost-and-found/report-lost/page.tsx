"use client";

import React, { useState, useEffect } from "react";
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
  { id: 1, title: "Item Identity", subtitle: "Name, category & photo" },
  { id: 2, title: "Campus Location", subtitle: "Where it was last seen" },
  { id: 3, title: "Security Challenge", subtitle: "Secret verification question" },
  { id: 4, title: "Bounty & Review", subtitle: "Quest deployment & summary" },
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
    publicDescription: "",
    secretIdentifiers: "",
    verificationQuestion: "",
    verificationAnswer: "",
    rewardOffered: 10,
    recoveryPreference: "HANDOVER_AT_SAFE_DESK",
    convertToQuest: true,
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setCurrentUser(d.data);
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));

    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setLocations(d.data);
          if (d.data.length > 0) {
            let initialId = d.data[0]._id;
            if (typeof window !== "undefined") {
              const urlParams = new URLSearchParams(window.location.search);
              const paramId = urlParams.get("locationId");
              if (paramId && d.data.some((l: any) => l._id === paramId)) {
                initialId = paramId;
              }
            }
            setFormData((prev) => ({ ...prev, lastKnownLocationId: initialId }));
          }
        }
      });
  }, []);

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
      if (!formData.verificationQuestion.trim() || formData.verificationQuestion.trim().length < 5) {
        setError("Secret verification question must be at least 5 characters long.");
        return false;
      }
      if (!formData.verificationAnswer.trim()) {
        setError("Please provide the correct verification answer.");
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
          ? "Report published & active campus investigation quest initialized!"
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
                Name your belonging and describe its visual characteristics.
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

              {/* Photograph Upload */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-950/70 border border-white/5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                    <Camera className="w-4 h-4 text-rose-400" />
                    Belonging Photo (Optional Reference)
                  </span>
                  {uploadingPhoto && <span className="text-rose-400 animate-pulse">Uploading photo...</span>}
                </div>

                <p className="text-xs text-slate-400">
                  Upload an existing photo or model image to assist campus seekers in identification.
                </p>

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
                  placeholder="Describe color, scratches, stickers, make, or appearance. Do NOT include your phone number or roll number."
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

        {/* STEP 2: Campus Location & Spot */}
        {currentStep === 2 && (
          <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400" />
                Step 2: Campus Location & Path
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Pinpoint where you last had your belonging on campus.
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

        {/* STEP 3: Secret Proof & Verification Challenge */}
        {currentStep === 3 && (
          <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  Step 3: Secret Proof & Ownership Challenge
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Prevents false claims. True owners will match this answer instantly.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 w-fit">
                CRYPTOGRAPHICALLY PROTECTED
              </span>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-bold">
                  Secret Verification Question *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. What sticker is affixed inside the battery compartment? What initials are scratched on the back?"
                  value={formData.verificationQuestion}
                  onChange={(e) => setFormData({ ...formData, verificationQuestion: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-300 font-bold">
                    Correct Verification Answer * (Stored as one-way Bcrypt hash)
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">Never stored in plaintext</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Iron Man sticker or serial 904"
                  value={formData.verificationAnswer}
                  onChange={(e) => setFormData({ ...formData, verificationAnswer: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 font-bold">
                  Private Identifiers (Only visible to authorized Safe-Desk security officers)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Barcode number, IMEI ending in 492, scratch near hinge"
                  value={formData.secretIdentifiers}
                  onChange={(e) => setFormData({ ...formData, secretIdentifiers: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Quest Bounty & Summary Review */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Quest Activation & Bounty */}
            <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Step 4: Quest Bounty & Handover Preference
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Deploy to the campus Quest Board to mobilize student hunters and squads.
                </p>
              </div>

              <div className="space-y-5">
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-slate-950/80 border border-white/10 cursor-pointer hover:border-emerald-500/40 transition-all">
                  <input
                    type="checkbox"
                    checked={formData.convertToQuest}
                    onChange={(e) => setFormData({ ...formData, convertToQuest: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-800"
                  />
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Deploy Campus Investigation Quest</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                        RECOMMENDED
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Publishes an active case file on the Quest Board. Campus hunters and squads will investigate your route, post clues on the Field Evidence board, and locate your item faster.
                    </p>
                  </div>
                </label>

                {/* Bounty presets */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span>Hunter Coin Bounty (Optional Finder Incentive)</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
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
                        +{amt} Coins
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={formData.rewardOffered}
                    onChange={(e) => setFormData({ ...formData, rewardOffered: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                {/* Handover Preference */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 font-bold">
                    Preferred Handover Protocol
                  </label>
                  <select
                    value={formData.recoveryPreference}
                    onChange={(e) => setFormData({ ...formData, recoveryPreference: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400 font-mono"
                  >
                    <option value="HANDOVER_AT_SAFE_DESK">
                      Verified Safe-Desk Handover (Main Gate / Library Station)
                    </option>
                    <option value="DIRECT_CONTACT_MODERATED">
                      Dual 6-Digit PIN Direct Campus Meetup
                    </option>
                  </select>
                </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-mono">Title:</span>
                  <div className="text-white font-bold text-sm mt-0.5">{formData.title}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-mono">Category:</span>
                  <div className="text-white font-bold mt-0.5">{selectedCategoryObj.label}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-mono">Last Known Location:</span>
                  <div className="text-white font-bold mt-0.5">{selectedLocationObj?.name || "Campus Location"}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-mono">Finder Bounty:</span>
                  <div className="text-amber-400 font-bold mt-0.5">+{formData.rewardOffered} Hunter Coins</div>
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

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs font-mono transition-all flex items-center gap-1.5 shadow-lg shadow-rose-500/20 cursor-pointer"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-xl shadow-emerald-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer font-mono"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing Dossier...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Publish Lost Report & Deploy Quest</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
