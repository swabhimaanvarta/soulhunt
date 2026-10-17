"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Coins,
  Settings,
  AlertTriangle,
  Compass,
  MapPin,
  CheckCircle2,
  Lock,
  PlusCircle,
  RefreshCw,
  Users,
  Building,
  Save,
  Check,
  Sparkles,
  Trophy,
  Calendar,
} from "lucide-react";

export default function AdminControlPage() {
  const [activeTab, setActiveTab] = useState<"CONFIG" | "FRAUD" | "CREATE_QUEST" | "LOCATIONS" | "AI_GENERATOR">("CONFIG");
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Economy config form state
  const [configForm, setConfigForm] = useState<any>({
    xpPerLevelBase: 250,
    xpLevelMultiplier: 1.2,
    globalXpMultiplier: 1.0,
    globalCoinMultiplier: 1.0,
    defaultFinderBonusPct: 15,
    maxFinderBonusPct: 25,
    pairCollusionWindowDays: 30,
    pairCollusionMaxCount: 2,
    dailyReportLimitPerUser: 5,
    allowedEmailDomains: "@student.aiem.edu, @aiem.edu",
    maintenanceMode: false,
  });

  // Quest creator form state
  const [newQuest, setNewQuest] = useState({
    title: "",
    description: "",
    questType: "CAMPUS_TREASURE",
    difficulty: 3,
    targetLocationId: "",
    xpReward: 200,
    coinReward: 40,
    squadXpReward: 70,
    clues: [
      {
        title: "Stage 1: Perimeter Check",
        clueText: "What color is the banner at the entrance?",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "blue",
        hintText: "Look up at the main sign.",
        hintCoinCost: 10,
      },
    ],
  });
  const [questSubmitting, setQuestSubmitting] = useState(false);
  const [questSuccess, setQuestSuccess] = useState<string | null>(null);

  // New location state
  const [newLoc, setNewLoc] = useState({
    name: "",
    code: "",
    zoneType: "ACADEMIC_BLOCK",
    description: "",
    lat: 22.9868,
    lng: 88.4312,
    mapX: 50,
    mapY: 50,
    isSafeDesk: false,
    operatingHours: "08:00 AM - 06:00 PM",
  });
  const [locSubmitting, setLocSubmitting] = useState(false);

  // AI Game Master state
  const [aiTheme, setAiTheme] = useState("CAMPUS_MYSTERY");
  const [aiDifficulty, setAiDifficulty] = useState(3);
  const [aiQuestType, setAiQuestType] = useState("CAMPUS_TREASURE");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [generatedQuestData, setGeneratedQuestData] = useState<any>(null);

  // Campus Event Organizer state
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    eventType: "INTER_DEPT",
    rules: "Solve sequential clues; strictly safe items; winner takes 300 Coins.",
    firstPlaceCoins: 300,
    secondPlaceCoins: 175,
    thirdPlaceCoins: 100,
    exclusiveTitle: "AIEM Vanguard",
  });
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventSuccess, setEventSuccess] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await fetch("/api/admin/overview");
      const json = await res.json();
      if (json.success && json.data) {
        setOverview(json.data);
        if (json.data.config) {
          setConfigForm({
            ...json.data.config,
            allowedEmailDomains: Array.isArray(json.data.config.allowedEmailDomains)
              ? json.data.config.allowedEmailDomains.join(", ")
              : json.data.config.allowedEmailDomains,
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setSaveSuccess(false);

    try {
      const domains = configForm.allowedEmailDomains
        .split(",")
        .map((d: string) => d.trim().toLowerCase())
        .filter(Boolean);

      const payload = {
        ...configForm,
        allowedEmailDomains: domains,
        xpPerLevelBase: Number(configForm.xpPerLevelBase),
        xpLevelMultiplier: Number(configForm.xpLevelMultiplier),
        globalXpMultiplier: Number(configForm.globalXpMultiplier),
        globalCoinMultiplier: Number(configForm.globalCoinMultiplier),
        defaultFinderBonusPct: Number(configForm.defaultFinderBonusPct),
        maxFinderBonusPct: Number(configForm.maxFinderBonusPct),
        pairCollusionWindowDays: Number(configForm.pairCollusionWindowDays),
        pairCollusionMaxCount: Number(configForm.pairCollusionMaxCount),
        dailyReportLimitPerUser: Number(configForm.dailyReportLimitPerUser),
      };

      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to update configuration.");

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      fetchOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleResolveFraud = async (alertId: string, resolution: string, deductTrust: boolean) => {
    try {
      const res = await fetch("/api/admin/fraud/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertId,
          resolution,
          deductTrustScore: deductTrust,
          notes: "Audited and resolved by Security Administrator.",
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchOverview();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCreateQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuestSubmitting(true);
    setQuestSuccess(null);

    try {
      const res = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newQuest),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to create quest.");

      setQuestSuccess(`Quest "${json.data?.title}" successfully registered and published!`);
      setNewQuest({
        title: "",
        description: "",
        questType: "CAMPUS_TREASURE",
        difficulty: 3,
        targetLocationId: "",
        xpReward: 200,
        coinReward: 40,
        squadXpReward: 70,
        clues: [
          {
            title: "Stage 1: Perimeter Check",
            clueText: "What color is the banner at the entrance?",
            verificationType: "TEXT_RIDDLE",
            expectedAnswer: "blue",
            hintText: "Look up at the main sign.",
            hintCoinCost: 10,
          },
        ],
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setQuestSubmitting(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocSubmitting(true);

    try {
      const payload = {
        name: newLoc.name,
        code: newLoc.code.toUpperCase(),
        zoneType: newLoc.zoneType,
        description: newLoc.description,
        coordinates: { lat: newLoc.lat, lng: newLoc.lng, mapX: newLoc.mapX, mapY: newLoc.mapY },
        isSafeDesk: newLoc.isSafeDesk,
        operatingHours: newLoc.operatingHours,
      };

      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to create location.");

      alert(`Campus location ${newLoc.name} registered!`);
      setNewLoc({
        name: "",
        code: "",
        zoneType: "ACADEMIC_BLOCK",
        description: "",
        lat: 22.9868,
        lng: 88.4312,
        mapX: 50,
        mapY: 50,
        isSafeDesk: false,
        operatingHours: "08:00 AM - 06:00 PM",
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLocSubmitting(false);
    }
  };

  const addClueRow = () => {
    setNewQuest((prev) => ({
      ...prev,
      clues: [
        ...prev.clues,
        {
          title: `Stage ${prev.clues.length + 1}: Checkpoint`,
          clueText: "",
          verificationType: "TEXT_RIDDLE",
          expectedAnswer: "",
          hintText: "",
          hintCoinCost: 10,
        },
      ],
    }));
  };

  const handleAIGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiGenerating(true);
    setAiSuccessMessage(null);
    setGeneratedQuestData(null);

    try {
      const res = await fetch("/api/ai/generate-quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: aiTheme,
          difficulty: aiDifficulty,
          questType: aiQuestType,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Generation failed.");

      setAiSuccessMessage(`Generated quest "${json.data?.quest?.title}" via ${json.data?.source}!`);
      setGeneratedQuestData(json.data);
      fetchOverview();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEventSubmitting(true);
    setEventSuccess(null);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEvent.title,
          description: newEvent.description,
          eventType: newEvent.eventType,
          rules: newEvent.rules.split(";").map((r) => r.trim()).filter(Boolean),
          rewardPool: {
            firstPlaceCoins: newEvent.firstPlaceCoins,
            secondPlaceCoins: newEvent.secondPlaceCoins,
            thirdPlaceCoins: newEvent.thirdPlaceCoins,
            exclusiveTitle: newEvent.exclusiveTitle,
          },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to create event.");

      setEventSuccess(`Campus event "${json.data?.title}" successfully published!`);
      setNewEvent({
        title: "",
        description: "",
        eventType: "INTER_DEPT",
        rules: "Solve sequential clues; strictly safe items; winner takes 300 Coins.",
        firstPlaceCoins: 300,
        secondPlaceCoins: 175,
        thirdPlaceCoins: 100,
        exclusiveTitle: "AIEM Vanguard",
      });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setEventSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center font-mono text-slate-500 animate-pulse">
        ESTABLISHING ROOT AUDIT CLEARANCE...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              CAMPUS SECURITY & ECONOMY CONTROL
            </span>
            <span className="text-xs font-mono text-slate-400">Security Clearance Level 4</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Admin & Moderator Control Center
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Live dynamic balancing: All XP formulas, coin distributions, anti-collusion fraud windows, allowed email domains, and campus zones are editable in real-time.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex rounded-xl bg-slate-900 p-1 border border-white/10 text-xs font-mono overflow-x-auto">
          {[
            { id: "CONFIG", label: "Game Economy", icon: Settings },
            { id: "FRAUD", label: `Fraud Alerts (${overview?.stats?.openFraudAlerts || 0})`, icon: AlertTriangle },
            { id: "CREATE_QUEST", label: "Deploy Quest", icon: Compass },
            { id: "AI_GENERATOR", label: "AI Game Master & Events", icon: Sparkles },
            { id: "LOCATIONS", label: "Campus Zones", icon: Building },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold whitespace-nowrap transition-all ${
                  activeTab === t.id
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-panel rounded-2xl p-4 text-center">
          <div className="text-2xl font-black font-mono text-emerald-400">
            {overview?.stats?.totalUsers || 0}
          </div>
          <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Total Users</div>
        </div>
        <div className="glass-panel rounded-2xl p-4 text-center">
          <div className="text-2xl font-black font-mono text-cyan-400">
            {overview?.stats?.totalLost || 0}
          </div>
          <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Lost Reports</div>
        </div>
        <div className="glass-panel rounded-2xl p-4 text-center">
          <div className="text-2xl font-black font-mono text-amber-400">
            {overview?.stats?.totalFound || 0}
          </div>
          <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Found Deposits</div>
        </div>
        <div className="glass-panel rounded-2xl p-4 text-center">
          <div className="text-2xl font-black font-mono text-emerald-400">
            {overview?.stats?.totalRecovered || 0}
          </div>
          <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Recovered Items</div>
        </div>
        <div className="glass-panel rounded-2xl p-4 text-center">
          <div className="text-2xl font-black font-mono text-rose-400">
            {overview?.stats?.openFraudAlerts || 0}
          </div>
          <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Active Fraud Alerts</div>
        </div>
      </div>

      {/* Tab 1: Game Economy & Dynamic Configuration */}
      {activeTab === "CONFIG" && (
        <form onSubmit={handleSaveConfig} className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" />
                Live Database-Driven Economy Parameters
              </h2>
              <p className="text-xs text-slate-400">
                Adjust progression difficulty, coin payout multipliers, and anti-fraud thresholds instantly without server restarts.
              </p>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Save className="w-4 h-4" />
              {savingConfig ? "Saving Config..." : "Commit Settings"}
            </button>
          </div>

          {saveSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>System economy parameters committed to MongoDB (GLOBAL_CONFIG) successfully!</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Base XP Per Level</label>
              <input
                type="number"
                value={configForm.xpPerLevelBase}
                onChange={(e) => setConfigForm({ ...configForm, xpPerLevelBase: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
              <span className="text-[10px] text-slate-500 font-mono">Default: 250 XP</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Global XP Multiplier</label>
              <input
                type="number"
                step="0.1"
                value={configForm.globalXpMultiplier}
                onChange={(e) => setConfigForm({ ...configForm, globalXpMultiplier: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
              <span className="text-[10px] text-slate-500 font-mono">Event multiplier (e.g. 1.5 for weekend 2x)</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Global Coin Multiplier</label>
              <input
                type="number"
                step="0.1"
                value={configForm.globalCoinMultiplier}
                onChange={(e) => setConfigForm({ ...configForm, globalCoinMultiplier: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
              <span className="text-[10px] text-slate-500 font-mono">Scales all coin rewards</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Default Finder Bonus %</label>
              <input
                type="number"
                value={configForm.defaultFinderBonusPct}
                onChange={(e) => setConfigForm({ ...configForm, defaultFinderBonusPct: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
              <span className="text-[10px] text-slate-500 font-mono">Bonus paid to physical finder</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Pair Collusion Window (Days)</label>
              <input
                type="number"
                value={configForm.pairCollusionWindowDays}
                onChange={(e) => setConfigForm({ ...configForm, pairCollusionWindowDays: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
              <span className="text-[10px] text-slate-500 font-mono">Auditing window for mutual claims</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Max Mutual Claims Allowed</label>
              <input
                type="number"
                value={configForm.pairCollusionMaxCount}
                onChange={(e) => setConfigForm({ ...configForm, pairCollusionMaxCount: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
              <span className="text-[10px] text-slate-500 font-mono">Triggers security hold if exceeded</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Daily Reports Limit Per User</label>
              <input
                type="number"
                value={configForm.dailyReportLimitPerUser}
                onChange={(e) => setConfigForm({ ...configForm, dailyReportLimitPerUser: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
              <span className="text-[10px] text-slate-500 font-mono">Prevents spam listings</span>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-mono text-slate-300">Allowed College Email Domains</label>
              <input
                type="text"
                value={configForm.allowedEmailDomains}
                onChange={(e) => setConfigForm({ ...configForm, allowedEmailDomains: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
              <span className="text-[10px] text-slate-500 font-mono">Comma-separated (e.g. @student.aiem.edu, @aiem.edu)</span>
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Anti-Collusion & Fraud Alerts */}
      {activeTab === "FRAUD" && (
        <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
          <div className="space-y-1 border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              Anti-Collusion & Fraud Prevention Ledger
            </h2>
            <p className="text-xs text-slate-400">
              Automatic heuristic monitor: flags repeated reciprocal claims between pairs of students to prevent bounty farming.
            </p>
          </div>

          <div className="space-y-4">
            {overview?.fraudAlerts?.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-mono text-xs">
                Zero open fraud alerts detected. Campus integrity intact.
              </div>
            ) : (
              overview?.fraudAlerts?.map((alert: any) => (
                <div
                  key={alert._id}
                  className="rounded-2xl bg-slate-950/80 border border-rose-500/30 p-5 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300">
                        {alert.alertType} • {alert.severity} SEVERITY
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        Status: <span className="text-amber-400 font-bold">{alert.status}</span>
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 font-mono leading-relaxed">
                    {alert.details}
                  </p>

                  <div className="text-xs font-mono text-slate-400">
                    Flagged Accounts:{" "}
                    {alert.involvedUserIds?.map((u: any) => `${u.displayName} (${u.email})`).join(" <-> ")}
                  </div>

                  {alert.status === "OPEN" && (
                    <div className="pt-2 border-t border-white/5 flex items-center gap-3">
                      <button
                        onClick={() => handleResolveFraud(alert._id, "RESOLVED", false)}
                        className="px-4 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all"
                      >
                        Approve & Release Rewards
                      </button>
                      <button
                        onClick={() => handleResolveFraud(alert._id, "DISMISSED", true)}
                        className="px-4 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold transition-all"
                      >
                        Penalize Fraud (-50 Trust)
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Quest & Treasure Hunt Creator */}
      {activeTab === "CREATE_QUEST" && (
        <form onSubmit={handleCreateQuest} className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
          <div className="space-y-1 border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-emerald-400" />
              Deploy Campus Mystery Hunt or Treasure Hunt
            </h2>
            <p className="text-xs text-slate-400">
              Author sequential multi-stage clues, set verification riddle answers, and define XP and Coin rewards.
            </p>
          </div>

          {questSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{questSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-mono text-slate-300">Hunt Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. The Founder's Clock Mystery, AIEM Cyber Hunt"
                value={newQuest.title}
                onChange={(e) => setNewQuest({ ...newQuest, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-mono text-slate-300">Briefing & Storyline *</label>
              <textarea
                required
                rows={3}
                placeholder="Describe the objective, background story, and campus zone..."
                value={newQuest.description}
                onChange={(e) => setNewQuest({ ...newQuest, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Difficulty (1 - 5 Stars)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={newQuest.difficulty}
                onChange={(e) => setNewQuest({ ...newQuest, difficulty: parseInt(e.target.value) || 1 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Quest Type</label>
              <select
                value={newQuest.questType}
                onChange={(e) => setNewQuest({ ...newQuest, questType: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              >
                <option value="CAMPUS_TREASURE">Campus Treasure Hunt</option>
                <option value="MYSTERY">Mystery Hunt</option>
                <option value="SQUAD_HUNT">Squad Raid</option>
                <option value="DAILY_HUNT">Daily Hunt</option>
                <option value="LEGENDARY">Legendary Event</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">XP Bounty</label>
              <input
                type="number"
                value={newQuest.xpReward}
                onChange={(e) => setNewQuest({ ...newQuest, xpReward: parseInt(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Hunter Coins Bounty</label>
              <input
                type="number"
                value={newQuest.coinReward}
                onChange={(e) => setNewQuest({ ...newQuest, coinReward: parseInt(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {/* Sequential Clues */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-mono uppercase">
                Sequential Clue Stages ({newQuest.clues.length})
              </h3>
              <button
                type="button"
                onClick={addClueRow}
                className="flex items-center gap-1 text-xs font-mono text-cyan-400 hover:text-cyan-300"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Stage
              </button>
            </div>

            {newQuest.clues.map((clue, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-3"
              >
                <div className="font-bold text-xs font-mono text-amber-400">
                  Stage {idx + 1} Configuration
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Clue Title (e.g. Ground Noticeboard)"
                    value={clue.title}
                    onChange={(e) => {
                      const updated = [...newQuest.clues];
                      updated[idx].title = e.target.value;
                      setNewQuest({ ...newQuest, clues: updated });
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
                  />

                  <input
                    type="text"
                    required
                    placeholder="Normalized Expected Answer (e.g. blue, b204)"
                    value={clue.expectedAnswer}
                    onChange={(e) => {
                      const updated = [...newQuest.clues];
                      updated[idx].expectedAnswer = e.target.value;
                      setNewQuest({ ...newQuest, clues: updated });
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
                  />

                  <textarea
                    rows={2}
                    required
                    placeholder="Clue Riddle / Instruction..."
                    value={clue.clueText}
                    onChange={(e) => {
                      const updated = [...newQuest.clues];
                      updated[idx].clueText = e.target.value;
                      setNewQuest({ ...newQuest, clues: updated });
                    }}
                    className="md:col-span-2 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={questSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs font-mono shadow-xl shadow-emerald-500/25 transition-all"
          >
            {questSubmitting ? "Deploying Mission..." : "Deploy Quest to Campus Board"}
          </button>
        </form>
      )}

      {/* Tab 4: Campus Locations Manager */}
      {activeTab === "LOCATIONS" && (
        <form onSubmit={handleCreateLocation} className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
          <div className="space-y-1 border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-cyan-400" />
              Register New Campus Zone or Safe-Desk
            </h2>
            <p className="text-xs text-slate-400">
              Define coordinates for the vector radar map and configure authorized safe-desk counters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Building / Zone Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Block D — Bio-Medical Bay"
                value={newLoc.name}
                onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Zone Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. BLK-D"
                value={newLoc.code}
                onChange={(e) => setNewLoc({ ...newLoc, code: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Zone Type</label>
              <select
                value={newLoc.zoneType}
                onChange={(e) => setNewLoc({ ...newLoc, zoneType: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
              >
                <option value="ACADEMIC_BLOCK">Academic Block</option>
                <option value="LIBRARY">Library & Archives</option>
                <option value="CANTEEN">Canteen & Courtyard</option>
                <option value="HOSTEL">Hostel Dormitory</option>
                <option value="SPORTS">Sports & SAC</option>
                <option value="SAFE_DESK">Security Safe-Desk</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300">Operating Hours</label>
              <input
                type="text"
                value={newLoc.operatingHours}
                onChange={(e) => setNewLoc({ ...newLoc, operatingHours: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="flex items-center gap-2 text-xs font-mono text-emerald-400 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={newLoc.isSafeDesk}
                  onChange={(e) => setNewLoc({ ...newLoc, isSafeDesk: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-500"
                />
                <span>Designate as Official 24/7 Verified Safe-Desk Counter</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={locSubmitting}
            className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono shadow-xl shadow-cyan-500/25 transition-all"
          >
            {locSubmitting ? "Registering Location..." : "Add to Campus Map"}
          </button>
        </form>
      )}

      {/* AI GAME MASTER & CAMPUS EVENT ORGANIZER */}
      {activeTab === "AI_GENERATOR" && (
        <div className="space-y-8 animate-in fade-in">
          {/* AI Game Master Card */}
          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6 border border-violet-500/30 bg-slate-900/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  AI Game Master Engine
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Provider-independent generator (Gemini / OpenAI / Deterministic Local Fallback). Generates cohesive clue chains, logic gates, cipher puzzles, and verified answers anchored to real campus zones.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-mono bg-violet-500/20 text-violet-300 border border-violet-500/30 self-start sm:self-auto font-bold">
                100% ETHICAL & SAFE
              </span>
            </div>

            {aiSuccessMessage && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{aiSuccessMessage}</span>
              </div>
            )}

            <form onSubmit={handleAIGenerate} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Quest Theme</label>
                  <select
                    value={aiTheme}
                    onChange={(e) => setAiTheme(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-violet-400"
                  >
                    <option value="CAMPUS_MYSTERY">Campus History & Lore</option>
                    <option value="ELECTRONICS_LOGIC">Electronics & Logic Gates</option>
                    <option value="LIBRARY_ARCHIVE">Library & Literary Cryptograms</option>
                    <option value="SUSTAINABILITY">Clean Energy & Microgrid</option>
                    <option value="ROBOTICS_CAD">Robotics, CAD & Trajectories</option>
                    <option value="CAMPUS_CULTURE">Campus Culture & Canteen Lore</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Difficulty Level</label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-violet-400"
                  >
                    <option value={1}>Level 1: Rookie Scout (Easy)</option>
                    <option value={2}>Level 2: Campus Tracker (Standard)</option>
                    <option value={3}>Level 3: Field Investigator (Medium)</option>
                    <option value={4}>Level 4: Senior Detective (Challenging)</option>
                    <option value={5}>Level 5: Master Hunter (Cryptic)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Quest Category</label>
                  <select
                    value={aiQuestType}
                    onChange={(e) => setAiQuestType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-violet-400"
                  >
                    <option value="CAMPUS_TREASURE">Campus Treasure Hunt</option>
                    <option value="DAILY_HUNT">Daily Mystery Hunt</option>
                    <option value="SQUAD_HUNT">Squad Investigation</option>
                    <option value="MYSTERY">Cryptic Campus Mystery</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={aiGenerating}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-600 hover:from-violet-500 hover:to-emerald-500 text-white font-bold text-xs font-mono shadow-xl shadow-violet-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {aiGenerating ? "Game Master Weaving Clue Matrix..." : "Generate & Deploy AI Quest Now"}
              </button>
            </form>

            {/* Generated Quest Inspection Card */}
            {generatedQuestData && (
              <div className="mt-6 p-5 rounded-2xl bg-slate-950 border border-violet-500/30 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-violet-400 font-bold uppercase">
                      Generated via {generatedQuestData.source} ({generatedQuestData.modelName || "engine"})
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      {generatedQuestData.quest?.title}
                    </h3>
                  </div>
                  <Link
                    href={`/quests/${generatedQuestData.quest?._id}`}
                    className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs font-mono font-bold hover:bg-violet-500/30"
                  >
                    Open Quest Board →
                  </Link>
                </div>

                <p className="text-xs text-slate-300 font-mono leading-relaxed">
                  {generatedQuestData.quest?.description}
                </p>

                <div className="grid grid-cols-3 gap-3 font-mono text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-900 border border-white/5">
                    <span className="text-slate-400 text-[10px]">XP Reward</span>
                    <div className="font-bold text-emerald-400">+{generatedQuestData.quest?.xpReward} XP</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-white/5">
                    <span className="text-slate-400 text-[10px]">Coin Payout</span>
                    <div className="font-bold text-amber-400">+{generatedQuestData.quest?.coinReward} 🪙</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-white/5">
                    <span className="text-slate-400 text-[10px]">Total Stages</span>
                    <div className="font-bold text-cyan-400">{generatedQuestData.cluesCount} Stages</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Campus Event Organizer Card */}
          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6 border border-emerald-500/30 bg-slate-900/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  Campus Event Organizer Workspace
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Launch multi-stage festival treasure hunts, department competitions, or orientation races.
                </p>
              </div>
              <Link
                href="/events"
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold hover:bg-emerald-500/30 self-start sm:self-auto"
              >
                View Public Events Page →
              </Link>
            </div>

            {eventSuccess && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{eventSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Event Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hackathon Campus Mystery Sprint"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Competition Type</label>
                  <select
                    value={newEvent.eventType}
                    onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
                  >
                    <option value="INTER_DEPT">Inter-Departmental Sprint</option>
                    <option value="SQUAD_SHOWDOWN">Squad Showdown</option>
                    <option value="FEST_TREASURE_HUNT">College Festival Treasure Hunt</option>
                    <option value="ORIENTATION_HUNT">Freshers Orientation Challenge</option>
                    <option value="FLASH_HUNT">2-Hour Flash Hunt</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">Event Description *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Describe the premise, checkpoints, and storyline..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-400 leading-relaxed font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">
                  Rules & Protocols (Semicolon ';' separated)
                </label>
                <input
                  type="text"
                  placeholder="Solve clue nodes in order; Zero tampering with belongings; First squad to verify wins."
                  value={newEvent.rules}
                  onChange={(e) => setNewEvent({ ...newEvent, rules: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">1st Place Prize</label>
                  <input
                    type="number"
                    value={newEvent.firstPlaceCoins}
                    onChange={(e) => setNewEvent({ ...newEvent, firstPlaceCoins: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-amber-400 text-xs font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">2nd Place Prize</label>
                  <input
                    type="number"
                    value={newEvent.secondPlaceCoins}
                    onChange={(e) => setNewEvent({ ...newEvent, secondPlaceCoins: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-300 text-xs font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">3rd Place Prize</label>
                  <input
                    type="number"
                    value={newEvent.thirdPlaceCoins}
                    onChange={(e) => setNewEvent({ ...newEvent, thirdPlaceCoins: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-slate-300 text-xs font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Exclusive Title</label>
                  <input
                    type="text"
                    value={newEvent.exclusiveTitle}
                    onChange={(e) => setNewEvent({ ...newEvent, exclusiveTitle: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-cyan-400 text-xs font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={eventSubmitting}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                {eventSubmitting ? "Publishing Event to Campus Ledger..." : "Publish Campus Event to Students"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

