"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Shield,
  ShieldAlert,
  Trophy,
  Compass,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  LogOut,
  UserPlus,
  MessageSquare,
  UserCheck,
  XCircle,
  Clock,
  Sparkles,
  Lock,
  Send,
  Loader2,
  Settings,
  Target,
  Award,
  Crown,
  ChevronUp,
  ChevronDown,
  UserMinus,
  Save,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SquadChat from "@/components/SquadChat";
import {
  canManageJoinRequests,
  canModerateMessages,
  canRemoveSquadMember,
  canEditSquadSettings,
  canPromoteDemoteElder,
  canPromoteDemoteCoLeader,
  canTransferOrDisband,
  ROLE_HIERARCHY,
  normalizeSquadRole,
  SquadRole,
} from "@/lib/squadPermissions";

export default function SquadDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const [squad, setSquad] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [activeInvestigations, setActiveInvestigations] = useState<any[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [viewerRole, setViewerRole] = useState<SquadRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [myJoinRequest, setMyJoinRequest] = useState<any>(null);

  // Tabs: "overview", "chat", "requests", "settings"
  const [activeTab, setActiveTab] = useState<"overview" | "chat" | "requests" | "settings">("overview");

  // Squad Settings form state
  const [settingsForm, setSettingsForm] = useState<{
    description: string;
    emblemIcon: string;
    joinType: "OPEN" | "INVITE_ONLY" | "CLOSED";
    minLevelRequired: number;
    tags: string[];
  }>({
    description: "",
    emblemIcon: "ShieldAlert",
    joinType: "OPEN",
    minLevelRequired: 1,
    tags: [],
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Join request drawer/modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [submittingJoin, setSubmittingJoin] = useState(false);

  // Pending join requests (for officers)
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        if (json.user) {
          setCurrentUserId(json.user._id);
        }
      }
    } catch {
      // unauthenticated
    }
  }, []);

  const fetchSquad = useCallback(async () => {
    try {
      const res = await fetch(`/api/squads/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSquad(json.data.squad);
        setMembers(json.data.members || []);
        setActiveInvestigations(json.data.activeInvestigations || []);
        setIsMember(json.data.isMember);
        setIsLeader(json.data.isLeader);
        const role = json.data.viewerRole ? normalizeSquadRole(json.data.viewerRole) : null;
        setViewerRole(role);
        setMyJoinRequest(json.data.myJoinRequest || null);

        const sq = json.data.squad;
        if (sq) {
          setSettingsForm({
            description: sq.description || "",
            emblemIcon: sq.emblemIcon || "ShieldAlert",
            joinType: sq.joinType || (sq.privacy === "PUBLIC" ? "OPEN" : sq.privacy === "INVITE_ONLY" ? "INVITE_ONLY" : "CLOSED"),
            minLevelRequired: sq.minLevelRequired || 1,
            tags: Array.isArray(sq.tags) ? sq.tags : [],
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchJoinRequests = useCallback(async () => {
    if (!id) return;
    setLoadingRequests(true);
    try {
      const res = await fetch(`/api/squads/${id}/join-requests`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setJoinRequests(json.data);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRequests(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchSquad();
      fetchCurrentUser();
    }
  }, [id, fetchSquad, fetchCurrentUser]);

  useEffect(() => {
    if (viewerRole && canManageJoinRequests(viewerRole)) {
      fetchJoinRequests();
    }
  }, [viewerRole, fetchJoinRequests]);

  const handleDirectJoinOrPrompt = async () => {
    if (!squad) return;

    if (myJoinRequest && myJoinRequest.status === "PENDING") {
      toast({
        title: "Application Already Pending",
        description: "You already have a pending join request awaiting leadership review.",
        variant: "default",
      });
      return;
    }

    if (squad.privacy !== "PUBLIC") {
      setShowJoinModal(true);
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/squads/${id}/join`, { method: "POST" });
      const json = await res.json();

      if (json.requiresJoinRequest) {
        setShowJoinModal(true);
        return;
      }

      if (!json.success) {
        toast({
          title: "Join Request Failed",
          description: (typeof json.error === "object" ? json.error?.message : json.error) || "Failed to join squad.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Squad Joined!",
        description: `You are now an active operative of ${squad.name}.`,
        variant: "success",
      });
      fetchSquad();
    } catch (e: any) {
      toast({
        title: "Connection Error",
        description: e.message || "Failed to join squad.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (myJoinRequest && myJoinRequest.status === "PENDING") {
      toast({
        title: "Application Already Pending",
        description: "You already have a pending join request awaiting leadership review.",
        variant: "default",
      });
      setShowJoinModal(false);
      return;
    }

    setSubmittingJoin(true);

    try {
      const res = await fetch(`/api/squads/${id}/join-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: joinMessage.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({
          title: "Application Error",
          description: (typeof json.error === "object" ? json.error?.message : json.error) || "Failed to submit join request.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Application Transmitted",
        description: `Your application to ${squad?.name} has been submitted for leadership review.`,
        variant: "success",
      });
      setShowJoinModal(false);
      setJoinMessage("");
      fetchSquad();
    } catch (e: any) {
      toast({
        title: "Submission Error",
        description: e.message || "Failed to transmit application.",
        variant: "destructive",
      });
    } finally {
      setSubmittingJoin(false);
    }
  };

  const handleReviewRequest = async (requestId: string, action: "ACCEPT" | "DECLINE") => {
    try {
      const res = await fetch(`/api/squads/${id}/join-requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action,
          decisionNote: action === "ACCEPT" ? "Accepted by squad leadership" : "Declined by squad leadership",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({
          title: "Review Error",
          description: (typeof json.error === "object" ? json.error?.message : json.error) || "Failed to process join request.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: action === "ACCEPT" ? "Operative Enlisted" : "Request Declined",
        description: json.message || "Join request updated.",
        variant: action === "ACCEPT" ? "success" : "default",
      });

      fetchJoinRequests();
      fetchSquad();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to communicate with server.",
        variant: "destructive",
      });
    }
  };

  const handleWithdrawRequest = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/squads/${id}/join-requests`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({
          title: "Withdrawal Failed",
          description: (typeof json.error === "object" ? json.error?.message : json.error) || "Failed to withdraw request.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Application Withdrawn",
        description: "Your join application has been withdrawn.",
        variant: "default",
      });
      setMyJoinRequest(null);
      fetchSquad();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to withdraw join request.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm("Are you sure you want to resign from this squad?")) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/squads/${id}/leave`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast({
          title: "Leave Failed",
          description: (typeof json.error === "object" ? json.error?.message : json.error) || "Failed to leave squad.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Squad Left",
        description: "You have resigned from this squad.",
        variant: "default",
      });
      fetchSquad();
      router.push("/squads");
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to leave squad.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/squads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || json.error || "Failed to update squad settings");
      }
      toast({
        title: "Settings Saved",
        description: "Squad recruitment and identity configuration updated.",
        variant: "success",
      });
      fetchSquad();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangeMemberRole = async (memberId: string, newRole: SquadRole, memberName: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/squads/${id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CHANGE_ROLE",
          targetRole: newRole,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || json.error || "Failed to update member role");
      }
      toast({
        title: "Role Updated",
        description: `${memberName} rank changed to ${newRole}.`,
        variant: "success",
      });
      fetchSquad();
    } catch (err: any) {
      toast({
        title: "Role Change Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleKickMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to dismiss ${memberName} from this syndicate?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/squads/${id}/members/${memberId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || json.error || "Failed to dismiss member");
      }
      toast({
        title: "Member Dismissed",
        description: `${memberName} has been removed from the syndicate.`,
        variant: "default",
      });
      fetchSquad();
    } catch (err: any) {
      toast({
        title: "Dismissal Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferLeadership = async (memberId: string, targetUsername: string) => {
    const promptVal = prompt(
      `Type "${targetUsername}" to confirm transferring LEADER authority to this operative. You will become Co-Leader:`
    );
    if (!promptVal || promptVal.toLowerCase() !== targetUsername.toLowerCase()) {
      toast({
        title: "Transfer Cancelled",
        description: "Confirmation username did not match.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/squads/${id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TRANSFER_LEADERSHIP",
          confirmTransfer: true,
          recipientUsername: targetUsername,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || json.error || "Failed to transfer leadership");
      }
      toast({
        title: "Leadership Transferred",
        description: `Squad leadership transferred to @${targetUsername}.`,
        variant: "success",
      });
      fetchSquad();
    } catch (err: any) {
      toast({
        title: "Transfer Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisbandSquad = async () => {
    if (!confirm("Are you sure you want to permanently disband this squad? This action cannot be undone.")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/squads/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || json.error || "Failed to disband squad");
      }
      toast({
        title: "Squad Disbanded",
        description: "The squad has been disbanded.",
        variant: "default",
      });
      router.push("/squads");
    } catch (err: any) {
      toast({
        title: "Disband Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center font-mono text-slate-500 animate-pulse flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
        CONNECTING TO SQUAD FREQUENCY...
      </div>
    );
  }

  if (!squad) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Squad Not Found</h2>
        <Link href="/squads" className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-mono">
          Return to Squads Directory
        </Link>
      </div>
    );
  }

  const hasManagementPerms = viewerRole ? canManageJoinRequests(viewerRole) : false;
  const canModerate = viewerRole ? canModerateMessages(viewerRole) : false;
  const canEditSettings = viewerRole ? canEditSquadSettings(viewerRole) : false;

  const isSquadOpen = (squad.joinType === "OPEN") || (!squad.joinType && squad.privacy === "PUBLIC");
  const isSquadInviteOnly = (squad.joinType === "INVITE_ONLY") || (!squad.joinType && squad.privacy === "INVITE_ONLY");
  const isSquadClosed = (squad.joinType === "CLOSED") || (!squad.joinType && squad.privacy === "PRIVATE");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <Link
          href="/squads"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Squads Directory
        </Link>
      </div>

      {/* Squad Header Banner */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 p-0.5 shadow-xl shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-mono font-black text-xl text-emerald-400">
                {squad.tag}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300">
                  LEVEL {squad.squadLevel || 1} SYNDICATE
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {members.length} / {squad.memberCap || 8} Operatives
                </span>
                {isSquadOpen && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Anyone Can Join
                  </span>
                )}
                {isSquadInviteOnly && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Invite Only
                  </span>
                )}
                {isSquadClosed && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Closed
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-cyan-300 border border-cyan-500/20">
                  Req Lv.{squad.minLevelRequired || 1}+
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{squad.name}</h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl">{squad.description}</p>
            </div>
          </div>

          {/* Action button */}
          <div>
            {isMember ? (
              <button
                onClick={handleLeave}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold transition-all disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                Leave Squad
              </button>
            ) : myJoinRequest && myJoinRequest.status === "PENDING" ? (
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
                  <Clock className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                  <span>Application Pending Review</span>
                </span>
                <button
                  onClick={handleWithdrawRequest}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 text-xs font-mono font-bold transition-all disabled:opacity-50"
                  title="Withdraw your pending join request"
                >
                  Withdraw
                </button>
              </div>
            ) : myJoinRequest && myJoinRequest.status === "DECLINED" ? (
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono">
                  Application Declined
                </span>
                <button
                  onClick={handleDirectJoinOrPrompt}
                  disabled={actionLoading || members.length >= (squad.memberCap || 8)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold text-xs font-mono border border-emerald-500/30 transition-all disabled:opacity-40"
                >
                  <UserPlus className="w-4 h-4" />
                  Re-apply
                </button>
              </div>
            ) : myJoinRequest && myJoinRequest.status === "WITHDRAWN" ? (
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-mono">
                  Application Withdrawn
                </span>
                <button
                  onClick={handleDirectJoinOrPrompt}
                  disabled={actionLoading || members.length >= (squad.memberCap || 8)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold text-xs font-mono border border-emerald-500/30 transition-all disabled:opacity-40"
                >
                  <UserPlus className="w-4 h-4" />
                  Re-apply
                </button>
              </div>
            ) : (
              <button
                onClick={handleDirectJoinOrPrompt}
                disabled={actionLoading || members.length >= (squad.memberCap || 8)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40"
              >
                <UserPlus className="w-4 h-4" />
                {members.length >= (squad.memberCap || 8)
                  ? "Squad Full"
                  : squad.privacy === "PUBLIC"
                  ? "Enlist in Squad"
                  : "Request to Join"}
              </button>
            )}
          </div>
        </div>

        {/* Squad HUD Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-emerald-400">{squad.squadXp || 0}</div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Total Squad XP</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-cyan-400">{squad.completedHuntsCount || 0}</div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Hunts Solved</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-amber-400">{members.length}</div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Active Members</div>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-white/5 p-4 text-center">
            <div className="text-2xl font-black font-mono text-violet-400 truncate px-2">
              {squad.leaderId?.displayName || "Agent"}
            </div>
            <div className="text-[10px] font-mono uppercase text-slate-400 mt-1">Squad Commander</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
            activeTab === "overview"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          Roster & Field Ops
        </button>

        {isMember && (
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === "chat"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Tactical Comms
          </button>
        )}

        {hasManagementPerms && (
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all relative ${
              activeTab === "requests"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Join Requests
            {joinRequests.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {joinRequests.length}
              </span>
            )}
          </button>
        )}

        {canEditSettings && (
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all relative ${
              activeTab === "settings"
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Settings className="w-4 h-4" />
            Squad Settings &amp; Authority
          </button>
        )}
      </div>

      {/* Tab 1: Overview (Roster & Hunts) */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Squad Progression Bar & Syndicate Perks */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Syndicate Mastery — Level {squad.squadLevel || 1}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Pool investigative XP from campus quests and recoveries to level up your syndicate.
                </p>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-emerald-400 font-bold">
                  {(squad.squadXp || 0) % 1000} / 1000 XP
                </span>
                <span className="text-slate-500 ml-1">
                  ({Math.min(100, Math.round((((squad.squadXp || 0) % 1000) / 1000) * 100))}%)
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-white/5">
              <div
                className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                style={{
                  width: `${Math.min(100, Math.max(5, Math.round((((squad.squadXp || 0) % 1000) / 1000) * 100)))}%`,
                }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className={`p-3 rounded-xl border font-mono text-xs ${(squad.squadLevel || 1) >= 1 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-slate-950/60 border-white/5 text-slate-500"}`}>
                <div className="font-bold flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Charter Perks</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">8 Operatives Roster &amp; Tactical Comms</div>
              </div>

              <div className={`p-3 rounded-xl border font-mono text-xs ${(squad.squadLevel || 1) >= 2 ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300" : "bg-slate-950/60 border-white/5 text-slate-500"}`}>
                <div className="font-bold flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Field Recon</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">+10% Hunt XP Bonus for active cases</div>
              </div>

              <div className={`p-3 rounded-xl border font-mono text-xs ${(squad.squadLevel || 1) >= 3 ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-slate-950/60 border-white/5 text-slate-500"}`}>
                <div className="font-bold flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Elite Unit</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Gilded Syndicate Insignia &amp; Recognition</div>
              </div>

              <div className={`p-3 rounded-xl border font-mono text-xs ${(squad.squadLevel || 1) >= 5 ? "bg-violet-500/10 border-violet-500/30 text-violet-300" : "bg-slate-950/60 border-white/5 text-slate-500"}`}>
                <div className="font-bold flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" />
                  <span>Grand Syndicate</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Permanent Campus Wall of Champions listing</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Member Roster */}
          <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Operatives Roster ({members.length})
              </h2>
              <span className="text-[11px] font-mono text-slate-400">Sorted by Contributed XP</span>
            </div>

            <div className="space-y-3">
              {members.length === 0 ? (
                <div className="text-center py-8 text-slate-500 font-mono text-xs">
                  {squad.privacy !== "PUBLIC" && !isMember
                    ? "Roster hidden by squad privacy protocol."
                    : "No members found in squad roster."}
                </div>
              ) : (
                members.map((m: any) => {
                  const u = m.userId;
                  if (!u) return null;
                  const role = normalizeSquadRole(m.role || m.squadRole);

                  const roleBadgeConfig: Record<SquadRole, { bg: string; text: string }> = {
                    LEADER: { bg: "bg-amber-500/20 border-amber-500/40", text: "text-amber-300" },
                    COLEADER: { bg: "bg-cyan-500/20 border-cyan-500/40", text: "text-cyan-300" },
                    OFFICER: { bg: "bg-cyan-500/20 border-cyan-500/40", text: "text-cyan-300" },
                    ELDER: { bg: "bg-violet-500/20 border-violet-500/40", text: "text-violet-300" },
                    MEMBER: { bg: "bg-emerald-500/20 border-emerald-500/40", text: "text-emerald-300" },
                  };

                  const badge = roleBadgeConfig[role] || roleBadgeConfig.MEMBER;

                  return (
                    <div
                      key={m._id}
                      className="rounded-2xl bg-slate-950/60 border border-white/5 p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-emerald-400 text-sm">
                          {u.displayName?.charAt(0) || "U"}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            <span>{u.displayName}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-mono border font-bold uppercase ${badge.bg} ${badge.text}`}
                            >
                              {role}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            LVL {u.level || 1} • {u.rankTitle || "Hunter"} • @{u.username}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-emerald-400 font-bold text-xs">
                          +{m.contributedSquadXp || 0} XP
                        </div>
                        <div className="text-[10px] text-slate-500">Contributed</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Shared Investigations */}
          <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                Active Squad Hunts ({activeInvestigations.length})
              </h2>
            </div>

            <div className="space-y-3">
              {activeInvestigations.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-mono">
                  {squad.privacy !== "PUBLIC" && !isMember
                    ? "Investigation room restricted to active operatives."
                    : "No active investigations running. Accept a quest from the Quest Board to start a raid!"}
                </div>
              ) : (
                activeInvestigations.map((inv: any) => (
                  <Link
                    key={inv._id}
                    href={`/investigations/${inv._id}`}
                    className="block p-4 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-cyan-500/40 transition-all space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-amber-400 font-bold">
                        {inv.questId?.questCode || "QUEST"}
                      </span>
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        {inv.progressPct || 0}% Done
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                      {inv.questId?.title || "Investigation Room"}
                    </h3>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-white/5">
                      <span>Stage {inv.currentStage || 1} In Progress</span>
                      <span className="text-cyan-400 font-bold flex items-center gap-1">
                        Enter Corkboard <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Tab 2: Squad Chat */}
      {activeTab === "chat" && isMember && (
        <SquadChat
          squadId={squad._id}
          isMember={isMember}
          canModerate={canModerate}
          currentUserId={currentUserId}
        />
      )}

      {/* Tab 3: Join Requests */}
      {activeTab === "requests" && hasManagementPerms && (
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                Pending Join Applications
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Review applicant profiles and decide admission into {squad.name}.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {joinRequests.length} pending
            </span>
          </div>

          {loadingRequests ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              Scanning recruitment terminal...
            </div>
          ) : joinRequests.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto" />
              <p>No pending applications on the queue.</p>
              <p className="text-[11px] text-slate-400">New join requests will appear here for review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {joinRequests.map((req) => {
                const u = req.userId;
                return (
                  <div
                    key={req._id}
                    className="p-5 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-amber-400 text-sm">
                          {u?.displayName?.charAt(0) || "A"}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white">
                            {u?.displayName || "Unknown Agent"}
                          </div>
                          <div className="text-xs font-mono text-slate-400">
                            LVL {u?.level || 1} • {u?.rankTitle || "Hunter"} • @{u?.username}
                          </div>
                        </div>
                      </div>

                      {req.message && (
                        <p className="text-xs text-slate-300 font-mono bg-white/5 p-3 rounded-xl border border-white/5">
                          &ldquo;{req.message}&rdquo;
                        </p>
                      )}

                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Submitted {new Date(req.createdAt).toLocaleDateString()} at{" "}
                        {new Date(req.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        onClick={() => handleReviewRequest(req._id, "DECLINE")}
                        className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold transition-all flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Decline
                      </button>
                      <button
                        onClick={() => handleReviewRequest(req._id, "ACCEPT")}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Accept Operative
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Squad Settings & Authority (Leader & Co-Leader) */}
      {activeTab === "settings" && canEditSettings && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Squad Configuration */}
          <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-white/10 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-violet-400" />
                Recruitment &amp; Identity Protocols
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Configure admission protocols, minimum level threshold, and syndicate motto.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Join Mode (Clash of Clans) */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-300 block">
                  RECRUITMENT ACCESS TYPE
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsForm({ ...settingsForm, joinType: "OPEN" })}
                    className={`p-3 rounded-xl border text-left font-mono transition-all ${
                      settingsForm.joinType === "OPEN"
                        ? "bg-emerald-500/20 border-emerald-500/50 text-white ring-1 ring-emerald-400"
                        : "bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <div className="text-xs font-bold text-emerald-400">Anyone can join</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Instant entry if level met</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsForm({ ...settingsForm, joinType: "INVITE_ONLY" })}
                    className={`p-3 rounded-xl border text-left font-mono transition-all ${
                      settingsForm.joinType === "INVITE_ONLY"
                        ? "bg-amber-500/20 border-amber-500/50 text-white ring-1 ring-amber-400"
                        : "bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <div className="text-xs font-bold text-amber-400">Invite only</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Submit join statement</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettingsForm({ ...settingsForm, joinType: "CLOSED" })}
                    className={`p-3 rounded-xl border text-left font-mono transition-all ${
                      settingsForm.joinType === "CLOSED"
                        ? "bg-rose-500/20 border-rose-500/50 text-white ring-1 ring-rose-400"
                        : "bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <div className="text-xs font-bold text-rose-400">Closed</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">No new applicants</div>
                  </button>
                </div>
              </div>

              {/* Minimum Level Required */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <label className="text-slate-300">MINIMUM LEVEL REQUIRED</label>
                  <span className="text-cyan-400 font-bold">
                    Level {settingsForm.minLevelRequired}+
                  </span>
                </div>
                <select
                  value={settingsForm.minLevelRequired}
                  onChange={(e) => setSettingsForm({ ...settingsForm, minLevelRequired: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-violet-400"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Level {lvl}+ {lvl === 1 ? "(All Welcome)" : lvl >= 5 ? "(Veteran)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] font-mono text-slate-500">
                  Applicants or joiners under this level threshold will be prevented from joining.
                </p>
              </div>

              {/* Emblem Crest */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 block">EMBLEM CREST</label>
                <div className="grid grid-cols-6 gap-2">
                  {[
                    { id: "ShieldAlert", icon: ShieldAlert, label: "Alert" },
                    { id: "Shield", icon: Shield, label: "Shield" },
                    { id: "Compass", icon: Compass, label: "Compass" },
                    { id: "Target", icon: Target, label: "Target" },
                    { id: "Trophy", icon: Trophy, label: "Trophy" },
                    { id: "Award", icon: Award, label: "Honor" },
                  ].map((emb) => {
                    const IconComponent = emb.icon;
                    const isSelected = settingsForm.emblemIcon === emb.id;
                    return (
                      <button
                        key={emb.id}
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, emblemIcon: emb.id })}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                          isSelected
                            ? "bg-violet-500/20 border-violet-500 text-violet-300 ring-1 ring-violet-400"
                            : "bg-slate-950/60 border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                        <span className="text-[9px] font-mono">{emb.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Motto / Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300 block">MOTTO &amp; MISSION STATEMENT</label>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                  placeholder="Describe your squad's investigation focus, campus block coverage, or schedule..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-violet-400 resize-none leading-relaxed"
                />
                <div className="text-right text-[10px] font-mono text-slate-500">
                  {300 - (settingsForm.description?.length || 0)} characters remaining
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingSettings ? "Updating Settings..." : "Save Squad Settings"}
              </button>
            </form>
          </div>

          {/* Right: Member Role Permissions & CoC Hierarchy Matrix */}
          <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-white/10 space-y-6">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                Leadership &amp; Roster Authority
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Clash of Clans style syndicate chain of command: LEADER &gt; CO-LEADER &gt; ELDER &gt; MEMBER.
              </p>
            </div>

            {/* Role Hierarchy Reference */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
              <div className="space-y-0.5">
                <span className="font-bold text-amber-400">Leader (★)</span>
                <p className="text-slate-400 text-[9px] leading-tight">Full command. Can promote/demote all ranks, kick, &amp; transfer leadership.</p>
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-cyan-400">Co-Leader (◆)</span>
                <p className="text-slate-400 text-[9px] leading-tight">Executive rank. Can edit settings, accept joins, promote Elders, &amp; kick Members.</p>
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-violet-400">Elder (▲)</span>
                <p className="text-slate-400 text-[9px] leading-tight">Respected veteran. Can accept/decline join requests &amp; kick regular Members.</p>
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-emerald-400">Member (●)</span>
                <p className="text-slate-400 text-[9px] leading-tight">Active operative. Collaborates on cases and earns squad XP.</p>
              </div>
            </div>

            {/* Member Action List */}
            <div className="space-y-3">
              <div className="text-xs font-mono font-bold text-slate-300">
                ACTIVE OPERATIVES ({members.length})
              </div>

              {members.map((m: any) => {
                const u = m.userId;
                if (!u) return null;
                const memberRole = normalizeSquadRole(m.role || m.squadRole);
                const isTargetSelf = currentUserId && (u._id?.toString() === currentUserId.toString());
                const isTargetLeader = memberRole === "LEADER";

                return (
                  <div
                    key={m._id}
                    className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-white text-sm shrink-0">
                        {u.displayName?.charAt(0) || "U"}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          <span>{u.displayName}</span>
                          {isTargetSelf && (
                            <span className="text-[10px] font-mono text-slate-400">(You)</span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          @{u.username} • LVL {u.level || 1} • {m.contributedSquadXp || 0} XP
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                          memberRole === "LEADER"
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                            : memberRole === "COLEADER"
                            ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                            : memberRole === "ELDER"
                            ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                            : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        }`}
                      >
                        {memberRole}
                      </span>

                      {/* Management Action Buttons */}
                      {!isTargetSelf && (
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          {/* Promote to Co-Leader (Leader only) */}
                          {viewerRole === "LEADER" && memberRole !== "COLEADER" && memberRole !== "LEADER" && (
                            <button
                              onClick={() => handleChangeMemberRole(m._id, "COLEADER", u.displayName)}
                              disabled={actionLoading}
                              className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                              title="Promote to Co-Leader"
                            >
                              + Co-Leader
                            </button>
                          )}

                          {/* Demote Co-Leader to Elder (Leader only) */}
                          {viewerRole === "LEADER" && memberRole === "COLEADER" && (
                            <button
                              onClick={() => handleChangeMemberRole(m._id, "ELDER", u.displayName)}
                              disabled={actionLoading}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
                              title="Demote to Elder"
                            >
                              Demote to Elder
                            </button>
                          )}

                          {/* Promote Member to Elder (Leader & Co-Leader) */}
                          {(viewerRole === "LEADER" || viewerRole === "COLEADER") && memberRole === "MEMBER" && (
                            <button
                              onClick={() => handleChangeMemberRole(m._id, "ELDER", u.displayName)}
                              disabled={actionLoading}
                              className="px-2 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30"
                              title="Promote to Elder"
                            >
                              + Elder
                            </button>
                          )}

                          {/* Demote Elder to Member (Leader & Co-Leader) */}
                          {(viewerRole === "LEADER" || viewerRole === "COLEADER") && memberRole === "ELDER" && (
                            <button
                              onClick={() => handleChangeMemberRole(m._id, "MEMBER", u.displayName)}
                              disabled={actionLoading}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
                              title="Demote to Member"
                            >
                              Demote to Member
                            </button>
                          )}

                          {/* Transfer Leadership (Leader only) */}
                          {viewerRole === "LEADER" && !isTargetLeader && (
                            <button
                              onClick={() => handleTransferLeadership(m._id, u.username)}
                              disabled={actionLoading}
                              className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              title="Transfer Leadership to this operative"
                            >
                              Pass Crown
                            </button>
                          )}

                          {/* Kick Member */}
                          {canRemoveSquadMember(viewerRole as SquadRole, memberRole, isTargetLeader) && (
                            <button
                              onClick={() => handleKickMember(m._id, u.displayName)}
                              disabled={actionLoading}
                              className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              title="Dismiss operative from syndicate"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Disband Squad (Sole Leader only) */}
            {viewerRole === "LEADER" && (
              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div>
                  <div className="font-bold text-rose-400">Danger Zone: Disband Syndicate</div>
                  <div className="text-slate-500 text-[11px]">
                    {members.length > 1
                      ? "Disbanding is blocked while other active members remain."
                      : "Permanent decommission. All syndicate records will be erased."}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDisbandSquad}
                  disabled={actionLoading || members.length > 1}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Disband Squad
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Join Request Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-white/10 space-y-4 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Submit Join Application
              </h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-slate-400 hover:text-white font-mono text-xs"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              <strong className="text-white">{squad.name}</strong> is an {squad.privacy?.toLowerCase() || "invite-only"} squad.
              Introduce yourself and brief leadership on why you would be an asset to this unit.
            </p>

            <form onSubmit={handleSubmitJoinRequest} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Applicant Statement (Max 300 characters)
                </label>
                <textarea
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value.slice(0, 300))}
                  placeholder="e.g. Active daily on North Campus, specialize in electronics recovery..."
                  rows={4}
                  maxLength={300}
                  disabled={submittingJoin || myJoinRequest?.status === "PENDING"}
                  className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 resize-none disabled:opacity-50"
                />
                <div className="text-right text-[10px] font-mono text-slate-500 mt-1">
                  {300 - joinMessage.length} characters remaining
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingJoin || myJoinRequest?.status === "PENDING"}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingJoin ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {myJoinRequest?.status === "PENDING" ? "Application Pending" : "Transmit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
