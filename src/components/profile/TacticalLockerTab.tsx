"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Shield,
  Target,
  Compass,
  Cpu,
  Eye,
  Bookmark,
  Save,
  KeyRound,
  Check,
  AlertCircle,
  EyeOff,
  Lock,
  User,
  GraduationCap,
  Layers,
  Phone,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  COSMETIC_CATALOGUE,
  isCosmeticOwned,
  CosmeticItem,
  CosmeticCategory,
} from "@/lib/cosmetics";
import {
  ProfileUser,
  AVATAR_PRESETS,
  DEPARTMENTS,
  COSMETIC_FRAMES,
  COSMETIC_THEMES,
  COSMETIC_TITLES,
} from "./types";

interface TacticalLockerTabProps {
  user: ProfileUser;
  onProfileUpdated: (updatedUser: ProfileUser) => void;
}

const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  recon: Target,
  scout: Compass,
  infiltrator: Eye,
  tactician: Shield,
  sleuth: Compass,
  vanguard: Shield,
  sentinel: Cpu,
  shadow: Eye,
  archivist: Bookmark,
};

// All 8 supported cosmetic categories
type LockerCategory =
  | "AVATAR"
  | "FRAME"
  | "THEME"
  | "TITLE"
  | "BANNER"
  | "BANNER_FRAME"
  | "EFFECT"
  | "DECORATION";

