"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Shield,
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SquadChat from "@/components/SquadChat";
import {
  canManageJoinRequests,
  canModerateMessages,
  canRemoveSquadMember,
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

  // Tabs: "overview", "chat", "requests"
  const [activeTab, setActiveTab] = useState<"overview" | "chat" | "requests">("overview");

  // Join request drawer/modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [submittingJoin, setSubmittingJoin] = useState(false);

  // Pending join requests (for officers)
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchCurrentUser = async () => {
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
  };

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
  }, [id, fetchSquad]);

  useEffect(() => {
    if (viewerRole && canManageJoinRequests(viewerRole)) {
      fetchJoinRequests();
    }
  }, [viewerRole, fetchJoinRequests]);

  const handleDirectJoinOrPrompt = async () => {
    if (!squad) return;

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
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/5 text-slate-400 border border-white/10">
                  {squad.privacy || "PUBLIC"}
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
      </div>

      {/* Tab 1: Overview (Roster & Hunts) */}
      {activeTab === "overview" && (
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
                  className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 resize-none"
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
                  disabled={submittingJoin}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingJoin ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Transmit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
