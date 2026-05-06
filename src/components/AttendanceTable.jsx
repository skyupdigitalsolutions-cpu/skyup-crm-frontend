import { useState, useMemo, useEffect } from "react";
import { updateAttendance, removeAttendance } from "../services/attendanceService";
import axios from "axios";

// ─── Constants ────────────────────────────────────────────────────────────────

const CRM_STATUS_STYLE = {
  present  : { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", dot: "#059669", label: "Present"  },
  absent   : { bg: "bg-red-50 dark:bg-red-950/40",         text: "text-red-600 dark:text-red-400",         dot: "#DC2626", label: "Absent"   },
  late     : { bg: "bg-amber-50 dark:bg-amber-950/40",     text: "text-amber-600 dark:text-amber-400",     dot: "#D97706", label: "Late"     },
  half_day : { bg: "bg-blue-50 dark:bg-blue-950/40",       text: "text-blue-600 dark:text-blue-400",       dot: "#2563EB", label: "Half-Day" },
  leave    : { bg: "bg-purple-50 dark:bg-purple-950/40",   text: "text-purple-600 dark:text-purple-400",   dot: "#7C3AED", label: "Leave"    },
};
const STATUS_ENUM = ["present", "absent", "late", "half_day", "leave"];

const CALL_TYPE_STYLE = {
  incoming : { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400", icon: "↙", label: "Incoming"  },
  outgoing : { bg: "bg-blue-100 dark:bg-blue-950/40",       text: "text-blue-700 dark:text-blue-400",       icon: "↗", label: "Outgoing"  },
  missed   : { bg: "bg-red-100 dark:bg-red-950/40",         text: "text-red-700 dark:text-red-400",         icon: "↗", label: "Missed"    },
  rejected : { bg: "bg-orange-100 dark:bg-orange-950/40",   text: "text-orange-700 dark:text-orange-400",   icon: "✕", label: "Rejected"  },
  blocked  : { bg: "bg-gray-100 dark:bg-gray-800",          text: "text-gray-600 dark:text-gray-400",       icon: "⊘", label: "Blocked"   },
  voicemail: { bg: "bg-purple-100 dark:bg-purple-950/40",   text: "text-purple-700 dark:text-purple-400",   icon: "✉", label: "Voicemail" },
  unknown  : { bg: "bg-gray-100 dark:bg-gray-800",          text: "text-gray-600 dark:text-gray-400",       icon: "?", label: "Unknown"   },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return fmtDate(d) + " · " + fmtTime(d);
}
function daysSince(iso) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
function toInputTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}
function combineDateTime(dateStr, timeStr) {
  if (!timeStr) return null;
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}
function initials(name) {
  return (name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}
function fmtDuration(seconds) {
  if (!seconds && seconds !== 0) return null;
  if (seconds === 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Auth helpers — same pattern as your other services
function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
const BASE = import.meta.env.VITE_API_URL || "";

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = CRM_STATUS_STYLE[status] || CRM_STATUS_STYLE["absent"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function CallTypeBadge({ callType }) {
  const s = CALL_TYPE_STYLE[callType] || CALL_TYPE_STYLE["unknown"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${s.bg} ${s.text}`}>
      <span>{s.icon}</span>
      {s.label}
    </span>
  );
}

function Avatar({ name, size = "md" }) {
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : size === "lg" ? "w-12 h-12 text-[15px]" : "w-9 h-9 text-[11px]";
  return (
    <div className={`${sz} rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 shrink-0`}>
      {initials(name)}
    </div>
  );
}

const INP = "w-full text-[12px] border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#0D0F14] rounded-xl px-3 py-2 text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-indigo-500 transition";

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ rec, onClose, onRefresh }) {
  const [form, setForm] = useState({
    loginTime : toInputTime(rec.loginTime),
    logoutTime: toInputTime(rec.logoutTime),
    crmStatus : rec.derivedCrmStatus || rec.crmStatus || "",
    remarks   : rec.remarks || "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await updateAttendance(rec._id, {
        loginTime : combineDateTime(rec.date, form.loginTime),
        logoutTime: combineDateTime(rec.date, form.logoutTime),
        crmStatus : form.crmStatus || null,
        remarks   : form.remarks,
      });
      onClose();
      onRefresh();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to save.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <h3 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Edit Attendance</h3>
        <p className="text-[12px] text-[#8B92A9] mb-5">{rec.user?.name} — {rec.date}</p>
        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wider block mb-1">Check-In</label>
              <input type="time" value={form.loginTime} onChange={e => setForm(f => ({ ...f, loginTime: e.target.value }))} className={INP} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wider block mb-1">Check-Out</label>
              <input type="time" value={form.logoutTime} onChange={e => setForm(f => ({ ...f, logoutTime: e.target.value }))} className={INP} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wider block mb-1">Status Override</label>
            <select value={form.crmStatus} onChange={e => setForm(f => ({ ...f, crmStatus: e.target.value }))} className={INP}>
              <option value="">Auto-detect</option>
              {STATUS_ENUM.map(s => <option key={s} value={s}>{CRM_STATUS_STYLE[s]?.label || s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wider block mb-1">Remarks</label>
            <input type="text" value={form.remarks} placeholder="Optional note…"
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={INP} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-white/5 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold transition disabled:opacity-60">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({ id, onClose, onRefresh }) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await removeAttendance(id);
      onClose();
      onRefresh();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to delete.");
    }
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-red-500">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </div>
        <h3 className="text-[15px] font-bold text-center text-[#0F1117] dark:text-[#F0F2FA] mb-1">Delete Record?</h3>
        <p className="text-[12px] text-center text-[#8B92A9] mb-6">This action cannot be undone.</p>
        {error && <p className="text-[12px] text-red-500 mb-3 text-center">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-white/5 transition">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition disabled:opacity-60">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Call Log Card ────────────────────────────────────────────────────────────

function CallLogCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const hasRecordings = log.recordings?.length > 0;
  const hasSummary    = log.recordings?.some(r => r.summary || r.transcript);
  const dur           = fmtDuration(log.duration);

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
      {/* Main row */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        {/* Left: call type icon + number + contact name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[14px] font-bold
            ${log.callType === "incoming"  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" :
              log.callType === "outgoing"  ? "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"             :
              log.callType === "missed"    ? "bg-red-100 dark:bg-red-950/40 text-red-500 dark:text-red-400"                 :
              log.callType === "rejected"  ? "bg-orange-100 dark:bg-orange-950/40 text-orange-500 dark:text-orange-400"     :
              log.callType === "voicemail" ? "bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400"     :
              "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
            {log.callType === "incoming"  ? "↙" :
             log.callType === "outgoing"  ? "↗" :
             log.callType === "missed"    ? "↗" :
             log.callType === "rejected"  ? "✕" :
             log.callType === "voicemail" ? "✉" : "?"}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">
              {log.phoneNumber || "Unknown"}
            </p>
            {log.name && (
              <p className="text-[11px] text-[#8B92A9] truncate">{log.name}</p>
            )}
          </div>
        </div>

        {/* Right: badges + timestamp + duration + expand toggle */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <CallTypeBadge callType={log.callType} />
            {log.matchedLead && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400">
                {log.matchedLead.name}
              </span>
            )}
            {hasRecordings && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400">
                🎙 {log.recordings.length}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#8B92A9]">{fmtDateTime(log.timestamp)}</p>
          {dur && (
            <p className="text-[10px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">{dur}</p>
          )}
          {(hasRecordings || hasSummary) && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition mt-0.5"
            >
              {expanded ? "Hide ▲" : "Details ▼"}
            </button>
          )}
        </div>
      </div>

      {/* Expanded: recordings player + transcript + AI summary */}
      {expanded && (hasRecordings || hasSummary) && (
        <div className="border-t border-[#E4E7EF] dark:border-[#262A38] px-4 py-3 space-y-4">
          {log.recordings.map((rec, i) => (
            <div key={rec._id || i} className="space-y-2.5">
              {rec.url && (
                <div>
                  <p className="text-[10px] font-semibold text-[#8B92A9] mb-1.5 uppercase tracking-wider">
                    Recording {log.recordings.length > 1 ? i + 1 : ""}
                  </p>
                  <audio
                    controls
                    src={rec.url}
                    className="w-full"
                    style={{ height: "36px", accentColor: "#6366f1" }}
                  />
                </div>
              )}

              {rec.transcribeStatus && rec.transcribeStatus !== "done" && !rec.transcript && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/40">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    rec.transcribeStatus === "processing" ? "bg-amber-400 animate-pulse" :
                    rec.transcribeStatus === "failed"     ? "bg-red-400" : "bg-gray-400"
                  }`} />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold capitalize">
                    Transcription {rec.transcribeStatus}
                  </p>
                </div>
              )}

              {rec.transcript && (
                <div>
                  <p className="text-[10px] font-semibold text-[#8B92A9] uppercase tracking-wider mb-1">Transcript</p>
                  <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed bg-white dark:bg-[#1A1D27] rounded-lg px-3 py-2 border border-[#E4E7EF] dark:border-[#262A38] max-h-36 overflow-y-auto">
                    {rec.transcript}
                  </p>
                </div>
              )}

              {rec.summary && (
                <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg px-3 py-2.5 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">AI Summary</p>

                  {rec.summary.summary && (
                    <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed">
                      {rec.summary.summary}
                    </p>
                  )}

                  {rec.summary.keyPoints?.length > 0 && (
                    <ul className="space-y-0.5">
                      {rec.summary.keyPoints.map((pt, j) => (
                        <li key={j} className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] flex gap-1.5">
                          <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center gap-3 pt-0.5 flex-wrap">
                    {rec.summary.sentiment && (
                      <span className="text-[10px] font-semibold text-[#8B92A9]">
                        Sentiment: <span className="text-[#0F1117] dark:text-[#F0F2FA]">{rec.summary.sentiment}</span>
                      </span>
                    )}
                    {rec.summary.nextAction && (
                      <span className="text-[10px] font-semibold text-[#8B92A9]">
                        Next action: <span className="text-[#0F1117] dark:text-[#F0F2FA]">{rec.summary.nextAction}</span>
                      </span>
                    )}
                    {rec.summary.suggestedTemp && (
                      <span className="text-[10px] font-semibold text-[#8B92A9]">
                        Lead temp: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{rec.summary.suggestedTemp}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── User Detail Drawer ───────────────────────────────────────────────────────

function UserDetailDrawer({ user, records, onClose }) {
  if (!user) return null;

  const [callLogs,    setCallLogs]    = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError,   setLogsError]   = useState("");
  const [logsPage,    setLogsPage]    = useState(1);
  const LOGS_PER_PAGE = 20;

  useEffect(() => {
    if (!user?._id) return;
    setCallLogs([]);
    setLogsPage(1);
    setLogsError("");
    setLogsLoading(true);
    axios.get(`${BASE}/api/call-logs/all?limit=500`, { headers: authHeaders() })
      .then(res => {
        const all = res.data?.logs || [];
        const filtered = all
          .filter(l => String(l.user?._id || l.user) === String(user._id))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setCallLogs(filtered);
      })
      .catch(err => {
        console.error("Call logs fetch failed:", err);
        setLogsError("Failed to load call logs.");
      })
      .finally(() => setLogsLoading(false));
  }, [user._id]);

  // ── Attendance stats ──────────────────────────────────────────────────────
  const userRecs      = records.filter(r => (r.user?._id || r.user?.id) === (user._id || user.id));
  const total         = userRecs.length;
  const present       = userRecs.filter(r => r.derivedCrmStatus === "present").length;
  const absent        = userRecs.filter(r => r.derivedCrmStatus === "absent").length;
  const late          = userRecs.filter(r => r.derivedCrmStatus === "late").length;
  const leave         = userRecs.filter(r => r.derivedCrmStatus === "leave").length;
  const halfDay       = userRecs.filter(r => r.derivedCrmStatus === "half_day").length;
  const attendancePct = total > 0 ? Math.round(((present + late + halfDay) / total) * 100) : 0;
  const sortedAtt     = [...userRecs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const lastRec       = sortedAtt[0];

  // ── Call log summary stats ────────────────────────────────────────────────
  const totalCalls    = callLogs.length;
  const totalDuration = callLogs.reduce((s, l) => s + (l.duration || 0), 0);
  const withRecording = callLogs.filter(l => l.recordings?.length > 0).length;
  const missedCalls   = callLogs.filter(l => l.callType === "missed").length;

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(totalCalls / LOGS_PER_PAGE);
  const pagedLogs  = callLogs.slice((logsPage - 1) * LOGS_PER_PAGE, logsPage * LOGS_PER_PAGE);

  // ── Device / app info ─────────────────────────────────────────────────────
  // User document is kept fresh on every login + clock-in by the mobile app.
  // Prefer user.* so the drawer always shows the latest device even if
  // the most recent attendance record predates the device info rollout.
  const appName     = user.appName     || lastRec?.appName     || null;
  const appVersion  = user.appVersion  || lastRec?.appVersion  || null;
  const platform    = user.platform    || lastRec?.platform    || null;
  const deviceModel = user.deviceModel || lastRec?.deviceModel || null;
  const osVersion   = user.osVersion   || lastRec?.osVersion   || null;
  const fcmToken    = user.fcmToken    || lastRec?.fcmToken    || null;
  const lastSynced  = lastRec?.updatedAt || lastRec?.loginTime  || null;

  const statItems = [
    { label: "Present",  value: present,  color: "#059669" },
    { label: "Absent",   value: absent,   color: "#DC2626" },
    { label: "Late",     value: late,     color: "#D97706" },
    { label: "Leave",    value: leave,    color: "#7C3AED" },
    { label: "Half-Day", value: halfDay,  color: "#2563EB" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-[540px] bg-white dark:bg-[#1A1D27] h-full shadow-2xl overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} size="lg" />
              <div>
                <h2 className="text-[17px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{user.name || "Unknown"}</h2>
                <p className="text-[11px] text-[#8B92A9] mt-0.5">{user.email || "—"}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {user.role && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                      {user.role}
                    </span>
                  )}
                  {user.phone && (
                    <span className="text-[10px] font-mono text-[#8B92A9]">{user.phone}</span>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    user.isActive !== false
                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                  }`}>
                    {user.isActive !== false ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white transition shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Attendance % bar ── */}
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-[#0F1117] dark:text-[#F0F2FA] uppercase tracking-widest">Attendance Rate</p>
            <span className="text-[13px] font-black" style={{
              color: attendancePct >= 80 ? "#059669" : attendancePct >= 60 ? "#D97706" : "#DC2626"
            }}>{attendancePct}%</span>
          </div>
          <div className="h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{
              width: `${attendancePct}%`,
              background: attendancePct >= 80 ? "#059669" : attendancePct >= 60 ? "#D97706" : "#DC2626"
            }} />
          </div>
          <p className="text-[10px] text-[#8B92A9] mt-1">
            {total} records total · Last seen {daysSince(lastRec?.date || lastRec?.loginTime)}
          </p>
        </div>

        {/* ── Attendance stats grid ── */}
        <div className="px-6 py-4 grid grid-cols-5 gap-2 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {statItems.map(s => (
            <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-2 text-center">
              <p className="text-[9px] font-bold text-[#8B92A9] uppercase tracking-wide mb-0.5">{s.label}</p>
              <p className="text-[15px] font-black" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 flex-1 space-y-6">

          {/* ── Device / App Info ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[14px]">📱</span>
              <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest">Login Device & App</p>
              <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
            </div>
            <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
              {[
                { label: "App Name",     value: appName     || "—" },
                { label: "App Version",  value: appVersion  || "—" },
                { label: "Platform",     value: platform    || "—" },
                { label: "Device Model", value: deviceModel || "—" },
                { label: "OS Version",   value: osVersion   || "—" },
                { label: "Last Synced",  value: lastSynced ? fmtDateTime(lastSynced) : "—" },
                { label: "FCM Token",    value: fcmToken ? fcmToken.slice(0, 24) + "…" : "—" },
              ].map((row, i) => (
                <div key={row.label} className={`flex items-center justify-between px-4 py-2.5 ${i > 0 ? "border-t border-[#F0F2FA] dark:border-[#1E2130]" : ""}`}>
                  <span className="text-[11px] text-[#8B92A9]">{row.label}</span>
                  <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] text-right max-w-[200px] truncate">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Device Call Logs ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[14px]">📞</span>
              <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest">Device Call Logs</p>
              <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
              <span className="text-[10px] font-bold text-[#8B92A9]">
                {logsLoading ? "…" : `${totalCalls} calls`}
              </span>
            </div>

            {!logsLoading && !logsError && totalCalls > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Total",     value: totalCalls,                    color: "#6366f1" },
                  { label: "Missed",    value: missedCalls,                   color: "#DC2626" },
                  { label: "Recorded",  value: withRecording,                 color: "#0891b2" },
                  { label: "Talk time", value: fmtDuration(totalDuration) || "0s", color: "#059669", small: true },
                ].map(s => (
                  <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-2 text-center border border-[#E4E7EF] dark:border-[#262A38]">
                    <p className="text-[9px] font-bold text-[#8B92A9] uppercase tracking-wide mb-0.5">{s.label}</p>
                    <p className={`font-black ${s.small ? "text-[11px]" : "text-[15px]"}`} style={{ color: s.color }}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {logsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 rounded-xl bg-[#F1F4FF] dark:bg-[#262A38] animate-pulse" />
                ))}
              </div>
            ) : logsError ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 bg-red-50 dark:bg-red-950/20 rounded-xl border border-dashed border-red-200 dark:border-red-900/40">
                <span className="text-[28px]">⚠️</span>
                <p className="text-[12px] text-red-500">{logsError}</p>
              </div>
            ) : pagedLogs.length > 0 ? (
              <>
                <div className="space-y-2">
                  {pagedLogs.map((log, i) => (
                    <CallLogCard key={log._id || i} log={log} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3">
                    <button
                      disabled={logsPage <= 1}
                      onClick={() => setLogsPage(p => p - 1)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white disabled:opacity-40 transition"
                    >
                      ← Prev
                    </button>
                    <p className="text-[11px] text-[#8B92A9]">Page {logsPage} of {totalPages}</p>
                    <button
                      disabled={logsPage >= totalPages}
                      onClick={() => setLogsPage(p => p + 1)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white disabled:opacity-40 transition"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-dashed border-[#E4E7EF] dark:border-[#262A38]">
                <span className="text-[28px]">📵</span>
                <p className="text-[12px] text-[#8B92A9]">No call logs synced for this user</p>
              </div>
            )}
          </div>

          {/* ── Recent Attendance Records ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[14px]">🗓️</span>
              <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest">Recent Attendance</p>
              <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
            </div>
            {sortedAtt.length > 0 ? (
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
                {sortedAtt.slice(0, 7).map((rec, i) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${i > 0 ? "border-t border-[#F0F2FA] dark:border-[#1E2130]" : ""}`}>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={rec.derivedCrmStatus || "absent"} />
                      <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{rec.date}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB]">
                        {fmtTime(rec.loginTime)} → {fmtTime(rec.logoutTime)}
                      </p>
                      <p className="text-[10px] text-[#8B92A9]">{rec.workingHours || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-dashed border-[#E4E7EF] dark:border-[#262A38]">
                <span className="text-[28px]">📋</span>
                <p className="text-[12px] text-[#8B92A9]">No attendance records found</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Sub-page: Attendance Table ───────────────────────────────────────────────

function AttendanceTab({ records, loading, onRefresh, onUserClick }) {
  const [editRec, setEditRec] = useState(null);
  const [delId,   setDelId]   = useState(null);

  const thCls = "px-4 py-3 text-left text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest whitespace-nowrap";
  const tdCls = "px-4 py-3 text-[12px] text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap";

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-[#E4E7EF] dark:border-[#262A38]">
        <table className="w-full">
          <thead className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
            <tr>
              <th className={thCls}>Employee</th>
              <th className={thCls}>Date</th>
              <th className={thCls}>Check-In</th>
              <th className={thCls}>Check-Out</th>
              <th className={thCls}>Working Hours</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Remarks</th>
              <th className={thCls}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-[#F1F4FF] dark:bg-[#262A38] animate-pulse w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <span className="text-[36px] block mb-2">📋</span>
                  <p className="text-[13px] text-[#8B92A9]">No attendance records found.</p>
                </td>
              </tr>
            ) : (
              records.map((rec, i) => (
                <tr key={rec._id || i} className="hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition group">
                  <td className={tdCls}>
                    <button
                      onClick={() => onUserClick(rec.user)}
                      className="flex items-center gap-2 hover:opacity-80 transition text-left"
                    >
                      <Avatar name={rec.user?.name} size="sm" />
                      <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:text-indigo-600 dark:hover:text-indigo-400 transition underline-offset-2 hover:underline">
                        {rec.user?.name || "Unknown"}
                      </span>
                    </button>
                  </td>
                  <td className={tdCls}>{rec.date}</td>
                  <td className={tdCls}>{fmtTime(rec.loginTime)}</td>
                  <td className={tdCls}>{fmtTime(rec.logoutTime)}</td>
                  <td className={tdCls}>
                    <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{rec.workingHours || "0h 00m"}</span>
                  </td>
                  <td className={tdCls}>
                    <StatusBadge status={rec.derivedCrmStatus} />
                  </td>
                  <td className={tdCls}>
                    <span className="italic text-[#8B92A9]">{rec.remarks || "—"}</span>
                  </td>
                  <td className={tdCls}>
                    {rec._id && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setEditRec(rec)}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-[#8B92A9] hover:text-indigo-600 dark:hover:text-indigo-400 transition" title="Edit">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => setDelId(rec._id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-[#8B92A9] hover:text-red-500 dark:hover:text-red-400 transition" title="Delete">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editRec && <EditModal rec={editRec} onClose={() => setEditRec(null)} onRefresh={onRefresh} />}
      {delId   && <DeleteModal id={delId}  onClose={() => setDelId(null)}   onRefresh={onRefresh} />}
    </>
  );
}

// ─── Sub-page: User Details Grid ─────────────────────────────────────────────

function UsersTab({ records, onUserClick }) {
  const users = useMemo(() => {
    const map = new Map();
    records.forEach(r => {
      const u = r.user;
      if (!u) return;
      const id = u._id || u.id || u.name;
      if (!map.has(id)) map.set(id, { ...u, _records: [] });
      map.get(id)._records.push(r);
    });
    return [...map.values()];
  }, [records]);

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <span className="text-[48px]">👥</span>
        <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">No users found</p>
        <p className="text-[12px] text-[#8B92A9]">Users will appear here once attendance records are loaded.</p>
      </div>
    );
  }

  return (
    // FIX: Added `items-start` so cards don't stretch to match their row neighbour's height
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
      {users.map(user => {
        const recs    = user._records || [];
        const total   = recs.length;
        const present = recs.filter(r => r.derivedCrmStatus === "present").length;
        const late    = recs.filter(r => r.derivedCrmStatus === "late").length;
        const absent  = recs.filter(r => r.derivedCrmStatus === "absent").length;
        const halfDay = recs.filter(r => r.derivedCrmStatus === "half_day").length;
        const pct     = total > 0 ? Math.round(((present + late + halfDay) / total) * 100) : 0;
        const sorted  = [...recs].sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastRec = sorted[0];
        const deviceInfo = lastRec?.appName || lastRec?.platform || lastRec?.deviceInfo;

        return (
          <button
            key={user._id || user.name}
            onClick={() => onUserClick(user)}
            className="text-left bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition group"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={user.name} size="md" />
                {/* FIX: Added min-w-0 to allow text truncation inside flex child */}
                <div className="min-w-0">
                  {/* FIX: Added line-clamp-1 so long names don't wrap and expand card height */}
                  <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-1">{user.name || "Unknown"}</p>
                  <p className="text-[10px] text-[#8B92A9] truncate">{user.email || "—"}</p>
                </div>
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${user.isActive !== false ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"}`}>
                {user.isActive !== false ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[#8B92A9]">Attendance</span>
                <span className="text-[10px] font-black" style={{ color: pct >= 80 ? "#059669" : pct >= 60 ? "#D97706" : "#DC2626" }}>{pct}%</span>
              </div>
              <div className="h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 80 ? "#059669" : pct >= 60 ? "#D97706" : "#DC2626" }} />
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              {[
                { label: "P", value: present, color: "#059669" },
                { label: "A", value: absent,  color: "#DC2626" },
                { label: "L", value: late,    color: "#D97706" },
              ].map(s => (
                <div key={s.label} className="flex-1 bg-[#F8F9FC] dark:bg-[#13161E] rounded-lg py-1 text-center">
                  <p className="text-[9px] text-[#8B92A9]">{s.label}</p>
                  <p className="text-[12px] font-black" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px]">📱</span>
                <span className="text-[10px] text-[#8B92A9] truncate">{deviceInfo || "No device info"}</span>
              </div>
              <span className="text-[10px] text-[#8B92A9] shrink-0">{daysSince(lastRec?.date || lastRec?.loginTime)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AttendancePage({ records = [], loading = false, onRefresh = () => {} }) {
  const [activeTab,    setActiveTab]    = useState("attendance");
  const [selectedUser, setSelectedUser] = useState(null);

  const tabs = [
    { key: "attendance", label: "Attendance",   icon: "🗓️" },
    { key: "users",      label: "User Details", icon: "👥" },
  ];

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-6 py-8">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Attendance</h1>
        <p className="text-[13px] text-[#8B92A9] mt-0.5">Track employee attendance, device info, and call log sync</p>
      </div>

      <div className="flex items-center gap-1 mb-6 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "attendance" && (
        <AttendanceTab
          records={records}
          loading={loading}
          onRefresh={onRefresh}
          onUserClick={u => { if (u) setSelectedUser(u); }}
        />
      )}
      {activeTab === "users" && (
        <UsersTab
          records={records}
          onUserClick={u => { if (u) setSelectedUser(u); }}
        />
      )}

      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          records={records}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
