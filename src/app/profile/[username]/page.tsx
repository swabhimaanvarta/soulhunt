"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Award,
  Trophy,
  FileText,
  Sliders,
  Lock,
  Compass,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Target,
  AlertTriangle,
} from "lucide-react";

import { ProfileUser, ActivitiesData } from "@/components/profile/types";
import AgentHeroCard from "@/components/profile/AgentHeroCard";
import TrophyRoomTab from "@/components/profile/TrophyRoomTab";
import OperationsLedgerTab from "@/components/profile/OperationsLedgerTab";
import TacticalLockerTab from "@/components/profile/TacticalLockerTab";

type TabKey = "overview" | "trophies" | "operations" | "locker";

interface TabDefinition {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
}

const TABS: TabDefinition[] = [
  { key: "overview", label: "Agent Overview", icon: Target },
  { key: "trophies", label: "Trophy Room", icon: Trophy },
  { key: "operations", label: "Operations Ledger", icon: FileText, ownerOnly: true },
  { key: "locker", label: "Locker & Settings", icon: Sliders, ownerOnly: true },
];

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const username = params?.username as string;

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [profileHidden, setProfileHidden] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [activities, setActivities] = useState<ActivitiesData>({
    lostItems: [],
    foundItems: [],
    claims: [],
    achievements: [],
  });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Active Tab State & URL Synchronization
  const tabParam = searchParams?.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const tabListRef = useRef<HTMLDivElement>(null);

  // Fetch Profile Dossier
  const fetchProfile = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setNotFound(false);

    try {
      const res = await fetch(`/api/user/profile?username=${encodeURIComponent(username)}`);
      const data = await res.json();

      if (res.status === 404 || !data.success) {
        setNotFound(true);
        return;
      }

      setIsOwnProfile(Boolean(data.isOwnProfile));
      setProfileHidden(Boolean(data.profileHidden));
      setProfile(data.profile);

      if (data.activities) {
        setActivities({
          lostItems: data.activities.lostItems || [],
          foundItems: data.activities.foundItems || [],
          claims: data.activities.claims || [],
          achievements: data.activities.achievements || [],
        });
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Sync tab from URL parameter once profile ownership is known
  useEffect(() => {
    const validTabs: TabKey[] = isOwnProfile
      ? ["overview", "trophies", "operations", "locker"]
      : ["overview", "trophies"];

    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    } else {
      setActiveTab("overview");
    }
  }, [tabParam, isOwnProfile]);

  // Handle Tab Change with URL Query update
  const handleTabSelect = (tab: TabKey) => {
    setActiveTab(tab);
    const newUrl = `/profile/${encodeURIComponent(username)}?tab=${tab}`;
    window.history.replaceState(null, "", newUrl);
  };

  // Keyboard navigation for WAI-ARIA tablist
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number, availableTabs: TabDefinition[]) => {
    let nextIndex = currentIndex;

    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % availableTabs.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = availableTabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const targetTab = availableTabs[nextIndex];
    handleTabSelect(targetTab.key);

    const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    if (buttons && buttons[nextIndex]) {
      buttons[nextIndex].focus();
    }
  };

  // Available tabs: exactly 2 for visitor, 4 for owner
  const availableTabs = TABS.filter((t) => (t.ownerOnly ? isOwnProfile : true));

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mb-4" />
        <p className="text-xs font-mono text-slate-400 tracking-wider uppercase">
          Decrypting Operative Dossier...
        </p>
      </div>
    );
  }

  // Not Found State (404)
  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur-md">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded border border-red-500/20">
            Error // 404
          </span>
          <h2 className="text-xl font-bold text-white mt-3">Operative Not Found</h2>
          <p className="text-xs text-slate-400 font-mono mt-2 leading-relaxed">
            Callsign <span className="text-white font-bold">@{username}</span> was not located in the AIEM Campus Seeker registry.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-mono font-bold text-white transition-all shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Campus</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Private Profile State
  if (profileHidden && !isOwnProfile) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/20 p-8 text-center shadow-2xl backdrop-blur-md">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <Lock className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
            Security Clearance Level 0
          </span>
          <h2 className="text-xl font-bold text-white mt-3">Classified Dossier</h2>
          <p className="text-sm font-bold text-slate-300 mt-1">
            {profile.displayName &&
            profile.displayName !== `@${profile.username}` &&
            profile.displayName !== profile.username
              ? `${profile.displayName} (@${profile.username})`
              : `@${profile.username}`}
          </p>
          <p className="text-xs text-slate-400 font-mono mt-2 leading-relaxed">
            This hunter&apos;s profile is set to private. Field operations, trophy badges, and campus telemetry records are strictly classified.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-mono font-bold text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Investigator HQ</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Breadcrumb Header */}
      <div className="border-b border-white/5 bg-slate-950/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/5 text-slate-400 hover:text-white transition-colors"
              aria-label="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <Link href="/dashboard" className="hover:text-slate-200 transition-colors">
                HQ
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span>Dossier</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-emerald-400 font-bold">@{profile.username}</span>
            </div>
          </div>

          {isOwnProfile && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-bold">
              Personal Dossier // Clearance 1
            </span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Modern Tactical Valorant Agent Hero Card */}
        <AgentHeroCard user={profile} isOwnProfile={isOwnProfile} />

        {/* WAI-ARIA Accessible Tab Navigation */}
        <div className="border-b border-white/10">
          <div
            ref={tabListRef}
            role="tablist"
            aria-label="Investigator Profile Navigation"
            className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
          >
            {availableTabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  id={`tab-${tab.key}`}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  aria-controls={`tabpanel-${tab.key}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => handleTabSelect(tab.key)}
                  onKeyDown={(e) => handleKeyDown(e, idx, availableTabs)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-mono font-bold transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 ${
                    isSelected
                      ? "bg-slate-800 text-white border border-white/20 shadow-md"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isSelected ? "text-emerald-400" : "text-slate-500"
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Panels */}
        {/* TAB 1: Agent Overview */}
        <div
          id="tabpanel-overview"
          role="tabpanel"
          aria-labelledby="tab-overview"
          hidden={activeTab !== "overview"}
          tabIndex={0}
          className="focus:outline-none space-y-6"
        >
          {/* Quick Overview Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 space-y-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">
                Investigative Specialization
              </span>
              <p className="text-base font-bold text-white">
                {profile.avatarPreset ? `${profile.avatarPreset.toUpperCase()} PROTOCOL` : "RECON RECOVERY"}
              </p>
              <p className="text-xs text-slate-400 font-mono">
                {profile.department} • Year {profile.yearOfStudy || 1}
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 space-y-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">
                Campus Standing
              </span>
              <p className="text-base font-bold text-emerald-400">
                {profile.rankTitle || "Campus Seeker"}
              </p>
              <p className="text-xs text-slate-400 font-mono">
                {typeof profile.level === "number" ? `Tier Rank Level ${profile.level}` : "Unranked Public Profile"}
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 p-5 space-y-2">
              <span className="text-[10px] font-mono text-amber-500/80 uppercase tracking-widest block">
                Trophies & Accolades
              </span>
              <p className="text-base font-bold text-amber-300 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                {(profile.trophies ?? profile.weeklyScore ?? 0).toLocaleString()} 🏆
              </p>
              <p className="text-xs text-slate-400 font-mono">
                {activities.achievements.filter((a) => a.isUnlocked).length} Medals Unlocked
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 space-y-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">
                Squad Deployment
              </span>
              {profile.squad ? (
                <div>
                  <p className="text-base font-bold text-cyan-400">
                    [{profile.squad.tag}] {profile.squad.name}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">
                    Squad Level {profile.squad.squadLevel || 1}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-base font-bold text-slate-400">Independent Operative</p>
                  <p className="text-xs text-slate-500 font-mono">Unattached to any campus squad</p>
                </div>
              )}
            </div>
          </div>

          {/* Featured Trophy Shelf */}
          {activities.achievements.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Featured Trophy Accolades
                </h3>
                <button
                  onClick={() => handleTabSelect("trophies")}
                  type="button"
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <span>View All Medals</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {activities.achievements
                  .filter((a) => a.isUnlocked)
                  .slice(0, 3)
                  .map((item) => (
                    <div
                      key={item._id}
                      className="p-4 rounded-xl border border-white/10 bg-slate-900/60 flex items-center gap-3 shadow-md"
                    >
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">
                          {item.achievementId?.title}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 truncate">
                          {item.achievementId?.description}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* TAB 2: Trophy Room */}
        <div
          id="tabpanel-trophies"
          role="tabpanel"
          aria-labelledby="tab-trophies"
          hidden={activeTab !== "trophies"}
          tabIndex={0}
          className="focus:outline-none"
        >
          <TrophyRoomTab
            achievements={activities.achievements}
            isOwnProfile={isOwnProfile}
          />
        </div>

        {/* TAB 3: Operations Ledger (Owner Only) */}
        {isOwnProfile && (
          <div
            id="tabpanel-operations"
            role="tabpanel"
            aria-labelledby="tab-operations"
            hidden={activeTab !== "operations"}
            tabIndex={0}
            className="focus:outline-none"
          >
            <OperationsLedgerTab
              lostItems={activities.lostItems}
              foundItems={activities.foundItems}
              claims={activities.claims}
            />
          </div>
        )}

        {/* TAB 4: Tactical Locker & Settings (Owner Only) */}
        {isOwnProfile && (
          <div
            id="tabpanel-locker"
            role="tabpanel"
            aria-labelledby="tab-locker"
            hidden={activeTab !== "locker"}
            tabIndex={0}
            className="focus:outline-none"
          >
            <TacticalLockerTab
              user={profile}
              onProfileUpdated={(updated) => {
                setProfile(updated);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