interface CategoryMeta {
  key: LockerCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const CATEGORIES: CategoryMeta[] = [
  { key: "AVATAR", label: "Avatars", icon: User, description: "Operative field specialization & callsign avatars" },
  { key: "FRAME", label: "Frames", icon: Shield, description: "Holographic avatar borders & cyber frames" },
  { key: "THEME", label: "Themes", icon: Sparkles, description: "Terminal & interface HUD color schemes" },
  { key: "TITLE", label: "Titles", icon: Bookmark, description: "Investigative ranks & operative titles" },
  { key: "BANNER", label: "Banners", icon: Layers, description: "Tactical profile header banners" },
  { key: "BANNER_FRAME", label: "Banner Frames", icon: ShieldCheck, description: "Circuit borders for profile banners" },
  { key: "EFFECT", label: "Banner Effects", icon: Cpu, description: "Holographic distortion & glitch overlays" },
  { key: "DECORATION", label: "Decorations", icon: AlertCircle, description: "Prestige badges & campus insignia" },
];

function getUnlockRequirementText(item: CosmeticItem): string {
  if (item.isStarter || item.unlockType === "STARTER") {
    return "Starter Loadout (Free)";
  }
  if (item.unlockType === "LEVEL" && item.unlockRequirement?.level) {
    return `Unlocked at Level ${item.unlockRequirement.level}`;
  }
  if (item.unlockType === "ACHIEVEMENT") {
    const achName = item.unlockRequirement?.achievementId
      ? item.unlockRequirement.achievementId.replace("ach-", "").replace(/-/g, " ")
      : "Achievement";
    return `Unlocked via [${achName}]`;
  }
  if (item.unlockType === "SHOP") {
    return item.unlockRequirement?.coinCost
      ? `Shop Item (${item.unlockRequirement.coinCost} Coins)`
      : "Shop Item";
  }
  return "Locked";
}

export default function TacticalLockerTab({
  user,
  onProfileUpdated,
}: TacticalLockerTabProps) {
  // Active cosmetic category filter in the locker
  const [activeCategory, setActiveCategory] = useState<LockerCategory>("AVATAR");

  // Wardrobe & Identity Form State
  const [formData, setFormData] = useState({
    displayName: user.displayName || "",
    bio: user.bio || "",
    department: user.department || DEPARTMENTS[0],
    yearOfStudy: user.yearOfStudy || 1,
    studentId: user.studentId || "",
    phoneNumber: user.phoneNumber || "",
    preferredContactMethod: user.preferredContactMethod || "SAFE_DESK",
    avatarPreset: user.avatarPreset || "recon",
    equippedTitle: user.equippedTitle || COSMETIC_TITLES[0],
    equippedFrame: user.equippedFrame || COSMETIC_FRAMES[0].id,
    equippedTheme: user.equippedTheme || COSMETIC_THEMES[0].id,
    equippedBanner: (user as any).equippedBanner || "theme-obsidian-grid",
    equippedBannerFrame: (user as any).equippedBannerFrame || "",
    equippedEffect: (user as any).equippedEffect || "",
    equippedDecoration: (user as any).equippedDecoration || "badge-verified-hunter",
    isProfilePublic: user.isProfilePublic !== false,
    isLeaderboardPublic: user.isLeaderboardPublic !== false,
    identityMode: user.identityMode || "PSEUDONYMOUS",
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password Change Form State
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active cosmetic lookups for Live Wardrobe Preview
  const previewFrame =
    COSMETIC_FRAMES.find((f) => f.id === formData.equippedFrame) || {
      id: formData.equippedFrame,
      name: formData.equippedFrame,
      border: "border-emerald-400",
      shadow: "shadow-[0_0_20px_rgba(16,185,129,0.6)] ring-2 ring-emerald-400/40",
      accent: "text-emerald-400",
      glowColor: "rgba(16, 185, 129, 0.5)",
    };

  const previewTheme =
    COSMETIC_THEMES.find((t) => t.id === formData.equippedTheme) || {
      id: formData.equippedTheme,
      name: formData.equippedTheme,
      bg: "bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border-white/10",
    };

  const PreviewIcon = PRESET_ICONS[formData.avatarPreset] || Target;

  // Catalogue items normalized by category
  const getCategoryItems = (cat: LockerCategory): CosmeticItem[] => {
    if (cat === "AVATAR") {
      const catalogueAvatars = COSMETIC_CATALOGUE.filter((item) => item.category === "AVATAR");
      // Add legacy presets if not in catalogue
      const extraPresets: CosmeticItem[] = AVATAR_PRESETS.filter(
        (p) => !catalogueAvatars.some((a) => a.id === p.id)
      ).map((p) => ({
        id: p.id,
        name: p.name,
        category: "AVATAR",
        rarity: "COMMON",
        isStarter: true,
        unlockType: "STARTER",
        description: p.roleDesc,
        previewUrl: `/avatars/${p.id}.png`,
      }));
      return [...catalogueAvatars, ...extraPresets];
    }

    if (cat === "FRAME") {
      const catalogueFrames = COSMETIC_CATALOGUE.filter((item) => item.category === "FRAME");
      const extraFrames: CosmeticItem[] = COSMETIC_FRAMES.filter(
        (f) => !catalogueFrames.some((c) => c.id === f.id)
      ).map((f) => ({
        id: f.id,
        name: f.name,
        category: "FRAME",
        rarity: "COMMON",
        isStarter: true,
        unlockType: "STARTER",
        description: "Holographic operative avatar border.",
      }));
      return [...catalogueFrames, ...extraFrames];
    }

    if (cat === "THEME") {
      const catalogueThemes: CosmeticItem[] = COSMETIC_THEMES.map((t) => ({
        id: t.id,
        name: t.name,
        category: "BANNER", // Mapped to theme in catalogue
        rarity: "COMMON",
        isStarter: true,
        unlockType: "STARTER",
        description: "Terminal and interface HUD backdrop.",
      }));
      return catalogueThemes;
    }

    if (cat === "TITLE") {
      const catalogueTitles = COSMETIC_CATALOGUE.filter((item) => item.category === "TITLE");
      const extraTitles: CosmeticItem[] = COSMETIC_TITLES.filter(
        (t) => !catalogueTitles.some((c) => c.id === t || c.name === t)
      ).map((t) => ({
        id: t,
        name: t,
        category: "TITLE",
        rarity: "COMMON",
        isStarter: true,
        unlockType: "STARTER",
        description: "Operative identity title.",
      }));
      return [...catalogueTitles, ...extraTitles];
    }

    if (cat === "BANNER") {
      return COSMETIC_CATALOGUE.filter((item) => item.category === "BANNER");
    }

    if (cat === "BANNER_FRAME") {
      return COSMETIC_CATALOGUE.filter((item) => item.category === "BANNER_FRAME");
    }

    if (cat === "EFFECT") {
      return COSMETIC_CATALOGUE.filter((item) => item.category === "EFFECT");
    }

    if (cat === "DECORATION") {
      return COSMETIC_CATALOGUE.filter((item) => item.category === "DECORATION");
    }

    return [];
  };

  const isEquipped = (cat: LockerCategory, itemId: string, itemName: string): boolean => {
    switch (cat) {
      case "AVATAR":
        return formData.avatarPreset === itemId;
      case "FRAME":
        return formData.equippedFrame === itemId;
      case "THEME":
        return formData.equippedTheme === itemId;
      case "TITLE":
        return formData.equippedTitle === itemName || formData.equippedTitle === itemId;
      case "BANNER":
        return formData.equippedBanner === itemId;
      case "BANNER_FRAME":
        return formData.equippedBannerFrame === itemId;
      case "EFFECT":
        return formData.equippedEffect === itemId;
      case "DECORATION":
        return formData.equippedDecoration === itemId;
      default:
        return false;
    }
  };

  const handleEquipItem = (cat: LockerCategory, item: CosmeticItem) => {
    switch (cat) {
      case "AVATAR":
        setFormData((prev) => ({ ...prev, avatarPreset: item.id }));
        break;
      case "FRAME":
        setFormData((prev) => ({ ...prev, equippedFrame: item.id }));
        break;
      case "THEME":
        setFormData((prev) => ({ ...prev, equippedTheme: item.id }));
        break;
      case "TITLE":
        setFormData((prev) => ({ ...prev, equippedTitle: item.name || item.id }));
        break;
      case "BANNER":
        setFormData((prev) => ({ ...prev, equippedBanner: item.id }));
        break;
      case "BANNER_FRAME":
        setFormData((prev) => ({ ...prev, equippedBannerFrame: item.id }));
        break;
      case "EFFECT":
        setFormData((prev) => ({ ...prev, equippedEffect: item.id }));
        break;
      case "DECORATION":
        setFormData((prev) => ({ ...prev, equippedDecoration: item.id }));
        break;
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update profile settings.");
      }

      setProfileMsg({ type: "success", text: "Tactical locker & credentials successfully updated." });
      if (data.user) {
        onProfileUpdated(data.user);
      }
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMsg(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      setSavingPassword(false);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "New password must be at least 8 characters long." });
      setSavingPassword(false);
      return;
    }

    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || "Failed to change password.");
      }

