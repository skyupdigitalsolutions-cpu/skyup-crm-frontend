import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import api from "../data/axiosConfig";
import LeadJourneyDrawer from "./LeadJourneyDrawer";
import CRMEncryption from "../utils/CRMEncryption";
import { getRole } from "../data/dataService";
import { normalizePhone, isSamePhone } from "../utils/normalizePhone";
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

const STATUS_CONFIG = {
  "New":            { bg: "bg-blue-100 dark:bg-blue-950/40",       text: "text-blue-600 dark:text-blue-400",       dot: "#2563EB" },
  "In Progress":    { bg: "bg-amber-100 dark:bg-amber-950/40",     text: "text-amber-600 dark:text-amber-400",     dot: "#D97706" },
  "Converted":      { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", dot: "#059669" },
  "Not Interested": { bg: "bg-red-100 dark:bg-red-950/40",         text: "text-red-600 dark:text-red-400",         dot: "#DC2626" },
};
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
const ALL_STATUSES = ["New", "In Progress", "Converted", "Not Interested"];

function normalizeMobile(val) {
  return normalizePhone(val) || (val || "").replace(/\D/g, "");
}
function canonicalPhone(val) {
  let n = String(val || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = n.slice(1);
  if (n.startsWith("91") && n.length > 10) n = n.slice(2);
  return n;
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG["New"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {status}
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
    </div>
  );
}

// ── RecordingsDrawer — standalone side panel for admin ────────────────────────
function RecordingsDrawer({ lead, onClose }) {
  const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG["New"];

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
              <StatusBadge status={lead.status} />
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
          <div className="flex items-center gap-1.5 px-3 py-3 text-[12px] font-semibold border-b-2 border-[#2563EB] text-[#2563EB] -mb-px">
            <Mic className="w-3 h-3" />
            Recordings &amp; AI
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <RecordingsTab lead={lead} />
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

// ── Add Lead Modal ────────────────────────────────────────────────────────────
// isSuperAdmin prop controls whether the duplicate lead's mobile is shown
// in plain text (superadmin) or masked (admin).
function AddLeadModal({ onClose, onAdd, isSuperAdmin }) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [customSource, setCustomSource] = useState("");
  const [form, setForm] = useState({
    name: "", mobile: "", source: "Google Ads", campaign: "",
    userId: "", status: "New", remark: "",
  });
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dupCheck,   setDupCheck]   = useState({ state: "idle", lead: null });
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
        const list = Array.isArray(r.data) ? r.data : [];
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
    else if (currentDupState === "duplicate") e.mobile = "This number already exists. Search for the existing lead to update it.";
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
      if (isDup) { setErrors({ mobile: "This number already exists. Search for the existing lead to update it." }); return; }
    }
    const newErrors = validate(resolvedDupState);
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    if (resolvedDupState === "duplicate") {
      setErrors({ mobile: "This number already exists. Search for the existing lead to update it." });
      return;
    }
    setSubmitting(true);
    const basePayload = {
      name:     form.name.trim(),
      mobile:   mob,
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
          { name: basePayload.name, mobile: basePayload.mobile, email: "", remark: basePayload.remark },
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
        phone:          saved.mobile,
        mobile:         saved.mobile,
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

  const canSubmit =
    !submitting && !loading && users.length > 0 &&
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
            {dupCheck.state === "duplicate" && dupCheck.lead && (
              <div className="mt-2 p-3 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600">
                <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Duplicate — this number already exists
                </p>
                <div className="text-[11px] text-amber-700 dark:text-amber-300 space-y-0.5">
                  <p><span className="font-semibold">Name:</span> {dupCheck.lead.name}</p>
                  {/* Superadmin sees plain number; admin sees masked number */}
                  <p>
                    <span className="font-semibold">Mobile:</span>{" "}
                    <span className="font-mono">{maskPhone(dupCheck.lead.mobile, isSuperAdmin)}</span>
                  </p>
                  <p><span className="font-semibold">Status:</span> {dupCheck.lead.status}</p>
                  <p><span className="font-semibold">Source:</span> {dupCheck.lead.source}</p>
                  {dupCheck.lead.createdAt && <p><span className="font-semibold">Added:</span> {new Date(dupCheck.lead.createdAt).toLocaleDateString()}</p>}
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 font-semibold border-t border-amber-200 dark:border-amber-800 pt-2">
                  This lead cannot be saved. Search for the existing lead to update it instead.
                </p>
              </div>
            )}
            {dupCheck.state === "duplicate" && !dupCheck.lead && (
              <div className="mt-2 p-3 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600">
                <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> This number is already registered as a lead.
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  This lead cannot be saved. Search for the existing lead to update it.
                </p>
              </div>
            )}
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
          <div className="grid grid-cols-2 gap-3">
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
    const headers = "name,mobile,email,source,campaign,status,remark";
    const example = "Rahul Sharma,9876543210,rahul@example.com,Manual,Summer 2026,New,Interested in demo";
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
        const rawName    = row.name || row["full name"] || row["fullname"] || "";
        const rawMobile  = row.mobile || row.phone || row["phone number"] || row["mobile number"] || "";
        const normalized = normalizeMobile(rawMobile);
        if (!normalized) { clientErrors.push({ index: i, row: rawName || i, message: "Missing mobile number — row skipped." }); continue; }
        const dupKey = canonicalPhone(normalized);
        if (existingPhoneSet.has(dupKey)) { clientErrors.push({ index: i, row: rawName || i, message: `Already exists in CRM: ${rawMobile} is already a lead. Skipped.` }); continue; }
        if (seenInFile.has(dupKey)) { clientErrors.push({ index: i, row: rawName || i, message: `Duplicate in CSV: ${rawMobile} appears more than once.` }); continue; }
        seenInFile.add(dupKey);
        leadsToImport.push({ name: rawName || "Unknown", mobile: normalized, email: row.email || "", source: row.source || "CSV Import", campaign: row.campaign || "", status: row.status || "New", remark: row.remark || row.notes || "Imported via CSV" });
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
                Required columns: <code className="font-mono bg-white dark:bg-[#0D0F14] px-1 rounded">name</code>,{" "}
                <code className="font-mono bg-white dark:bg-[#0D0F14] px-1 rounded">mobile</code>
              </p>
              <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">Optional: email, source, campaign, status, remark</p>
              <p className="text-[11px] text-[#8B92A9] mt-2">
                Duplicate numbers (with or without +91) are automatically skipped. Leads round-robin assigned to your team.
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
  return {
    id:             String(l._id),
    name:           l.name           || "Unknown",
    phone:          l.mobile         || l.phone || "",
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

  const [search,      setSearch]      = useState("");
  const [filterSt,    setFilterSt]    = useState("All");
  const [filterAgent, setFilterAgent] = useState("All");
  const [filterSrc,   setFilterSrc]   = useState("All");
  const [filterTemp,  setFilterTemp]  = useState("All");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [sortBy,      setSortBy]      = useState("date_desc");
  const [page,        setPage]        = useState(1);

  const role         = getRole();
  const isSuperAdmin = role === "superadmin";

  // ── Phone masking — only relevant for non-superadmin ─────────────────────
  const [revealedPhone, setRevealedPhone] = useState(null);

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

  const revealTimerRef = useRef(null);

  const handleRevealPhone = async (e, leadId) => {
    e.stopPropagation();
    clearTimeout(revealTimerRef.current);
    setViewCounts(prev => ({ ...prev, [leadId]: (prev[leadId] || 0) + 1 }));
    setRevealedPhone(leadId);
    revealTimerRef.current = setTimeout(() => setRevealedPhone(null), 4000);
    try { await api.post(`/lead/admin/${leadId}/reveal-phone`); } catch { /* non-critical */ }
  };

  useEffect(() => () => clearTimeout(revealTimerRef.current), []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/lead/admin/all?page=1&limit=500");
      const raw = res.data?.leads || (Array.isArray(res.data) ? res.data : []);
      setAllLeads(raw.map(mapLead));
      const agentSet = new Set();
      raw.forEach(l => {
        const n = l.user?.name || l.assignedTo?.name || l.agent;
        if (n) agentSet.add(n);
      });
      setAgents([...agentSet]);
    } catch {
      setError("Failed to load leads. Please refresh.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleAdd = useCallback((newLead) => {
    setAllLeads(prev => [mapLead({ ...newLead, _id: newLead.id || newLead._id }), ...prev]);
    setPage(1);
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
  }), [allLeads]);

  const displayed = useMemo(() => {
    let res = allLeads.filter(l => {
      const q           = search.toLowerCase();
      const matchSearch = !q || l.name.toLowerCase().includes(q) || l.phone.includes(q);
      const matchSt     = filterSt    === "All" || l.status  === filterSt;
      const matchAgent  = filterAgent === "All" || l.agent   === filterAgent;
      const matchSrc    = filterSrc   === "All" || l.source  === filterSrc;
      const matchTemp   = filterTemp  === "All" || l.Quality === filterTemp;
      let matchDate = true;
      if (dateFrom) matchDate = matchDate && new Date(l._raw_date) >= new Date(dateFrom);
      if (dateTo)   matchDate = matchDate && new Date(l._raw_date) <= new Date(dateTo + "T23:59:59");
      return matchSearch && matchSt && matchAgent && matchSrc && matchTemp && matchDate;
    });
    return res.slice().sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b._raw_date || 0) - new Date(a._raw_date || 0);
      if (sortBy === "date_asc")  return new Date(a._raw_date || 0) - new Date(b._raw_date || 0);
      if (sortBy === "name_asc")  return a.name.localeCompare(b.name);
      if (sortBy === "status")    return a.status.localeCompare(b.status);
      return 0;
    });
  }, [allLeads, search, filterSt, filterAgent, filterSrc, filterTemp, dateFrom, dateTo, sortBy]);

  const totalPages = Math.ceil(displayed.length / PER_PAGE);
  const paged      = displayed.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const clearFilters = () => {
    setSearch(""); setFilterSt("All"); setFilterAgent("All"); setFilterSrc("All");
    setFilterTemp("All"); setDateFrom(""); setDateTo(""); setPage(1);
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
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#059669] text-white text-[12px] font-semibold hover:bg-emerald-700 transition">
            <Plus className="w-3.5 h-3.5" /> Add Lead
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#7C3AED] text-white text-[12px] font-semibold hover:bg-violet-700 transition">
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
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
              placeholder="Search name, phone…" className={INP + " pl-9 w-full"} />
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
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className={INP} title="From date" />
          <input type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setPage(1); }} className={INP} title="To date" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={INP}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="name_asc">Name A–Z</option>
            <option value="status">By status</option>
          </select>
          {(search || filterSt !== "All" || filterAgent !== "All" || filterSrc !== "All" || filterTemp !== "All" || dateFrom || dateTo) && (
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
              <button onClick={() => setShowAdd(true)}
                className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#059669] text-white text-[13px] font-semibold hover:bg-emerald-700 transition">
                <Plus className="w-3.5 h-3.5" /> Add first lead
              </button>
            ) : (
              <button onClick={clearFilters} className="mt-1 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 transition">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                    {["Lead", "Contact", "Employee", "Source / Campaign", "Date", "Status", "Quality", "Last Outcome", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                  {paged.map(l => {
                    const sc        = STATUS_CONFIG[l.status] || STATUS_CONFIG["New"];
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                              style={{ background: (sc.dot || "#2563EB") + "20", color: sc.dot || "#2563EB" }}>
                              {l.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">{l.name}</p>
                              <p className="text-[10px] text-[#8B92A9]">{daysSince(l._raw_date) || "—"}</p>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {isSuperAdmin ? (
                              // ── SuperAdmin: plain number, no eye icon, no view count ──
                              <span className="font-mono text-[#0F1117] dark:text-[#F0F2FA] text-[12px]">
                                {l.phone || "—"}
                              </span>
                            ) : isRevealed ? (
                              // ── Admin: revealed state ──
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap text-[12px] animate-pulse">
                                  {l.phone || "—"}
                                </span>
                                <span className="inline-block w-8 h-1 rounded-full bg-[#E4E7EF] dark:bg-[#262A38] overflow-hidden">
                                  <span className="block h-full bg-[#2563EB] rounded-full" style={{ animation: "shrink 4s linear forwards" }} />
                                </span>
                              </div>
                            ) : (
                              // ── Admin: masked state with eye button ──
                              <button onClick={(e) => handleRevealPhone(e, l.id)} className="flex items-center gap-1 group/phone" title="Click to reveal number">
                                <span className="font-mono text-[#8B92A9] dark:text-[#565C75] tracking-widest text-[12px] select-none">
                                  {maskedPhone}
                                </span>
                                <Eye className="w-3 h-3 text-[#C4C9D9] dark:text-[#3E4257] group-hover/phone:text-[#2563EB] transition shrink-0" />
                              </button>
                            )}

                            {/* View count badge — hidden for superadmin */}
                            {!isSuperAdmin && viewCount > 0 && (
                              <span
                                title={`Viewed ${viewCount} time${viewCount > 1 ? "s" : ""} this session`}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 leading-none flex items-center gap-0.5
                                  ${viewCount >= 5 ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                                  : viewCount >= 3 ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                                  : "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7]"}`}
                              >
                                <Eye className="w-2 h-2" /> {viewCount}
                              </span>
                            )}
                          </div>
                          {l.email && (
                            <p className="text-[10px] text-[#8B92A9] truncate max-w-[130px] mt-0.5">{l.email}</p>
                          )}
                        </td>

                        {/* Employee */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-[8px] font-black text-purple-600 dark:text-purple-400 shrink-0">
                              {(l.agent || "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[#0F1117] dark:text-[#F0F2FA] truncate max-w-[90px]">{l.agent || "Unassigned"}</span>
                          </div>
                          {l.reassignCount > 0 && (
                            <p className="text-[9px] text-purple-400 mt-0.5">{l.reassignCount} reassign{l.reassignCount > 1 ? "s" : ""}</p>
                          )}
                        </td>

                        {/* Source */}
                        <td className="px-4 py-3">
                          <p className="text-[#0F1117] dark:text-[#F0F2FA] truncate max-w-[110px]">{l.source}</p>
{l.campaign !== "—" && (
  <p className="text-[10px] text-[#8B92A9] truncate max-w-[110px]">{l.campaign}</p>
)}
{l.adSetName && (
  <p className="text-[10px] text-[#E1306C] truncate max-w-[110px]">📢 {l.adSetName}</p>
)}                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap text-[#0F1117] dark:text-[#F0F2FA]">{l.date}</td>

                        {/* Status */}
                        <td className="px-4 py-3"><StatusBadge status={l.status} /></td>

                        {/* Quality */}
                        <td className="px-4 py-3"><TempBadge temp={l.Quality} /></td>

                        {/* Last Outcome */}
                        <td className="px-4 py-3">
                          {l.lastOutcome ? (
                            <div>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                                l.lastOutcome === "Interested" || l.lastOutcome === "Converted"
                                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                  : l.lastOutcome === "Not Interested" || l.lastOutcome === "Not Reachable"
                                  ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                                  : "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                              }`}>{l.lastOutcome}</span>
                              {l.lastCalledAt && <p className="text-[9px] text-[#8B92A9] mt-0.5">{daysSince(l.lastCalledAt)}</p>}
                              {l.lastRemark && <p className="text-[9px] text-[#8B92A9] truncate max-w-[140px] italic mt-0.5">"{l.lastRemark}"</p>}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#8B92A9]">No calls yet</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              title="Recordings & AI"
                              onClick={e => { e.stopPropagation(); setRecordingsLead(l); }}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 border border-violet-100 dark:border-violet-900/50 transition whitespace-nowrap"
                            >
                              <Mic className="w-3 h-3" />
                              Recordings &amp; AI
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
  />
)}
      {/* Recordings & AI drawer */}
      {recordingsLead && (
        <RecordingsDrawer lead={recordingsLead} onClose={() => setRecordingsLead(null)} />
      )}
    </div>
  );
}
