// src/components/LeadChronologyTimeline.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Full chronological "Lead Journey" — every event that happened to this lead,
// in the order it happened, with real date + time on each line:
//   New lead arrived → Telegram notification sent to employee → Template
//   sent (with the actual message content) → Call made → Follow-up call →
//   repeat template sends → status changes …
//
// Backed by GET /lead/:id/timeline (admin: /lead/admin/:id/timeline), which
// merges Lead.callHistory, scheduledCalls, meetingRemarks, templateHistory,
// telegramNotifications, activityTimeline and the WhatsApp conversation
// thread into one sorted list (services/ai/leadTimeline.service.js).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import {
  Sparkles, Phone, CalendarClock, MessageSquare, Send, Bell,
  RefreshCw, Handshake, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import api from "../data/axiosConfig";

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

// ── Per-event-type presentation: icon, color, title + subtitle builder ───────
const EVENT_META = {
  LEAD_CREATED: {
    icon: Sparkles, color: "#2563EB",
    title: () => "New Lead Arrived",
    subtitle: (ev) => `Source: ${ev.source || "—"}${ev.campaign ? ` · Campaign: ${ev.campaign}` : ""}`,
    body: (ev) => ev.initialRemark,
  },
  TELEGRAM_NOTIFICATION: {
    icon: Bell, color: "#0EA5E9",
    title: (ev) => ev.status === "failed"
      ? "Telegram Notification Failed"
      : ev.notificationType === "employee_assigned"
        ? "Telegram Notification Sent to Employee"
        : "Telegram Notification Sent",
    subtitle: (ev) => ev.recipientName ? `To: ${ev.recipientName}${ev.recipientRole ? ` (${ev.recipientRole})` : ""}` : (ev.recipientRole || ""),
    body: (ev) => ev.status === "failed" ? ev.detail : "",
  },
  TEMPLATE_SENT: {
    icon: Send, color: "#7C3AED",
    title: (ev) => ev.status === "failed" ? `Template Failed — ${ev.templateName}` : `Template Sent — ${ev.templateName}`,
    subtitle: (ev) => `Channel: ${ev.channel || "whatsapp"}`,
    body: (ev) => ev.content,
  },
  CALL: {
    icon: Phone, color: "#059669",
    title: (ev) => `Call by ${ev.employeeName || "Employee"}${ev.outcome ? ` — ${ev.outcome}` : ""}`,
    subtitle: () => "",
    body: (ev) => ev.summary,
  },
  FOLLOW_UP: {
    icon: CalendarClock, color: "#D97706",
    title: (ev) => `${ev.followUpType === "verification" ? "Verification" : "Follow-up"} Call ${ev.status === "COMPLETED" ? "(Completed)" : ev.status === "OVERDUE" ? "(Overdue)" : "(Scheduled)"}`,
    subtitle: (ev) => ev.doneAt ? `Done: ${fmtDateTime(ev.doneAt)}` : "",
    body: (ev) => ev.note,
  },
  MEETING: {
    icon: Handshake, color: "#0891B2",
    title: (ev) => `${ev.meetingType || "Meeting"} by ${ev.employeeName || "Employee"}${ev.outcome ? ` — ${ev.outcome}` : ""}`,
    subtitle: (ev) => ev.followUpDate ? `Next follow-up: ${fmtDateTime(ev.followUpDate)}` : "",
    body: (ev) => ev.remark,
  },
  STAGE_CHANGE: {
    icon: RefreshCw, color: "#8B92A9",
    title: (ev) => (ev.action || "Status Update").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    subtitle: (ev) => ev.role ? `By: ${ev.role}` : "",
    body: (ev) => ev.note,
  },
  WHATSAPP: {
    icon: MessageSquare, color: "#22C55E",
    title: (ev) => ev.direction === "INCOMING" ? "WhatsApp Reply Received" : "WhatsApp Message Sent",
    subtitle: (ev) => ev.messageType && ev.messageType !== "text" ? `Type: ${ev.messageType}` : "",
    body: (ev) => ev.message,
  },
  CALL_TRANSCRIPT: {
    icon: Phone, color: "#0F766E",
    title: () => "Call Transcript Analyzed",
    subtitle: (ev) => ev.sentiment ? `Sentiment: ${ev.sentiment}` : "",
    body: (ev) => ev.summary,
  },
};

