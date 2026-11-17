"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Flag,
  Shield,
  Clock,
  AlertTriangle,
  Building,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MessageItem {
  _id: string;
  text: string;
  isPreset: boolean;
  presetCode?: string;
  isReported: boolean;
  createdAt: string;
  isMe: boolean;
  senderLabel: string;
  avatarPreset?: string;
}

interface HandoverCoordinationChatProps {
  claimId: string;
  isFinder: boolean;
  isClaimant: boolean;
  custodyStatus?: string;
  safeDeskLocationName?: string;
}

const PRESET_MESSAGES = [
  { code: "MEET_LIBRARY", label: "Meet at Library Desk (2 PM)", text: "I can meet at the Library Safe-Desk counter today at 2:00 PM." },
  { code: "NEAR_CANTEEN", label: "Near Canteen", text: "I am near the Main Canteen Safe-Desk counter right now." },
  { code: "ARRIVED_SPOT", label: "Arrived at Location", text: "I have arrived at the agreed campus location." },
  { code: "DEPOSIT_SAFE_DESK", label: "Drop at Safe-Desk", text: "I will deposit the item at the nearest campus Safe-Desk counter for secure custody." },
];

export default function HandoverCoordinationChat({
  claimId,
  isFinder,
  isClaimant,
  custodyStatus = "HELD_BY_FINDER",
  safeDeskLocationName = "Safe-Desk Station",
}: HandoverCoordinationChatProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  const messageListRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const isInitialMountRef = useRef<boolean>(true);

  const isSafeDeskHeld = ["DEPOSITED_AT_SAFE_DESK", "SAFE_DESK"].includes(custodyStatus);

  const scrollChatToBottom = useCallback((smooth = true) => {
    if (messageListRef.current) {
      if (smooth) {
        messageListRef.current.scrollTo({
          top: messageListRef.current.scrollHeight,
          behavior: "smooth",
        });
      } else {
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      }
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/claims/${claimId}/messages`);
      const data = await res.json();
      if (data.success && data.data?.messages) {
        setMessages(data.data.messages);
        // Sync active notifications since user is in the chat
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("notificationsUpdated"));
        }
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 15000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialMountRef.current) {
        // Immediate scroll inside chat container without moving window
        scrollChatToBottom(false);
        isInitialMountRef.current = false;
      } else if (messages.length > prevMessageCountRef.current) {
        // Smooth scroll inside chat container when a new message arrives
        scrollChatToBottom(true);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, scrollChatToBottom]);

  const handleSendMessage = async (textToSend: string, isPreset = false, presetCode = "") => {
    if (!textToSend.trim()) return;

    // PIN blocking guard: Check for 6-digit numbers
    if (/\b\d{6}\b/.test(textToSend)) {
      toast({
        title: "Security Violation Blocked",
        description: "Recovery PINs cannot be shared in messages. Show your recovery pass in person upon physical return.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/claims/${claimId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSend.trim(),
          isPreset,
          presetCode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to send message.");
      }

      setInputText("");
      fetchMessages();
    } catch (err: any) {
      toast({
        title: "Send Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleReportMessage = async (messageId: string) => {
    if (!reportReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please specify why you are reporting this message.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`/api/claims/${claimId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          reason: reportReason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Message Flagged",
          description: "This message has been reported to campus moderators.",
          variant: "success",
        });
        setReportingId(null);
        setReportReason("");
        fetchMessages();
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to report message.",
        variant: "destructive",
      });
    }
  };

  if (isSafeDeskHeld) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400 border border-white/10">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Item in Safe-Desk Custody</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              This item is held physically at <strong>{safeDeskLocationName}</strong>. Peer-to-peer coordination is disabled. Please visit the Safe Desk counter directly with your 6-digit recovery code.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950 p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">
            Handover Coordination Channel
          </h3>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-500/20">
            SECURE
          </span>
        </div>
        <button
          type="button"
          onClick={fetchMessages}
          className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Refresh messages"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Safety Notice */}
      <div className="my-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>Keep coordination limited to public campus meetup spots. Never share 6-digit recovery PINs or phone numbers.</span>
        </div>
      </div>

      {/* Preset Action Chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESET_MESSAGES.map((preset) => (
          <button
            key={preset.code}
            type="button"
            disabled={sending}
            onClick={() => handleSendMessage(preset.text, true, preset.code)}
            className="rounded-lg border border-white/10 bg-slate-800/80 hover:bg-slate-750 px-2.5 py-1 text-[11px] font-mono text-slate-200 hover:text-white hover:border-emerald-500/40 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div ref={messageListRef} className="h-60 overflow-y-auto rounded-xl border border-white/5 bg-black/40 p-3 space-y-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs font-mono text-slate-500">
            Loading coordination thread...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-xs text-slate-500 gap-1 text-center p-4">
            <Sparkles className="h-5 w-5 text-slate-600 mb-1" />
            <span>No messages yet.</span>
            <span>Use the preset chips above or send a message to coordinate in-person return.</span>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg._id}
              className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1">
                <span>{msg.senderLabel}</span>
                <span>•</span>
                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs ${
                  msg.isMe
                    ? "bg-emerald-600/90 text-white rounded-br-none"
                    : "bg-slate-800 text-slate-200 rounded-bl-none border border-white/5"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
              </div>

              {!msg.isMe && !msg.isReported && (
                <button
                  type="button"
                  onClick={() => setReportingId(msg._id)}
                  className="mt-1 text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                >
                  <Flag className="h-2.5 w-2.5" />
                  <span>Report</span>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Reporting Modal / Inline Form */}
      {reportingId && (
        <div className="mt-3 p-3 rounded-xl border border-rose-500/30 bg-rose-950/30 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-rose-300">
            <span>Report Message to Moderators</span>
            <button
              type="button"
              onClick={() => {
                setReportingId(null);
                setReportReason("");
              }}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
          <input
            type="text"
            placeholder="Explain why (e.g. harassment, soliciting payment, suspicious meetup)"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="w-full text-xs bg-slate-900 border border-white/10 rounded-lg p-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
          />
          <button
            type="button"
            onClick={() => handleReportMessage(reportingId)}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Submit Moderation Report
          </button>
        </div>
      )}

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          type="text"
          value={inputText}
          maxLength={500}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type coordination message (keep contact info private)..."
          className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
        <button
          type="submit"
          disabled={sending || !inputText.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-4 py-2.5 text-xs font-bold font-mono text-slate-950 transition-colors"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
