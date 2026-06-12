import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import api from "../data/axiosConfig";
import LeadJourneyDrawer from "./LeadJourneyDrawer";
import ClientMeetingTab from "./ClientMeetingTab";
import CRMEncryption from "../utils/CRMEncryption";
import { getRole } from "../data/dataService";
import { normalizePhone } from "../utils/normalizePhone";
import { STATUS_CONFIG, getLeadDisplayStatus, ALL_STATUSES } from "../utils/statusConfig";
import {
  RefreshCw,
  Plus,
  Upload,
  Download,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  AlertTriangle,
  AlertCircle,
  Mic,
  Sparkles,
  Loader2,
  Eye,
  User,
  Clock,
  RotateCcw,
} from "lucide-react";

const crm = new CRMEncryption();

const BACKEND_ROOT = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, "")
  : "https://skyup-crm-backend.onrender.com";

// ── Phone masking utility ─────────────────────────────────────────────────────
// Superadmin always sees the full number; admin sees last 2 digits only.
function maskPhone(phone, isSuperAdmin) {
  if (!phone) return "—";
  if (isSuperAdmin) return phone;
  const str = String(phone);
  if (str.length <= 2) return "••••••••";
  return "•".repeat(str.length - 2) + str.slice(-2);
}

// ── Email masking utility ──────────────────────────────────────────────────────
// Superadmin always sees the full email; admin sees masked version.
function maskEmail(email, isSuperAdmin) {
  if (!email) return null;
  if (isSuperAdmin) return email;
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "•".repeat(8);
  const local  = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  let maskedLocal;
  if (local.length <= 2) {
    maskedLocal = "•".repeat(local.length);
  } else {
    const mid = Math.max(1, local.length - 4);
    maskedLocal = local.slice(0, 2) + "•".repeat(mid) + local.slice(-2);
  }
  const dotIdx = domain.lastIndexOf(".");
  const maskedDomain = dotIdx > 0
    ? "•".repeat(dotIdx) + domain.slice(dotIdx)
    : "•".repeat(domain.length);
  return `${maskedLocal}@${maskedDomain}`;
}