function TimelineEvent({ ev }) {
  const [expanded, setExpanded] = useState(false);
  const meta = EVENT_META[ev.type] || {
    icon: AlertTriangle, color: "#8B92A9", title: () => ev.type, subtitle: () => "", body: () => "",
  };
  const Icon = meta.icon;
  const title = meta.title(ev);
  const subtitle = meta.subtitle(ev);
  const body = meta.body(ev);
  const isLong = body && body.length > 160;

  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      <div className="absolute left-[13px] top-6 bottom-0 w-px bg-[#E4E7EF] dark:bg-[#262A38] last:hidden" />
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white dark:border-[#1A1D27]"
        style={{ background: (meta.color || "#8B92A9") + "18" }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-[12.5px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{title}</p>
          <span className="text-[10.5px] text-[#8B92A9] shrink-0 whitespace-nowrap">{fmtDateTime(ev.date)}</span>
        </div>
        {subtitle && <p className="text-[11px] text-[#8B92A9] mt-0.5">{subtitle}</p>}
        {body && (
          <div className="mt-1.5 rounded-lg bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] px-3 py-2">
            <p className={`text-[11.5px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed whitespace-pre-wrap ${!expanded && isLong ? "line-clamp-3" : ""}`}>
              {body}
            </p>
            {isLong && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="mt-1 text-[10.5px] font-semibold text-[#2563EB] flex items-center gap-0.5"
              >
                {expanded ? <>Show less <ChevronUp className="w-3 h-3" /></> : <>Show more <ChevronDown className="w-3 h-3" /></>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const FILTERS = [
  { k: "",                      l: "All" },
  { k: "TEMPLATE_SENT",         l: "Templates" },
  { k: "TELEGRAM_NOTIFICATION", l: "Telegram" },
  { k: "CALL",                  l: "Calls" },
  { k: "FOLLOW_UP",             l: "Follow-ups" },
  { k: "WHATSAPP",              l: "WhatsApp" },
];

// isAdmin: which auth context is calling this (drives which route/middleware
// is hit). LeadJourneyDrawer is only ever used from admin-side pages
// (AdminLeadsPage, LeadInsights), so it always passes isAdmin=true — matching
// how the same drawer already calls /lead/admin/:id/action-summary regardless
// of super_admin vs regular admin. Left as a prop (rather than hardcoded) so
// this component can be reused from an employee-facing page later.
export default function LeadChronologyTimeline({ leadId, isAdmin = true }) {
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [filter, setFilter]     = useState("");
  const [oldestFirst, setOldestFirst] = useState(false);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const base = isAdmin ? `/lead/admin/${leadId}/timeline` : `/lead/${leadId}/timeline`;
    api.get(base)
      .then(({ data }) => { if (!cancelled) setTimeline(data.timeline || []); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.message || "Could not load lead journey."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leadId, isAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[#8B92A9]">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-[12px] font-semibold">Loading lead journey…</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-[12px] text-red-500 py-4 text-center">{error}</p>;
  }

  const events = (timeline || []).filter((ev) => !filter || ev.type === filter);
  const ordered = oldestFirst ? events : [...events].reverse();

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition ${
                filter === f.k
                  ? "bg-[#2563EB] text-white"
                  : "bg-[#F8F9FC] dark:bg-[#13161E] text-[#8B92A9] border border-[#E4E7EF] dark:border-[#262A38]"
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOldestFirst((v) => !v)}
          className="text-[10.5px] font-semibold text-[#2563EB] hover:underline shrink-0"
        >
          {oldestFirst ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {ordered.length === 0 ? (
        <p className="text-[12px] text-[#8B92A9] py-8 text-center">No activity recorded yet.</p>
      ) : (
        <div className="max-h-[520px] overflow-y-auto pr-1">
          {ordered.map((ev, i) => (
            <TimelineEvent key={`${ev.type}-${i}-${ev.date}`} ev={ev} />
          ))}
        </div>
      )}
    </div>
  );
}