      setPasswordMsg({ type: "success", text: "Security credentials updated. Password changed successfully." });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err.message || "Failed to change password." });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Live Interactive Wardrobe & Cosmetic Loadout */}
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Tactical Wardrobe & Cosmetic Loadout
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Equip operative avatars, glowing frames, interface themes, and custom titles.
            </p>
          </div>
          <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
            Interactive Live Preview
          </span>
        </div>

        {/* Live Preview Display Card */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-950/80 rounded-2xl border border-white/10">
          <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase mb-3">
            Real-Time Operative Card Preview
          </span>

          <div
            className={`w-full max-w-sm rounded-xl border p-4 ${previewTheme.bg} shadow-xl flex items-center gap-4 transition-all duration-300`}
          >
            <div
              className={`w-16 h-16 rounded-xl flex items-center justify-center bg-slate-950 border-2 ${previewFrame.border} ${previewFrame.shadow} shrink-0`}
            >
              <PreviewIcon className={`w-8 h-8 ${previewFrame.accent}`} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 block w-fit mb-1">
                {formData.equippedTitle}
              </span>
              <p className="font-bold text-white text-sm truncate">
                {formData.displayName || user.displayName}
              </p>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                @{user.username} • {formData.department}
              </p>
            </div>
          </div>
        </div>

        {/* Category Switcher Tabs */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              Armory Customization Categories
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Select category to browse & equip unlocked cosmetics
            </span>
          </div>

          <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-white/5">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-mono font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 ${
                    isActive
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Category Description Banner */}
          <div className="text-xs font-mono text-slate-400 px-1 flex items-center justify-between">
            <span>
              {CATEGORIES.find((c) => c.key === activeCategory)?.description}
            </span>
            <span className="text-[10px] text-slate-500 uppercase">
              {getCategoryItems(activeCategory).length} items in catalogue
            </span>
          </div>

          {/* Category Items Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {getCategoryItems(activeCategory).map((item) => {
              const isOwned = item.isStarter || isCosmeticOwned(user as any, item.id, user.level);
              const equipped = isEquipped(activeCategory, item.id, item.name);
              const reqText = getUnlockRequirementText(item);
              const PresetIcon = PRESET_ICONS[item.id] || Target;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!isOwned}
                  onClick={() => handleEquipItem(activeCategory, item)}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all relative overflow-hidden group ${
                    equipped
                      ? "bg-slate-800/90 border-emerald-400/60 ring-1 ring-emerald-400/50 shadow-lg shadow-emerald-500/10"
                      : isOwned
                      ? "bg-slate-950/70 border-white/10 hover:border-emerald-500/40 hover:bg-slate-900 cursor-pointer"
                      : "bg-slate-950/40 border-dashed border-white/10 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="space-y-2 w-full">
                    {/* Header: Title & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {activeCategory === "AVATAR" ? (
                          <div className="w-7 h-7 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center shrink-0">
                            <PresetIcon className="w-4 h-4 text-emerald-400" />
                          </div>
                        ) : activeCategory === "FRAME" ? (
                          <span className="w-3.5 h-3.5 rounded-full border border-current text-cyan-400 bg-current/20 shrink-0" />
                        ) : null}
                        <div>
                          <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                            {item.name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-500 block truncate">
                            {item.rarity}
                          </span>
                        </div>
                      </div>

                      {/* Status Indicator */}
                      {equipped ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          <Check className="w-3 h-3" />
                          <span>Equipped</span>
                        </span>
                      ) : !isOwned ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>Locked</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-white/5">
                          Owned
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-slate-400 line-clamp-2 font-mono leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Footer: Unlock Requirement / Equip action */}
                  <div className="pt-2.5 mt-2 border-t border-white/5 flex items-center justify-between w-full text-[10px] font-mono">
                    {!isOwned ? (
                      <span className="text-amber-400/90 flex items-center gap-1 font-bold">
                        <Lock className="w-3 h-3" />
                        {reqText}
                      </span>
                    ) : equipped ? (
                      <span className="text-emerald-400 font-bold">Active in Loadout</span>
                    ) : (
                      <span className="text-slate-400 group-hover:text-white">Click to Equip</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: Identity & Academic Credentials Form */}
      <form onSubmit={handleSaveProfile} className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="border-b border-white/10 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            Identity & Academic Record
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Configure how your operative identity is presented across campus operations.
          </p>
        </div>

        {profileMsg && (
          <div
            className={`p-4 rounded-xl text-xs font-mono flex items-center gap-2 ${
              profileMsg.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
            }`}
          >
            {profileMsg.type === "success" ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{profileMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300">
              Display Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={50}
              value={formData.displayName}
              onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300">
              Department
            </label>
            <select
              value={formData.department}
              onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Year of Study */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300">
              Year of Study (1 - 5)
            </label>
            <select
              value={formData.yearOfStudy}
              onChange={(e) => setFormData((prev) => ({ ...prev, yearOfStudy: Number(e.target.value) }))}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {[1, 2, 3, 4, 5].map((yr) => (
                <option key={yr} value={yr}>
                  Year {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Identity Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300">
              Identity Presentation Mode
            </label>
            <select
              value={formData.identityMode}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  identityMode: e.target.value as "PSEUDONYMOUS" | "PUBLIC" | "ANONYMOUS",
                }))
              }
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="PSEUDONYMOUS">Pseudonymous (@username handle)</option>
              <option value="PUBLIC">Public (Display Name)</option>
              <option value="ANONYMOUS">Anonymous (Anonymous Hunter)</option>
            </select>
          </div>

          {/* Student ID (Confidential) */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300">
              Student ID (Private // Safe-Desk Verification Only)
            </label>
            <input
              type="text"
              maxLength={30}
              value={formData.studentId}
              placeholder="e.g. AIEM2024CS001"
              onChange={(e) => setFormData((prev) => ({ ...prev, studentId: e.target.value }))}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 uppercase"
            />
          </div>

          {/* Phone Number (Confidential) */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300">
              Phone Number (Private // Safe-Desk Notifications)
            </label>
            <input
              type="text"
              maxLength={25}
              value={formData.phoneNumber}
              placeholder="+91 ..."
              onChange={(e) => setFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Preferred Contact Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300">
              Preferred Contact Channel
            </label>
            <select
              value={formData.preferredContactMethod}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  preferredContactMethod: e.target.value as "EMAIL" | "PHONE" | "SAFE_DESK",
                }))
              }
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="SAFE_DESK">Safe-Desk Station Only (Highest Privacy)</option>
              <option value="EMAIL">Campus Email</option>
              <option value="PHONE">Phone / SMS</option>
            </select>
          </div>
        </div>

        {/* Bio Textarea */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-mono font-bold text-slate-300">
              Operative Transmission Bio (Max 300 Chars)
            </label>
            <span className="text-[10px] font-mono text-slate-500">
              {formData.bio.length} / 300
            </span>
          </div>
          <textarea
            rows={3}
            maxLength={300}
            value={formData.bio}
            placeholder="State your campus investigative objective or specialty..."
            onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none font-mono"
          />
        </div>

        {/* Privacy Invariants & Toggles */}
        <div className="p-4 bg-slate-950/60 rounded-xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Campus Privacy Invariants
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isProfilePublic}
                onChange={(e) => setFormData((prev) => ({ ...prev, isProfilePublic: e.target.checked }))}
                className="mt-1 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-400"
              />
              <div className="text-xs font-mono">
                <span className="font-bold text-white block">Public Profile Clearance</span>
                <span className="text-slate-400 text-[11px]">
                  Allow fellow students to view your dossier card and unlocked trophies.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isLeaderboardPublic}
                onChange={(e) => setFormData((prev) => ({ ...prev, isLeaderboardPublic: e.target.checked }))}
                className="mt-1 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-400"
              />
              <div className="text-xs font-mono">
                <span className="font-bold text-white block">Leaderboard & XP Broadcast</span>
                <span className="text-slate-400 text-[11px]">
                  Publish your level and XP to campus leaderboards. When disabled, you display as &quot;Unranked Operative&quot;.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Save Identity Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingProfile ? "Saving Loadout..." : "Save Locker & Loadout"}</span>
          </button>
        </div>
      </form>

      {/* SECTION 3: Account Security & Password Form */}
      <form onSubmit={handleSavePassword} className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="border-b border-white/10 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-cyan-400" />
            Account Security & Access Key
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Update your authentication password. Requires at least 8 characters with upper, lower, and numeric characters.
          </p>
        </div>

        {passwordMsg && (
          <div
            className={`p-4 rounded-xl text-xs font-mono flex items-center gap-2 ${
              passwordMsg.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
            }`}
          >
            {passwordMsg.type === "success" ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300">
              Current Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300">
              New Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-slate-300">
              Confirm New Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1.5"
          >
            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPassword ? "Hide Passwords" : "Show Passwords"}</span>
          </button>

          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-bold text-xs font-mono transition-all disabled:opacity-50"
          >
            <Lock className="w-4 h-4 text-cyan-400" />
            <span>{savingPassword ? "Updating Access Key..." : "Update Password"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