// STATUS_CONFIG and ALL_STATUSES are imported from ../utils/statusConfig
// (includes virtual statuses: Merged=Yellow, Closed=Red)
const TEMP_CONFIG = {
  Hot:  { bg: "bg-red-100 dark:bg-red-950/40",    text: "text-red-600 dark:text-red-400" },
  Warm: { bg: "bg-amber-100 dark:bg-amber-950/40",text: "text-amber-600 dark:text-amber-400" },
  Cold: { bg: "bg-blue-100 dark:bg-blue-950/40",  text: "text-blue-600 dark:text-blue-400" },
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

const ALL_SOURCES  = ["Google Ads", "Campaign", "Facebook Ads", "Web Form", "Referral", "CSV Import", "Channel Partner", "Other"];
// ALL_STATUSES imported from statusConfig (includes Merged + Closed)

// normalizeMobile: returns 10-digit string or null — never falls back to raw digits
// (the raw-digit fallback bypassed 10-digit enforcement allowing "91" or "123" to pass)
function normalizeMobile(val) {
  return normalizePhone(val);
}
function canonicalPhone(val) {
  let n = String(val || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = n.slice(1);
  if (n.startsWith("91") && n.length > 10) n = n.slice(2);
  return n;
}
function daysSince(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30)  return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Badges ────────────────────────────────────────────────────────────────────
/**
 * StatusBadge — renders a coloured pill badge for a lead's display status.
 *
 * Pass the full `lead` object (preferred) so that virtual statuses
 * Merged (Yellow) and Closed (Red) are correctly resolved via getLeadDisplayStatus.
 * Legacy: pass just `status` string if no lead object is available.
 */
function StatusBadge({ lead, status }) {
  let label, config;
  if (lead) {
    ({ label, config } = getLeadDisplayStatus(lead));
  } else {
    config = STATUS_CONFIG[status] || STATUS_CONFIG["New"];
    label  = status || "New";
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${config.bg} ${config.text}`}
    >
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      {temp}
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
        <button
          onClick={handleTranscribe}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] hover:bg-[#DBEAFE] transition"
        >
          <Sparkles className="w-3 h-3" />
          AI Transcribe &amp; Summarize
        </button>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F1F4FF] dark:bg-[#1A2540]">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
        <span className="text-[11px] text-[#2563EB] font-medium">Transcribing with Whisper AI…</span>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span className="text-[11px] text-red-500">{error || "Transcription failed."}</span>
        </div>
        <button onClick={handleTranscribe} className="text-[11px] text-[#2563EB] underline pl-1">Retry</button>
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
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-[#F1F4FF] dark:bg-[#1A2540] hover:bg-[#EEF3FF] transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
          <span className="text-[11px] font-bold text-[#2563EB]">AI Summary</span>
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
        <ChevronDown className={`w-3.5 h-3.5 text-[#8B92A9] transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-3 py-3 space-y-3 bg-white dark:bg-[#13161E]">
          {summary?.summary && (
            <div>
              <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">Summary</p>
              <p className="text-[12px] text-[#4B5168] dark:text-white leading-relaxed">{summary.summary}</p>
            </div>
          )}
          {Array.isArray(summary?.keyPoints) && summary.keyPoints.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">Key Points</p>
              <ul className="space-y-1">
                {summary.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#4B5168] dark:text-white">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary?.nextAction && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#F0FDF4] dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-0.5">Next Action</p>
                <p className="text-[12px] text-emerald-700 dark:text-emerald-300">{summary.nextAction}</p>
              </div>
            </div>
          )}
          {transcript && (
            <details className="group">
              <summary className="cursor-pointer text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest select-none list-none flex items-center gap-1">
                <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                Full Transcript
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto">
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed whitespace-pre-wrap font-mono bg-[#F8F9FC] dark:bg-[#0D0F14] rounded-lg px-3 py-2">
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
function LeadCombinedSummaryPanel({ leadId }) {
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
          <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
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
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-violet-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 py-4 bg-white dark:bg-[#1A1D27] space-y-3">
          {loading && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
              <span className="text-[12px] text-violet-500 font-medium">Generating combined summary…</span>
            </div>
          )}
          {error && !loading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="text-[12px] text-red-500">{error}</span>
              </div>
              <button onClick={fetchSummary} className="text-[12px] text-violet-600 underline pl-1">Retry</button>
            </div>
          )}
          {data && !cs && !loading && !error && (
            <div className="flex items-start gap-2 px-3 py-3 rounded-lg bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
              <Mic className="w-3.5 h-3.5 text-[#8B92A9] shrink-0 mt-0.5" />
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
                  <User className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
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
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
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

// ── RecordingsTab ─────────────────────────────────────────────────────────────
function RecordingsTab({ lead }) {
  const [callLogs, setCallLogs] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const fetchCallLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/call-logs/recordings?page=1&limit=200");
      const all = res.data.recordings || [];
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
        <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
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
        <Mic className="w-10 h-10 text-[#E4E7EF] dark:text-[#262A38]" />
        <p className="text-[13px] font-semibold text-[#4B5168] dark:text-white">No recordings found</p>
        <p className="text-[11px] text-[#8B92A9]">
          Recordings upload automatically from the mobile app after calls.
        </p>
        <button
          onClick={fetchCallLogs}
          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-white hover:border-[#2563EB] hover:text-[#2563EB] transition"
        >
          <RotateCcw className="w-3 h-3" />
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
        <button
          onClick={fetchCallLogs}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-[#F1F4FF] dark:bg-[#1E2130] text-[#2563EB] hover:bg-[#EEF3FF] transition"
          title="Refresh"
        >
          <RotateCcw className="w-3 h-3" />
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
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                style={{ backgroundColor: callTypeColor(log.callType) + "20", color: callTypeColor(log.callType) }}
              >
                {log.callType || "call"}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#4B5168] dark:text-white">
                <Clock className="w-3 h-3" />
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
                <div
                  key={r._id || ri}
                  className="rounded-lg border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden bg-[#F8F9FC] dark:bg-[#13161E]"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[#E4E7EF] dark:border-[#262A38]">
                    <span className="text-[11px] font-semibold text-[#4B5168] dark:text-white">
                      Recording {ri + 1}
                    </span>
                    {r.transcribeStatus === "done" ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-full">
                        <Check className="w-2.5 h-2.5" />
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
                      <audio
                        controls
                        src={audioUrl(r.url)}
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
                <audio controls src={audioUrl(log.recordingUrl)} className="w-full h-8 rounded-xl accent-[#2563EB]" preload="none" />
              </div>
            ) : (
              <p className="text-[11px] text-[#8B92A9] italic">Recording file not available</p>
            )}
          </div>
        </div>
      ))}
      {lead.id && (
        <LeadCombinedSummaryPanel leadId={lead.id} />
      )}
    </div>
  );
}

// ── RecordingsDrawer — standalone side panel for admin ────────────────────────
function RecordingsDrawer({ lead, onClose, isSuperAdmin, onLeadUpdated, onToast }) {
  const { config: sc } = getLeadDisplayStatus(lead);
  const [drawerTab, setDrawerTab] = useState("recordings"); // recordings | meeting

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-[#1A1D27] h-full shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                style={{ background: (sc.dot || "#2563EB") + "20", color: sc.dot || "#2563EB" }}
              >
                {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#0F1117] dark:text-white leading-none">{lead.name}</p>
                <p className="text-[12px] text-[#8B92A9] mt-0.5">{lead.agent || "Unassigned"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusBadge lead={lead} />
              {lead.Quality && <TempBadge temp={lead.Quality} />}
              <span className="text-[10px] text-[#8B92A9]">{lead.source}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="px-6 shrink-0 flex border-b border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27]">
          <button
            onClick={() => setDrawerTab("recordings")}
            className={`flex items-center gap-1.5 px-3 py-3 text-[12px] font-semibold border-b-2 transition -mb-px ${
              drawerTab === "recordings"
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-[#8B92A9] hover:text-[#4B5168] dark:hover:text-white"
            }`}
          >
            <Mic className="w-3 h-3" />
            Recordings &amp; AI
          </button>
          <button
            onClick={() => setDrawerTab("meeting")}
            className={`flex items-center gap-1.5 px-3 py-3 text-[12px] font-semibold border-b-2 transition -mb-px ${
              drawerTab === "meeting"
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-[#8B92A9] hover:text-[#4B5168] dark:hover:text-white"
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Client Meeting
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {drawerTab === "recordings" ? (
            <>
              <div className="px-6 py-4">
                <PhoneActionsPanel
                  lead={lead}
                  isSuperAdmin={isSuperAdmin}
                  onLeadUpdated={onLeadUpdated}
                  onToast={onToast}
                />
              </div>
              <RecordingsTab lead={lead} />
            </>
          ) : (
            <ClientMeetingTab lead={lead} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Searchable Employee Select ───────────────────────────────────────────────────
function AgentSelect({ value, onChange, agents, className }) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef     = useRef(null);

  const options  = ["All", ...agents];
  const filtered = query.trim()
    ? options.filter(a => a.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (agent) => { onChange(agent); setOpen(false); setQuery(""); };
  const label  = value === "All" ? "All employees" : value;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${className} flex items-center justify-between gap-2 min-w-[140px]`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 text-[#8B92A9] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-56 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[#E4E7EF] dark:border-[#262A38]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9] pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search employee…"
                className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-[12px] text-[#8B92A9] italic">No employees found</p>
            ) : filtered.map(agent => {
              const isSelected  = agent === value;
              const displayName = agent === "All" ? "All employees" : agent;
              return (
                <button
                  key={agent}
                  type="button"
                  onClick={() => select(agent)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition ${
                    isSelected
                      ? "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] font-semibold"
                      : "text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A]"
                  }`}
                >
                  <span className="w-4 shrink-0">
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="truncate">{displayName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
}

// ── Toast Notification ────────────────────────────────────────────────────────
function Toast({ message, type = "success", onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-[13px] font-semibold animate-fade-in
      ${type === "success"
        ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
        : "bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"}`}>
      {type === "success"
        ? <Check className="w-4 h-4 shrink-0" />
        : <AlertCircle className="w-4 h-4 shrink-0" />}
      {message}
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100 transition">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
// ── PhoneActionsPanel ─────────────────────────────────────────────────────────
function PhoneActionsPanel({ lead, isSuperAdmin, onLeadUpdated, onToast }) {
 const [mode, setMode]         = useState(null); // "add" | "remove" | "swap" | "merge" | null
const [secInput, setSecInput] = useState("");
const [loading, setLoading]   = useState(false);
const [error, setError]       = useState("");
const [swapConfirm, setSwapConfirm] = useState(false);
const [mergeLead,  setMergeLead]    = useState(null);  // existing lead returned in 409
const [merging,    setMerging]      = useState(false);

  const primaryPhone   = lead.primaryPhone   || lead.phone || "";
  const secondaryPhone = lead.secondaryPhone || null;

  const reset = () => { setMode(null); setSecInput(""); setError(""); setSwapConfirm(false); setMergeLead(null); setMerging(false); };

  // ── Add / Update secondary phone ───────────────────────────────────────────
const handleAddSecondary = async () => {
  const norm = normalizeMobile(secInput);
if (!norm) { setError("Enter a valid 10-digit mobile number."); return; }
  if (norm === normalizeMobile(primaryPhone)) { setError("Secondary cannot match the primary number."); return; }
  setLoading(true); setError("");
  try {
    const res = await api.put(`/lead/${lead.id}/secondary-phone`, { secondaryPhone: norm });
   const savedLead = res.data?.lead || res.data;
   onLeadUpdated({ ...lead, secondaryPhone: savedLead.secondaryPhone ?? norm });
    onToast("Secondary number saved successfully.");
    reset();
  } catch (e) {
    const status = e.response?.status;
    const data   = e.response?.data;
    // 409 → number belongs to another lead → offer merge
    if (status === 409 && data?.existingLead) {
      setMergeLead(data.existingLead);
      setMode("merge");
      setError("");
    } else {
      setError(data?.message || "Failed to save secondary number.");
    }
  } finally { setLoading(false); }
};

  // ── Remove secondary phone ─────────────────────────────────────────────────
  const handleRemoveSecondary = async () => {
    setLoading(true); setError("");
    try {
      await api.delete(`/lead/${lead.id}/secondary-phone`);
      onLeadUpdated({ ...lead, secondaryPhone: null });
      onToast("Secondary number removed.");
      reset();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to remove secondary number.");
    } finally { setLoading(false); }
  };

  // ── Swap primary ↔ secondary ───────────────────────────────────────────────
  const handleSwap = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.put(`/lead/${lead.id}/swap-phones`);
      const updated = res.data?.lead || res.data;
      onLeadUpdated({
        ...lead,
        primaryPhone:   updated.primaryPhone   || secondaryPhone,
        phone:          updated.primaryPhone   || secondaryPhone,
        mobile:         updated.primaryPhone   || secondaryPhone,
        secondaryPhone: updated.secondaryPhone || primaryPhone,
      });
      onToast("Phone numbers swapped successfully.");
      reset();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to swap numbers.");
    } finally { setLoading(false); }
  };

  // ── Merge from PhoneActionsPanel ─────────────────────────────────────────────
const handleMergeFromPanel = async () => {
  if (!mergeLead) return;
  // Direction: the lead we OPENED (lead) survives and keeps its primary number.
  // The number we typed (secInput) belongs to mergeLead — we add it as THIS
  // lead's secondary, fold mergeLead's history in, and hide mergeLead.
  const survivorId  = lead.id;
  const numberToAdd = normalizeMobile(secInput) ||
                      normalizeMobile(mergeLead.primaryPhone || mergeLead.mobile || "");
  if (!survivorId)  { setError("Cannot determine the current lead."); return; }
  if (!numberToAdd) { setError("Cannot determine the number to add."); return; }
  setMerging(true); setError("");
  try {
    const role     = getRole();
    const endpoint = role === "superadmin"
      ? `/lead/superadmin/${survivorId}/merge`
      : role === "admin"
        ? `/lead/admin/${survivorId}/merge`
        : `/lead/${survivorId}/merge`;
    const res = await api.post(endpoint, {
      secondaryPhone: numberToAdd,                    // becomes THIS lead's secondary
      sourceName:     mergeLead.name,                 // the absorbed (duplicate) lead
      sourceMobile:   numberToAdd,
      sourceLeadId:   mergeLead._id || mergeLead.id,  // fold in + hide the other lead
    });
    const updated = res.data?.lead || res.data;
    onToast(`Merged "${mergeLead.name}" in — both numbers and all history now live on this lead.`);
    reset();
    // Survivor = the lead we opened. Tell the parent to update it in place and
    // drop the absorbed lead from the list.
    onLeadUpdated({
      ...lead,
      ...updated,
      id:              String(updated?._id || lead.id),
      secondaryPhone:  updated?.secondaryPhone ?? numberToAdd,
      callHistory:     updated?.callHistory    || lead.callHistory    || [],
      scheduledCalls:  updated?.scheduledCalls || lead.scheduledCalls || [],
      _absorbedLeadId: res.data?.absorbedLeadId || mergeLead._id || mergeLead.id,
    });
  } catch (e) {
    setError(e.response?.data?.message || "Merge failed. Please try again.");
  } finally { setMerging(false); }
};

  return (
    <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
      {/* Phone numbers display */}
      <div className="px-4 py-3 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
        <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Phone Numbers</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">Primary</span>
            <span className="font-mono text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {maskPhone(primaryPhone, isSuperAdmin)}
            </span>
          </div>
          {secondaryPhone ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">Secondary</span>
              <span className="font-mono text-[13px] text-[#4B5168] dark:text-[#9DA3BB]">
                {maskPhone(secondaryPhone, isSuperAdmin)}
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-[#8B92A9] italic">No secondary number</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 bg-white dark:bg-[#1A1D27] flex flex-wrap gap-2">
        <button
          onClick={() => setMode(mode === "add" ? null : "add")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] hover:bg-blue-100 dark:hover:bg-[#1E2D4D] transition"
        >
          <Plus className="w-3 h-3" />
          {secondaryPhone ? "Update Secondary" : "Add Secondary"}
        </button>
        {secondaryPhone && (
          <>
            <button
              onClick={() => setMode(mode === "remove" ? null : "remove")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 transition"
            >
              <X className="w-3 h-3" />
              Remove Secondary
            </button>
            <button
              onClick={() => { setMode("swap"); setSwapConfirm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition"
            >
              <RotateCcw className="w-3 h-3" />
              Swap Numbers
            </button>
          </>
        )}
      </div>

      {/* Add/Update form */}
      {mode === "add" && (
        <div className="px-4 pb-4 pt-1 bg-white dark:bg-[#1A1D27] border-t border-[#E4E7EF] dark:border-[#262A38] space-y-2">
          <label className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest">
            {secondaryPhone ? "New Secondary Number" : "Secondary Number"}
          </label>
          <input
            type="tel"
            placeholder="9876543210 or +91..."
            value={secInput}
            onChange={e => { setSecInput(e.target.value); setError(""); }}
            className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition"
          />
          {error && (
            <p className="text-[11px] text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />{error}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
            <button onClick={handleAddSecondary} disabled={loading}
              className="flex-1 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
              {loading ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</> : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Merge confirmation */}
{mode === "merge" && mergeLead && (() => {
  const numberToAdd = normalizeMobile(secInput) ||
                      normalizeMobile(mergeLead.primaryPhone || mergeLead.mobile || "");
  return (
    <div className="px-4 pb-4 pt-1 bg-white dark:bg-[#1A1D27] border-t border-[#E4E7EF] dark:border-[#262A38] space-y-2">
      <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        Number belongs to &quot;{mergeLead.name}&quot;
      </p>
      <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB]">
        Add <span className="font-mono font-semibold">{numberToAdd}</span> as the secondary number of <span className="font-semibold">this lead</span> and fold in &quot;{mergeLead.name}&quot;? All of its call logs, WhatsApp, notes and history move here, and &quot;{mergeLead.name}&quot; is hidden.
      </p>
      {error && (
        <p className="text-[11px] text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />{error}
        </p>
      )}
      <div className="flex gap-2">
        <button onClick={reset} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
        <button onClick={handleMergeFromPanel} disabled={merging}
          className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
          {merging
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Merging…</>
            : "Add as Secondary & Merge"
          }
        </button>
      </div>
    </div>
  );
})()}

      {/* Remove confirm */}
      {mode === "remove" && (
        <div className="px-4 pb-4 pt-1 bg-white dark:bg-[#1A1D27] border-t border-[#E4E7EF] dark:border-[#262A38] space-y-2">
          <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
            Remove <span className="font-mono font-semibold">{maskPhone(secondaryPhone, isSuperAdmin)}</span> as secondary number?
          </p>
          {error && (
            <p className="text-[11px] text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />{error}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
            <button onClick={handleRemoveSecondary} disabled={loading}
              className="flex-1 py-2 rounded-xl bg-red-600 text-white text-[12px] font-semibold hover:bg-red-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
              {loading ? <><Loader2 className="w-3 h-3 animate-spin" /> Removing…</> : "Remove"}
            </button>
          </div>
        </div>
      )}

      {/* Swap confirmation dialog */}
      {mode === "swap" && swapConfirm && (
        <div className="px-4 pb-4 pt-1 bg-white dark:bg-[#1A1D27] border-t border-[#E4E7EF] dark:border-[#262A38] space-y-3">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-[12px] text-amber-700 dark:text-amber-300 font-semibold">Confirm phone swap</p>
          </div>
          <div className="space-y-1 px-1">
            <p className="text-[11px] text-[#8B92A9]">After swap:</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">New Primary</span>
              <span className="font-mono text-[12px] text-[#0F1117] dark:text-[#F0F2FA]">{maskPhone(secondaryPhone, isSuperAdmin)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">New Secondary</span>
              <span className="font-mono text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{maskPhone(primaryPhone, isSuperAdmin)}</span>
            </div>
          </div>
          {error && (
            <p className="text-[11px] text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />{error}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
            <button onClick={handleSwap} disabled={loading}
              className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
              {loading ? <><Loader2 className="w-3 h-3 animate-spin" /> Swapping…</> : "Confirm Swap"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Lead Modal ────────────────────────────────────────────────────────────
// isSuperAdmin prop controls whether the duplicate lead's mobile is shown
// in plain text (superadmin) or masked (admin).
function AddLeadModal({ onClose, onAdd, isSuperAdmin }) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [customSource, setCustomSource] = useState("");
  const [form, setForm] = useState({
    name: "", mobile: "", secondaryPhone: "", email: "", source: "Google Ads", campaign: "",
    userId: "", status: "New", remark: "",
  });
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
 const [dupCheck,   setDupCheck]   = useState({ state: "idle", lead: null });
const [merging,    setMerging]    = useState(false);   // true while merge API call is in-flight
const [mergeError, setMergeError] = useState("");      // error message for merge dialog
const dupTimerRef = useRef(null);

  const checkDuplicate = useCallback((mobile) => {
    const norm = normalizePhone(mobile);
    if (!norm) { setDupCheck({ state: "idle", lead: null }); return; }
    setDupCheck({ state: "checking", lead: null });
    clearTimeout(dupTimerRef.current);
    dupTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/lead/admin/check-duplicate?mobile=${norm}`);
        if (res.data.duplicate) {
          setDupCheck({ state: "duplicate", lead: res.data.existingLead });
        } else {
          setDupCheck({ state: "ok", lead: null });
        }
      } catch {
        setDupCheck({ state: "idle", lead: null });
      }
    }, 600);
  }, []);

  useEffect(() => () => clearTimeout(dupTimerRef.current), []);

  useEffect(() => {
    api.get("/admin/company/users")
      .then(r => {
        // Handle new shape { users, totalCompanyUsers } or legacy plain array
        const list = Array.isArray(r.data) ? r.data : (r.data?.users || []);
        setUsers(list);
        if (list.length > 0) setForm(f => ({ ...f, userId: list[0]._id }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: "", submit: "" }));
    if (k === "mobile") checkDuplicate(v);
  };

  const runSyncDupCheck = async (mob) => {
    const norm = normalizePhone(mob);
    if (!norm) return false;
    setDupCheck({ state: "checking", lead: null });
    try {
      const res = await api.get(`/lead/admin/check-duplicate?mobile=${norm}`);
      if (res.data.duplicate) {
        setDupCheck({ state: "duplicate", lead: res.data.existingLead });
        return true;
      }
      setDupCheck({ state: "ok", lead: null });
      return false;
    } catch {
      setDupCheck({ state: "idle", lead: null });
      return false;
    }
  };

  const validate = (currentDupState) => {
    const e = {};
    const name = form.name.trim();
    const mob  = normalizeMobile(form.mobile);
    if (!name || name.length < 2) e.name = "Name must be at least 2 characters.";
    if (!mob) e.mobile = "Mobile number is required.";
    else if (mob.length < 7 || mob.length > 15) e.mobile = "Enter a valid mobile number (7–15 digits).";
else if (currentDupState === "duplicate") e.mobile = "This number belongs to an existing lead. Use the merge option above.";
    if (form.secondaryPhone) {
      const secMob = normalizeMobile(form.secondaryPhone);
      if (secMob.length > 0 && secMob.length < 7) e.secondaryPhone = "Enter a valid secondary number.";
      else if (secMob === mob) e.secondaryPhone = "Secondary phone cannot be the same as primary.";
    }
    if (!form.userId) e.userId = "Please select an employee to assign this lead.";
    if (form.source === "Other" && !customSource.trim()) e.source = "Please enter custom source.";
    return e;
  };

  const handleSubmit = async () => {
    const mob = normalizeMobile(form.mobile);
    let resolvedDupState = dupCheck.state;
    if (mob && dupCheck.state === "checking") {
      setErrors({ submit: "Please wait — checking for duplicate number…" });
      return;
    }
    if (mob && dupCheck.state === "idle") {
      clearTimeout(dupTimerRef.current);
      const isDup = await runSyncDupCheck(mob);
      resolvedDupState = isDup ? "duplicate" : "ok";
if (isDup) { setErrors({ mobile: "This number belongs to an existing lead. Use the merge option above." }); return; }
    }
    const newErrors = validate(resolvedDupState);
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    if (resolvedDupState === "duplicate") {
setErrors({ mobile: "This number belongs to an existing lead. Use the merge option above." });
      return;
    }
    setSubmitting(true);
    const basePayload = {
      name:           form.name.trim(),
      mobile:         mob,
      primaryPhone:   mob,
      secondaryPhone: form.secondaryPhone ? normalizeMobile(form.secondaryPhone) || null : null,
      email:    form.email.trim() || "",
      source:   form.source === "Other" ? customSource : form.source,
      campaign: form.campaign.trim() || null,
      status:   form.status,
      remark:   form.remark.trim() || "Manually added",
      user:     form.userId,
      date:     new Date(),
    };
    let payload = basePayload;
    const keyString = crm.getLocalKey();
    if (keyString) {
      try {
        const encryptedData = await crm.encrypt(
          { name: basePayload.name, mobile: basePayload.mobile, email: basePayload.email, remark: basePayload.remark },
          keyString
        );
        payload = { ...basePayload, encryptedData };
      } catch { /* send plain */ }
    }
    try {
      const role     = getRole();
      const endpoint = role === "superadmin" ? "/lead/superadmin/create" : "/lead/admin/create";
      const res      = await api.post(endpoint, payload);
      const saved    = res.data;
      onAdd({
        ...saved,
        id:             String(saved._id),
        name:           saved.name,
        phone:          saved.primaryPhone || saved.mobile,
        mobile:         saved.primaryPhone || saved.mobile,
        primaryPhone:   saved.primaryPhone || saved.mobile,
        secondaryPhone: saved.secondaryPhone || null,
        source:         saved.source   || "Manual",
        campaign:       saved.campaign || "—",
        status:         saved.status,
        date:           saved.date
          ? new Date(saved.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
          : "—",
        remark:         saved.remark,
        agent:          saved.user?.name || users.find(u => u._id === form.userId)?.name || "—",
        callHistory:    saved.callHistory    || [],
        scheduledCalls: saved.scheduledCalls || [],
        previousAgents: saved.previousAgents || [],
        reassignCount:  saved.reassignCount  || 0,
        _raw_date:      saved.date,
        Quality:        saved.temperature ?? null,
        temperature:    saved.temperature ?? null,
        createdAt:      saved.createdAt,
      });
      onClose();
    } catch (err) {
      const msg   = err.response?.data?.message || "Failed to save lead.";
      const isDup = err.response?.status === 409 || err.response?.data?.duplicate;
      if (isDup) {
        setDupCheck({ state: "duplicate", lead: err.response?.data?.existingLead || null });
        setErrors({ mobile: msg, submit: msg });
      } else {
        setErrors({ submit: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };
// ── Merge: add current form's number as secondary of existing lead ───────────
const handleMerge = async () => {
  if (!dupCheck.lead) return;
  const existingId   = dupCheck.lead._id || dupCheck.lead.id;
  const currentMob   = normalizeMobile(form.mobile);   // this becomes secondary on the existing lead
  setMerging(true);
  setMergeError("");
  try {
    const role     = getRole();
    const endpoint = role === "superadmin"
      ? `/lead/superadmin/${existingId}/merge`
      : role === "admin"
        ? `/lead/admin/${existingId}/merge`
        : `/lead/${existingId}/merge`;
    const res = await api.post(endpoint, {
      secondaryPhone: currentMob,
      // The "source" lead whose data should be absorbed is the current (new) form.
      // We pass its basic fields so the backend can build a timeline entry.
      sourceName:   form.name.trim(),
      sourceMobile: currentMob,
    });
    const merged = res.data?.lead || res.data;
    // Notify parent so the leads list refreshes / shows the updated lead
    // Pass isMerge=true so the parent updates the existing lead in-place
    // rather than prepending a duplicate entry to the list
    onAdd({
      ...merged,
      id:             String(merged._id),
      name:           merged.name,
      phone:          merged.primaryPhone || merged.mobile,
      mobile:         merged.primaryPhone || merged.mobile,
      primaryPhone:   merged.primaryPhone || merged.mobile,
      secondaryPhone: merged.secondaryPhone || null,
      source:         merged.source   || "Manual",
      campaign:       merged.campaign || "—",
      status:         merged.status,
      date:           merged.date
        ? new Date(merged.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : "—",
      remark:         merged.remark,
      agent:          merged.user?.name || "—",
      callHistory:    merged.callHistory    || [],
      scheduledCalls: merged.scheduledCalls || [],
      previousAgents: merged.previousAgents || [],
      reassignCount:  merged.reassignCount  || 0,
      _raw_date:      merged.date,
      Quality:        merged.temperature ?? null,
      temperature:    merged.temperature ?? null,
      createdAt:      merged.createdAt,
    }, true);   // ← isMerge flag
    onClose();
  } catch (e) {
    setMergeError(e.response?.data?.message || "Merge failed. Please try again.");
  } finally {
    setMerging(false);
  }
};
  
const canSubmit =
  !submitting && !loading && !merging && users.length > 0 &&
  dupCheck.state !== "duplicate" && dupCheck.state !== "checking";
  
  const inp = (key) =>
    `w-full px-3 py-2.5 rounded-xl border text-[13px] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none transition
    ${errors[key] ? "border-red-400 dark:border-red-500 focus:border-red-500" : "border-[#E4E7EF] dark:border-[#262A38] focus:border-[#2563EB]"}`;

  const ErrMsg = ({ k }) => errors[k]
    ? <span className="text-[11px] text-red-500 flex items-center gap-1 mt-0.5">
        <AlertCircle className="w-3 h-3 shrink-0" />
        {errors[k]}
      </span>
    : null;

  const btnLabel = () => {
    if (submitting)                    return <><Spinner /> Saving…</>;
    if (dupCheck.state === "checking") return <><Spinner /> Checking…</>;
    return "Add Lead";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Add New Lead</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Lead Name <span className="text-red-500">*</span></label>
            <input type="text" placeholder="Full name" value={form.name} onChange={e => set("name", e.target.value)} className={inp("name")} />
            <ErrMsg k="name" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">
              Mobile Number <span className="text-red-500">*</span>
              <span className="ml-1 normal-case text-[10px] font-normal text-[#8B92A9]">(with or without +91 prefix)</span>
            </label>
            <input type="tel" placeholder="9876543210 or +919876543210" value={form.mobile} onChange={e => set("mobile", e.target.value)} className={inp("mobile")} />
            <ErrMsg k="mobile" />
            {dupCheck.state === "checking" && (
              <p className="text-[11px] text-[#9DA3BB] mt-1 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking for duplicates…
              </p>
            )}
            {dupCheck.state === "ok" && (
              <p className="text-[11px] text-emerald-500 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Number is available
              </p>
            )}

            {/* ── Duplicate card with phone masking ── */}
          {/* ── Duplicate / Merge card ── */}
{dupCheck.state === "duplicate" && dupCheck.lead && (() => {
  const existingLead    = dupCheck.lead;
  const alreadyHasSec   = !!existingLead.secondaryPhone;
  // canMerge is an optimistic hint from the cached duplicate-check response.
  // If the lead gained a secondary since this page loaded, handleMerge will
  // receive a 409 and show the error inline — no need to hard-block here.
  const canMerge        = !alreadyHasSec;
  return (
    <div className="mt-2 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-amber-200 dark:border-amber-800">
        <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          This number belongs to existing lead &quot;{existingLead.name}&quot;
        </p>
      </div>
      {/* Existing lead details */}
      <div className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300 space-y-0.5">
        <p><span className="font-semibold">Primary:</span>{" "}
          <span className="font-mono">{maskPhone(existingLead.primaryPhone || existingLead.mobile, isSuperAdmin)}</span>
        </p>
        {existingLead.secondaryPhone && (
          <p><span className="font-semibold">Secondary:</span>{" "}
            <span className="font-mono">{maskPhone(existingLead.secondaryPhone, isSuperAdmin)}</span>
          </p>
        )}
        <p><span className="font-semibold">Status:</span> {existingLead.status}</p>
        {existingLead.createdAt && (
          <p><span className="font-semibold">Added:</span> {new Date(existingLead.createdAt).toLocaleDateString()}</p>
        )}
      </div>
      {/* Action buttons */}
      <div className="px-3 pb-3 space-y-2">
        {canMerge ? (
          <>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide">Choose an action:</p>
            {mergeError && (
              <p className="text-[11px] text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />{mergeError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setDupCheck({ state: "idle", lead: null }); setMergeError(""); }}
                className="flex-1 py-2 rounded-xl border border-amber-300 dark:border-amber-700 text-[12px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={merging}
                className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
              >
                {merging
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Merging…</>
                  : "Add as Secondary & Merge Leads"}
              </button>
            </div>
            <p className="text-[10px] text-amber-600/80 dark:text-amber-500/70 leading-snug">
              This will add <span className="font-mono font-semibold">{normalizeMobile(form.mobile)}</span> as the secondary number of &quot;{existingLead.name}&quot; and transfer all call logs, WhatsApp, notes, tasks, and timeline entries.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-red-500 flex items-center gap-1.5 pb-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Cannot merge — &quot;{existingLead.name}&quot; already has two numbers (max limit). Open that lead to manage its numbers.
          </p>
        )}
      </div>
    </div>
  );
})()}
{dupCheck.state === "duplicate" && !dupCheck.lead && (
  <div className="mt-2 p-3 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600">
    <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> This number is already registered as a lead.
    </p>
    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
      Search for the existing lead to update or merge it.
    </p>
  </div>
)}
          </div>
          {/* ── Secondary Phone (optional) ───────────────────────────────── */}
          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">
              Secondary Phone <span className="normal-case font-normal text-[10px]">(optional)</span>
            </label>
            <input
              type="tel"
              placeholder="Alternate number (optional)"
              value={form.secondaryPhone || ""}
              onChange={e => set("secondaryPhone", e.target.value)}
              className={inp("secondaryPhone")}
            />
            <ErrMsg k="secondaryPhone" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Assign to Employee <span className="text-red-500">*</span></label>
            {loading ? (
              <div className={`${inp("userId")} flex items-center gap-2 text-[#8B92A9]`}><Spinner /> Loading employees…</div>
            ) : users.length === 0 ? (
              <div className={`${inp("userId")} text-red-500`}>No employees found. Add employees first.</div>
            ) : (
              <select value={form.userId} onChange={e => set("userId", e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl border text-[13px] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none transition ${errors.userId ? "border-red-400 dark:border-red-500" : "border-[#E4E7EF] dark:border-[#262A38] focus:border-[#2563EB]"}`}>
                <option value="">— Select employee —</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
              </select>
            )}
            <ErrMsg k="userId" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Source</label>
              <select value={form.source} onChange={e => set("source", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]">
                {ALL_SOURCES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {form.source === "Other" && (
                <input type="text" placeholder="Enter custom source" value={customSource} onChange={e => setCustomSource(e.target.value)}
                  className="mt-2 w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB]" />
              )}
              <ErrMsg k="source" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]">
                {ALL_STATUSES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Email</label>
              <input type="email" placeholder="email@example.com" value={form.email} onChange={e => set("email", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB]" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Campaign</label>
              <input type="text" placeholder="Campaign name" value={form.campaign} onChange={e => set("campaign", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB]" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Remark</label>
              <input type="text" placeholder="Notes" value={form.remark} onChange={e => set("remark", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB]" />
            </div>
          </div>
        </div>
        {errors.submit && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[12px] text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {errors.submit}
          </div>
        )}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {btnLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import CSV Modal ──────────────────────────────────────────────────────────
function ImportCSVModal({ onClose, onImported, existingLeads = [] }) {
  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);

  const downloadTemplate = () => {
    const headers = "Name,Primary Number,Secondary Number,Email,Source,Campaign,Status,Remark";
    const example = "Rahul Sharma,9876543210,9123456780,rahul@example.com,Google Ads,Summer2025,New,Imported";
    const blob = new Blob([[headers, example].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob), download: "leads_import_template.csv",
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const parseCSVLine = (line) => {
    const values = []; let current = "", inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    values.push(current.trim()); return values;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    setResult(null);
    try {
      const text  = await file.text();
      const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      const existingPhoneSet = new Set(
        (existingLeads || []).map(l => canonicalPhone(l.phone || l.mobile)).filter(Boolean)
      );
      const seenInFile    = new Set();
      const leadsToImport = [];
      const clientErrors  = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row    = {};
        headers.forEach((h, idx) => { row[h] = (values[idx] || "").trim(); });
        const rawName      = row.name || row["full name"] || row["fullname"] || "";
        const rawMobile    = row["primary number"] || row.mobile || row.phone || row["phone number"] || row["mobile number"] || "";
        const rawSecondary = row["secondary number"] || row["secondaryphone"] || row["secondary phone"] || "";
        const normalized   = normalizeMobile(rawMobile);
        if (!normalized) { clientErrors.push({ index: i, row: rawName || i, message: "Missing mobile number — row skipped." }); continue; }
        const normSecondary = rawSecondary ? normalizeMobile(rawSecondary) : null;
        if (normSecondary && normSecondary === normalized) { clientErrors.push({ index: i, row: rawName || i, message: `Secondary phone same as primary — row skipped.` }); continue; }
        const dupKey = canonicalPhone(normalized);
        if (existingPhoneSet.has(dupKey)) { clientErrors.push({ index: i, row: rawName || i, message: `Already exists in CRM: ${rawMobile} is already a lead. Skipped.` }); continue; }
        if (seenInFile.has(dupKey)) { clientErrors.push({ index: i, row: rawName || i, message: `Duplicate in CSV: ${rawMobile} appears more than once.` }); continue; }
        seenInFile.add(dupKey);
        leadsToImport.push({
          name:           rawName || "Unknown",
          mobile:         normalized,
          primaryPhone:   normalized,
          secondaryPhone: normSecondary || null,
          email:          row.email || "",
          source:         row.source || "Excel Import",
          campaign:       row.campaign || "",
          status:         row.status || "New",
          remark:         row.remark || row.notes || "Imported via CSV",
        });
      }
      if (!leadsToImport.length && clientErrors.length > 0) {
        setResult({ savedCount: 0, errorCount: clientErrors.length, errors: clientErrors, message: "No valid rows found." });
        return;
      }
      const { data } = await api.post("/lead/admin/import-csv", { leads: leadsToImport });
      const allErrors = [...clientErrors, ...(data.errors || [])];
      setResult({ savedCount: data.savedCount, errorCount: (data.errorCount || 0) + clientErrors.length, errors: allErrors, message: data.message });
      if (data.savedCount > 0) onImported();
    } catch (err) {
      setResult({ savedCount: 0, errorCount: 1, errors: [{ message: err.response?.data?.message || err.message }], message: "Import failed." });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Import CSV</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <X className="w-4 h-4" />
          </button>
        </div>
        {!result ? (
          <>
            <div className="bg-[#EFF6FF] dark:bg-[#1A2540] border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 mb-5">
              <p className="text-[12px] font-semibold text-[#1D4ED8] dark:text-[#4F8EF7] mb-2">CSV Format</p>
              <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] mb-1">
                Required: <code className="font-mono bg-white dark:bg-[#0D0F14] px-1 rounded">Name</code>,{" "}
                <code className="font-mono bg-white dark:bg-[#0D0F14] px-1 rounded">Primary Number</code>
              </p>
              <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
                Optional: <code className="font-mono bg-white dark:bg-[#0D0F14] px-1 rounded">Secondary Number</code>, Email, Source, Campaign, Status, Remark
              </p>
              <p className="text-[11px] text-[#8B92A9] mt-2">
                Duplicate numbers (primary or secondary, with or without +91) are automatically skipped. Leads round-robin assigned to your team.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#7C3AED] dark:text-[#A78BFA] hover:bg-purple-50 dark:hover:bg-purple-950/30 transition">
                <Download className="w-4 h-4" /> Download Template
              </button>
              <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              <button onClick={() => importRef.current?.click()} disabled={importing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-violet-700 disabled:opacity-50 transition">
                {importing ? <><Spinner /> Importing…</> : <><Upload className="w-4 h-4" /> Choose CSV File</>}
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3 text-center">
                <p className="text-[24px] font-bold text-emerald-600 dark:text-emerald-400">{result.savedCount}</p>
                <p className="text-[12px] text-emerald-600 dark:text-emerald-400 font-semibold">Imported</p>
              </div>
              <div className={`border rounded-xl p-3 text-center ${result.errorCount > 0 ? "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40" : "bg-gray-50 dark:bg-gray-900/20 border-gray-100 dark:border-gray-800"}`}>
                <p className={`text-[24px] font-bold ${result.errorCount > 0 ? "text-red-600 dark:text-red-400" : "text-[#8B92A9]"}`}>{result.errorCount}</p>
                <p className={`text-[12px] font-semibold ${result.errorCount > 0 ? "text-red-600 dark:text-red-400" : "text-[#8B92A9]"}`}>Skipped</p>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-3 mb-4 max-h-48 overflow-y-auto">
                <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Skipped rows</p>
                <div className="space-y-1.5">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px]">
                      <X className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                      <span className="text-[#4B5168] dark:text-[#9DA3BB]">{e.row ? `Row "${e.row}": ` : ""}{e.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              {result.savedCount === 0 && (
                <button onClick={() => { setResult(null); importRef.current?.click(); }}
                  className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] hover:bg-[#F1F4FF] transition">
                  Try Again
                </button>
              )}
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
                {result.savedCount > 0 ? "Done" : "Close"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── mapLead ───────────────────────────────────────────────────────────────────
function mapLead(l) {
  const callHistory = Array.isArray(l.callHistory) ? l.callHistory : [];
  const sortedCalls = [...callHistory].sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt));
  const lastCall    = sortedCalls[0] || null;

  // Strip country-code prefix so phone is always displayed as 10 digits.
  // WA/SMS APIs receive the raw stored value and add 91 at send time.
  function strip91(raw) {
    if (!raw) return raw || "";
    const d = String(raw).replace(/\D/g, "");
    if (d.startsWith("9191") && d.length === 14) return d.slice(4);  // double-91
    if (d.startsWith("91")   && d.length === 12) return d.slice(2);  // single country code
    return d.slice(-10) || raw;
  }

  const primaryPhone   = strip91(l.primaryPhone || l.mobile || l.phone || "");
  const secondaryPhone = l.secondaryPhone ? strip91(l.secondaryPhone) : null;

  return {
    id:             String(l._id),
    _id:            l._id,                // raw ObjectId — needed by getLeadDisplayStatus
    name:           l.name           || "Unknown",
    phone:          primaryPhone,
    mobile:         primaryPhone,         // keep alias
    primaryPhone,
    secondaryPhone,
    email:          l.email          || "",
    source:         l.source         || "—",
    campaign:       l.campaign       || "—",
    adSetName:      l.adSetName      || "",    
    agent:          l.user?.name || l.assignedTo?.name || l.agent || "Unassigned",
    status:         l.status         || "New",
    Quality:        l.temperature || l.Quality || null,
    remark:         l.remark         || "",
    date:           l.date
      ? new Date(l.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "—",
    createdAt:      l.createdAt      || l.date || null,
    _raw_date:      l.date           || l.createdAt || null,
    callHistory,
    scheduledCalls: Array.isArray(l.scheduledCalls) ? l.scheduledCalls : [],
    previousAgents: Array.isArray(l.previousAgents) ? l.previousAgents : [],
    reassignCount:  l.reassignCount  || 0,
    lastOutcome:    lastCall?.outcome  || null,
    lastCalledAt:   lastCall?.calledAt || null,
    lastRemark:     lastCall?.remark   || null,
    // ── Status-resolution fields (required by getLeadDisplayStatus) ───────────
    isClosed:         l.isClosed        || false,
    mergedInto:       l.mergedInto      || null,
    closeReason:      l.closeReason     || "",
    // ── Merged lead name — searchable alias (e.g. "Shashi" searches find Divzz) ─
    mergedSourceName: l.mergedSourceName || "",
    // ── Project membership ─────────────────────────────────────────────────────
    projects:         Array.isArray(l.projects) ? l.projects : [],
  };
}

const PER_PAGE = 15;

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminLeadsPage() {
  const [allLeads,   setAllLeads]   = useState([]);
  const [agents,     setAgents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [selected,   setSelected]   = useState(null);
  const [showAdd,    setShowAdd]    = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [recordingsLead, setRecordingsLead] = useState(null);

  const [toast, setToast] = useState(null); // { message, type }
const showToast = useCallback((message, type = "success") => {
  setToast({ message, type });
}, []);

  const [search,      setSearch]      = useState("");
  const [filterSt,    setFilterSt]    = useState("All");
  const [filterAgent, setFilterAgent] = useState("All");
  const [filterSrc,   setFilterSrc]   = useState("All");
  const [filterTemp,  setFilterTemp]  = useState("All");
  const [filterProject, setFilterProject] = useState("All"); // Project filter
  const [projects,      setProjects]      = useState([]);    // Project list for dropdown
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [sortBy,      setSortBy]      = useState("date_desc");
  const [page,        setPage]        = useState(1);

  const role         = getRole();
  const isSuperAdmin = role === "superadmin";

  // ── Phone masking — only relevant for non-superadmin ─────────────────────
  const [revealedPhone, setRevealedPhone] = useState(null);
  const [revealedEmail, setRevealedEmail] = useState(null);
  const [emailViewCounts, setEmailViewCounts] = useState(() => {
    try {
      const stored = sessionStorage.getItem("leadEmailViewCounts");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const [viewCounts, setViewCounts] = useState(() => {
    try {
      const stored = sessionStorage.getItem("leadViewCounts");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("leadViewCounts", JSON.stringify(viewCounts));
    } catch { /* quota exceeded or private mode — silently ignore */ }
  }, [viewCounts]);

  useEffect(() => {
  try {
    sessionStorage.setItem("leadEmailViewCounts", JSON.stringify(emailViewCounts));
  } catch { /* ignore */ }
}, [emailViewCounts]);

  const revealTimerRef = useRef(null);


  
  const handleRevealPhone = async (e, leadId) => {
    e.stopPropagation();
    clearTimeout(revealTimerRef.current);
    setViewCounts(prev => ({ ...prev, [leadId]: (prev[leadId] || 0) + 1 }));
    setRevealedPhone(leadId);
    revealTimerRef.current = setTimeout(() => setRevealedPhone(null), 4000);
    try { await api.post(`/lead/admin/${leadId}/reveal-phone`); } catch { /* non-critical */ }
  };

  const emailRevealTimerRef = useRef(null);

  const handleRevealEmail = async (e, leadId) => {
    e.stopPropagation();
    clearTimeout(emailRevealTimerRef.current);
    setEmailViewCounts(prev => ({ ...prev, [leadId]: (prev[leadId] || 0) + 1 }));
    setRevealedEmail(leadId);
    emailRevealTimerRef.current = setTimeout(() => setRevealedEmail(null), 4000);
    try { await api.post(`/lead/admin/${leadId}/reveal-email`); } catch { /* non-critical */ }
  };
  
  useEffect(() => () => clearTimeout(revealTimerRef.current), []);
  useEffect(() => () => clearTimeout(emailRevealTimerRef.current), []);

  const handleLeadUpdated = useCallback((updatedLead) => {
    // Merge (new direction): a duplicate lead was absorbed INTO this surviving
    // lead. Drop the absorbed lead from the list and update the survivor in place.
    if (updatedLead._absorbedLeadId) {
      const absorbedId = updatedLead._absorbedLeadId;
      const survivorId = updatedLead.id;
      setAllLeads(prev =>
        prev
          .filter(l => l.id !== absorbedId && l._id !== absorbedId)
          .map(l => (l.id === survivorId || l._id === survivorId)
            ? { ...l, ...updatedLead }
            : l)
      );
      setSelected(prev =>
        prev && (prev.id === absorbedId)
          ? null
          : (prev && prev.id === survivorId ? { ...prev, ...updatedLead } : prev)
      );
      setRecordingsLead(prev =>
        prev && (prev.id === absorbedId)
          ? null
          : (prev && prev.id === survivorId ? { ...prev, ...updatedLead } : prev)
      );
      return;
    }

    // When a lead is merged into another, remove it from the list entirely
    // and close any open panels that reference it
    if (updatedLead._merged) {
      setAllLeads(prev => prev.filter(l => l.id !== updatedLead.id));
      setSelected(prev => prev && prev.id === updatedLead.id ? null : prev);
      setRecordingsLead(prev => prev && prev.id === updatedLead.id ? null : prev);
      // If the merge target is also in the list, refresh it with updated data
      if (updatedLead._mergedTarget) {
        const target = updatedLead._mergedTarget;
        const targetId = target._id || target.id;
        setAllLeads(prev =>
          prev.map(l => (l.id === targetId || l._id === targetId)
            ? { ...l, ...mapLead(target) }
            : l
          )
        );
      }
      return;
    }

    setAllLeads(prev =>
      prev.map(l => l.id === updatedLead.id ? { ...l, ...updatedLead } : l)
    );

    // Also refresh selected / recordingsLead if open
    setSelected(prev => prev && prev.id === updatedLead.id ? { ...prev, ...updatedLead } : prev);
    setRecordingsLead(prev => prev && prev.id === updatedLead.id ? { ...prev, ...updatedLead } : prev);
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [leadsRes, usersRes] = await Promise.all([
        api.get("/lead/admin/all?page=1&limit=500"),
        api.get("/admin/company/users"),
      ]);
      const raw = leadsRes.data?.leads || (Array.isArray(leadsRes.data) ? leadsRes.data : []);
      setAllLeads(raw.map(mapLead));

      // Populate agents from the admin's own employees (respects createdBy scoping),
      // not from lead data which may contain employees of other admins.
      const userList = Array.isArray(usersRes.data)
        ? usersRes.data
        : (usersRes.data?.users || []);
      setAgents(userList.map(u => u.name).filter(Boolean));
    } catch {
      setError("Failed to load leads. Please refresh.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Fetch project list for the project filter dropdown ──────────────────────
  useEffect(() => {
    api.get("/project/admin")
      .then(res => setProjects(Array.isArray(res.data) ? res.data : []))
      .catch(() => setProjects([]));
  }, []);

  const handleAdd = useCallback((newLead, isMerge = false) => {
    const mapped = mapLead({ ...newLead, _id: newLead.id || newLead._id });
    if (isMerge) {
      // Merge: update the survivor in-place AND remove the absorbed (duplicate) lead.
      // The backend returns absorbedLeadId on the merge response.
      // Without removing the absorbed lead here, it stays visible in the list
      // until the next page refresh, making it look like two leads exist.
      const absorbedId = String(newLead._absorbedLeadId || newLead.absorbedLeadId || "");
      setAllLeads(prev => {
        let updated = prev;
        // Remove the absorbed duplicate from the list
        if (absorbedId) {
          updated = updated.filter(l => l.id !== absorbedId && String(l._id || "") !== absorbedId);
        }
        const exists = updated.some(l => l.id === mapped.id || l._id === mapped._id);
        if (exists) {
          return updated.map(l => (l.id === mapped.id || l._id === mapped._id) ? { ...l, ...mapped } : l);
        }
        // Fallback: survivor wasn't in the list yet (e.g. filtered out) — prepend it
        return [mapped, ...updated];
      });
    } else {
      setAllLeads(prev => [mapped, ...prev]);
      setPage(1);
    }
  }, []);

  const uniqueSources = useMemo(() =>
    [...new Set(allLeads.map(l => l.source).filter(s => s && s !== "—"))],
  [allLeads]);

  const kpi = useMemo(() => ({
    total:      allLeads.length,
    converted:  allLeads.filter(l => l.status === "Converted").length,
    inProgress: allLeads.filter(l => l.status === "In Progress").length,
    notInt:     allLeads.filter(l => l.status === "Not Interested").length,
    newLeads:   allLeads.filter(l => l.status === "New").length,
    merged:     allLeads.filter(l => !!l.mergedInto).length,
    closed:     allLeads.filter(l => l.isClosed && !l.mergedInto).length,
  }), [allLeads]);

  const displayed = useMemo(() => {
    let res = allLeads.filter(l => {
      const q           = search.toLowerCase();
      const matchSearch = !q || l.name.toLowerCase().includes(q) || l.phone.includes(q) ||
        (l.email  && l.email.toLowerCase().includes(q)) ||
        (l.secondaryPhone && l.secondaryPhone.includes(q)) ||
        (l.mergedSourceName && l.mergedSourceName.toLowerCase().includes(q));

      // Use getLeadDisplayStatus so "Merged" and "Closed" virtual statuses
      // are correctly matched — l.status alone won't catch them.
      const { label: displayLabel } = getLeadDisplayStatus(l);
      const matchSt     = filterSt    === "All" || displayLabel === filterSt;

      const matchAgent  = filterAgent === "All" || l.agent   === filterAgent;
      const matchSrc    = filterSrc   === "All" || l.source  === filterSrc;
      const matchTemp   = filterTemp  === "All" || l.Quality === filterTemp;

      // Project filter — a lead belongs to a project if its projects array
      // contains the selected projectId (populated object or raw ObjectId string).
      const matchProject = filterProject === "All" ||
        (l.projects || []).some(p =>
          (p?._id ? String(p._id) : String(p)) === filterProject
        );

      let matchDate = true;
      if (dateFrom) matchDate = matchDate && new Date(l._raw_date) >= new Date(dateFrom);
      if (dateTo)   matchDate = matchDate && new Date(l._raw_date) <= new Date(dateTo + "T23:59:59");

      return matchSearch && matchSt && matchAgent && matchSrc && matchTemp && matchDate && matchProject;
    });
    return res.slice().sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b._raw_date || 0) - new Date(a._raw_date || 0);
      if (sortBy === "date_asc")  return new Date(a._raw_date || 0) - new Date(b._raw_date || 0);
      if (sortBy === "name_asc")  return a.name.localeCompare(b.name);
      if (sortBy === "status")    return a.status.localeCompare(b.status);
      return 0;
    });
  }, [allLeads, search, filterSt, filterAgent, filterSrc, filterTemp, dateFrom, dateTo, sortBy, filterProject]);

  const totalPages = Math.ceil(displayed.length / PER_PAGE);
  const paged      = displayed.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const clearFilters = () => {
    setSearch(""); setFilterSt("All"); setFilterAgent("All"); setFilterSrc("All");
    setFilterTemp("All"); setFilterProject("All"); setDateFrom(""); setDateTo(""); setPage(1);
  };

  const exportToCSV = useCallback(() => {
    if (!displayed.length) return;
    const headers = ["Name","Phone","Email","Employee","Source","Campaign","Date","Status","Quality","Calls","Last Outcome","Last Called","Remark"];
    const escape  = v => { const s = String(v ?? "").replace(/"/g, '""'); return /[",\n\r]/.test(s) ? `"${s}"` : s; };
    const rows    = displayed.map(l => [
      l.name, l.phone, l.email, l.agent, l.source, l.campaign, l.date, l.status,
      l.Quality || "", l.callHistory.length, l.lastOutcome || "",
      l.lastCalledAt ? new Date(l.lastCalledAt).toLocaleDateString("en-GB") : "", l.remark,
    ].map(escape).join(","));
    const blob = new Blob([[headers.join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }, [displayed]);

  const INP = "px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition";

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-3 py-4 md:px-6 md:py-8">

      {/* Pass isSuperAdmin so AddLeadModal can mask the duplicate lead's phone */}
      {showAdd    && <AddLeadModal   onClose={() => setShowAdd(false)}    onAdd={handleAdd}    isSuperAdmin={isSuperAdmin} />}
      {showImport && <ImportCSVModal onClose={() => setShowImport(false)} onImported={fetchLeads} existingLeads={allLeads} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Lead Management</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
            Full pipeline view — click any lead to see its complete journey
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isSuperAdmin && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#059669] text-white text-[12px] font-semibold hover:bg-emerald-700 transition">
              <Plus className="w-3.5 h-3.5" /> Add Lead
            </button>
          )}
         {!isSuperAdmin && (
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#7C3AED] text-white text-[12px] font-semibold hover:bg-violet-700 transition">
              <Upload className="w-3.5 h-3.5" /> Import CSV
            </button>
          )}
          {isSuperAdmin && (
            <button onClick={exportToCSV} disabled={!displayed.length}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition">
              <Download className="w-3.5 h-3.5" /> Export CSV
              {displayed.length > 0 && (
                <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {displayed.length}
                </span>
              )}
            </button>
          )}
          <button onClick={fetchLeads} className="p-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#8B92A9] hover:text-[#2563EB] transition" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI pills */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { label: "Total",          value: kpi.total,      color: "#2563EB", bg: "bg-blue-50 dark:bg-blue-950/30",       text: "text-blue-700 dark:text-blue-300",       filter: "All" },
          { label: "New",            value: kpi.newLeads,   color: "#2563EB", bg: "bg-blue-50 dark:bg-blue-950/30",       text: "text-blue-600 dark:text-blue-400",       filter: "New" },
          { label: "In Progress",    value: kpi.inProgress, color: "#D97706", bg: "bg-amber-50 dark:bg-amber-950/30",     text: "text-amber-600 dark:text-amber-400",     filter: "In Progress" },
          { label: "Converted",      value: kpi.converted,  color: "#059669", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400", filter: "Converted" },
          { label: "Not Interested", value: kpi.notInt,     color: "#DC2626", bg: "bg-red-50 dark:bg-red-950/30",         text: "text-red-600 dark:text-red-400",         filter: "Not Interested" },
          { label: "Merged",         value: kpi.merged,     color: "#D97706", bg: "bg-yellow-50 dark:bg-yellow-950/30",   text: "text-yellow-700 dark:text-yellow-400",   filter: "Merged" },
          { label: "Closed",         value: kpi.closed,     color: "#DC2626", bg: "bg-red-50 dark:bg-red-950/30",         text: "text-red-700 dark:text-red-400",         filter: "Closed" },
        ].map(s => (
          <button key={s.label}
            onClick={() => { setFilterSt(filterSt === s.filter ? "All" : s.filter); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition font-semibold text-[13px] ${s.bg} ${s.text} ${filterSt === s.filter ? "" : "border-transparent"}`}
            style={{ borderColor: filterSt === s.filter ? s.color : undefined }}>
            <span className="text-[18px] font-black">{s.value}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, phone, email…" className={INP + " pl-9 w-full"} />
          </div>
          <AgentSelect value={filterAgent} onChange={(val) => { setFilterAgent(val); setPage(1); }} agents={agents} className={INP} />
          <select value={filterSrc} onChange={e => { setFilterSrc(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All sources</option>
            {uniqueSources.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterTemp} onChange={e => { setFilterTemp(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All qualities</option>
            <option>Hot</option><option>Warm</option><option>Cold</option>
          </select>
          {/* Project filter — always shown */}
          <select value={filterProject} onChange={e => { setFilterProject(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All Projects</option>
            {projects.map(p => (
              <option key={String(p._id)} value={String(p._id)}>{p.name}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className={INP} title="From date" />
          <input type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setPage(1); }} className={INP} title="To date" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={INP}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="name_asc">Name A–Z</option>
            <option value="status">By status</option>
          </select>
          {(search || filterSt !== "All" || filterAgent !== "All" || filterSrc !== "All" || filterTemp !== "All" || filterProject !== "All" || dateFrom || dateTo) && (
            <button onClick={clearFilters}
              className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-500 text-[12px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 transition">
              <span className="flex items-center gap-1"><X className="w-3 h-3" /> Clear</span>
            </button>
          )}
        </div>
        <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-2">
          {displayed.length} leads found{displayed.length !== allLeads.length ? ` (filtered from ${allLeads.length})` : ""}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[12px]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={fetchLeads} className="ml-auto underline font-semibold">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#8B92A9]">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-[13px]">Loading leads…</span>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Search className="w-12 h-12 text-[#E4E7EF] dark:text-[#262A38]" />
            <p className="text-[16px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {allLeads.length === 0 ? "No leads yet" : "No leads match your filters"}
            </p>
            {allLeads.length === 0 ? (
              !isSuperAdmin && (
                <button onClick={() => setShowAdd(true)}
                  className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#059669] text-white text-[13px] font-semibold hover:bg-emerald-700 transition">
                  <Plus className="w-3.5 h-3.5" /> Add first lead
                </button>
              )
            ) : (
              <button onClick={clearFilters} className="mt-1 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 transition">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] table-fixed">
                <colgroup>
                  <col className="w-[160px]" /> {/* Lead */}
                  <col className="w-[140px]" /> {/* Contact */}
                  <col className="w-[110px]" /> {/* Employee */}
                  <col className="w-[120px]" /> {/* Source */}
                  <col className="w-[100px]" /> {/* Project */}
                  <col className="w-[80px]" />  {/* Date */}
                  <col className="w-[90px]" />  {/* Status */}
                  <col className="w-[70px]" />  {/* Quality */}
                  <col className="w-[120px]" /> {/* Last Outcome */}
                  <col className="w-[100px]" /> {/* Actions */}
                </colgroup>
                <thead>
                  <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                    {["Lead", "Contact", "Employee", "Source", "Project", "Date", "Status", "Quality", "Last Outcome", ""].map(h => (
                      <th key={h} className="px-2.5 py-2.5 text-left text-[9px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                  {paged.map(l => {
                    const { config: sc } = getLeadDisplayStatus(l);
                    const isRevealed = revealedPhone === l.id;
                    const viewCount  = viewCounts[l.id] || 0;
                    // Use shared maskPhone for consistency
                    const maskedPhone = maskPhone(l.phone, isSuperAdmin);

                    return (
                      <tr key={l.id}
                        className="hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition cursor-pointer group"
                        onClick={() => setSelected(l)}
                      >
                        {/* Lead name */}
                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                              style={{ background: (sc.dot || "#2563EB") + "20", color: sc.dot || "#2563EB" }}>
                              {l.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate text-[12px]">{l.name}</p>
                              <p className="text-[9px] text-[#8B92A9]">{daysSince(l._raw_date) || "—"}</p>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            {isSuperAdmin ? (
                              <span className="font-mono text-[#0F1117] dark:text-[#F0F2FA] text-[11px]">{l.phone || "—"}</span>
                            ) : isRevealed ? (
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-[#0F1117] dark:text-[#F0F2FA] text-[11px] animate-pulse">{l.phone || "—"}</span>
                                <span className="inline-block w-6 h-1 rounded-full bg-[#E4E7EF] dark:bg-[#262A38] overflow-hidden">
                                  <span className="block h-full bg-[#2563EB] rounded-full" style={{ animation: "shrink 4s linear forwards" }} />
                                </span>
                              </div>
                            ) : (
                              <button onClick={(e) => handleRevealPhone(e, l.id)} className="flex items-center gap-1 group/phone" title="Click to reveal number">
                                <span className="font-mono text-[#8B92A9] dark:text-[#565C75] tracking-widest text-[11px] select-none">{maskedPhone}</span>
                                <Eye className="w-3 h-3 text-[#C4C9D9] dark:text-[#3E4257] group-hover/phone:text-[#2563EB] transition shrink-0" />
                              </button>
                            )}
                            {!isSuperAdmin && viewCount > 0 && (
                              <span title={`Viewed ${viewCount}x`}
                                className={`text-[9px] font-bold px-1 py-0.5 rounded-full leading-none flex items-center gap-0.5 shrink-0
                                  ${viewCount >= 5 ? "bg-red-100 dark:bg-red-950/40 text-red-600"
                                  : viewCount >= 3 ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600"
                                  : "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB]"}`}>
                                <Eye className="w-2 h-2" />{viewCount}
                              </span>
                            )}
                            {l.secondaryPhone && (
                              <span title="Has secondary number" className="text-[9px] font-bold px-1 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 shrink-0">+1</span>
                            )}
                          </div>
                          {l.email && (
                            <div className="mt-0.5 flex items-center gap-1">
                              {isSuperAdmin ? (
                                <p className="text-[9px] text-[#0F1117] dark:text-[#F0F2FA] truncate font-mono" title={l.email}>{l.email}</p>
                              ) : revealedEmail === l.id ? (
                                <p className="text-[9px] text-[#0F1117] dark:text-[#F0F2FA] truncate font-mono animate-pulse">{l.email}</p>
                              ) : (
                                <button onClick={(e) => handleRevealEmail(e, l.id)} className="flex items-center gap-0.5 group/email" title="Reveal email">
                                  <p className="text-[9px] text-[#8B92A9] truncate font-mono select-none">{maskEmail(l.email, isSuperAdmin)}</p>
                                  <Eye className="w-2.5 h-2.5 text-[#C4C9D9] group-hover/email:text-[#2563EB] transition shrink-0" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Employee */}
                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-[8px] font-black text-purple-600 dark:text-purple-400 shrink-0">
                              {(l.agent || "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[#0F1117] dark:text-[#F0F2FA] truncate text-[11px]">{l.agent || "Unassigned"}</span>
                          </div>
                          {l.reassignCount > 0 && (
                            <p className="text-[9px] text-purple-400 mt-0.5">{l.reassignCount}× reassigned</p>
                          )}
                        </td>

                        {/* Source */}
                        <td className="px-2.5 py-2.5">
                          <p className="text-[#0F1117] dark:text-[#F0F2FA] truncate text-[11px]">{l.source}</p>
                          {l.campaign !== "—" && (
                            <p className="text-[9px] text-[#8B92A9] truncate">{l.campaign}</p>
                          )}
                          {l.adSetName && (
                            <p className="text-[9px] text-[#E1306C] truncate">📢 {l.adSetName}</p>
                          )}
                        </td>

                        {/* Project */}
                        <td className="px-2.5 py-2.5">
                          {l.projects && l.projects.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {l.projects.slice(0, 2).map((p, pi) => {
                                const pName  = p?.name  || "Project";
                                const pColor = p?.color || "#2563EB";
                                return (
                                  <span
                                    key={pi}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold truncate"
                                    style={{ background: pColor + "18", color: pColor }}
                                    title={pName}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: pColor }} />
                                    {pName}
                                  </span>
                                );
                              })}
                              {l.projects.length > 2 && (
                                <span className="text-[9px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">+{l.projects.length - 2} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#C4C9D9] dark:text-[#3E4257]">—</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-2.5 py-2.5 text-[11px] text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">{l.date}</td>

                        {/* Status */}
                        <td className="px-2.5 py-2.5"><StatusBadge lead={l} /></td>

                        {/* Quality */}
                        <td className="px-2.5 py-2.5"><TempBadge temp={l.Quality} /></td>

                        {/* Last Outcome */}
                        <td className="px-2.5 py-2.5">
                          {l.lastOutcome ? (
                            <div>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap ${
                                l.lastOutcome === "Interested" || l.lastOutcome === "Converted"
                                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                  : l.lastOutcome === "Not Interested" || l.lastOutcome === "Not Reachable"
                                  ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                                  : "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                              }`}>{l.lastOutcome}</span>
                              {l.lastCalledAt && <p className="text-[9px] text-[#8B92A9] mt-0.5">{daysSince(l.lastCalledAt)}</p>}
                              {l.lastRemark && <p className="text-[9px] text-[#8B92A9] truncate italic mt-0.5">"{l.lastRemark}"</p>}
                            </div>
                          ) : (
                            <span className="text-[10px] text-[#8B92A9]">No calls</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              title="Recordings & AI"
                              onClick={e => { e.stopPropagation(); setRecordingsLead(l); }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 border border-violet-100 dark:border-violet-900/50 transition whitespace-nowrap"
                            >
                              <Mic className="w-3 h-3" />
                              AI
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setSelected(l); }}
                              className="w-6 h-6 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

        <style>{`
              @keyframes shrink {
                from { width: 100%; }
                to   { width: 0%; }
              }
              @keyframes fade-in {
                from { opacity: 0; transform: translateY(8px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              .animate-fade-in { animation: fade-in 0.2s ease forwards; }
            `}</style>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between bg-[#F8F9FC] dark:bg-[#13161E]">
                <span className="text-[11px] text-[#8B92A9]">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, displayed.length)} of {displayed.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    return (
                      <button key={n} onClick={() => setPage(n)}
                        className={`w-7 h-7 rounded-lg text-[11px] font-semibold transition ${page === n ? "bg-[#2563EB] text-white" : "border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27]"}`}>
                        {n}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Journey drawer */}
{selected && (
<LeadJourneyDrawer
        lead={selected}
        onClose={() => setSelected(null)}
        isSuperAdmin={isSuperAdmin}
        maskPhone={maskPhone}
        maskEmail={maskEmail}
        onLeadUpdated={handleLeadUpdated}
        onToast={showToast}
      />
)}
    {/* Recordings & AI drawer */}
    {recordingsLead && (
        <RecordingsDrawer
          lead={recordingsLead}
          onClose={() => setRecordingsLead(null)}
          isSuperAdmin={isSuperAdmin}
          onLeadUpdated={handleLeadUpdated}
          onToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
