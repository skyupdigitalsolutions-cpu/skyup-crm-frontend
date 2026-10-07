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
  RefreshCw, Handshake, ChevronDown, ChevronUp, AlertTriangle, Eye, X,
  FileText, Image as ImageIcon, ExternalLink,
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
        : ev.notificationType === "employee_followup"
          ? "Follow-up Ping Sent to Employee"
          : "Telegram Notification Sent",
    subtitle: (ev) => ev.recipientName ? `To: ${ev.recipientName}${ev.recipientRole ? ` (${ev.recipientRole})` : ""}` : (ev.recipientRole || ""),
    body: (ev) => ev.status === "failed" ? ev.detail : (ev.notificationType === "employee_followup" ? ev.detail : ""),
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
  PROPOSAL_SENT: {
    icon: FileText, color: "#7C3AED",
    title: (ev) => `Proposal sent by ${ev.employeeName || "Employee"}`,
    subtitle: (ev) => ev.meetingType ? `During: ${ev.meetingType} meeting` : "",
    body: (ev) => ev.note,
  },
  WHATSAPP_SCREENSHOT: {
    icon: ImageIcon, color: "#16A34A",
    title: (ev) => `WhatsApp chat screenshot uploaded by ${ev.employeeName || "Employee"}`,
    subtitle: (ev) => ev.note ? `Note: ${ev.note}` : "",
    // The summary is the body; the full chat renders below it.
    body: (ev) => ev.chatStatus === "done" ? ev.summary : "",
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

// ── Full-detail modal for a template-sent event ──────────────────────────────
// Shows the complete, untruncated message. If this record predates content
// tracking (content is blank), falls back to fetching the template's cached
// generic body on demand — so even old sends show what was generally said,
// not just the internal template name.
function TemplateViewModal({ ev, onClose }) {
  const [fallbackBody, setFallbackBody] = useState(null);
  const [fallbackSource, setFallbackSource] = useState(""); // "cache" | "msg91-live" | ""
  const [loadingFallback, setLoadingFallback] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // A saved "content" that's actually just the old generic fallback sentence
  // (recorded before the resolver could find the real body) isn't the real
  // sent text — treat it the same as having no content at all and fetch the
  // real thing.
  const looksLikeFallback = !ev.content || /^Message sent to .+\(template: /.test(ev.content);

  const loadFallback = () => {
    if (!ev.templateName) return;
    setFetchError("");
    setLoadingFallback(true);
    api.get("/whatsapp/template-body", { params: { name: ev.templateName } })
      .then(({ data }) => {
        setFallbackBody(data?.body || "");
        setFallbackSource(data?.source || "");
        if (!data?.body) setFetchError("MSG91 has no BODY text cached for this template name.");
      })
      .catch((e) => {
        setFallbackBody("");
        setFetchError(e?.response?.data?.message || "Could not reach MSG91 to fetch this template.");
      })
      .finally(() => setLoadingFallback(false));
  };

  useEffect(() => {
    if (!looksLikeFallback) return; // already have the real sent text, no need to fetch
    loadFallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looksLikeFallback, ev.templateName]);

  const preferLive = looksLikeFallback && fallbackBody;
  const shownContent = preferLive ? fallbackBody : ev.content;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1A1D27] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[#7C3AED]" />
            <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Template Sent</p>
          </div>
          <button onClick={onClose} className="text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-[11.5px]">
            <div>
              <p className="text-[#8B92A9] font-semibold uppercase tracking-wide text-[9.5px] mb-0.5">Template</p>
              <p className="font-mono text-[#0F1117] dark:text-[#F0F2FA]">{ev.templateName || "—"}</p>
            </div>
            <div>
              <p className="text-[#8B92A9] font-semibold uppercase tracking-wide text-[9.5px] mb-0.5">Channel</p>
              <p className="text-[#0F1117] dark:text-[#F0F2FA] capitalize">{ev.channel || "whatsapp"}</p>
            </div>
            <div>
              <p className="text-[#8B92A9] font-semibold uppercase tracking-wide text-[9.5px] mb-0.5">Status</p>
              <p className={`font-semibold capitalize ${ev.status === "failed" ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>{ev.status || "sent"}</p>
            </div>
            <div>
              <p className="text-[#8B92A9] font-semibold uppercase tracking-wide text-[9.5px] mb-0.5">Sent At</p>
              <p className="text-[#0F1117] dark:text-[#F0F2FA]">{fmtDateTime(ev.date)}</p>
            </div>
          </div>

          <div>
            <p className="text-[#8B92A9] font-semibold uppercase tracking-wide text-[9.5px] mb-1">Message Content</p>
            {loadingFallback ? (
              <div className="flex items-center gap-2 text-[#8B92A9] py-3">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[11px]">Fetching from MSG91…</span>
              </div>
            ) : shownContent ? (
              <div className="rounded-lg bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] px-3 py-2.5">
                <p className="text-[12.5px] text-[#0F1117] dark:text-[#DDE1F5] leading-relaxed whitespace-pre-wrap">{shownContent}</p>
                {preferLive && (
                  <p className="text-[10px] text-[#8B92A9] mt-1.5 italic">
                    {fallbackSource === "msg91-live"
                      ? "Fetched live from MSG91 — generic approved template text (this send's per-lead content wasn't recorded)."
                      : "From your synced template cache — generic approved text, not the personalized message."}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-2">
                <p className="text-[11.5px] text-[#8B92A9] italic">
                  {fetchError || "Content isn't available for this send."}
                </p>
                <button
                  onClick={loadFallback}
                  className="mt-2 text-[10.5px] font-semibold text-[#2563EB] hover:underline"
                >
                  Retry fetching from MSG91
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const SENTIMENT_STYLE = {
  POSITIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  NEGATIVE: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  NEUTRAL:  "bg-gray-100 text-gray-600 dark:bg-[#262A38] dark:text-[#9DA3BB]",
};

// Chat read from a WhatsApp screenshot: status, topics, bubbles, actions.
function ScreenshotChat({ ev, leadId, isAdmin, onChanged }) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState("");
  const msgs = ev.messages || [];

  const read = async () => {
    setReading(true); setErr("");
    try {
      const base = isAdmin ? `/lead/admin/${leadId}` : `/lead/${leadId}`;
      await api.post(`${base}/whatsapp-screenshots/${ev.referenceId}/read`);
      onChanged?.();
    } catch (e) {
      setErr(e?.response?.data?.message || "Couldn't read this screenshot.");
    } finally { setReading(false); }
  };

  const status = ev.chatStatus;
  return (
    <div className="mt-1.5 space-y-1.5">
      {status === "done" && (ev.sentiment || (ev.keyTopics || []).length > 0) && (
        <div className="flex flex-wrap items-center gap-1">
          {ev.sentiment && (
            <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${SENTIMENT_STYLE[ev.sentiment] || SENTIMENT_STYLE.NEUTRAL}`}>
              {ev.sentiment.charAt(0) + ev.sentiment.slice(1).toLowerCase()}
            </span>
          )}
          {(ev.keyTopics || []).map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded bg-[#F1F4FF] dark:bg-[#262A38] text-[9.5px] text-[#4B5168] dark:text-[#9DA3BB]">{t}</span>
          ))}
        </div>
      )}
      {status === "pending" && (
        <p className="flex items-center gap-1 text-[11px] text-[#8B92A9]"><RefreshCw className="w-3 h-3 animate-spin" /> Reading the chat from the image…</p>
      )}
      {status === "failed" && <p className="text-[11px] text-red-500">Couldn't read the chat{ev.chatError ? `: ${ev.chatError}` : "."}</p>}
      {status === "unavailable" && <p className="text-[11px] text-[#8B92A9]">Chat reading isn't set up on the server.</p>}
      {err && <p className="text-[11px] text-red-500">{err}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {status === "done" && msgs.length > 0 && (
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[10.5px] font-semibold text-[#16A34A] hover:underline">
            <MessageSquare className="w-3 h-3" /> {open ? "Hide chat" : `View chat (${msgs.length} messages)`}
          </button>
        )}
        {status !== "done" && status !== "pending" && status !== "unavailable" && (
          <button onClick={read} disabled={reading} className="flex items-center gap-1 text-[10.5px] font-semibold text-[#2563EB] hover:underline disabled:opacity-50">
            {reading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {reading ? "Reading…" : status === "failed" ? "Try reading again" : "Read chat"}
          </button>
        )}
        {ev.url && (
          <a href={ev.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10.5px] font-semibold text-[#8B92A9] hover:text-[#2563EB]">
            <ExternalLink className="w-3 h-3" /> View image
          </a>
        )}
      </div>

      {open && (
        <div className="rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#EFEAE2] dark:bg-[#0B141A] p-2 space-y-1 max-h-80 overflow-y-auto">
          {msgs.map((m, i) => {
            const out = m.direction === "outbound";
            return (
              <div key={i} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-2 py-1 shadow-sm ${out ? "bg-[#D9FDD3] dark:bg-[#005C4B]" : "bg-white dark:bg-[#202C33]"}`}>
                  {m.date && i > 0 && msgs[i - 1].date === m.date ? null : m.date ? (
                    <p className="text-[9px] font-semibold text-[#667781] mb-0.5">{m.date}</p>
                  ) : null}
                  <p className="text-[11.5px] text-[#111B21] dark:text-[#E9EDEF] whitespace-pre-wrap">
                    {m.messageType && m.messageType !== "text" && !m.text ? `[${m.messageType}]` : m.text}
                  </p>
                  {m.time && <p className="text-[9px] text-[#667781] text-right">{m.time}</p>}
                </div>
              </div>
            );
          })}
          <p className="text-[9px] text-center text-[#667781] pt-1">Read from the screenshot by AI. Check the image if anything looks wrong.</p>
        </div>
      )}
    </div>
  );
}

function TimelineEvent({ ev, leadId, isAdmin, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const meta = EVENT_META[ev.type] || {
    icon: AlertTriangle, color: "#8B92A9", title: () => ev.type, subtitle: () => "", body: () => "",
  };
  const Icon = meta.icon;
  const title = meta.title(ev);
  const subtitle = meta.subtitle(ev);
  const body = meta.body(ev);
  const isLong = body && body.length > 160;
  const isTemplate = ev.type === "TEMPLATE_SENT";

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
          <div className="flex items-center gap-2 shrink-0">
            {isTemplate && (
              <button
                onClick={() => setViewOpen(true)}
                className="flex items-center gap-1 text-[10px] font-semibold text-[#7C3AED] hover:underline"
                title="View full template details"
              >
                <Eye className="w-3 h-3" /> View
              </button>
            )}
            <span className="text-[10.5px] text-[#8B92A9] whitespace-nowrap">{fmtDateTime(ev.date)}</span>
          </div>
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
        {ev.type === "PROPOSAL_SENT" && (ev.documents || []).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ev.documents.map((d, i) => (
              <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-950/30 text-[10.5px] font-semibold text-[#7C3AED] hover:underline">
                <FileText className="w-3 h-3" /> {d.name || "Proposal"}
              </a>
            ))}
          </div>
        )}
        {ev.type === "WHATSAPP_SCREENSHOT" && (
          <ScreenshotChat ev={ev} leadId={leadId} isAdmin={isAdmin} onChanged={onChanged} />
        )}
        {isTemplate && !body && (
          <button
            onClick={() => setViewOpen(true)}
            className="mt-1.5 text-[10.5px] font-semibold text-[#7C3AED] flex items-center gap-1"
          >
            <Eye className="w-3 h-3" /> View template
          </button>
        )}
      </div>
      {viewOpen && <TemplateViewModal ev={ev} onClose={() => setViewOpen(false)} />}
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
  { k: "PROPOSAL_SENT",         l: "Proposals" },
  { k: "WHATSAPP_SCREENSHOT",   l: "Screenshots" },
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
  // Default to oldest-first so the very first thing shown top-to-bottom is
  // always "New Lead Arrived", reading down through the whole story in the
  // order it actually happened.
  const [oldestFirst, setOldestFirst] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // While any screenshot is still being read, check again shortly.
  useEffect(() => {
    if (!(timeline || []).some((ev) => ev.type === "WHATSAPP_SCREENSHOT" && ev.chatStatus === "pending")) return undefined;
    const t = setTimeout(reload, 8000);
    return () => clearTimeout(t);
  }, [timeline]);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    if (timeline === null) setLoading(true);
    setError("");
    const base = isAdmin ? `/lead/admin/${leadId}/timeline` : `/lead/${leadId}/timeline`;
    api.get(base)
      .then(({ data }) => { if (!cancelled) setTimeline(data.timeline || []); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.message || "Could not load lead journey."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leadId, isAdmin, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {oldestFirst ? "Oldest first ↓" : "Newest first ↓"}
        </button>
      </div>

      {ordered.length === 0 ? (
        <p className="text-[12px] text-[#8B92A9] py-8 text-center">No activity recorded yet.</p>
      ) : (
        <div className="max-h-[520px] overflow-y-auto pr-1">
          {ordered.map((ev, i) => (
            <TimelineEvent key={`${ev.type}-${i}-${ev.date}`} ev={ev} leadId={leadId} isAdmin={isAdmin} onChanged={reload} />
          ))}
        </div>
      )}
    </div>
  );
}
