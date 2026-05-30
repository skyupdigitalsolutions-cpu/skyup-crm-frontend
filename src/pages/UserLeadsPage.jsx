import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../data/axiosConfig";
import { STATUS_CONFIG, getLeadDisplayStatus, ALL_STATUSES } from "../utils/statusConfig";

const BACKEND_ROOT = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, "")
  : "https://skyup-crm-backend.onrender.com";

function maskPhone(phone) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "••••••";
  return digits.slice(0, 2) + "•••••" + digits.slice(-2);
}

// STATUS_CONFIG imported from ../utils/statusConfig (Merged=Yellow, Closed=Red)
const TEMP_CONFIG = {
  Hot:  { bg: "bg-red-100 dark:bg-red-950/40",    text: "text-red-600 dark:text-red-400",    icon: "" },
  Warm: { bg: "bg-amber-100 dark:bg-amber-950/40",text: "text-amber-600 dark:text-amber-400",icon: "" },
  Cold: { bg: "bg-blue-100 dark:bg-blue-950/40",  text: "text-blue-600 dark:text-blue-400",  icon: "" },
};
const SENTIMENT_STYLE = {
  Positive: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400" },
  Neutral:  { bg: "bg-slate-100 dark:bg-slate-800",       text: "text-slate-500 dark:text-slate-400" },
  Negative: { bg: "bg-red-50 dark:bg-red-900/20",         text: "text-red-500 dark:text-red-400" },
};
const TEMP_STYLE = {
  Hot:  { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  Warm: { bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-600 dark:text-yellow-500", dot: "bg-yellow-400" },
  Cold: { bg: "bg-blue-50 dark:bg-blue-900/20",     text: "text-blue-500 dark:text-blue-400",     dot: "bg-blue-400" },
};

const STATUS_OPTIONS  = ["New", "In Progress", "Converted", "Not Interested"];
const OUTCOME_OPTIONS = ["Call Back", "Interested", "Not Reachable", "Meeting Scheduled", "Demo Done", "Converted", "Not Interested"];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function daysSince(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso);
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30)  return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function mapLead(l) {
  const recs = Array.isArray(l.recordings) ? l.recordings : [];
  const hasRecording = recs.length > 0;
  const hasAiSummary = recs.some(r => r.transcribeStatus === "done" && r.summary);
  return {
    id:             String(l._id),
    _id:            l._id,
    name:           l.name           || "Unknown",
    phone:          l.mobile         || l.phone || "",
    email:          l.email          || "",
    source:         l.source         || "—",
    campaign:       l.campaign       || "—",
    adSetName:      l.adSetName      || "",   
    status:         l.status         || "New",
    temperature:    l.temperature    || l.Quality || null,
    remark:         l.remark         || "",
    date:           fmtDate(l.date   || l.createdAt),
    _raw_date:      l.date           || l.createdAt || null,
    callHistory:    Array.isArray(l.callHistory)    ? l.callHistory    : [],
    scheduledCalls: Array.isArray(l.scheduledCalls) ? l.scheduledCalls : [],
    previousAgents: Array.isArray(l.previousAgents) ? l.previousAgents : [],
    reassignCount:  l.reassignCount  || 0,
    agent:          l.agent          || null,
    recordings:     recs,
    hasRecording,
    hasAiSummary,
    // ── Status-resolution fields (required by getLeadDisplayStatus) ───────────
    isClosed:       l.isClosed      || false,
    mergedInto:     l.mergedInto    || null,
    closeReason:    l.closeReason   || "",
    // ── Project membership ─────────────────────────────────────────────────────
    projects:       Array.isArray(l.projects) ? l.projects : [],
  };
}

// ── Badges ────────────────────────────────────────────────────────────────────
function StatusBadge({ lead, status }) {
  let label, config;
  if (lead) {
    ({ label, config } = getLeadDisplayStatus(lead));
  } else {
    config = STATUS_CONFIG[status] || STATUS_CONFIG["New"];
    label  = status || "New";
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${config.bg} ${config.text}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: config.dot }} />
      {label}
    </span>
  );
}
function TempBadge({ temp }) {
  if (!temp) return null;
  const s = TEMP_CONFIG[temp];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[14px] font-semibold ${s.bg} ${s.text}`}>
      {s.icon} {temp}
    </span>
  );
}

// ── TranscriptionPanel ────────────────────────────────────────────────────────
function TranscriptionPanel({ callLogId, recording, contactName }) {
  const [status,     setStatus]     = useState(recording.transcribeStatus || "pending");
  const [transcript, setTranscript] = useState(recording.transcript || null);
  const [summary,    setSummary]    = useState(recording.summary    || null);
  const [expanded,   setExpanded]   = useState(false);
  const [error,      setError]      = useState(null);
  const recId = recording._id;

  useEffect(() => {
    if (status !== "processing") return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/transcription/mobile/${callLogId}/${recId}`);
        const s = res.data.transcribeStatus;
        setStatus(s);
        if (s === "done") {
          setTranscript(res.data.transcript);
          setSummary(res.data.summary);
          clearInterval(interval);
        } else if (s === "failed") {
          setError("Transcription failed. Check your OpenAI API key on the server.");
          clearInterval(interval);
        }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [status, callLogId, recId]);

  const handleTranscribe = async () => {
    setStatus("processing");
    setError(null);
    try {
      const res = await api.post(`/transcription/mobile/${callLogId}/${recId}`, {
        contactName: contactName || "the customer",
      });
      setStatus("done");
      setTranscript(res.data.transcript);
      setSummary(res.data.summary);
    } catch (e) {
      setStatus("failed");
      setError(e.response?.data?.message || "Transcription failed.");
    }
  };

  if (status === "pending") {
    return (
      <div className="mt-2">
        <button onClick={handleTranscribe}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] hover:bg-[#DBEAFE] transition">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          AI Transcribe &amp; Summarize
        </button>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F1F4FF] dark:bg-[#1A2540]">
        <svg className="w-3.5 h-3.5 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-[14px] text-[#2563EB] font-medium">Transcribing with Whisper AI…</span>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20">
          <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span className="text-[14px] text-red-500">{error || "Transcription failed."}</span>
        </div>
        <button onClick={handleTranscribe} className="text-[14px] text-[#2563EB] underline pl-1">Retry</button>
      </div>
    );
  }

  // done
  const sent      = summary?.sentiment;
  const temp      = summary?.suggestedTemp;
  const sentStyle = SENTIMENT_STYLE[sent] || SENTIMENT_STYLE.Neutral;
  const tempStyle = TEMP_STYLE[temp];

  return (
    <div className="mt-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-[#F1F4FF] dark:bg-[#1A2540] hover:bg-[#EEF3FF] transition">
        <div className="flex items-center gap-2 flex-wrap">
          <svg className="w-3.5 h-3.5 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          <span className="text-[14px] font-bold text-[#2563EB]">AI Summary</span>
          {sent && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sentStyle.bg} ${sentStyle.text}`}>{sent}</span>
          )}
          {temp && tempStyle && (
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${tempStyle.bg} ${tempStyle.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tempStyle.dot}`}/>
              {temp}
            </span>
          )}
        </div>
        <svg className={`w-3.5 h-3.5 text-[#8B92A9] transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {expanded && (
        <div className="px-3 py-3 space-y-3 bg-white dark:bg-[#13161E]">
          {summary?.summary && (
            <div>
              <p className="text-[14px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">Summary</p>
              <p className="text-[14px] text-[#4B5168] dark:text-white leading-relaxed">{summary.summary}</p>
            </div>
          )}
          {Array.isArray(summary?.keyPoints) && summary.keyPoints.length > 0 && (
            <div>
              <p className="text-[14px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">Key Points</p>
              <ul className="space-y-1">
                {summary.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#4B5168] dark:text-white">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0"/>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary?.nextAction && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#F0FDF4] dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <p className="text-[14px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-0.5">Next Action</p>
                <p className="text-[14px] text-emerald-700 dark:text-emerald-300">{summary.nextAction}</p>
              </div>
            </div>
          )}
          {transcript && (
            <details className="group">
              <summary className="cursor-pointer text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest select-none list-none flex items-center gap-1">
                <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
                Full Transcript
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto">
                <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed whitespace-pre-wrap font-mono bg-[#F8F9FC] dark:bg-[#0D0F14] rounded-lg px-3 py-2">
                  {transcript}
                </p>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ── LeadCombinedSummaryPanel ──────────────────────────────────────────────────
function LeadCombinedSummaryPanel({ leadId, leadName }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/transcription/lead/${leadId}/summary`);
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to generate combined summary.");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !data && !loading) fetchSummary();
  };

  const cs        = data?.combinedSummary;
  const sent      = cs?.overallSentiment;
  const temp      = cs?.suggestedTemp;
  const sentStyle = SENTIMENT_STYLE[sent] || SENTIMENT_STYLE.Neutral;
  const tempStyle = TEMP_STYLE[temp];

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800/50 overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-950/50 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <svg className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          <span className="text-[12px] font-bold text-violet-700 dark:text-violet-300">Lead AI Summary</span>
          <span className="text-[10px] text-violet-500 dark:text-violet-400">
            {data ? `${data.summarizedCalls} call${data.summarizedCalls !== 1 ? "s" : ""} combined` : "All transcribed calls combined"}
          </span>
          {sent && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sentStyle.bg} ${sentStyle.text}`}>{sent}</span>
          )}
          {temp && tempStyle && (
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${tempStyle.bg} ${tempStyle.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tempStyle.dot}`} />
              {temp}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {open && !loading && (
            <button
              onClick={e => { e.stopPropagation(); fetchSummary(); }}
              className="w-5 h-5 flex items-center justify-center rounded text-violet-500 hover:bg-violet-200 dark:hover:bg-violet-900/40 transition"
              title="Refresh summary"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          )}
          <svg className={`w-3.5 h-3.5 text-violet-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-4 py-4 bg-white dark:bg-[#1A1D27] space-y-3">
          {loading && (
            <div className="flex items-center gap-2 py-2">
              <svg className="w-3.5 h-3.5 animate-spin text-violet-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-[12px] text-violet-500 font-medium">Generating combined summary…</span>
            </div>
          )}
          {error && !loading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span className="text-[12px] text-red-500">{error}</span>
              </div>
              <button onClick={fetchSummary} className="text-[12px] text-violet-600 underline pl-1">Retry</button>
            </div>
          )}
          {data && !cs && !loading && !error && (
            <div className="flex items-start gap-2 px-3 py-3 rounded-lg bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
              <svg className="w-3.5 h-3.5 text-[#8B92A9] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
              </svg>
              <div>
                <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{data.message}</p>
                <p className="text-[10px] text-[#8B92A9] mt-1">
                  {data.totalCalls} call{data.totalCalls !== 1 ? "s" : ""} logged · 0 transcribed
                </p>
              </div>
            </div>
          )}
          {cs && !loading && !error && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-[#F1F4FF] dark:bg-[#1E2130] text-[#4B5168] dark:text-[#9DA3BB]">
                  {data.totalCalls} total call{data.totalCalls !== 1 ? "s" : ""}
                </span>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400">
                  {data.summarizedCalls} transcribed &amp; summarised
                </span>
              </div>
              {cs.overallSummary && (
                <div>
                  <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1.5">Overall Summary</p>
                  <p className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed">{cs.overallSummary}</p>
                </div>
              )}
              {cs.relationshipStatus && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540]">
                  <svg className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  <div>
                    <p className="text-[10px] font-bold text-[#2563EB] dark:text-[#4F8EF7] uppercase tracking-wide mb-0.5">Relationship Status</p>
                    <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{cs.relationshipStatus}</p>
                  </div>
                </div>
              )}
              {Array.isArray(cs.keyInsights) && cs.keyInsights.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1.5">Key Insights</p>
                  <ul className="space-y-1.5">
                    {cs.keyInsights.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cs.recommendedNextAction && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-[#F0FDF4] dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-0.5">Recommended Next Action</p>
                    <p className="text-[12px] text-emerald-700 dark:text-emerald-300">{cs.recommendedNextAction}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}



// ── RecordingsTab — fetches from /call-logs/recordings, filters by this lead ──
function RecordingsTab({ lead }) {
  const [callLogs, setCallLogs] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const fetchCallLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch with a large limit so we capture all call logs for this lead
      const res = await api.get("/call-logs/recordings?page=1&limit=200");
      const all = res.data.recordings || [];

      // Match by lead ID or by last-6-digits of phone number
      const phone6 = lead.phone ? lead.phone.replace(/\D/g, "").slice(-6) : null;
      const matched = all.filter(r => {
        const byId    = r.matchedLead && String(r.matchedLead._id) === String(lead.id);
        const byPhone = phone6 && r.phoneNumber &&
          r.phoneNumber.replace(/\D/g, "").endsWith(phone6);
        return byId || byPhone;
      });

      setCallLogs(matched);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load recordings.");
    } finally {
      setLoading(false);
    }
  }, [lead.id, lead.phone]);

  useEffect(() => { fetchCallLogs(); }, [fetchCallLogs]);

  const audioUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${BACKEND_ROOT}${url}`;
  };

  const fmtDuration = (sec) => {
    if (!sec) return "—";
    const m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const callTypeColor = (type) => ({
    incoming: "#059669",
    outgoing: "#2563EB",
    missed:   "#EF4444",
    rejected: "#F59E0B",
    blocked:  "#64748B",
  }[type] || "#8B92A9");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#8B92A9]">
        <svg className="w-5 h-5 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-[13px]">Loading recordings…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-[13px] text-red-500">{error}</p>
        <button onClick={fetchCallLogs} className="text-[12px] text-[#2563EB] underline">Retry</button>
      </div>
    );
  }

  if (callLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
        <svg className="w-10 h-10 text-[#E4E7EF] dark:text-[#262A38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
        <p className="text-[13px] font-semibold text-[#4B5168] dark:text-white">No recordings found</p>
        <p className="text-[11px] text-[#8B92A9]">
          Recordings upload automatically from the mobile app after calls.
        </p>
        <button onClick={fetchCallLogs}
          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-white hover:border-[#2563EB] hover:text-[#2563EB] transition">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-[#8B92A9] dark:text-gray-400 uppercase tracking-widest">
          {callLogs.length} Call Log{callLogs.length > 1 ? "s" : ""} with Recordings
        </p>
        <button onClick={fetchCallLogs}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-[#F1F4FF] dark:bg-[#1E2130] text-[#2563EB] hover:bg-[#EEF3FF] transition" title="Refresh">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>

      {callLogs.map((log, li) => (
        <div key={log._id || li} className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">

          {/* Call log header */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center text-[10px] font-black shrink-0">
                {li + 1}
              </span>
              <div>
                <p className="text-[12px] font-semibold text-[#0F1117] dark:text-white leading-none">
                  {new Date(log.timestamp).toLocaleString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                {log.user?.name && (
                  <p className="text-[10px] text-[#8B92A9] mt-0.5">Employee: {log.user.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                style={{ backgroundColor: callTypeColor(log.callType) + "20", color: callTypeColor(log.callType) }}>
                {log.callType || "call"}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#4B5168] dark:text-white">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {fmtDuration(log.duration)}
              </span>
            </div>
          </div>

          {log.remark && (
            <div className="px-3 py-2 border-b border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27]">
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] italic">"{log.remark}"</p>
            </div>
          )}

          {/* Recordings inside this call log */}
          <div className="p-3 space-y-3 bg-white dark:bg-[#1A1D27]">
            {Array.isArray(log.recordings) && log.recordings.length > 0 ? (
              log.recordings.map((r, ri) => (
                <div key={r._id || ri}
                  className="rounded-lg border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden bg-[#F8F9FC] dark:bg-[#13161E]">

                  <div className="flex items-center justify-between px-3 py-2 border-b border-[#E4E7EF] dark:border-[#262A38]">
                    <span className="text-[11px] font-semibold text-[#4B5168] dark:text-white">
                      Recording {ri + 1}
                    </span>
                    {r.transcribeStatus === "done" ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-full">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                        Transcribed
                      </span>
                    ) : r.transcribeStatus === "processing" ? (
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">Processing…</span>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#8B92A9] bg-[#F1F4FF] dark:bg-[#1E2130] px-2 py-0.5 rounded-full">Not transcribed</span>
                    )}
                  </div>

                  <div className="px-3 pt-2.5 pb-1">
                    {r.url ? (
                      <audio controls src={audioUrl(r.url)}
                        className="w-full h-8 rounded-xl accent-[#2563EB]"
                        preload="none"
                        onError={e => { e.target.style.display = "none"; }}
                      />
                    ) : (
                      <p className="text-[11px] text-[#8B92A9] italic py-1">Audio file not available</p>
                    )}
                  </div>

                  <div className="px-3 pb-3">
                    <TranscriptionPanel
                      callLogId={log._id}
                      recording={r}
                      contactName={lead.name}
                    />
                  </div>
                </div>
              ))
            ) : log.recordingUrl ? (
              <div className="rounded-lg border border-[#E4E7EF] dark:border-[#262A38] p-3 bg-[#F8F9FC] dark:bg-[#13161E]">
                <audio controls src={audioUrl(log.recordingUrl)}
                  className="w-full h-8 rounded-xl accent-[#2563EB]" preload="none"/>
              </div>
            ) : (
              <p className="text-[11px] text-[#8B92A9] italic">Recording file not available</p>
            )}
          </div>
        </div>
      ))}
        {lead.id && (
        <LeadCombinedSummaryPanel leadId={lead.id} leadName={lead.name} />
      )}
    </div>
  );
}

// ── Update drawer ─────────────────────────────────────────────────────────────
function UpdateDrawer({ lead, onClose, onSaved }) {
  const [status,       setStatus]       = useState(lead.status);
  const [remark,       setRemark]       = useState("");
  const [outcome,      setOutcome]      = useState("Call Back");
  const [temperature,  setTemperature]  = useState(lead.temperature || "");
  const [followUpDate, setFollowUpDate] = useState("");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const [activeTab,    setActiveTab]    = useState("update");

  const isNI = status === "Not Interested";

  const handleSave = async () => {
    if (!remark.trim()) return setError("Remark is required.");
    setSaving(true);
    setError("");
    try {
      let updatedLead;
      if (isNI) {
        const res = await api.patch(`/lead/${lead.id}/not-interested`, { remark: remark.trim() });
        updatedLead = res.data?.lead || res.data;
      } else {
        const body = { status, remark: remark.trim(), outcome };
        if (temperature)  body.temperature  = temperature;
        if (followUpDate) body.followUpDate = followUpDate;
        const res = await api.patch(`/lead/${lead.id}`, body);
        updatedLead = res.data?.lead || res.data;
      }
      // Prefer backend response for scheduledCalls so progress is always accurate.
      // Fall back to optimistic merge only if backend didn't return the lead.
      const newCall = { outcome: isNI ? "Not Interested" : outcome, remark: remark.trim(), calledAt: new Date().toISOString() };
      const mergedCallHistory = updatedLead?.callHistory
        ? (Array.isArray(updatedLead.callHistory) ? updatedLead.callHistory : [...(lead.callHistory || []), newCall])
        : [...(lead.callHistory || []), newCall];
      const mergedScheduled = updatedLead?.scheduledCalls
        ? (Array.isArray(updatedLead.scheduledCalls) ? updatedLead.scheduledCalls : lead.scheduledCalls || [])
        : lead.scheduledCalls || [];
      onSaved({
        ...lead,
        ...(updatedLead ? mapLead(updatedLead) : {}),
        id:             lead.id,  // preserve frontend id
        status:         isNI ? "Not Interested" : status,
        remark:         remark.trim(),
        temperature:    temperature || lead.temperature,
        callHistory:    mergedCallHistory,
        scheduledCalls: mergedScheduled,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const { label: currentDisplayLabel, config: sc } = getLeadDisplayStatus({ ...lead, status });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] h-full shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black"
                style={{ background: (sc.dot || "#2563EB") + "20", color: sc.dot || "#2563EB" }}>
                {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#0F1117] dark:text-white leading-none">{lead.name}</p>
                <p className="text-[12px] text-[#8B92A9] dark:text-gray-400 font-mono mt-0.5">{maskPhone(lead.phone)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusBadge lead={lead} />
              {lead.temperature && <TempBadge temp={lead.temperature} />}
              <span className="text-[10px] text-[#8B92A9]">{lead.source}</span>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white transition shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Lead info strip */}
        <div className="px-6 py-3 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38] grid grid-cols-2 gap-y-1.5 shrink-0">
          {[
            { label: "Campaign", value: lead.campaign !== "—" ? lead.campaign : "—" },
            { label: "Date",     value: lead.date },
            { label: "Source",   value: lead.source },
            { label: "Calls",    value: lead.callHistory.length || 0 },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[9px] font-bold text-[#8B92A9] uppercase tracking-widest">{label}</p>
              <p className="text-[12px] font-semibold text-[#0F1117] dark:text-white truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Tab bar — always visible */}
        <div className="px-6 shrink-0 flex border-b border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27]">
          {[
            { id: "update", label: "Update Lead",
              icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> },
            { id: "recordings", label: "Recordings & AI",
              icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-[12px] font-semibold border-b-2 transition -mb-px ${
                activeTab === tab.id
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-[#8B92A9] hover:text-[#4B5168] dark:hover:text-white"
              }`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Update ───────────────────────────────────── */}
        {activeTab === "update" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {lead.remark && (
                <div className="px-6 py-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
                  <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">Last Remark</p>
                  <p className="text-[12px] text-[#4B5168] dark:text-white italic">"{lead.remark}"</p>
                </div>
              )}
              {lead.callHistory.length > 0 && (
                <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
                  <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">
                    Call History ({lead.callHistory.length})
                  </p>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {[...lead.callHistory].reverse().map((h, i) => (
                      <div key={i} className="flex gap-2.5 text-[11px]">
                        <div className="w-1.5 shrink-0 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#0F1117] dark:text-white truncate">{h.outcome || "Call Back"}</span>
                            <span className="text-[#8B92A9] shrink-0 text-[10px]">{h.calledAt ? fmtDate(h.calledAt) : "—"}</span>
                          </div>
                          <p className="text-[#4B5168] dark:text-white italic truncate">{h.remark || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="px-6 py-5 space-y-4">
                <p className="text-[14px] font-bold text-[#8B92A9] dark:text-gray-400 uppercase tracking-widest">Update Lead</p>
                <div>
                  <label className="block text-[14px] font-semibold text-[#4B5168] dark:text-white mb-1.5">Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_OPTIONS.map(s => {
                      const sc2   = STATUS_CONFIG[s] || STATUS_CONFIG["New"];
                      const active = status === s;
                      return (
                        <button key={s} onClick={() => setStatus(s)}
                          className={`px-3 py-2 rounded-xl border-2 text-[14px] font-semibold transition flex items-center gap-1.5 ${
                            active
                              ? `${sc2.bg} ${sc2.text} border-current`
                              : "border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-white hover:border-[#CBD5E1]"
                          }`}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? sc2.dot : "#CBD5E1" }} />
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {!isNI && (
                  <div>
                    <label className="block text-[14px] font-semibold text-[#4B5168] dark:text-white mb-1.5">Call Outcome</label>
                    <select value={outcome} onChange={e => setOutcome(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB] transition">
                      {OUTCOME_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[14px] font-semibold text-[#4B5168] dark:text-white mb-1.5">Lead Quality</label>
                  <div className="grid grid-cols-4 gap-2">
                    {["", "Hot", "Warm", "Cold"].map(q => {
                      const colors = { Hot: "#DC2626", Warm: "#D97706", Cold: "#2563EB", "": "#8B92A9" };
                      const labels = { Hot: "Hot", Warm: " Warm", Cold: " Cold", "": "— None" };
                      const active = temperature === q;
                      return (
                        <button key={q} type="button" onClick={() => setTemperature(q)}
                          className={`px-2 py-2 rounded-xl border-2 text-[14px] font-semibold transition ${
                            active
                              ? "border-current"
                              : "border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-white hover:border-[#CBD5E1]"
                          }`}
                          style={active ? { color: colors[q], borderColor: colors[q], background: colors[q] + "15" } : {}}>
                          {labels[q]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {!isNI && outcome === "Call Back" && (
                  <div>
                    <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-white mb-1.5">
                      Follow-up Date
                      <span className="ml-1 font-normal text-[11px] text-[#8B92A9]">(optional — defaults to tomorrow)</span>
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                      onChange={e => setFollowUpDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB] transition"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-white mb-1.5">
                    Remark <span className="text-red-500">*</span>
                    {isNI && <span className="ml-1 font-normal text-[14px] text-[#8B92A9]">(reason required)</span>}
                  </label>
                  <textarea
                    value={remark}
                    onChange={e => { setRemark(e.target.value); setError(""); }}
                    rows={4}
                    placeholder="Add your call notes…"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition resize-none"
                  />
                </div>
                {error && (
                  <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-[12px] text-red-600 dark:text-red-400">
                    ⚠️ {error}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex gap-3 shrink-0">
              <button onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-white hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !remark.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
                {saving
                  ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Saving…</>
                  : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Save Update</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Recordings & AI ──────────────────────────── */}
        {activeTab === "recordings" && (
          <div className="flex-1 overflow-y-auto">
            <RecordingsTab lead={lead} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI pill ──────────────────────────────────────────────────────────────────
function KpiPill({ label, value, color, bg, text, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition font-semibold text-[13px] ${bg} ${text} ${active ? "" : "border-transparent"}`}
      style={{ borderColor: active ? color : undefined }}>
      <span className="text-[18px] font-black">{value}</span>
      {label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const PER_PAGE = 15;

export default function UserLeadsPage() {
  const [leads,    setLeads]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState(null);

  const [search,     setSearch]     = useState("");
  const [filterSt,   setFilterSt]   = useState("All");
  const [filterTemp, setFilterTemp] = useState("All");
  const [filterSrc,  setFilterSrc]  = useState("All");
  const [sortBy,     setSortBy]     = useState("date_desc");
  const [page,       setPage]       = useState(1);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // ✅ FIX: backend /lead/my-leads now always returns { leads[], total, page, pages }
      // Limit=200 covers all leads for most users in a single request.
      const res = await api.get("/lead/my-leads?page=1&limit=200");
      const raw = res.data?.leads ?? [];
      setLeads(raw.map(mapLead));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load leads. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleSaved = useCallback((updated) => {
    setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
  }, []);

  const sources = useMemo(() =>
    [...new Set(leads.map(l => l.source).filter(s => s && s !== "—"))],
  [leads]);

  const kpi = useMemo(() => ({
    total:      leads.length,
    newLeads:   leads.filter(l => l.status === "New" && !l.isClosed && !l.mergedInto).length,
    inProgress: leads.filter(l => l.status === "In Progress" && !l.isClosed && !l.mergedInto).length,
    converted:  leads.filter(l => l.status === "Converted" && !l.isClosed && !l.mergedInto).length,
    notInt:     leads.filter(l => l.status === "Not Interested" && !l.isClosed && !l.mergedInto).length,
    hot:        leads.filter(l => l.temperature === "Hot").length,
    merged:     leads.filter(l => !!l.mergedInto).length,
    closed:     leads.filter(l => l.isClosed && !l.mergedInto).length,
  }), [leads]);

  const displayed = useMemo(() => {
    let res = leads.filter(l => {
      const q           = search.toLowerCase();
      const matchSearch = !q || l.name.toLowerCase().includes(q) || l.source.toLowerCase().includes(q) || l.campaign.toLowerCase().includes(q);
      const { label: displayLabel } = getLeadDisplayStatus(l);
      const matchSt     = filterSt   === "All" || displayLabel === filterSt;
      const matchTemp   = filterTemp === "All" || l.temperature === filterTemp;
      const matchSrc    = filterSrc  === "All" || l.source      === filterSrc;
      return matchSearch && matchSt && matchTemp && matchSrc;
    });
    return res.slice().sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b._raw_date || 0) - new Date(a._raw_date || 0);
      if (sortBy === "date_asc")  return new Date(a._raw_date || 0) - new Date(b._raw_date || 0);
      if (sortBy === "name_asc")  return a.name.localeCompare(b.name);
      if (sortBy === "status")    return a.status.localeCompare(b.status);
      return 0;
    });
  }, [leads, search, filterSt, filterTemp, filterSrc, sortBy]);

  const totalPages = Math.ceil(displayed.length / PER_PAGE);
  const paged      = displayed.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const clearFilters = () => {
    setSearch(""); setFilterSt("All"); setFilterTemp("All"); setFilterSrc("All"); setPage(1);
  };
  const hasFilter = search || filterSt !== "All" || filterTemp !== "All" || filterSrc !== "All";

  const INP = "px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB] transition";

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-3 py-4 md:px-6 md:py-8">

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-white">My Leads</h1>
          <p className="text-[14px] text-[#8B92A9] dark:text-gray-400 mt-0.5">
            Your assigned leads — click any row to update status &amp; add call notes
          </p>
        </div>
        <button onClick={fetchLeads}
          className="p-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#8B92A9] hover:text-[#2563EB] transition" title="Refresh">
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: "Total",          value: kpi.total,      color: "#2563EB", bg: "bg-blue-50 dark:bg-blue-950/30",       text: "text-blue-700 dark:text-blue-300",       filter: "All"           },
          { label: "New",            value: kpi.newLeads,   color: "#2563EB", bg: "bg-blue-50 dark:bg-blue-950/30",       text: "text-blue-600 dark:text-blue-400",       filter: "New"           },
          { label: "In Progress",    value: kpi.inProgress, color: "#D97706", bg: "bg-amber-50 dark:bg-amber-950/30",     text: "text-amber-600 dark:text-amber-400",     filter: "In Progress"   },
          { label: "Converted",      value: kpi.converted,  color: "#059669", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400", filter: "Converted"     },
          { label: "Not Interested", value: kpi.notInt,     color: "#DC2626", bg: "bg-red-50 dark:bg-red-950/30",         text: "text-red-600 dark:text-red-400",         filter: "Not Interested"},
        ].map(s => (
          <KpiPill key={s.label} {...s}
            active={filterSt === s.filter}
            onClick={() => { setFilterSt(filterSt === s.filter ? "All" : s.filter); setPage(1); }} />
        ))}
        {kpi.hot > 0 && (
          <button
            onClick={() => { setFilterTemp(filterTemp === "Hot" ? "All" : "Hot"); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition font-semibold text-[13px] bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 ${filterTemp === "Hot" ? "" : "border-transparent"}`}
            style={{ borderColor: filterTemp === "Hot" ? "#DC2626" : undefined }}>
            <span className="text-[18px] font-black">{kpi.hot}</span>
             Hot
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, source, campaign…"
              className={INP + " pl-9 w-full"} />
          </div>
          <select value={filterSrc} onChange={e => { setFilterSrc(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All sources</option>
            {sources.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterTemp} onChange={e => { setFilterTemp(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All quality</option>
            <option>Hot</option><option>Warm</option><option>Cold</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={INP}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="name_asc">Name A–Z</option>
            <option value="status">By status</option>
          </select>
          {hasFilter && (
            <button onClick={clearFilters}
              className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-500 text-[12px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 transition">
              ✕ Clear
            </button>
          )}
        </div>
        <p className="text-[14px] text-[#8B92A9] dark:text-gray-400 mt-2">
          {displayed.length} leads {displayed.length !== leads.length ? `(filtered from ${leads.length})` : ""}
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[12px]">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {error}
          <button onClick={fetchLeads} className="ml-auto underline font-semibold">Retry</button>
        </div>
      )}

      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#8B92A9]">
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <span className="text-[14px]">Loading your leads…</span>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-[48px]"></span>
            <p className="text-[14px] font-semibold text-[#0F1117] dark:text-white">
              {leads.length === 0 ? "No leads assigned yet" : "No leads match your filters"}
            </p>
            {leads.length > 0 && (
              <button onClick={clearFilters}
                className="mt-1 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold hover:bg-blue-700 transition">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                    {["Lead", "Phone", "Source / Campaign", "Date", "Status", "Quality", "Calls", ""].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-[10px] font-bold text-[#8B92A9] dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                  {paged.map(l => {
                    const sc = STATUS_CONFIG[l.status] || STATUS_CONFIG["New"];
                    return (
                      <tr key={l.id}
                        className="hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition cursor-pointer group"
                        onClick={() => setSelected(l)}>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                              style={{ background: (sc.dot || "#2563EB") + "20", color: sc.dot || "#2563EB" }}>
                              {l.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-[#0F1117] dark:text-white whitespace-nowrap">{l.name}</p>
                              <p className="text-[14px] text-[#8B92A9]">{daysSince(l._raw_date) || "—"}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-mono text-[#4B5168] dark:text-white tracking-wider bg-[#F1F4FF] dark:bg-[#1A2540] px-2 py-0.5 rounded-lg text-[11px]">
                            {maskPhone(l.phone)}
                          </span>
                          {l.email && (
                            <p className="text-[14px] text-[#8B92A9] mt-0.5 truncate max-w-[120px]">
                              {l.email.replace(/(.{2})(.*)(@.*)/, "$1••••$3")}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <p className="text-[#0F1117] dark:text-white truncate max-w-[130px]">{l.source}</p>
                          {l.campaign !== "—" && (
                            <p className="text-[14px] text-[#8B92A9] truncate max-w-[130px]">{l.campaign}</p>
                          )}
                          {l.adSetName && (
                            <p className="text-[11px] text-[#E1306C] truncate max-w-[130px]"> {l.adSetName}</p>
                          )}
                          {l.projects && l.projects.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {l.projects.slice(0, 2).map((p, pi) => {
                                const pName  = p?.name  || "Project";
                                const pColor = p?.color || "#2563EB";
                                return (
                                  <span
                                    key={pi}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold truncate max-w-[100px]"
                                    style={{ background: pColor + "18", color: pColor }}
                                    title={pName}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: pColor }} />
                                    {pName}
                                  </span>
                                );
                              })}
                              {l.projects.length > 2 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7]">
                                  +{l.projects.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-[#0F1117] dark:text-white">{l.date}</p>
                        </td>

                        <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                        <td className="px-4 py-3"><TempBadge temp={l.temperature} /></td>

                        <td className="px-4 py-3">
                          {l.callHistory.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[14px] font-semibold bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                               {l.callHistory.length}
                            </span>
                          ) : (
                            <span className="text-[14px] text-[#8B92A9]">—</span>
                          )}
                        </td>

                        {/* Recordings shortcut — appears on row hover */}
                        <td className="px-4 py-3">
                          <button
                            title="View recordings & AI summary"
                            onClick={e => { e.stopPropagation(); setSelected(l); }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[14px] font-semibold bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 border border-violet-100 dark:border-violet-900/50 transition">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                            </svg>
                            Recordings
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between bg-[#F8F9FC] dark:bg-[#13161E]">
                <span className="text-[14px] text-[#8B92A9]">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, displayed.length)} of {displayed.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    return (
                      <button key={n} onClick={() => setPage(n)}
                        className={`w-7 h-7 rounded-lg text-[14px] font-semibold transition ${page === n ? "bg-[#2563EB] text-white" : "border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27]"}`}>
                        {n}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

     
      {selected && (
        <UpdateDrawer lead={selected} onClose={() => setSelected(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
