"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Layers,
  Search,
  Filter,
  Eye,
  ArrowRightLeft,
  PackagePlus,
  PackageSearch,
  PackageCheck,
  AlertOctagon,
  Clock,
  FileText,
  UserCheck,
  History,
  ChevronRight,
  ExternalLink,
  X,
  Copy,
  Archive,
  ArrowUpRight,
  Send,
  Edit3,
  Loader2,
} from "lucide-react";

type AdminTab =
  | "OPERATIONS"
  | "ITEM_DESK"
  | "CONTENT_CMS"
  | "STAFF_ACCESS"
  | "ECONOMY_LEDGER"
  | "FRAUD_PRIVACY";

type ContentSubTab = "QUESTS" | "EVENTS" | "LOCATIONS" | "ACHIEVEMENTS" | "AI_GENERATOR";

export default function AdminControlPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("OPERATIONS");
  const [contentSubTab, setContentSubTab] = useState<ContentSubTab>("QUESTS");
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Selected station filter for scoped operations
  const [selectedStationFilter, setSelectedStationFilter] = useState<string>("ALL");

  // Operations queue state
  const [selectedQueue, setSelectedQueue] = useState<
    "reports_review" | "claims_review" | "approved_handovers" | "station_custody" | "disputes_overdue"
  >("reports_review");
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");

  // Item desk state
  const [deskItems, setDeskItems] = useState<any[]>([]);
  const [deskLoading, setDeskLoading] = useState(false);
  const [deskSearch, setDeskSearch] = useState("");
  const [deskTypeFilter, setDeskTypeFilter] = useState("ALL");
  const [deskStatusFilter, setDeskStatusFilter] = useState("");
  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null);

  // Custody modal state
  const [custodyModalOpen, setCustodyModalOpen] = useState(false);
  const [custodyTargetItem, setCustodyTargetItem] = useState<any | null>(null);
  const [custodyAction, setCustodyAction] = useState<"DEPOSIT" | "TRANSFER">("DEPOSIT");
  const [custodyStationId, setCustodyStationId] = useState("");
  const [custodyLockerCode, setCustodyLockerCode] = useState("");
  const [custodyCondition, setCustodyCondition] = useState("");
  const [custodyReason, setCustodyReason] = useState("");
  const [custodySubmitting, setCustodySubmitting] = useState(false);

  // Claim escalation modal state
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateTargetClaim, setEscalateTargetClaim] = useState<any | null>(null);
  const [escalateReason, setEscalateReason] = useState("");
  const [escalateNotes, setEscalateNotes] = useState("");
  const [escalateFlagFraud, setEscalateFlagFraud] = useState(false);
  const [escalateSubmitting, setEscalateSubmitting] = useState(false);

  // Staff management state
  const [staffData, setStaffData] = useState<{ staff: any[]; candidates: any[]; stations: any[] }>({
    staff: [],
    candidates: [],
    stations: [],
  });
  const [staffSearch, setStaffSearch] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [roleChangeModalOpen, setRoleChangeModalOpen] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState<any | null>(null);
  const [roleChangeNewRole, setRoleChangeNewRole] = useState("SAFE_DESK_STAFF");
  const [roleChangeStationId, setRoleChangeStationId] = useState("");
  const [roleChangeReason, setRoleChangeReason] = useState("");
  const [roleChangeSubmitting, setRoleChangeSubmitting] = useState(false);

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
    allowedEmailDomains: "@aiemgoa.ac.in, @aitdgoa.edu.in",
    maintenanceMode: false,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Economy adjustment modal state
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustTargetUser, setAdjustTargetUser] = useState<any | null>(null);
  const [adjustDeltaCoins, setAdjustDeltaCoins] = useState<number>(0);
  const [adjustDeltaXp, setAdjustDeltaXp] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Ledger transactions state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Audit events log state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  // Content CMS - Quests
  const [cmsQuests, setCmsQuests] = useState<any[]>([]);
  const [cmsQuestsLoading, setCmsQuestsLoading] = useState(false);
  const [questPreviewTarget, setQuestPreviewTarget] = useState<any | null>(null);
  const [newQuest, setNewQuest] = useState({
    title: "",
    description: "",
    questType: "CAMPUS_TREASURE",
    difficulty: 3,
    targetLocationId: "",
    xpReward: 200,
    coinReward: 40,
    squadXpReward: 70,
    finderBonusXp: 25,
    maxCompletions: 1,
    status: "DRAFT",
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

  // Content CMS - Events
  const [cmsEvents, setCmsEvents] = useState<any[]>([]);
  const [cmsEventsLoading, setCmsEventsLoading] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    eventType: "INTER_DEPT",
    rules: "Solve sequential clues; strictly safe items; winner takes 300 Coins.",
    firstPlaceCoins: 300,
    secondPlaceCoins: 175,
    thirdPlaceCoins: 100,
    exclusiveTitle: "AIEM Vanguard",
    status: "DRAFT",
  });
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventSuccess, setEventSuccess] = useState<string | null>(null);

  // Content CMS - Locations
  const [cmsLocations, setCmsLocations] = useState<any[]>([]);
  const [cmsLocationsLoading, setCmsLocationsLoading] = useState(false);
  const [newLoc, setNewLoc] = useState({
    name: "",
    code: "",
    zoneType: "ACADEMIC_BLOCK",
    description: "",
    lat: 15.5948,
    lng: 73.7947,
    mapX: 50,
    mapY: 50,
    isSafeDesk: false,
    operatingHours: "08:00 AM - 06:00 PM",
    building: "",
    accessibleRouteNotes: "",
    currentCapacity: 50,
  });
  const [locSubmitting, setLocSubmitting] = useState(false);
  const [editingLoc, setEditingLoc] = useState<any | null>(null);
  const [editingLocSubmitting, setEditingLocSubmitting] = useState(false);

  // Content CMS - Achievements
  const [cmsAchievements, setCmsAchievements] = useState<any[]>([]);
  const [cmsAchievementsLoading, setCmsAchievementsLoading] = useState(false);
  const [newAchievement, setNewAchievement] = useState({
    code: "",
    title: "",
    description: "",
    badgeIcon: "Award",
    rarity: "COMMON",
    metricKey: "RECOVERIES_COUNT",
    threshold: 1,
    xpReward: 100,
    coinReward: 25,
    scope: "PLAYER",
  });
  const [achievementSubmitting, setAchievementSubmitting] = useState(false);
  const [achievementSuccess, setAchievementSuccess] = useState<string | null>(null);

  // AI Game Master state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTheme, setAiTheme] = useState("CAMPUS_MYSTERY");
  const [aiDifficulty, setAiDifficulty] = useState(3);
  const [aiQuestType, setAiQuestType] = useState("CAMPUS_TREASURE");
  const [aiStageCount, setAiStageCount] = useState(3);
  const [aiLocationCode, setAiLocationCode] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedData, setAiGeneratedData] = useState<any | null>(null);
  const [aiPublishing, setAiPublishing] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // Notification feedback banner
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // 1. Fetch overview data
  const fetchOverview = useCallback(async () => {
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
      console.error("Failed to load overview:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch queue items
  const fetchQueueItems = useCallback(async () => {
    setQueueLoading(true);
    try {
      const stationParam = selectedStationFilter !== "ALL" ? `&stationId=${selectedStationFilter}` : "";
      const searchParam = queueSearch ? `&search=${encodeURIComponent(queueSearch)}` : "";
      const res = await fetch(`/api/admin/queues?queue=${selectedQueue}${stationParam}${searchParam}`);
      const json = await res.json();
      if (json.success) {
        setQueueItems(json.data || []);
      }
    } catch (e) {
      console.error("Queue fetch error:", e);
    } finally {
      setQueueLoading(false);
    }
  }, [selectedQueue, selectedStationFilter, queueSearch]);

  // 3. Fetch desk items
  const fetchDeskItems = useCallback(async () => {
    setDeskLoading(true);
    try {
      const typeParam = deskTypeFilter !== "ALL" ? `&type=${deskTypeFilter}` : "";
      const statusParam = deskStatusFilter ? `&status=${deskStatusFilter}` : "";
      const searchParam = deskSearch ? `&search=${encodeURIComponent(deskSearch)}` : "";
      const res = await fetch(`/api/admin/items?page=1&limit=25${typeParam}${statusParam}${searchParam}`);
      const json = await res.json();
      if (json.success) {
        setDeskItems(json.data || []);
      }
    } catch (e) {
      console.error("Desk fetch error:", e);
    } finally {
      setDeskLoading(false);
    }
  }, [deskTypeFilter, deskStatusFilter, deskSearch]);

  // 4. Fetch staff data
  const fetchStaffData = useCallback(async () => {
    setStaffLoading(true);
    try {
      const searchParam = staffSearch ? `?search=${encodeURIComponent(staffSearch)}` : "";
      const res = await fetch(`/api/admin/staff${searchParam}`);
      const json = await res.json();
      if (json.success) {
        setStaffData(json.data || { staff: [], candidates: [], stations: [] });
      }
    } catch (e) {
      console.error("Staff fetch error:", e);
    } finally {
      setStaffLoading(false);
    }
  }, [staffSearch]);

  // 5. Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const res = await fetch("/api/admin/transactions?limit=25");
      const json = await res.json();
      if (json.success) {
        setTransactions(json.data || []);
      }
    } catch (e) {
      console.error("Transactions fetch error:", e);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  // 6. Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    setAuditLogsLoading(true);
    try {
      const res = await fetch("/api/admin/audit-logs?limit=30");
      const json = await res.json();
      if (json.success) {
        setAuditLogs(json.data || []);
      }
    } catch (e) {
      console.error("Audit logs fetch error:", e);
    } finally {
      setAuditLogsLoading(false);
    }
  }, []);

  // 7. Fetch CMS Quests
  const fetchCmsQuests = useCallback(async () => {
    setCmsQuestsLoading(true);
    try {
      const res = await fetch("/api/admin/quests?limit=30");
      const json = await res.json();
      if (json.success) {
        setCmsQuests(json.data || []);
      }
    } catch (e) {
      console.error("CMS Quests fetch error:", e);
    } finally {
      setCmsQuestsLoading(false);
    }
  }, []);

  // 8. Fetch CMS Events
  const fetchCmsEvents = useCallback(async () => {
    setCmsEventsLoading(true);
    try {
      const res = await fetch("/api/admin/events?limit=30");
      const json = await res.json();
      if (json.success) {
        setCmsEvents(json.data || []);
      }
    } catch (e) {
      console.error("CMS Events fetch error:", e);
    } finally {
      setCmsEventsLoading(false);
    }
  }, []);

  // 9. Fetch CMS Locations
  const fetchCmsLocations = useCallback(async () => {
    setCmsLocationsLoading(true);
    try {
      const res = await fetch("/api/admin/locations");
      const json = await res.json();
      if (json.success) {
        setCmsLocations(json.data || []);
      }
    } catch (e) {
      console.error("CMS Locations fetch error:", e);
    } finally {
      setCmsLocationsLoading(false);
    }
  }, []);

  // 10. Fetch CMS Achievements
  const fetchCmsAchievements = useCallback(async () => {
    setCmsAchievementsLoading(true);
    try {
      const res = await fetch("/api/admin/achievements?status=ALL");
      const json = await res.json();
      if (json.success) {
        setCmsAchievements(json.data || []);
      }
    } catch (e) {
      console.error("CMS Achievements fetch error:", e);
    } finally {
      setCmsAchievementsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeTab === "OPERATIONS") fetchQueueItems();
    if (activeTab === "ITEM_DESK") fetchDeskItems();
    if (activeTab === "STAFF_ACCESS") fetchStaffData();
    if (activeTab === "ECONOMY_LEDGER") fetchTransactions();
    if (activeTab === "CONTENT_CMS") {
      if (contentSubTab === "QUESTS") fetchCmsQuests();
      if (contentSubTab === "EVENTS") fetchCmsEvents();
      if (contentSubTab === "LOCATIONS" || contentSubTab === "AI_GENERATOR") fetchCmsLocations();
      if (contentSubTab === "ACHIEVEMENTS") fetchCmsAchievements();
    }
  }, [
    activeTab,
    contentSubTab,
    fetchQueueItems,
    fetchDeskItems,
    fetchStaffData,
    fetchTransactions,
    fetchCmsQuests,
    fetchCmsEvents,
    fetchCmsLocations,
    fetchCmsAchievements,
  ]);

  // Handlers for Custody Actions
  const handleCustodySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custodyTargetItem || !custodyStationId || !custodyReason) return;
    setCustodySubmitting(true);

    try {
      const res = await fetch(`/api/admin/items/${custodyTargetItem._id}/custody`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: custodyAction,
          stationId: custodyStationId,
          lockerCode: custodyLockerCode,
          conditionNote: custodyCondition,
          reason: custodyReason,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Custody update failed.");

      showToast(json.message || "Custody updated successfully.");
      setCustodyModalOpen(false);
      setCustodyTargetItem(null);
      setCustodyReason("");
      setCustodyLockerCode("");
      fetchOverview();
      if (activeTab === "OPERATIONS") fetchQueueItems();
      if (activeTab === "ITEM_DESK") fetchDeskItems();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCustodySubmitting(false);
    }
  };

  // Handlers for Claim Escalation
  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateTargetClaim || !escalateReason) return;
    setEscalateSubmitting(true);

    try {
      const res = await fetch(`/api/admin/claims/${escalateTargetClaim._id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: escalateReason,
          notes: escalateNotes,
          flagFraud: escalateFlagFraud,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Escalation failed.");

      showToast(json.message || "Claim escalated to DISPUTED status.");
      setEscalateModalOpen(false);
      setEscalateTargetClaim(null);
      setEscalateReason("");
      setEscalateNotes("");
      fetchOverview();
      if (activeTab === "OPERATIONS") fetchQueueItems();
      if (activeTab === "ITEM_DESK") fetchDeskItems();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setEscalateSubmitting(false);
    }
  };

  // Handlers for Staff Role Grant
  const handleRoleChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleChangeTarget || !roleChangeReason) return;
    setRoleChangeSubmitting(true);

    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: roleChangeTarget._id,
          newRole: roleChangeNewRole,
          stationId: roleChangeNewRole === "SAFE_DESK_STAFF" ? roleChangeStationId : null,
          reason: roleChangeReason,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Role grant failed.");

      showToast(json.message || "User role updated successfully.");
      setRoleChangeModalOpen(false);
      setRoleChangeTarget(null);
      setRoleChangeReason("");
      fetchStaffData();
      fetchOverview();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setRoleChangeSubmitting(false);
    }
  };

  // Handlers for Manual Balance Adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetUser || !adjustReason) return;
    setAdjustSubmitting(true);

    try {
      const res = await fetch("/api/admin/economy/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: adjustTargetUser._id,
          deltaCoins: Number(adjustDeltaCoins),
          deltaXp: Number(adjustDeltaXp),
          reason: adjustReason,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Balance adjustment failed.");

      showToast(json.message || "User balance adjusted.");
      setAdjustModalOpen(false);
      setAdjustTargetUser(null);
      setAdjustReason("");
      setAdjustDeltaCoins(0);
      setAdjustDeltaXp(0);
      fetchTransactions();
      fetchOverview();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Handlers for Quest Status Transition & Duplication
  const handleQuestStatusChange = async (questId: string, targetStatus: string) => {
    const reason = prompt(`Enter mandatory audit reason for setting quest to ${targetStatus}:`);
    if (!reason || reason.trim().length < 5) {
      showToast("Audit reason must be at least 5 characters.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/admin/quests/${questId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Status update failed.");
      showToast(json.message || "Quest status updated.");
      fetchCmsQuests();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDuplicateQuest = async (questId: string) => {
    try {
      const res = await fetch(`/api/admin/quests/${questId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Duplication failed.");
      showToast(json.message || "Quest duplicated as draft.");
      fetchCmsQuests();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Handlers for Event Status Transition & Duplication
  const handleEventStatusChange = async (eventId: string, targetStatus: string) => {
    const reason = prompt(`Enter audit reason for updating event to ${targetStatus}:`);
    if (!reason || reason.trim().length < 5) {
      showToast("Audit reason must be at least 5 characters.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Status update failed.");
      showToast(json.message || "Event status updated.");
      fetchCmsEvents();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDuplicateEvent = async (eventId: string) => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Duplication failed.");
      showToast(json.message || "Event duplicated as draft.");
      fetchCmsEvents();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Handlers for Achievement Status Transition & Delete
  const handleAchievementStatusChange = async (id: string, action: "ARCHIVE" | "REACTIVATE") => {
    try {
      const res = await fetch(`/api/admin/achievements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, revisionNote: `Admin ${action.toLowerCase()}d via CMS` }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || `Failed to ${action.toLowerCase()} achievement.`);
      showToast(`Achievement ${action === "ARCHIVE" ? "archived" : "reactivated"} successfully.`);
      fetchCmsAchievements();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleAchievementDelete = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete or archive achievement "${code}"?`)) return;
    try {
      const res = await fetch(`/api/admin/achievements/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Admin deleted via CMS" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to delete achievement.");
      showToast(json.message || "Achievement removed.");
      fetchCmsAchievements();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleCreateAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    setAchievementSubmitting(true);
    setAchievementSuccess(null);
    try {
      const res = await fetch("/api/admin/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newAchievement,
          threshold: Number(newAchievement.threshold),
          xpReward: Number(newAchievement.xpReward),
          coinReward: Number(newAchievement.coinReward),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to create achievement.");
      setAchievementSuccess(`Achievement "${json.data?.title}" created successfully!`);
      showToast("Achievement created successfully.");
      setNewAchievement({
        code: "",
        title: "",
        description: "",
        badgeIcon: "Award",
        rarity: "COMMON",
        metricKey: "RECOVERIES_COUNT",
        threshold: 1,
        xpReward: 100,
        coinReward: 25,
        scope: "PLAYER",
      });
      fetchCmsAchievements();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setAchievementSubmitting(false);
    }
  };

  // Economy config save
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
        reason: "Updated game economy and domain authorization parameters via Admin CMS.",
      };

      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to update configuration.");

      setSaveSuccess(true);
      showToast("Economy configuration saved and audited.");
      setTimeout(() => setSaveSuccess(false), 4000);
      fetchOverview();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingConfig(false);
    }
  };

  // AI Game Master generation
  const handleAIGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aiGenerating) return;
    setAiGenerating(true);
    setAiSuccessMessage(null);
    setAiGeneratedData(null);

    try {
      const res = await fetch("/api/ai/generate-quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          theme: aiTheme,
          difficulty: aiDifficulty,
          questType: aiQuestType,
          locationCode: aiLocationCode || undefined,
          stageCount: aiStageCount,
          status: "DRAFT",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Generation failed.");

      setAiGeneratedData(json.data);
      setAiSuccessMessage(`Generated quest "${json.data?.quest?.title}" via ${json.data?.source}! Review the clue chain below and click "Make Public" when ready.`);
      showToast(`AI Quest generated in Draft mode: "${json.data?.quest?.title}"`);
      fetchOverview();
      fetchCmsQuests();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setAiGenerating(false);
    }
  };

  // Publish AI-generated quest to public board
  const handleMakeAiQuestPublic = async (questId: string) => {
    if (aiPublishing) return;
    setAiPublishing(true);
    try {
      const res = await fetch(`/api/admin/quests/${questId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: "ACTIVE",
          reason: "Published AI-generated quest to campus board for student participation.",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to publish quest.");

      showToast("Quest published to campus! All users can now accept it.");
      setAiGeneratedData((prev: any) => prev ? {
        ...prev,
        quest: { ...prev.quest, status: "ACTIVE" }
      } : null);
      fetchOverview();
      fetchCmsQuests();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setAiPublishing(false);
    }
  };

  // Fraud alert resolve
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
        showToast("Fraud alert resolution recorded.");
        fetchOverview();
      }
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <h2 className="text-lg font-mono font-bold tracking-wider text-slate-300">
          INITIALIZING OPERATIONS DESK...
        </h2>
        <p className="text-xs text-slate-500 font-mono mt-1">Verifying clearance credentials</p>
      </div>
    );
  }

  const currentUser = overview?.user;
  const permissions = overview?.permissions || {};
  const isSafeDeskOnly = permissions.isSafeDeskStaff;

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 selection:bg-emerald-500 selection:text-slate-950 pb-36 md:pb-16">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-top-4 duration-200 ${
            toastMessage.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/90 border-rose-500/40 text-rose-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-mono font-medium">{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Operations Header */}
      <header className="border-b border-white/10 bg-[#0B0F17]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold font-mono tracking-tight text-white">
                  OPERATIONS & RECOVERY DESK
                </h1>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    currentUser?.role === "ADMIN"
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      : currentUser?.role === "MODERATOR"
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                      : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  }`}
                >
                  {currentUser?.role || "STAFF"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                AIEM — Agnel Institute of Engineering and Management • Logged in as{" "}
                <span className="text-slate-200 font-medium">{currentUser?.displayName}</span>
              </p>
            </div>
          </div>

          {/* Scoped Safe-Desk Station Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="station-filter" className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Desk:</span>
            </label>
            <select
              id="station-filter"
              value={selectedStationFilter}
              onChange={(e) => setSelectedStationFilter(e.target.value)}
              disabled={isSafeDeskOnly}
              className="bg-[#070A0F] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-75"
            >
              <option value="ALL">All Campus Stations</option>
              {overview?.safeDesks?.map((sd: any) => (
                <option key={sd._id} value={sd._id}>
                  {sd.name} ({sd.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Navigation with Horizontal Scroll & Touch Affordance */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center overflow-x-auto no-scrollbar border-t border-white/5">
          <button
            onClick={() => setActiveTab("OPERATIONS")}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-mono font-medium whitespace-nowrap transition-all ${
              activeTab === "OPERATIONS"
                ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Work Queues</span>
            {overview?.queues?.reportsNeedingReview > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {overview.queues.reportsNeedingReview}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("ITEM_DESK")}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-mono font-medium whitespace-nowrap transition-all ${
              activeTab === "ITEM_DESK"
                ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <PackageSearch className="w-4 h-4" />
            <span>Item & Custody Desk</span>
          </button>

          {permissions.canManageContent && (
            <button
              onClick={() => setActiveTab("CONTENT_CMS")}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-mono font-medium whitespace-nowrap transition-all ${
                activeTab === "CONTENT_CMS"
                  ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Campus Content CMS</span>
            </button>
          )}

          {permissions.canManageStaff && (
            <button
              onClick={() => setActiveTab("STAFF_ACCESS")}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-mono font-medium whitespace-nowrap transition-all ${
                activeTab === "STAFF_ACCESS"
                  ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Staff & Access</span>
            </button>
          )}

          {permissions.canManageEconomy && (
            <button
              onClick={() => setActiveTab("ECONOMY_LEDGER")}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-mono font-medium whitespace-nowrap transition-all ${
                activeTab === "ECONOMY_LEDGER"
                  ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Economy & Ledger</span>
            </button>
          )}

          {permissions.canResolveFraud && (
            <button
              onClick={() => setActiveTab("FRAUD_PRIVACY")}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-mono font-medium whitespace-nowrap transition-all ${
                activeTab === "FRAUD_PRIVACY"
                  ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Fraud & Privacy</span>
              {overview?.stats?.openFraudAlerts > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {overview.stats.openFraudAlerts}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Tab View Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ============================================================== */}
        {/* TAB 1: OPERATIONS DASHBOARD & ACTIONABLE WORK QUEUES */}
        {/* ============================================================== */}
        {activeTab === "OPERATIONS" && (
          <div className="space-y-6">
            {/* Actionable Small Totals */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <button
                type="button"
                onClick={() => setSelectedQueue("reports_review")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedQueue === "reports_review"
                    ? "bg-rose-950/20 border-rose-500/60 ring-1 ring-rose-500"
                    : "bg-[#0B0F17] border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-slate-400">Reports to Review</span>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                  {overview?.queues?.reportsNeedingReview ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Submitted lost/found</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedQueue("claims_review")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedQueue === "claims_review"
                    ? "bg-cyan-950/20 border-cyan-500/60 ring-1 ring-cyan-500"
                    : "bg-[#0B0F17] border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-slate-400">Pending Proof</span>
                  <FileText className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                  {overview?.queues?.claimsAwaitingReview ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Proof review pending</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedQueue("approved_handovers")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedQueue === "approved_handovers"
                    ? "bg-emerald-950/20 border-emerald-500/60 ring-1 ring-emerald-500"
                    : "bg-[#0B0F17] border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-slate-400">Approved Meetups</span>
                  <PackageCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                  {overview?.queues?.approvedHandovers ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Ready for PIN verify</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedQueue("station_custody")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedQueue === "station_custody"
                    ? "bg-amber-950/20 border-amber-500/60 ring-1 ring-amber-500"
                    : "bg-[#0B0F17] border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-slate-400">Desk Custody</span>
                  <Building className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                  {overview?.queues?.stationCustodyItems ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Items at safe-desks</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedQueue("disputes_overdue")}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedQueue === "disputes_overdue"
                    ? "bg-purple-950/20 border-purple-500/60 ring-1 ring-purple-500"
                    : "bg-[#0B0F17] border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-slate-400">Disputes & Locked</span>
                  <AlertOctagon className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                  {overview?.queues?.disputesAndOverdue ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Escalated tickets</div>
              </button>
            </div>

            {/* Queue Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0B0F17] p-3 rounded-xl border border-white/10">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Filter className="w-4 h-4 text-emerald-400" />
                <span className="font-bold uppercase tracking-wider">
                  Queue: {selectedQueue.replace(/_/g, " ")}
                </span>
                <span className="text-slate-500">({queueItems.length} active)</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Search queue records..."
                    className="w-full bg-[#070A0F] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchQueueItems}
                  className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 transition-colors"
                  title="Refresh Queue"
                >
                  <RefreshCw className={`w-4 h-4 ${queueLoading ? "animate-spin text-emerald-400" : ""}`} />
                </button>
              </div>
            </div>

            {/* Queue Records Display */}
            {queueLoading ? (
              <div className="py-16 text-center text-slate-400 font-mono text-xs flex flex-col items-center justify-center">
                <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mb-2" />
                Loading queue records...
              </div>
            ) : queueItems.length === 0 ? (
              <div className="py-16 text-center bg-[#0B0F17] rounded-xl border border-white/10 p-8 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-70" />
                <h3 className="font-mono font-bold text-white text-sm">All clear in this queue</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No records currently require staff intervention under this filter. Great job!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {queueItems.map((item) => (
                  <div
                    key={item._id}
                    className="bg-[#0B0F17] border border-white/10 hover:border-emerald-500/40 rounded-xl p-4 flex flex-col justify-between transition-all"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                            item.reportType === "LOST" || item.itemType === "LOST"
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          }`}
                        >
                          {item.reportType || item.itemType || "ITEM"} • {item.status}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(item.createdAt || item.updatedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white line-clamp-1">
                        {item.title || item.shortTitle || item.itemDetails?.title || "Claim Record"}
                      </h4>

                      <p className="text-xs text-slate-400 line-clamp-2">
                        {item.publicDescription || item.notes || item.submittedAnswer || "No extra public description"}
                      </p>

                      {/* Station & Locker receipt badge */}
                      {item.lockerReceiptCode && (
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                          <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>Receipt: {item.lockerReceiptCode}</span>
                        </div>
                      )}

                      {/* Involvements */}
                      <div className="text-[11px] text-slate-400 space-y-0.5 border-t border-white/5 pt-2">
                        {item.claimantId && (
                          <p>
                            Claimant:{" "}
                            <span className="text-slate-200">{item.claimantId.displayName || item.claimantId.username}</span>
                          </p>
                        )}
                        {item.counterpartyUserId && (
                          <p>
                            Counterparty:{" "}
                            <span className="text-slate-200">
                              {item.counterpartyUserId.displayName || item.counterpartyUserId.username}
                            </span>
                          </p>
                        )}
                        {item.finderId && (
                          <p>
                            Finder:{" "}
                            <span className="text-slate-200">{item.finderId.displayName || item.finderId.username}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Operational Action Row */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedItemDetail(item)}
                        className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {/* Escalate button for claims */}
                        {(item.claimantId || item.counterpartyUserId) && item.status !== "DISPUTED" && (
                          <button
                            type="button"
                            onClick={() => {
                              setEscalateTargetClaim(item);
                              setEscalateModalOpen(true);
                            }}
                            className="px-2 py-1 text-[11px] font-mono text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors"
                          >
                            Dispute
                          </button>
                        )}

                        {/* Custody deposit or transfer button */}
                        {item.reportType === "FOUND" && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustodyTargetItem(item);
                              setCustodyAction(item.custodyStatus ? "TRANSFER" : "DEPOSIT");
                              setCustodyStationId(item.safeDeskLocationId?._id || "");
                              setCustodyModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-[11px] font-mono font-medium text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span>Custody</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Audit Log Feed */}
            <div className="bg-[#0B0F17] rounded-xl border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-mono font-bold text-white">
                  <History className="w-4 h-4 text-emerald-400" />
                  <span>IMMUTABLE AUDIT LOG (RECENT ACTIONS)</span>
                </div>
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="space-y-2">
                {overview?.recentAuditLogs?.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono py-4 text-center">
                    No recent audit events recorded.
                  </p>
                ) : (
                  overview?.recentAuditLogs?.map((log: any) => (
                    <div
                      key={log._id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2.5 rounded-lg bg-black/20 border border-white/5 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">{log.action}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-300">{log.actorName}</span>
                        <span className="text-[10px] text-slate-500">({log.actorRole})</span>
                        <span className="text-slate-500">—</span>
                        <span className="text-slate-400 line-clamp-1">{log.reason}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: ITEM & CUSTODY DESK */}
        {/* ============================================================== */}
        {activeTab === "ITEM_DESK" && (
          <div className="space-y-5">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0B0F17] p-4 rounded-xl border border-white/10">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={deskSearch}
                  onChange={(e) => setDeskSearch(e.target.value)}
                  placeholder="Search by title, description, or receipt code..."
                  className="w-full bg-[#070A0F] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={deskTypeFilter}
                  onChange={(e) => setDeskTypeFilter(e.target.value)}
                  className="bg-[#070A0F] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                >
                  <option value="ALL">All Types (Lost & Found)</option>
                  <option value="LOST">Lost Reports</option>
                  <option value="FOUND">Found Items</option>
                </select>

                <select
                  value={deskStatusFilter}
                  onChange={(e) => setDeskStatusFilter(e.target.value)}
                  className="bg-[#070A0F] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                >
                  <option value="">All Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CLAIMED">Claimed / Verification</option>
                  <option value="APPROVED">Approved</option>
                  <option value="RECOVERED">Recovered</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DISPUTED">Disputed</option>
                </select>

                <button
                  type="button"
                  onClick={fetchDeskItems}
                  className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${deskLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Desktop Table / Mobile Cards */}
            {deskLoading ? (
              <div className="py-20 text-center text-slate-400 font-mono text-xs flex flex-col items-center">
                <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mb-2" />
                Loading inventory records...
              </div>
            ) : deskItems.length === 0 ? (
              <div className="py-16 text-center bg-[#0B0F17] rounded-xl border border-white/10 p-8 space-y-2">
                <PackageSearch className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="font-mono font-bold text-white text-sm">No items found</h3>
                <p className="text-xs text-slate-500">Try adjusting your search criteria or filters.</p>
              </div>
            ) : (
              <div className="bg-[#0B0F17] rounded-xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/10 bg-black/30 text-slate-400 uppercase text-[11px]">
                        <th className="py-3 px-4">Item Details</th>
                        <th className="py-3 px-4">Type & Category</th>
                        <th className="py-3 px-4">Custody & Station</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {deskItems.map((item) => (
                        <tr key={item._id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white line-clamp-1">{item.title || item.shortTitle}</div>
                            <div className="text-slate-400 text-[11px] line-clamp-1 mt-0.5">
                              {item.publicDescription}
                            </div>
                            <div className="text-slate-500 text-[10px] mt-0.5">
                              Reported: {new Date(item.createdAt).toLocaleDateString()}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.reportType === "LOST"
                                    ? "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                                    : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                                }`}
                              >
                                {item.reportType}
                              </span>
                              <span className="text-slate-400 text-[11px]">{item.category}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {item.custodyStatus ? (
                              <div className="space-y-0.5">
                                <span className="text-amber-300 font-medium">{item.custodyStatus}</span>
                                {item.lockerReceiptCode && (
                                  <div className="text-[10px] text-slate-400">
                                    Locker: <span className="text-white font-mono">{item.lockerReceiptCode}</span>
                                  </div>
                                )}
                                {item.safeDeskLocationId?.name && (
                                  <div className="text-[10px] text-slate-500">{item.safeDeskLocationId.name}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500">Direct / Finder</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300">
                              {item.status}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => setSelectedItemDetail(item)}
                              className="px-2.5 py-1 text-[11px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg transition-colors"
                            >
                              Inspect
                            </button>

                            {item.reportType === "FOUND" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCustodyTargetItem(item);
                                  setCustodyAction(item.custodyStatus ? "TRANSFER" : "DEPOSIT");
                                  setCustodyStationId(item.safeDeskLocationId?._id || "");
                                  setCustodyModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-[11px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg transition-colors"
                              >
                                Custody
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: CAMPUS CONTENT CMS */}
        {/* ============================================================== */}
        {activeTab === "CONTENT_CMS" && (
          <div className="space-y-6">
            {/* Sub-nav pills */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              {(["QUESTS", "EVENTS", "LOCATIONS", "ACHIEVEMENTS", "AI_GENERATOR"] as ContentSubTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setContentSubTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                    contentSubTab === tab
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : "bg-[#0B0F17] text-slate-400 hover:text-white border border-white/10"
                  }`}
                >
                  {tab === "AI_GENERATOR" ? "AI Game Master" : tab}
                </button>
              ))}
            </div>

            {/* Sub-tab 1: Quests CMS */}
            {contentSubTab === "QUESTS" && (
              <div className="space-y-6">
                {/* Create Quest Accordion Form */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setQuestSubmitting(true);
                    setQuestSuccess(null);
                    try {
                      const res = await fetch("/api/admin/quests", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(newQuest),
                      });
                      const json = await res.json();
                      if (!json.success) throw new Error(json.error || "Failed to create quest.");
                      setQuestSuccess(`Quest "${json.data?.title}" registered (${json.data?.status})!`);
                      showToast("Quest created successfully.");
                      fetchCmsQuests();
                    } catch (err: any) {
                      showToast(err.message, "error");
                    } finally {
                      setQuestSubmitting(false);
                    }
                  }}
                  className="bg-[#0B0F17] p-5 rounded-xl border border-white/10 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-emerald-400" />
                      <span>AUTHOR NEW CAMPUS QUEST (DRAFT OR PUBLISH)</span>
                    </h3>
                    <select
                      value={newQuest.status}
                      onChange={(e) => setNewQuest({ ...newQuest, status: e.target.value })}
                      className="bg-[#070A0F] border border-white/15 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200"
                    >
                      <option value="DRAFT">Save as DRAFT</option>
                      <option value="ACTIVE">Publish immediately (ACTIVE)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Quest Title *</label>
                      <input
                        type="text"
                        required
                        value={newQuest.title}
                        onChange={(e) => setNewQuest({ ...newQuest, title: e.target.value })}
                        placeholder="e.g. The Mechanical Complex Cryptography"
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Quest Type</label>
                      <select
                        value={newQuest.questType}
                        onChange={(e) => setNewQuest({ ...newQuest, questType: e.target.value })}
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      >
                        <option value="CAMPUS_TREASURE">Campus Treasure</option>
                        <option value="MYSTERY">Mystery</option>
                        <option value="INVESTIGATION">Investigation</option>
                        <option value="DAILY_HUNT">Daily Hunt</option>
                        <option value="SQUAD_HUNT">Squad Hunt</option>
                        <option value="LEGENDARY">Legendary</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-mono text-slate-400 mb-1">Public Story Brief *</label>
                      <textarea
                        required
                        rows={2}
                        value={newQuest.description}
                        onChange={(e) => setNewQuest({ ...newQuest, description: e.target.value })}
                        placeholder="Lore and narrative hints visible to hunters..."
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Target Campus Location *</label>
                      <select
                        required
                        value={newQuest.targetLocationId}
                        onChange={(e) => setNewQuest({ ...newQuest, targetLocationId: e.target.value })}
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      >
                        <option value="">Select Location</option>
                        {overview?.safeDesks?.map((loc: any) => (
                          <option key={loc._id} value={loc._id}>
                            {loc.name} ({loc.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 mb-1">XP Reward</label>
                        <input
                          type="number"
                          value={newQuest.xpReward}
                          onChange={(e) => setNewQuest({ ...newQuest, xpReward: Number(e.target.value) })}
                          className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-400 mb-1">Coin Reward</label>
                        <input
                          type="number"
                          value={newQuest.coinReward}
                          onChange={(e) => setNewQuest({ ...newQuest, coinReward: Number(e.target.value) })}
                          className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clues Builder */}
                  <div className="border-t border-white/10 pt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-300">
                        CLUE STAGES ({newQuest.clues.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
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
                        }}
                        className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Add Clue Stage</span>
                      </button>
                    </div>

                    {newQuest.clues.map((clue, idx) => (
                      <div key={idx} className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-slate-400">Stage {idx + 1}</span>
                          {newQuest.clues.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewQuest((prev) => ({
                                  ...prev,
                                  clues: prev.clues.filter((_, i) => i !== idx),
                                }));
                              }}
                              className="text-slate-500 hover:text-rose-400 text-xs"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Clue Question or Riddle"
                            value={clue.clueText}
                            onChange={(e) => {
                              const updated = [...newQuest.clues];
                              updated[idx].clueText = e.target.value;
                              setNewQuest({ ...newQuest, clues: updated });
                            }}
                            className="bg-[#070A0F] border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                          <input
                            type="text"
                            placeholder="Expected Answer (Kept Secret)"
                            value={clue.expectedAnswer}
                            onChange={(e) => {
                              const updated = [...newQuest.clues];
                              updated[idx].expectedAnswer = e.target.value;
                              setNewQuest({ ...newQuest, clues: updated });
                            }}
                            className="bg-[#070A0F] border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={questSubmitting}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{questSubmitting ? "Saving..." : "Save Quest"}</span>
                    </button>
                  </div>
                </form>

                {/* Quests Catalog List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold text-slate-300">QUEST CATALOG REVISIONS</h4>
                    <button
                      type="button"
                      onClick={fetchCmsQuests}
                      className="text-xs font-mono text-emerald-400 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${cmsQuestsLoading ? "animate-spin" : ""}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cmsQuests.map((q) => (
                      <div
                        key={q._id}
                        className="bg-[#0B0F17] rounded-xl border border-white/10 p-4 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                q.status === "ACTIVE"
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                  : q.status === "DRAFT"
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                  : "bg-slate-800 text-slate-400 border-white/10"
                              }`}
                            >
                              {q.status}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">{q.questCode}</span>
                          </div>
                          <h5 className="font-bold text-white text-sm">{q.title}</h5>
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1">{q.description}</p>
                          <div className="text-[11px] font-mono text-slate-500 mt-2">
                            Rewards: +{q.xpReward} XP • +{q.coinReward} Coins
                          </div>
                        </div>

                        <div className="border-t border-white/10 pt-2 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setQuestPreviewTarget(q)}
                            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            {q.status === "DRAFT" && (
                              <button
                                type="button"
                                onClick={() => handleQuestStatusChange(q._id, "ACTIVE")}
                                className="px-2 py-1 text-[11px] font-mono text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded"
                              >
                                Publish
                              </button>
                            )}
                            {q.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => handleQuestStatusChange(q._id, "ARCHIVED")}
                                className="px-2 py-1 text-[11px] font-mono text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded"
                              >
                                Archive
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDuplicateQuest(q._id)}
                              className="px-2 py-1 text-[11px] font-mono text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded"
                              title="Duplicate to Draft"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Events CMS */}
            {contentSubTab === "EVENTS" && (
              <div className="space-y-6">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setEventSubmitting(true);
                    try {
                      const res = await fetch("/api/admin/events", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(newEvent),
                      });
                      const json = await res.json();
                      if (!json.success) throw new Error(json.error || "Event creation failed.");
                      showToast(`Event "${newEvent.title}" registered as ${newEvent.status}.`);
                      fetchCmsEvents();
                    } catch (err: any) {
                      showToast(err.message, "error");
                    } finally {
                      setEventSubmitting(false);
                    }
                  }}
                  className="bg-[#0B0F17] p-5 rounded-xl border border-white/10 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>CREATE CAMPUS SPRINT / INTER-DEPT EVENT</span>
                    </h3>
                    <select
                      value={newEvent.status}
                      onChange={(e) => setNewEvent({ ...newEvent, status: e.target.value })}
                      className="bg-[#070A0F] border border-white/15 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200"
                    >
                      <option value="DRAFT">Save as DRAFT</option>
                      <option value="LIVE">Publish as LIVE</option>
                      <option value="UPCOMING">Schedule as UPCOMING</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Event Name *</label>
                      <input
                        type="text"
                        required
                        value={newEvent.title}
                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                        placeholder="e.g. AIEM Engineering Fest Hunt 2026"
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Event Type</label>
                      <select
                        value={newEvent.eventType}
                        onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                      >
                        <option value="INTER_DEPT">Inter-Department Showdown</option>
                        <option value="FLASH_HUNT">Flash Hunt</option>
                        <option value="DAILY_SPRINT">Daily Sprint</option>
                        <option value="FEST_TREASURE_HUNT">Fest Treasure Hunt</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-mono text-slate-400 mb-1">Description & Lore</label>
                      <textarea
                        required
                        rows={2}
                        value={newEvent.description}
                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg p-2.5 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={eventSubmitting}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{eventSubmitting ? "Creating..." : "Save Event"}</span>
                    </button>
                  </div>
                </form>

                {/* Events list */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cmsEvents.map((evt) => (
                    <div
                      key={evt._id}
                      className="bg-[#0B0F17] rounded-xl border border-white/10 p-4 flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
                            {evt.status}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">{evt.eventType}</span>
                        </div>
                        <h5 className="font-bold text-white text-sm">{evt.title}</h5>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">{evt.description}</p>
                      </div>

                      <div className="border-t border-white/10 pt-2 flex items-center justify-end gap-1.5">
                        {evt.status !== "LIVE" && (
                          <button
                            type="button"
                            onClick={() => handleEventStatusChange(evt._id, "LIVE")}
                            className="px-2 py-1 text-[11px] font-mono text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded"
                          >
                            Set Live
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDuplicateEvent(evt._id)}
                          className="px-2 py-1 text-[11px] font-mono text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded"
                          title="Duplicate Event"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-tab 3: Locations CMS */}
            {contentSubTab === "LOCATIONS" && (
              <div className="space-y-6">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setLocSubmitting(true);
                    try {
                      const res = await fetch("/api/admin/locations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(newLoc),
                      });
                      const json = await res.json();
                      if (!json.success) throw new Error(json.error || "Failed to create location.");
                      showToast(`Location ${newLoc.name} registered.`);
                      fetchCmsLocations();
                    } catch (err: any) {
                      showToast(err.message, "error");
                    } finally {
                      setLocSubmitting(false);
                    }
                  }}
                  className="bg-[#0B0F17] p-5 rounded-xl border border-white/10 space-y-4"
                >
                  <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-400" />
                    <span>REGISTER CAMPUS ZONE OR SAFE-DESK STATION</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Station Name *</label>
                      <input
                        type="text"
                        required
                        value={newLoc.name}
                        onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                        placeholder="e.g. Mechanical Lab Safe-Desk"
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Code * (Unique)</label>
                      <input
                        type="text"
                        required
                        value={newLoc.code}
                        onChange={(e) => setNewLoc({ ...newLoc, code: e.target.value })}
                        placeholder="e.g. SD_MECH_01"
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Zone Type</label>
                      <select
                        value={newLoc.zoneType}
                        onChange={(e) => setNewLoc({ ...newLoc, zoneType: e.target.value })}
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                      >
                        <option value="SAFE_DESK">Safe-Desk Station</option>
                        <option value="ACADEMIC_BLOCK">Academic Block</option>
                        <option value="LIBRARY">Central Library</option>
                        <option value="CANTEEN">Campus Canteen</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Building / Floor</label>
                      <input
                        type="text"
                        value={newLoc.building}
                        onChange={(e) => setNewLoc({ ...newLoc, building: e.target.value })}
                        placeholder="e.g. Main Block, Ground Floor"
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Operating Hours</label>
                      <input
                        type="text"
                        value={newLoc.operatingHours}
                        onChange={(e) => setNewLoc({ ...newLoc, operatingHours: e.target.value })}
                        placeholder="08:00 AM - 06:00 PM"
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="isSafeDeskCheck"
                        checked={newLoc.isSafeDesk}
                        onChange={(e) => setNewLoc({ ...newLoc, isSafeDesk: e.target.checked })}
                        className="rounded bg-[#070A0F] border-white/20 text-emerald-400 focus:ring-0"
                      />
                      <label htmlFor="isSafeDeskCheck" className="text-xs font-mono text-slate-300">
                        Designated Safe-Desk Locker Station
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={locSubmitting}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{locSubmitting ? "Saving..." : "Register Location"}</span>
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cmsLocations.map((loc) => (
                    <div
                      key={loc._id}
                      className="bg-[#0B0F17] rounded-xl border border-white/10 p-4 space-y-2.5 text-xs font-mono hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            loc.isSafeDesk
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                              : "bg-slate-800 text-slate-400 border-white/10"
                          }`}
                        >
                          {loc.isSafeDesk ? "SAFE-DESK STATION" : loc.zoneType}
                        </span>
                        <span className="text-emerald-400 font-bold">{loc.code}</span>
                      </div>
                      <h5 className="font-bold text-white text-sm">{loc.name}</h5>
                      <p className="text-slate-400 text-xs">{loc.building || loc.description || "Campus grounds"}</p>
                      
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
                        <span>Hours: {loc.operatingHours || "08:30 - 17:30"}</span>
                        <span className="text-cyan-400 font-bold">
                          Pin: X: {loc.coordinates?.mapX ?? 50}% • Y: {loc.coordinates?.mapY ?? 50}%
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingLoc({ ...loc })}
                          className="flex-1 py-1.5 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Details &amp; Pin</span>
                        </button>
                        <Link
                          href="/map"
                          className="py-1.5 px-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg text-xs transition-colors"
                          title="Open live on vector map"
                        >
                          Map View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Location Edit Modal */}
                {editingLoc && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="max-w-lg w-full bg-[#0B0F17] rounded-2xl border border-white/20 p-6 space-y-4 shadow-2xl">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-emerald-400" />
                          <h4 className="text-sm font-mono font-bold text-white">
                            Edit Location: {editingLoc.code}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingLoc(null)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setEditingLocSubmitting(true);
                          try {
                            const res = await fetch(`/api/admin/locations/${editingLoc._id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                name: editingLoc.name,
                                code: editingLoc.code,
                                zoneType: editingLoc.zoneType,
                                description: editingLoc.description,
                                operatingHours: editingLoc.operatingHours,
                                building: editingLoc.building,
                                isSafeDesk: editingLoc.isSafeDesk,
                                mapX: Number(editingLoc.coordinates?.mapX ?? 50),
                                mapY: Number(editingLoc.coordinates?.mapY ?? 50),
                                reason: "Admin modified location metadata and coordinates.",
                              }),
                            });
                            const json = await res.json();
                            if (!json.success) throw new Error(json.error || "Update failed.");
                            showToast(`Location "${editingLoc.name}" updated successfully.`);
                            setEditingLoc(null);
                            fetchCmsLocations();
                          } catch (err: any) {
                            showToast(err.message, "error");
                          } finally {
                            setEditingLocSubmitting(false);
                          }
                        }}
                        className="space-y-3 text-xs font-mono"
                      >
                        <div>
                          <label className="block text-slate-400 mb-1">Station / Zone Name *</label>
                          <input
                            type="text"
                            required
                            value={editingLoc.name}
                            onChange={(e) => setEditingLoc({ ...editingLoc, name: e.target.value })}
                            className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-400 mb-1">Code</label>
                            <input
                              type="text"
                              required
                              value={editingLoc.code}
                              onChange={(e) => setEditingLoc({ ...editingLoc, code: e.target.value })}
                              className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-white uppercase"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Zone Type</label>
                            <select
                              value={editingLoc.zoneType}
                              onChange={(e) => setEditingLoc({ ...editingLoc, zoneType: e.target.value })}
                              className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-white"
                            >
                              <option value="ACADEMIC_BLOCK">Academic Block</option>
                              <option value="SAFE_DESK">Safe-Desk Station</option>
                              <option value="LIBRARY">Central Library</option>
                              <option value="CANTEEN">Campus Canteen</option>
                              <option value="SPORTS">Sports Arena</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-400 mb-1">Operating Hours</label>
                            <input
                              type="text"
                              value={editingLoc.operatingHours || ""}
                              onChange={(e) => setEditingLoc({ ...editingLoc, operatingHours: e.target.value })}
                              className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Map Position (X% • Y%)</label>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={editingLoc.coordinates?.mapX ?? 50}
                                onChange={(e) =>
                                  setEditingLoc({
                                    ...editingLoc,
                                    coordinates: { ...(editingLoc.coordinates || {}), mapX: Number(e.target.value) },
                                  })
                                }
                                className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-2 py-1.5 text-white"
                                placeholder="X %"
                              />
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={editingLoc.coordinates?.mapY ?? 50}
                                onChange={(e) =>
                                  setEditingLoc({
                                    ...editingLoc,
                                    coordinates: { ...(editingLoc.coordinates || {}), mapY: Number(e.target.value) },
                                  })
                                }
                                className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-2 py-1.5 text-white"
                                placeholder="Y %"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="editIsSafeDesk"
                            checked={editingLoc.isSafeDesk || false}
                            onChange={(e) => setEditingLoc({ ...editingLoc, isSafeDesk: e.target.checked })}
                            className="rounded bg-slate-900 border-white/20 text-emerald-400 focus:ring-0"
                          />
                          <label htmlFor="editIsSafeDesk" className="text-slate-300 text-xs">
                            Designated Safe-Desk Locker Station
                          </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setEditingLoc(null)}
                            className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={editingLocSubmitting}
                            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{editingLocSubmitting ? "Saving..." : "Update Location"}</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab: Achievements CMS */}
            {contentSubTab === "ACHIEVEMENTS" && (
              <div className="space-y-6">
                {/* Create Achievement Accordion Form */}
                <form
                  onSubmit={handleCreateAchievement}
                  className="bg-[#0B0F17] p-5 rounded-2xl border border-white/10 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>REGISTER NEW CAMPUS ACHIEVEMENT CITATION</span>
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">
                      Standardized progression & recognition registry
                    </span>
                  </div>

                  {achievementSuccess && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                      {achievementSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">
                        Unique Citation Code (UPPERCASE_SNAKE)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. MASTER_NAVIGATOR"
                        value={newAchievement.code}
                        onChange={(e) =>
                          setNewAchievement({ ...newAchievement, code: e.target.value.toUpperCase().trim() })
                        }
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Citation Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Master Navigator"
                        value={newAchievement.title}
                        onChange={(e) => setNewAchievement({ ...newAchievement, title: e.target.value })}
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Rarity Tier</label>
                      <select
                        value={newAchievement.rarity}
                        onChange={(e) => setNewAchievement({ ...newAchievement, rarity: e.target.value })}
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                      >
                        <option value="COMMON">Common (Slate)</option>
                        <option value="RARE">Rare (Cyan)</option>
                        <option value="EPIC">Epic (Violet)</option>
                        <option value="LEGENDARY">Legendary (Amber)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Citation Brief / Description</label>
                    <textarea
                      rows={2}
                      required
                      placeholder="e.g. Recover 5 lost property items across campus and verify return at a Safe-Desk."
                      value={newAchievement.description}
                      onChange={(e) => setNewAchievement({ ...newAchievement, description: e.target.value })}
                      className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Metric Key</label>
                      <select
                        value={newAchievement.metricKey}
                        onChange={(e) => setNewAchievement({ ...newAchievement, metricKey: e.target.value })}
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                      >
                        <option value="RECOVERIES_COUNT">Recoveries Count</option>
                        <option value="SAFE_DESK_DEPOSITS">Safe Desk Deposits</option>
                        <option value="VISITED_BLOCKS_COUNT">Visited Blocks</option>
                        <option value="INVESTIGATION_QUESTS">Investigation Quests</option>
                        <option value="MYSTERY_NO_HINTS">Mystery (No Hints)</option>
                        <option value="PLAYER_LEVEL">Player Level</option>
                        <option value="SPEED_RECOVERY">Speed Recovery</option>
                        <option value="SQUAD_QUESTS">Squad Quests</option>
                        <option value="SQUAD_LEVEL">Squad Level</option>
                        <option value="LEGENDARY_QUESTS">Legendary Quests</option>
                        <option value="TREASURES_FOUND">Treasures Found</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Threshold (Target Count)</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={newAchievement.threshold}
                        onChange={(e) => setNewAchievement({ ...newAchievement, threshold: Number(e.target.value) })}
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Reward XP</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={newAchievement.xpReward}
                        onChange={(e) => setNewAchievement({ ...newAchievement, xpReward: Number(e.target.value) })}
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Reward Coins 🪙</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={newAchievement.coinReward}
                        onChange={(e) => setNewAchievement({ ...newAchievement, coinReward: Number(e.target.value) })}
                        className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-slate-400">Scope:</span>
                      <label className="flex items-center gap-1.5 text-xs font-mono text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="achievementScope"
                          value="PLAYER"
                          checked={newAchievement.scope === "PLAYER"}
                          onChange={() => setNewAchievement({ ...newAchievement, scope: "PLAYER" })}
                          className="accent-amber-400"
                        />
                        <span>Individual Hunter</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-mono text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="achievementScope"
                          value="SQUAD"
                          checked={newAchievement.scope === "SQUAD"}
                          onChange={() => setNewAchievement({ ...newAchievement, scope: "SQUAD" })}
                          className="accent-amber-400"
                        />
                        <span>Squad Team</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={achievementSubmitting}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {achievementSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Registering...</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Register Achievement</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Achievements Registry Grid */}
                <div className="bg-[#0B0F17] p-5 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h4 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>CAMPUS CITATION REGISTRY ({cmsAchievements.length} DEFINITIONS)</span>
                    </h4>
                    <div className="flex items-center gap-3">
                      <Link
                        href="/admin/achievements"
                        className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
                      >
                        <span>Open Dedicated Editor</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => fetchCmsAchievements()}
                        className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {cmsAchievementsLoading ? (
                    <div className="py-8 text-center text-xs font-mono text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Loading achievement registry...</span>
                    </div>
                  ) : cmsAchievements.length === 0 ? (
                    <div className="py-8 text-center text-xs font-mono text-slate-500">
                      No achievements found in the registry.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {cmsAchievements.map((ach) => {
                        const rarityColors: Record<string, string> = {
                          COMMON: "bg-slate-800 text-slate-300 border-slate-700",
                          RARE: "bg-cyan-950/60 text-cyan-400 border-cyan-800/60",
                          EPIC: "bg-purple-950/60 text-purple-400 border-purple-800/60",
                          LEGENDARY: "bg-amber-950/60 text-amber-400 border-amber-800/60",
                        };
                        const isArchived = ach.status === "ARCHIVED";
                        return (
                          <div
                            key={ach._id}
                            className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                              isArchived
                                ? "bg-[#070A0F]/60 border-white/5 opacity-60"
                                : "bg-[#070A0F] border-white/10 hover:border-white/20"
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                    rarityColors[ach.rarity] || rarityColors.COMMON
                                  }`}
                                >
                                  {ach.rarity}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                                    {ach.scope}
                                  </span>
                                  {isArchived ? (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/40">
                                      ARCHIVED
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                                      ACTIVE
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h5 className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                                  <span>{ach.title}</span>
                                </h5>
                                <span className="text-[10px] font-mono text-slate-500">{ach.code}</span>
                              </div>

                              <p className="text-[11px] text-slate-400 line-clamp-2">{ach.description}</p>

                              <div className="text-[10px] font-mono text-slate-400 space-y-0.5 pt-1 border-t border-white/5">
                                <div className="flex justify-between">
                                  <span>Metric Target:</span>
                                  <span className="text-white font-bold">
                                    {ach.threshold} × {ach.metricKey}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Rewards:</span>
                                  <span className="text-emerald-400">
                                    +{ach.xpReward} XP / +{ach.coinReward} Coins
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Unlocked By:</span>
                                  <span className="text-amber-400 font-bold">
                                    {ach.unlockCount ?? 0} Hunters
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-white/5">
                              {isArchived ? (
                                <button
                                  type="button"
                                  onClick={() => handleAchievementStatusChange(ach._id, "REACTIVATE")}
                                  className="px-2.5 py-1 text-[11px] font-mono rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                                >
                                  Reactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAchievementStatusChange(ach._id, "ARCHIVE")}
                                  className="px-2.5 py-1 text-[11px] font-mono rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors"
                                >
                                  Archive
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleAchievementDelete(ach._id, ach.code)}
                                className="px-2.5 py-1 text-[11px] font-mono rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-tab 4: AI Game Master */}
            {contentSubTab === "AI_GENERATOR" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0B0F17] p-5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600/20 to-emerald-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                      <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                        <span>AI GAME MASTER QUEST SYNTHESIZER & WORKBENCH</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          AUTONOMOUS CMS
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Prompt AI to generate structured campus quests with automatic stages, questions/riddles, answers, hints, and rewards. Review before publishing live.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: AI Parameters & Prompting Form */}
                  <div className="lg:col-span-5 bg-[#0B0F17] p-5 rounded-2xl border border-white/10 space-y-4">
                    <h4 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2 border-b border-white/10 pb-3">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>MISSION SYNTHESIS PARAMETERS</span>
                    </h4>

                    <form onSubmit={handleAIGenerate} className="space-y-4">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 mb-1">
                          Mission Prompt / Story Directive
                        </label>
                        <textarea
                          rows={3}
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="e.g. A missing laboratory oscilloscope has vanished near the Electronics Lab. Lead the investigator through testbenches to find the physical clue..."
                          className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400 leading-relaxed"
                        />
                        <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                          Optional: Provide narrative themes, specific item details, or campus lore.
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">Category / Type</label>
                          <select
                            value={aiQuestType}
                            onChange={(e) => setAiQuestType(e.target.value)}
                            className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                          >
                            <option value="CAMPUS_TREASURE">Campus Treasure Hunt</option>
                            <option value="INVESTIGATION">Lost Item Investigation</option>
                            <option value="MYSTERY">Campus Mystery & Lore</option>
                            <option value="SQUAD_HUNT">Squad Raid Challenge</option>
                            <option value="DAILY_HUNT">Daily Campus Sprint</option>
                            <option value="QUICK_FIND">Quick Find (1-2 Min)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1">Theme</label>
                          <select
                            value={aiTheme}
                            onChange={(e) => setAiTheme(e.target.value)}
                            className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                          >
                            <option value="CAMPUS_MYSTERY">Campus History & Secret Archives</option>
                            <option value="TECHNICAL_ENGINEERING">Engineering Lab Artifacts</option>
                            <option value="LIBRARY_EXPEDITION">Archival Library Breadcrumbs</option>
                            <option value="FEST_SCAVENGER">Campus Scavenger Fest</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                          <span>Difficulty Level: {aiDifficulty} / 5</span>
                          <span className="text-amber-400 font-bold">
                            {"★".repeat(aiDifficulty)}{"☆".repeat(5 - aiDifficulty)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={aiDifficulty}
                          onChange={(e) => setAiDifficulty(Number(e.target.value))}
                          className="w-full accent-emerald-400"
                        />
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
                          <span className="text-emerald-400">+{aiDifficulty * 75} XP</span>
                          <span className="text-amber-400">+{aiDifficulty * 15} Coins 🪙</span>
                          <span className="text-cyan-400">+{aiDifficulty * 25} Squad XP</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-slate-400 mb-1.5">
                          Clue Stages Count ({aiStageCount} Clues)
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {[2, 3, 4, 5].map((count) => (
                            <button
                              key={count}
                              type="button"
                              onClick={() => setAiStageCount(count)}
                              className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                                aiStageCount === count
                                  ? "bg-emerald-500 text-slate-950 shadow-sm"
                                  : "bg-[#070A0F] text-slate-400 hover:text-white border border-white/10"
                              }`}
                            >
                              {count} Stages
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-slate-400 mb-1">
                          Anchor Campus Location
                        </label>
                        <select
                          value={aiLocationCode}
                          onChange={(e) => setAiLocationCode(e.target.value)}
                          className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                        >
                          <option value="">Auto-Select Campus Location</option>
                          {cmsLocations.map((loc) => (
                            <option key={loc._id} value={loc.code}>
                              {loc.name} ({loc.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={aiGenerating}
                        className="w-full py-3 bg-gradient-to-r from-violet-600 via-emerald-600 to-teal-500 hover:from-violet-500 hover:to-emerald-400 text-white font-mono font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
                      >
                        <Sparkles className={`w-4 h-4 ${aiGenerating ? "animate-spin" : ""}`} />
                        <span>{aiGenerating ? "Synthesizing Clue Chains & Answers..." : "🤖 Synthesize Quest with AI"}</span>
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Interactive Review Studio */}
                  <div className="lg:col-span-7 space-y-4">
                    {aiGeneratedData ? (
                      <div className="bg-[#0B0F17] p-6 rounded-2xl border border-emerald-500/40 space-y-5 shadow-[0_0_25px_rgba(16,185,129,0.1)]">
                        {/* Header & Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-amber-400 font-bold">
                                {aiGeneratedData.quest?.questCode}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                                {aiGeneratedData.quest?.questType}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">
                                {aiGeneratedData.source}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-white mt-1">
                              {aiGeneratedData.quest?.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2">
                            {aiGeneratedData.quest?.status === "ACTIVE" ? (
                              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ACTIVE (LIVE)
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                DRAFT (READY FOR REVIEW)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Storyline & Description */}
                        <div className="space-y-1 text-xs">
                          <span className="font-mono text-slate-400 uppercase text-[10px]">Storyline Briefing</span>
                          <p className="text-slate-300 bg-[#070A0F] p-3 rounded-xl border border-white/5 leading-relaxed font-mono">
                            {aiGeneratedData.quest?.description}
                          </p>
                        </div>

                        {/* Parameters & Rewards */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-[10px] text-emerald-400 block font-bold">REWARD XP</span>
                            <span className="text-sm font-black text-white">+{aiGeneratedData.quest?.xpReward}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <span className="text-[10px] text-amber-400 block font-bold">COINS</span>
                            <span className="text-sm font-black text-white">+{aiGeneratedData.quest?.coinReward} 🪙</span>
                          </div>
                          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                            <span className="text-[10px] text-cyan-400 block font-bold">DIFFICULTY</span>
                            <span className="text-sm font-black text-white">{"★".repeat(aiGeneratedData.quest?.difficulty || 3)}</span>
                          </div>
                        </div>

                        {/* Clue Chain Stages Review */}
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="text-xs font-mono font-bold text-slate-300">
                              CLUE STAGES & VERIFICATION BLUEPRINT ({aiGeneratedData.clues?.length || 0} STAGES)
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400">
                              Verified Safe & Answers Normalized
                            </span>
                          </div>

                          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                            {aiGeneratedData.clues?.map((clue: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-4 rounded-xl bg-[#070A0F] border border-white/10 space-y-2 text-xs font-mono"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                                    Stage {clue.stageOrder}: {clue.title}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    Type: <span className="text-cyan-400">{clue.verificationType}</span>
                                  </span>
                                </div>

                                <p className="text-slate-200 text-xs leading-relaxed font-sans">
                                  {clue.clueText}
                                </p>

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <div className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold">
                                    🔑 Answer: <span className="text-white underline">{clue.expectedAnswer}</span>
                                  </div>

                                  {clue.hintText && (
                                    <div className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[11px]">
                                      💡 Hint (-{clue.hintCoinCost || 10}c): {clue.hintText}
                                    </div>
                                  )}
                                </div>

                                {clue.unlockedBreadcrumbText && (
                                  <div className="text-[10px] text-slate-400 italic pt-1 border-t border-white/5">
                                    🔓 Milestone Narrative: &quot;{clue.unlockedBreadcrumbText}&quot;
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action Bar */}
                        <div className="pt-4 border-t border-white/10 space-y-3">
                          {aiGeneratedData.quest?.status === "DRAFT" ? (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => handleMakeAiQuestPublic(aiGeneratedData.quest?._id)}
                                disabled={aiPublishing}
                                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
                              >
                                {aiPublishing ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Publishing to Campus Board...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>🚀 Make Public (Publish to Campus Board)</span>
                                  </>
                                )}
                              </button>
                              <p className="text-[11px] font-mono text-slate-400 text-center">
                                When made public, this quest will immediately appear on the public quest board for students to play and earn rewards.
                              </p>
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>Published Live! Quest is active on the public campus board.</span>
                              </div>
                              <Link
                                href={`/quests/${aiGeneratedData.quest?._id}`}
                                target="_blank"
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-[11px] hover:bg-emerald-400 transition-colors flex items-center gap-1 shrink-0"
                              >
                                <span>View on Live Board</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setAiGeneratedData(null);
                              setAiSuccessMessage(null);
                            }}
                            className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-mono text-xs rounded-xl transition-all"
                          >
                            + Synthesize Another Quest
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#0B0F17] p-10 rounded-2xl border border-white/10 text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mx-auto">
                          <Compass className="w-8 h-8" />
                        </div>
                        <div className="space-y-1.5 max-w-md mx-auto">
                          <h4 className="text-sm font-mono font-bold text-white">
                            NO ACTIVE QUEST BLUEPRINT IN WORKBENCH
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed font-mono">
                            Fill in your instructions on the left and click &quot;Synthesize Quest with AI&quot;. The Game Master engine will generate multi-stage clue chains, normalized answer keys, hint deductions, and campus location bindings for your review before publishing.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: STAFF & ACCESS MANAGEMENT */}
        {/* ============================================================== */}
        {activeTab === "STAFF_ACCESS" && (
          <div className="space-y-6">
            <div className="bg-[#0B0F17] p-5 rounded-xl border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-mono font-bold text-white">CAMPUS STAFF DIRECTORY & STATION ASSIGNMENTS</h3>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    placeholder="Search staff or student to promote..."
                    className="bg-[#070A0F] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
              </div>

              {/* Staff table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/30 text-slate-400 uppercase text-[11px]">
                      <th className="py-2.5 px-3">Name & Department</th>
                      <th className="py-2.5 px-3">Institutional Email</th>
                      <th className="py-2.5 px-3">Assigned Role</th>
                      <th className="py-2.5 px-3">Scoped Station</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {staffData.staff.map((s) => (
                      <tr key={s._id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-medium text-white">
                          {s.displayName}
                          <span className="block text-[10px] text-slate-400 font-normal">{s.department}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{s.email}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              s.role === "ADMIN"
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                : s.role === "MODERATOR"
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            }`}
                          >
                            {s.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {s.assignedStationId?.name || "Campus-wide"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setRoleChangeTarget(s);
                              setRoleChangeNewRole(s.role);
                              setRoleChangeStationId(s.assignedStationId?._id || "");
                              setRoleChangeModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-[11px] bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg transition-colors"
                          >
                            Edit Access
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Candidate students for promotion */}
            {staffData.candidates.length > 0 && (
              <div className="bg-[#0B0F17] p-5 rounded-xl border border-white/10 space-y-3">
                <h4 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>STUDENT CANDIDATES (SEARCH MATCHES)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {staffData.candidates.map((stu) => (
                    <div
                      key={stu._id}
                      className="p-3 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-white">{stu.displayName}</div>
                        <div className="text-[10px] text-slate-400">{stu.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRoleChangeTarget(stu);
                          setRoleChangeNewRole("SAFE_DESK_STAFF");
                          setRoleChangeModalOpen(true);
                        }}
                        className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[11px]"
                      >
                        Promote
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: ECONOMY CONFIGURATION & RECONCILED LEDGER */}
        {/* ============================================================== */}
        {activeTab === "ECONOMY_LEDGER" && (
          <div className="space-y-6">
            {/* Economy Configuration Form */}
            <form
              onSubmit={handleSaveConfig}
              className="bg-[#0B0F17] p-5 rounded-xl border border-white/10 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>GAME ECONOMY & POLICY CONTROLS (ADMIN STRICT)</span>
                </h3>
                {saveSuccess && (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Saved!
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Global XP Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={configForm.globalXpMultiplier}
                    onChange={(e) => setConfigForm({ ...configForm, globalXpMultiplier: e.target.value })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Global Coin Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={configForm.globalCoinMultiplier}
                    onChange={(e) => setConfigForm({ ...configForm, globalCoinMultiplier: e.target.value })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Default Finder Bonus %</label>
                  <input
                    type="number"
                    value={configForm.defaultFinderBonusPct}
                    onChange={(e) => setConfigForm({ ...configForm, defaultFinderBonusPct: e.target.value })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Daily Report Limit / User</label>
                  <input
                    type="number"
                    value={configForm.dailyReportLimitPerUser}
                    onChange={(e) => setConfigForm({ ...configForm, dailyReportLimitPerUser: e.target.value })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    Allowed Institutional Email Domains (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={configForm.allowedEmailDomains}
                    onChange={(e) => setConfigForm({ ...configForm, allowedEmailDomains: e.target.value })}
                    className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingConfig ? "Saving..." : "Save Economy Settings"}</span>
                </button>
              </div>
            </form>

            {/* Reconciled Transaction Ledger */}
            <div className="bg-[#0B0F17] rounded-xl border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-mono font-bold text-white">RECONCILED TRANSACTION AUDIT LEDGER</h3>
                </div>
                <button
                  type="button"
                  onClick={fetchTransactions}
                  className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${transactionsLoading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/30 text-slate-400 uppercase text-[11px]">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Hunter</th>
                      <th className="py-2.5 px-3">Delta XP</th>
                      <th className="py-2.5 px-3">Delta Coins</th>
                      <th className="py-2.5 px-3">Reference & Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.map((tx) => (
                      <tr key={tx._id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 text-slate-500">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-white font-medium">
                          {tx.userId?.displayName || tx.userId?.username || "Unknown"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={tx.deltaXp >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}
                          >
                            {tx.deltaXp >= 0 ? `+${tx.deltaXp}` : tx.deltaXp}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={tx.deltaCoins >= 0 ? "text-amber-400 font-bold" : "text-rose-400 font-bold"}
                          >
                            {tx.deltaCoins >= 0 ? `+${tx.deltaCoins}` : tx.deltaCoins}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          <span className="text-[10px] text-slate-500 font-mono mr-1.5">[{tx.referenceType}]</span>
                          {tx.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: FRAUD & PRIVACY REVIEW */}
        {/* ============================================================== */}
        {activeTab === "FRAUD_PRIVACY" && (
          <div className="space-y-4">
            <div className="bg-[#0B0F17] p-5 rounded-xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-mono font-bold text-white">FRAUD & ANTI-COLLUSION RADAR</h3>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {overview?.fraudAlerts?.length || 0} alerts monitored
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated detection flags rapid cycling, suspect claims, and duplicate reporting. Staff review notes
                and resolution reasons are recorded to the immutable audit log.
              </p>
            </div>

            <div className="space-y-3">
              {overview?.fraudAlerts?.length === 0 ? (
                <div className="py-16 text-center bg-[#0B0F17] rounded-xl border border-white/10 p-8 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-70" />
                  <h4 className="font-mono font-bold text-white text-sm">No Open Fraud Alerts</h4>
                  <p className="text-xs text-slate-500">Campus activities are compliant with anti-collusion policies.</p>
                </div>
              ) : (
                overview?.fraudAlerts?.map((alert: any) => (
                  <div
                    key={alert._id}
                    className="bg-[#0B0F17] border border-white/10 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            alert.severity === "CRITICAL" || alert.severity === "HIGH"
                              ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                              : "bg-amber-500/15 border-amber-500/40 text-amber-300"
                          }`}
                        >
                          {alert.severity} SEVERITY
                        </span>
                        <span className="text-xs font-mono font-bold text-white">{alert.alertType}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-500">
                        {new Date(alert.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-mono">{alert.details}</p>

                    {/* Involved users masked */}
                    {alert.involvedUserIds?.length > 0 && (
                      <div className="text-[11px] font-mono text-slate-400 border-t border-white/5 pt-2 flex items-center gap-2">
                        <span>Involved:</span>
                        {alert.involvedUserIds.map((u: any) => (
                          <span key={u._id} className="text-slate-200">
                            {u.displayName} ({u.username})
                          </span>
                        ))}
                      </div>
                    )}

                    {alert.status === "OPEN" ? (
                      <div className="border-t border-white/10 pt-3 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolveFraud(alert._id, "DISMISSED", false)}
                          className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-mono rounded-lg transition-colors"
                        >
                          Dismiss (False Positive)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveFraud(alert._id, "RESOLVED_PENALIZED", true)}
                          className="px-3 py-1 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-mono rounded-lg transition-colors"
                        >
                          Penalize (-50 Trust Score)
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] font-mono text-slate-500 border-t border-white/5 pt-2">
                        Resolved as: <span className="text-emerald-400">{alert.status}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* MODAL 1: CUSTODY INTAKE & STATION TRANSFER DIALOG */}
      {/* ============================================================== */}
      {custodyModalOpen && custodyTargetItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[#0B0F17] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-400" />
                <span>
                  {custodyAction === "DEPOSIT" ? "ACCEPT PHYSICAL CUSTODY" : "TRANSFER STATION CUSTODY"}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setCustodyModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs font-mono text-slate-400 space-y-1 bg-black/30 p-3 rounded-lg border border-white/5">
              <div className="text-white font-bold">{custodyTargetItem.title || custodyTargetItem.shortTitle}</div>
              <div>Category: {custodyTargetItem.category}</div>
              <div>Current Custody: {custodyTargetItem.custodyStatus || "None (Finder Held)"}</div>
            </div>

            <form onSubmit={handleCustodySubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Target Safe-Desk Station *
                </label>
                <select
                  required
                  value={custodyStationId}
                  onChange={(e) => setCustodyStationId(e.target.value)}
                  className="w-full bg-[#070A0F] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                >
                  <option value="">Select Destination Station</option>
                  {overview?.safeDesks?.map((sd: any) => (
                    <option key={sd._id} value={sd._id}>
                      {sd.name} ({sd.code}) • {sd.building || "Campus Station"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Locker / Storage Bin Receipt Code (Auto-generated if blank)
                </label>
                <input
                  type="text"
                  value={custodyLockerCode}
                  onChange={(e) => setCustodyLockerCode(e.target.value)}
                  placeholder="e.g. SD-ELB-402"
                  className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Condition & Sealed Bag Notes</label>
                <input
                  type="text"
                  value={custodyCondition}
                  onChange={(e) => setCustodyCondition(e.target.value)}
                  placeholder="e.g. Scratched screen, sealed in bag #B-12"
                  className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Mandatory Audit Reason * (min 5 chars)
                </label>
                <input
                  type="text"
                  required
                  minLength={5}
                  value={custodyReason}
                  onChange={(e) => setCustodyReason(e.target.value)}
                  placeholder="e.g. Finder surrendered item at Main Gate Station"
                  className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCustodyModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-mono text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={custodySubmitting}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {custodySubmitting ? "Recording..." : "Record Custody"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: CLAIM ESCALATION & DISPUTE DIALOG */}
      {/* ============================================================== */}
      {escalateModalOpen && escalateTargetClaim && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[#0B0F17] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-purple-400" />
                <span>ESCALATE CLAIM TO DISPUTE</span>
              </h3>
              <button
                type="button"
                onClick={() => setEscalateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-mono">
              Escalating freezes the claim, marks it as <span className="text-purple-300 font-bold">DISPUTED</span>,
              and requests security intervention.
            </p>

            <form onSubmit={handleEscalateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Dispute Reason * (min 5 chars)
                </label>
                <input
                  type="text"
                  required
                  minLength={5}
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="e.g. Counterparty reported conflicting ownership proof"
                  className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:ring-1 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Investigation Notes</label>
                <textarea
                  rows={2}
                  value={escalateNotes}
                  onChange={(e) => setEscalateNotes(e.target.value)}
                  placeholder="Details observed by attendant or custodian..."
                  className="w-full bg-[#070A0F] border border-white/10 rounded-lg p-2.5 text-xs font-mono text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="flagFraudCheck"
                  checked={escalateFlagFraud}
                  onChange={(e) => setEscalateFlagFraud(e.target.checked)}
                  className="rounded bg-[#070A0F] border-white/20 text-purple-400 focus:ring-0"
                />
                <label htmlFor="flagFraudCheck" className="text-xs font-mono text-slate-300">
                  Flag as suspicious for security fraud review
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEscalateModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-mono text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={escalateSubmitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {escalateSubmitting ? "Escalating..." : "Confirm Dispute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: STAFF ROLE GRANT & STATION SCOPING DIALOG */}
      {/* ============================================================== */}
      {roleChangeModalOpen && roleChangeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[#0B0F17] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>UPDATE USER ROLE & STATION SCOPE</span>
              </h3>
              <button
                type="button"
                onClick={() => setRoleChangeModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs font-mono text-slate-400 bg-black/30 p-3 rounded-lg border border-white/5 space-y-1">
              <div className="text-white font-bold">{roleChangeTarget.displayName}</div>
              <div>Email: {roleChangeTarget.email}</div>
              <div>Current Role: {roleChangeTarget.role}</div>
            </div>

            <form onSubmit={handleRoleChangeSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Select Role *</label>
                <select
                  value={roleChangeNewRole}
                  onChange={(e) => setRoleChangeNewRole(e.target.value)}
                  className="w-full bg-[#070A0F] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                >
                  <option value="STUDENT">Student (Standard seeker / loster)</option>
                  <option value="SAFE_DESK_STAFF">Safe-Desk Staff (Station-scoped attendant)</option>
                  <option value="MODERATOR">Moderator (Campus content & disputes)</option>
                  <option value="ADMIN">Administrator (Full governance)</option>
                </select>
              </div>

              {roleChangeNewRole === "SAFE_DESK_STAFF" && (
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    Assign Primary Safe-Desk Station
                  </label>
                  <select
                    value={roleChangeStationId}
                    onChange={(e) => setRoleChangeStationId(e.target.value)}
                    className="w-full bg-[#070A0F] border border-white/15 rounded-lg px-3 py-2 text-xs font-mono text-white"
                  >
                    <option value="">Campus-wide Float Attendant</option>
                    {staffData.stations?.map((st: any) => (
                      <option key={st._id} value={st._id}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Mandatory Audit Reason * (min 5 chars)
                </label>
                <input
                  type="text"
                  required
                  minLength={5}
                  value={roleChangeReason}
                  onChange={(e) => setRoleChangeReason(e.target.value)}
                  placeholder="e.g. Assigned to Library Station for Fall 2026 term"
                  className="w-full bg-[#070A0F] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setRoleChangeModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-mono text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roleChangeSubmitting}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {roleChangeSubmitting ? "Updating..." : "Save Role Grant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: ITEM DETAIL INSPECTOR (SEPARATES PUBLIC & SECRET) */}
      {/* ============================================================== */}
      {selectedItemDetail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[#0B0F17] border border-white/15 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-emerald-400">ITEM DOSSIER</span>
                <span className="text-xs font-mono text-slate-500">•</span>
                <span className="text-xs font-mono text-slate-400">{selectedItemDetail._id}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Public Title</span>
                <div className="text-base font-bold text-white">
                  {selectedItemDetail.title || selectedItemDetail.shortTitle}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Public Description</span>
                <p className="text-slate-300 bg-black/30 p-2.5 rounded-lg border border-white/5">
                  {selectedItemDetail.publicDescription || "No description provided"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-black/20 p-2 rounded border border-white/5">
                  <span className="text-slate-500 block">Category</span>
                  <span className="text-white font-bold">{selectedItemDetail.category}</span>
                </div>
                <div className="bg-black/20 p-2 rounded border border-white/5">
                  <span className="text-slate-500 block">Status</span>
                  <span className="text-emerald-400 font-bold">{selectedItemDetail.status}</span>
                </div>
              </div>

              {/* Custody Information */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg space-y-1">
                <div className="text-amber-400 font-bold flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" />
                  <span>Physical Custody State</span>
                </div>
                <div>Status: {selectedItemDetail.custodyStatus || "None (Finder Held)"}</div>
                {selectedItemDetail.lockerReceiptCode && (
                  <div>
                    Locker / Bin Code:{" "}
                    <span className="text-white font-bold">{selectedItemDetail.lockerReceiptCode}</span>
                  </div>
                )}
                {selectedItemDetail.safeDeskLocationId?.name && (
                  <div>Station: {selectedItemDetail.safeDeskLocationId.name}</div>
                )}
              </div>

              {/* History Timeline */}
              {selectedItemDetail.stateHistory?.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <span className="text-[10px] text-slate-500 uppercase block">Lifecycle Audit Events</span>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {selectedItemDetail.stateHistory.map((h: any, idx: number) => (
                      <div key={idx} className="p-2 rounded bg-black/20 text-[10px] text-slate-400">
                        <span className="text-emerald-400 font-bold mr-1.5">{h.state}</span>
                        {h.note}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white font-mono text-xs rounded-lg"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: QUEST PREVIEW CARD MODAL */}
      {/* ============================================================== */}
      {questPreviewTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[#0B0F17] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-mono font-bold text-white">PUBLIC QUEST CARD PREVIEW</h4>
              </div>
              <button
                type="button"
                onClick={() => setQuestPreviewTarget(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Simulating public card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-emerald-400 font-bold">{questPreviewTarget.questType}</span>
                <span className="text-amber-400">Difficulty: {questPreviewTarget.difficulty}/5</span>
              </div>
              <h3 className="text-base font-bold text-white">{questPreviewTarget.title}</h3>
              <p className="text-xs text-slate-400">{questPreviewTarget.description}</p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400 font-bold">+{questPreviewTarget.xpReward} XP</span>
                <span className="text-amber-400 font-bold">+{questPreviewTarget.coinReward} Coins</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setQuestPreviewTarget(null)}
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
