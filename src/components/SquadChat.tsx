"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, ShieldAlert, Trash2, Clock, CheckCheck, Loader2 } from "lucide-react";

interface ChatMessage {
  _id: string;
  senderId?: {
    _id: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
    rankTitle?: string;
  } | null;
  text: string;
  moderationState?: "VISIBLE" | "HIDDEN" | "REMOVED";
  createdAt: string;
}

interface SquadChatProps {
  squadId: string;
  isMember: boolean;
  canModerate: boolean;
  currentUserId?: string;
}

export default function SquadChat({
  squadId,
  isMember,
  canModerate,
  currentUserId,
}: SquadChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastFetchedTimeRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<number>(5000);
  const isOnlineRef = useRef<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = useCallback(async (sinceTime?: string | null) => {
    try {
      const url = sinceTime
        ? `/api/squads/${squadId}/messages?since=${encodeURIComponent(sinceTime)}`
        : `/api/squads/${squadId}/messages?limit=50`;

      const res = await fetch(url);
      if (!res.ok) {
        pollIntervalRef.current = Math.min(60000, Math.round(pollIntervalRef.current * 1.5));
        return;
      }
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        pollIntervalRef.current = 5000;
        if (!sinceTime) {
          setMessages(json.data);
          if (json.data.length > 0) {
            lastFetchedTimeRef.current = json.data[json.data.length - 1].createdAt;
          }
          setTimeout(scrollToBottom, 100);
        } else if (json.data.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m._id));
            const newOnes = json.data.filter((m: ChatMessage) => !existingIds.has(m._id));
            if (newOnes.length === 0) return prev;
            return [...prev, ...newOnes];
          });
          lastFetchedTimeRef.current = json.data[json.data.length - 1].createdAt;
          setTimeout(scrollToBottom, 100);
        }
      }
    } catch {
      // Background poll failure: backoff
      pollIntervalRef.current = Math.min(60000, Math.round(pollIntervalRef.current * 1.5));
    } finally {
      setLoadingInitial(false);
    }
  }, [squadId]);

  // Initial fetch
  useEffect(() => {
    if (isMember) {
      fetchMessages();
    }
  }, [isMember, fetchMessages]);

  // Polling with error backoff, visibility pausing, offline suspension, and route unmount safety
  useEffect(() => {
    if (!isMember) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let isDisposed = false;

    const scheduleNextPoll = () => {
      if (isDisposed) return;
      timeoutId = setTimeout(async () => {
        if (!isDisposed && isOnlineRef.current && document.visibilityState === "visible") {
          await fetchMessages(lastFetchedTimeRef.current);
        }
        scheduleNextPoll();
      }, pollIntervalRef.current);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isOnlineRef.current) {
        pollIntervalRef.current = 5000;
        fetchMessages(lastFetchedTimeRef.current);
      }
    };

    const handleOnline = () => {
      isOnlineRef.current = true;
      pollIntervalRef.current = 5000;
      fetchMessages(lastFetchedTimeRef.current);
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    scheduleNextPoll();

    return () => {
      isDisposed = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isMember, fetchMessages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setErrorNotice(null);

    const requestId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const res = await fetch(`/api/squads/${squadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, requestId }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const errorMsg = typeof json.error === "string" ? json.error : json.error?.message || "Failed to transmit message.";
        setErrorNotice(errorMsg);
        return;
      }

      setInputText("");
      if (json.data) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === json.data._id)) return prev;
          return [...prev, json.data];
        });
        lastFetchedTimeRef.current = json.data.createdAt;
        setTimeout(scrollToBottom, 50);
      }
    } catch (err: any) {
      setErrorNotice(err.message || "Network transmission error.");
    } finally {
      setSending(false);
    }
  };

  const handleModerateMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to remove this message and replace it with a tombstone?")) {
      return;
    }

    try {
      const res = await fetch(`/api/squads/${squadId}/messages`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, reason: "Removed by squad leadership" }),
      });

      const json = await res.json();
      if (json.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId
              ? {
                  ...m,
                  moderationState: "REMOVED",
                  text: "[This message was removed by squad leadership]",
                }
              : m
          )
        );
      } else {
        alert(typeof json.error === "string" ? json.error : json.error?.message || "Failed to moderate message.");
      }
    } catch {
      alert("Failed to communicate with server.");
    }
  };

  if (!isMember) {
    return (
      <div className="glass-panel rounded-3xl p-8 border border-white/10 text-center space-y-3 font-mono">
        <ShieldAlert className="w-10 h-10 text-slate-500 mx-auto" />
        <h3 className="text-sm font-bold text-slate-300">Tactical Comms Channel Encrypted</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Squad chat is reserved strictly for active operatives. Enlist in this squad to participate in live field communications.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-3xl border border-white/10 flex flex-col h-[520px] overflow-hidden bg-slate-950/90 shadow-2xl">
      {/* Comms HUD Header */}
      <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/80" />
          <span className="font-mono font-bold text-xs text-white uppercase tracking-wider">
            Field Comms Frequency
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
          <span>500 CAP • 30D TTL</span>
          <span className="text-emerald-400 font-bold">ONLINE</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-white/10">
        {loadingInitial ? (
          <div className="flex items-center justify-center h-full text-slate-500 font-mono text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            SYNCHRONIZING SECURE FEED...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-xs text-center space-y-1">
            <p>Channel is clear. No tactical messages sent yet.</p>
            <p className="text-[11px] text-slate-400">Coordinate clue sweeps and Safe-Desk dropoffs with your squad.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isRemoved = msg.moderationState === "REMOVED";
            const isSelf = currentUserId && msg.senderId?._id === currentUserId;

            return (
              <div
                key={msg._id}
                className={`flex flex-col gap-1 ${isSelf ? "items-end" : "items-start"} group`}
              >
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 px-1">
                  <span className="font-bold text-slate-300">
                    {msg.senderId?.displayName || "Operative"}
                  </span>
                  {msg.senderId?.rankTitle && (
                    <span className="text-[9px] px-1 py-0.2 bg-white/5 rounded text-emerald-400/80">
                      {msg.senderId.rankTitle}
                    </span>
                  )}
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {canModerate && !isRemoved && (
                    <button
                      onClick={() => handleModerateMessage(msg._id)}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity p-0.5"
                      title="Moderate / Remove message"
                      aria-label="Remove message"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-mono leading-relaxed break-words ${
                    isRemoved
                      ? "bg-slate-900/40 border border-white/5 text-slate-500 italic"
                      : isSelf
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-100 rounded-tr-sm"
                      : "bg-slate-900/90 border border-white/10 text-slate-200 rounded-tl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error alert */}
      {errorNotice && (
        <div className="px-4 py-1.5 bg-rose-500/15 border-t border-rose-500/30 text-rose-300 text-[11px] font-mono flex items-center justify-between">
          <span>{errorNotice}</span>
          <button
            onClick={() => setErrorNotice(null)}
            className="text-rose-400 hover:text-white underline text-[10px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input Tray */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-white/10 bg-slate-900/80 flex items-center gap-2"
      >
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value.slice(0, 1000))}
            placeholder="Broadcast tactical intel to squad..."
            disabled={sending}
            maxLength={1000}
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 disabled:opacity-50"
          />
          {inputText.length > 800 && (
            <span
              className={`absolute right-3 top-2.5 text-[10px] font-mono ${
                inputText.length >= 1000 ? "text-rose-400 font-bold" : "text-amber-400"
              }`}
            >
              {1000 - inputText.length}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={sending || !inputText.trim()}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:hover:bg-emerald-500 shrink-0"
        >
          {sending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Send
        </button>
      </form>
    </div>
  );
}

