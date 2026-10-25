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
  Sparkles,
  Building,
  Camera,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ReportFoundItemPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<any[]>([]);
  const [safeDesks, setSafeDesks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  const { toast } = useToast();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
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
        const errorMsg = json.error?.message || (typeof json.error === "string" ? json.error : "Failed to submit found item report.");
        throw new Error(errorMsg);
      }

      toast({
        title: "Found Item Turned In",
        description: "Deposit logged in Safe-Desk custody ledger! Reward coins granted.",
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <Link
          href="/lost-and-found"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Lost & Found Directory
        </Link>
      </div>

      <div className="space-y-2 border-b border-white/10 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          ETHICAL FINDER RECOVERY DESK
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          Turn in a Found Belonging
        </h1>
        <p className="text-sm text-slate-400">
          Thank you for keeping AIEM honest. Report belongings discovered on campus. Safe-Desk handovers earn immediate XP, Coins, and Trust tier boosts.
        </p>
      </div>

      {/* Ethical Bounty Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-transparent border border-emerald-500/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="font-bold text-white text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Ethical Samaritan Payout
          </div>
          <p className="text-xs text-slate-400">
            Depositing an item at a campus Safe-Desk instantly awards you +80 XP, +20 Coins, and +20 Trust Score points.
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
            ⭐ +80 XP
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold">
            🪙 +20 Coins
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <MapPin className="w-4 h-4 text-emerald-400" />
            1. Found Item Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-mono text-slate-300">
                Item Title / Summary *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Blue Dell Wireless Mouse, Water Bottle, USB Drive"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
              >
                <option value="ELECTRONICS">Electronics (Laptops, Calculators, Phones)</option>
                <option value="ID_CARDS_DOCS">ID Cards & College Documents</option>
                <option value="BOOKS_NOTES">Books, Notebooks & Lab Manuals</option>
                <option value="BAGS_WALLETS">Bags, Backpacks & Wallets</option>
                <option value="ACCESSORIES">Earphones, Watches, Glasses</option>
                <option value="KEYS">Hostel / Locker / Bike Keys</option>
                <option value="LAB_GEAR">Lab Coats, Breadboards, Instruments</option>
                <option value="OTHER">Other Belongings</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">
                Where did you find it? *
              </label>
              <select
                value={formData.foundLocationId}
                onChange={(e) => setFormData({ ...formData, foundLocationId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
              >
                {locations.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-mono text-slate-300">
                Specific Location Details
              </label>
              <input
                type="text"
                placeholder="e.g. Left on bench #3 outside Block B micro lab"
                value={formData.spotDetails}
                onChange={(e) => setFormData({ ...formData, spotDetails: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-mono text-slate-300">
                Public Description *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe general condition, color, and appearance without revealing any private ID numbers or names."
                value={formData.publicDescription}
                onChange={(e) => setFormData({ ...formData, publicDescription: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 leading-relaxed"
              />
            </div>

            {/* Photo Capture Input */}
            <div className="space-y-2 md:col-span-2 p-4 rounded-xl bg-slate-950/70 border border-white/5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  Belonging Photo / Snapshot (Privacy blur automatically applied for IDs)
                </span>
                {uploadingPhoto && <span className="text-emerald-400 animate-pulse">Uploading photo...</span>}
              </div>

              <div className="flex items-center gap-3">
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
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Photo Attached
                  </span>
                )}
              </div>

              {formData.photoUrl && (
                <div className="relative mt-2 rounded-xl overflow-hidden border border-white/10 h-32 max-w-sm bg-black/40">
                  <img
                    src={formData.photoUrl}
                    alt="Found item"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Custody and Handover Location */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Lock className="w-4 h-4 text-cyan-400" />
            2. Current Custody & Safe-Desk Deposit
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">
                  Custody Status *
                </label>
                <select
                  value={formData.custodyStatus}
                  onChange={(e) => setFormData({ ...formData, custodyStatus: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="SAFE_DESK">Deposited at Campus Safe-Desk (Recommended)</option>
                  <option value="FINDER_HELD">Temporarily held by Finder</option>
                  <option value="ADMIN_OFFICE">Turned in to Department / Admin Office</option>
                </select>
              </div>

              {formData.custodyStatus === "SAFE_DESK" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">
                    Which Safe-Desk Counter? *
                  </label>
                  <select
                    value={formData.currentCustodyLocationId}
                    onChange={(e) => setFormData({ ...formData, currentCustodyLocationId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {safeDesks.map((sd) => (
                      <option key={sd._id} value={sd._id}>
                        {sd.name} ({sd.operatingHours})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4">
          <Link
            href="/lost-and-found"
            className="px-5 py-2.5 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || uploadingPhoto}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-xl shadow-emerald-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer font-mono"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Found Report & Claim Bounty</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

