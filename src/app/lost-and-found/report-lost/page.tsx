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
  Sparkles,
} from "lucide-react";

export default function ReportLostItemPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    category: "ELECTRONICS",
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
    fetch("/api/locations")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setLocations(d.data);
          if (d.data.length > 0) {
            setFormData((prev) => ({ ...prev, lastKnownLocationId: d.data[0]._id }));
          }
        }
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/items/lost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to submit lost item report.");
      }

      // Redirect to the item page or quest page
      if (json.data?.quest?._id) {
        router.push(`/quests/${json.data.quest._id}`);
      } else {
        router.push(`/items/${json.data.item._id}`);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

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
        <h1 className="text-3xl font-black text-white tracking-tight">
          Report a Lost Belonging
        </h1>
        <p className="text-sm text-slate-400">
          File a verified lost report. All sensitive student identification is automatically redacted to prevent phishing and unauthorized claims.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Compass className="w-4 h-4 text-emerald-400" />
            1. Basic Item Identification
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-mono text-slate-300">
                Item Title / Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Casio FX-991EX Calculator, Navy Blue HP Backpack"
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
                Last Seen Campus Location *
              </label>
              <select
                value={formData.lastKnownLocationId}
                onChange={(e) => setFormData({ ...formData, lastKnownLocationId: e.target.value })}
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
                Specific Spot Details / Path Breadcrumbs
              </label>
              <input
                type="text"
                placeholder="e.g. Block B Ground Corridor -> Main Canteen -> Microprocessor Lab B-204"
                value={formData.spotDetails}
                onChange={(e) => setFormData({ ...formData, spotDetails: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-slate-300">
                  Public Description (Visible to all students) *
                </label>
                <span className="text-[10px] text-emerald-400 font-mono">
                  Auto-PII Redaction Enabled
                </span>
              </div>
              <textarea
                required
                rows={3}
                placeholder="Describe color, make, scratches, or appearance. Do NOT include your phone number or roll number."
                value={formData.publicDescription}
                onChange={(e) => setFormData({ ...formData, publicDescription: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Secret Identifiers and Verification Questions */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              2. Secret Proof & Verification Question
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300">
              CRYPTOGRAPHICALLY PROTECTED
            </span>
          </div>

          <p className="text-xs text-slate-400">
            To prevent fraudulent claims, provide a verification question only the true owner would know (e.g. What photo is on the lock screen? What initials are engraved on the back?).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-mono text-slate-300">
                Secret Verification Question *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. What sticker is affixed inside the slide lid?"
                value={formData.verificationQuestion}
                onChange={(e) => setFormData({ ...formData, verificationQuestion: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-mono text-slate-300">
                Correct Verification Answer * (Stored as one-way Bcrypt hash)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. fx991ex or Iron Man sticker"
                value={formData.verificationAnswer}
                onChange={(e) => setFormData({ ...formData, verificationAnswer: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-mono text-slate-300">
                Private Identifiers (Only visible to Safe-Desk security officers)
              </label>
              <input
                type="text"
                placeholder="e.g. Scratch near barcode, serial ends in 904"
                value={formData.secretIdentifiers}
                onChange={(e) => setFormData({ ...formData, secretIdentifiers: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        </div>

        {/* Quest & Recovery Settings */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            3. Quest Activation & Finder Bounty
          </h2>

          <div className="space-y-4">
            <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-white/5 cursor-pointer hover:bg-slate-950 transition-colors">
              <input
                type="checkbox"
                checked={formData.convertToQuest}
                onChange={(e) => setFormData({ ...formData, convertToQuest: e.target.checked })}
                className="mt-1 w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-800"
              />
              <div className="space-y-0.5">
                <div className="font-bold text-sm text-white flex items-center gap-2">
                  <span>Activate Campus Investigation Quest</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                    RECOMMENDED
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Turns your report into a cooperative investigation on the Quest Board. Campus hunters and squads will investigate your trail, submit clues, and locate your item faster.
                </p>
              </div>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">
                  Hunter Coin Bounty (Optional)
                </label>
                <div className="relative flex items-center">
                  <Coins className="w-4 h-4 text-amber-400 absolute left-3" />
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={formData.rewardOffered}
                    onChange={(e) => setFormData({ ...formData, rewardOffered: parseInt(e.target.value) || 0 })}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">
                  Preferred Handover Method
                </label>
                <select
                  value={formData.recoveryPreference}
                  onChange={(e) => setFormData({ ...formData, recoveryPreference: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
                >
                  <option value="HANDOVER_AT_SAFE_DESK">
                    Verified Safe-Desk Handover (Main Gate / Library)
                  </option>
                  <option value="DIRECT_CONTACT_MODERATED">
                    Dual 6-Digit Code Direct Verification
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/lost-and-found"
            className="px-5 py-2.5 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-xl shadow-emerald-500/25 transition-all flex items-center gap-2"
          >
            {loading ? (
              <span className="font-mono">Submitting Report...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Publish Lost Report & Deploy Quest
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

