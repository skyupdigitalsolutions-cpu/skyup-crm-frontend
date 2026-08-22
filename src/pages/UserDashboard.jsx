import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import api from "../data/axiosConfig";
import { maskPhone } from "../utils/maskPhone";
import { io } from "socket.io-client";
import { FlameIcon, UsersIcon, LoaderIcon, CheckIcon, AlertTriangle, CloudSun, Snowflake, MessageCircle, Flame, Sun, Check } from "lucide-react";
import NotInterestedModal from "../components/Notinterestedmodal";
import { normalizePhone } from "../utils/normalizePhone";
import { getRole } from "../data/dataService";
import CRMEncryption from "../utils/CRMEncryption";
// FIX (clock/timezone bug): see getGreeting() below.
import { toIST } from "../utils/dateUtils";
import IdleRemarkModal from "../components/IdleRemarkModal";

const crm = new CRMEncryption();
const ALL_SOURCES  = ["Manual", "Google Ads", "Campaign", "Facebook Ads", "Web Form", "Referral"];
const ALL_STATUSES = ["New", "In Progress", "Converted", "Not Interested"];

// ── helpers ───────────────────────────────────────────────────────────────────
function parseDate(s) {
  if (!s) return new Date(NaN);
  const m = s.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (m) {
    const mo = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    return new Date(+m[3], mo[m[2]], +m[1], 12);
  }
  return new Date(s);
}
function isToday(dateStr) {
  return parseDate(dateStr).toDateString() === new Date().toDateString();
}
function isThisWeek(dateStr) {
  const d = parseDate(dateStr);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0,0,0,0);
  return d >= weekStart && d <= now;
}
function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

// ── Phone normalisation ───────────────────────────────────────────────────────
function normalizeForDupCheck(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits;
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { values.push(current.replace(/\r/g, "").trim()); current = ""; }
    else { current += ch; }
  }
  values.push(current.replace(/\r/g, "").trim());
  return values;
}

// ── Status / Quality configs ──────────────────────────────────────────────────
const STATUS_CONFIG = {
  "New":            { bg:"bg-blue-50 dark:bg-blue-950/40",       text:"text-blue-600 dark:text-blue-400",    dot:"#2563EB" },
  "In Progress":    { bg:"bg-amber-50 dark:bg-amber-950/40",     text:"text-amber-600 dark:text-amber-400",  dot:"#D97706" },
  "Converted":      { bg:"bg-emerald-50 dark:bg-emerald-950/40", text:"text-emerald-600 dark:text-emerald-400", dot:"#059669" },
  "Not Interested": { bg:"bg-red-50 dark:bg-red-950/40",         text:"text-red-600 dark:text-red-400",      dot:"#DC2626" },
};
const TEMP_CONFIG = {
  Hot:  { bg:"bg-red-50 dark:bg-red-950/40",    text:"text-red-600 dark:text-red-400",    icon:"" },
  Warm: { bg:"bg-amber-50 dark:bg-amber-950/40",text:"text-amber-600 dark:text-amber-400",icon:"" },
  Cold: { bg:"bg-blue-50 dark:bg-blue-950/40",  text:"text-blue-600 dark:text-blue-400",  icon:"" },
};

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG["New"];
  return (
    <span className={"inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold " + s.bg + " " + s.text}>
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
    <span className={"inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold " + s.bg + " " + s.text}>
      {s.icon} {temp}
    </span>
  );
}

// ── Shared socket ref ─────────────────────────────────────────────────────────
const sharedSocket = { current: null };

// ─────────────────────────────────────────────────────────────────────────────
// ── Attendance Mini Widget
// ─────────────────────────────────────────────────────────────────────────────
const IDLE_MS        = 5 * 60 * 1000;
const IDLE_PROMPT_MS = 5 * 60 * 1000; // re-prompt every 5 min while still idle

function fmtMins(totalMins) {
  if (!Number.isFinite(totalMins) || totalMins < 0) return "0h 00m";
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function fmtTime(d) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function computeTotalBreakMins(record) {
  if (!record) return 0;
  const serverTotal = Number(record.totalBreakMinutes);
  if (Number.isFinite(serverTotal) && serverTotal > 0) return serverTotal;
  const breaks = Array.isArray(record.breaks) ? record.breaks : [];
  let total = 0;
  for (const b of breaks) {
    const dur = Number(b.durationMinutes ?? b.duration ?? b.durationMins);
    if (Number.isFinite(dur) && dur > 0) { total += dur; continue; }
    const start = b.startTime ? new Date(b.startTime) : null;
    const end   = b.endTime   ? new Date(b.endTime)   : null;
    if (start && !isNaN(start.getTime())) {
      const endMs = (end && !isNaN(end.getTime())) ? end.getTime() : Date.now();
      total += Math.max(0, Math.round((endMs - start.getTime()) / 60000));
    }
  }
  return total;
}

function breakEntryDurMins(b) {
  if (!b) return 0;
  const dur = Number(b.durationMinutes ?? b.duration ?? b.durationMins);
  if (Number.isFinite(dur) && dur > 0) return dur;
  const start = b.startTime ? new Date(b.startTime) : null;
  const end   = b.endTime   ? new Date(b.endTime)   : null;
  if (start && !isNaN(start.getTime())) {
    const endMs = (end && !isNaN(end.getTime())) ? end.getTime() : Date.now();
    return Math.max(0, Math.round((endMs - start.getTime()) / 60000));
  }
  return 0;
}

function computeWorkedSecsFixed(record) {
  if (!record?.loginTime) return 0;
  const loginMs = new Date(record.loginTime).getTime();
  const endMs   = record.logoutTime ? new Date(record.logoutTime).getTime() : Date.now();
  if (isNaN(loginMs) || isNaN(endMs)) return 0;
  const elapsedMs = Math.max(0, endMs - loginMs);
  const completedBreakMs = computeTotalBreakMins(record) * 60 * 1000;
  let ongoingBreakMs = 0;
  if (record.activeBreakIndex != null) {
    const ab = (record.breaks || [])[record.activeBreakIndex];
    if (ab?.startTime && !ab?.endTime) {
      const bStart = new Date(ab.startTime).getTime();
      if (!isNaN(bStart)) ongoingBreakMs = Math.max(0, Date.now() - bStart);
    }
  }
  return Math.max(0, Math.round((elapsedMs - completedBreakMs - ongoingBreakMs) / 1000));
}

function AttendanceMiniWidget() {
  const [record,      setRecord]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [workedSecs,  setWorkedSecs]  = useState(0);
  const [idleWarning, setIdleWarning] = useState(false);
  const [panelOpen,   setPanelOpen]   = useState(false);
  const panelRef     = useRef(null);
  const lastMoveRef  = useRef(Date.now());
  const idleTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  const tickTimerRef = useRef(null);

  // ── Idle-remark popup state ─────────────────────────────────────────────
  const [showIdleModal, setShowIdleModal] = useState(false);
  const [idleModalMode,  setIdleModalMode]  = useState("recurring"); // "recurring" | "resume"
  const idlePromptTimerRef = useRef(null);
  const pendingResumeRef   = useRef(false);

  const userId = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      return u?._id || u?.id || null;
    } catch { return null; }
  }, []);

  const fetchRecord = useCallback(async () => {
    try {
      const res = await api.get("/attendance/my-today");
      setRecord(res.data);
      setWorkedSecs(computeWorkedSecsFixed(res.data));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  useEffect(() => {
    if (!userId) return;
    let attempts = 0;
    let offFn = () => {};
    const tryJoin = () => {
      const socket = sharedSocket.current;
      if (!socket || !socket.connected) {
        if (++attempts < 8) { setTimeout(tryJoin, 400); }
        return;
      }
      socket.emit("att_join", { userId });
      const onUpdate = (updated) => {
        setRecord(updated);
        setWorkedSecs(computeWorkedSecsFixed(updated));
        setIdleWarning(false);
        lastMoveRef.current = Date.now();
      };
      socket.on("attendance:updated", onUpdate);
      offFn = () => socket.off("attendance:updated", onUpdate);
    };
    tryJoin();
    return () => offFn();
  }, [userId]);

  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen]);

  useEffect(() => {
    clearInterval(tickTimerRef.current);
    if (!record?.loginTime) { setWorkedSecs(0); return; }
    if (record.logoutTime) { setWorkedSecs(computeWorkedSecsFixed(record)); return; }
    const tick = () => setWorkedSecs(computeWorkedSecsFixed(record));
    tick();
    tickTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickTimerRef.current);
  }, [record]);

  useEffect(() => {
    if (!record?.loginTime || record?.logoutTime) return;
    pingTimerRef.current = setInterval(async () => {
      // FIX: applying the response directly here too (not just relying on the
      // attendance:updated socket listener above) — the socket can be
      // mid-reconnect at the exact moment this fires, and this is the same
      // defense-in-depth the mobile app's manual Resume handler already uses.
      try {
        const res = await api.post("/attendance/ping");
        if (res.data?.status && res.data.status !== "idle") {
          setRecord((prev) => (prev ? { ...prev, status: res.data.status, activeBreakIndex: null } : prev));
        }
      } catch {}
    }, 60000);
    return () => clearInterval(pingTimerRef.current);
  }, [record?.loginTime, record?.logoutTime]);

  useEffect(() => {
    if (!record?.loginTime || record?.logoutTime || record?.status !== "active") return;
    const resetIdle = () => {
      lastMoveRef.current = Date.now();
      setIdleWarning(false);
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(goIdle, IDLE_MS);
    };
    const goIdle = async () => {
      try {
        const res = await api.post("/attendance/break/start", { reason: "Auto Idle" });
        setRecord(res.data);
        // Cross-device guard: the backend may keep status "active" if the
        // employee has been active on another device (e.g. mobile) within
        // the idle cutoff, even though this browser tab has been idle.
        // Only show the idle banner when it actually went idle.
        setIdleWarning(res.data?.status === "idle");
      } catch {}
    };
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    idleTimerRef.current = setTimeout(goIdle, IDLE_MS);
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle));
      clearTimeout(idleTimerRef.current);
    };
  }, [record?.loginTime, record?.logoutTime, record?.status]);

  // ── Idle-remark: re-prompt every 5 min while still idle ────────────────────
  useEffect(() => {
    clearInterval(idlePromptTimerRef.current);
    if (record?.status !== "idle") return;

    setIdleModalMode("recurring");
    setShowIdleModal(true);
    idlePromptTimerRef.current = setInterval(() => {
      setIdleModalMode("recurring");
      setShowIdleModal(true);
    }, IDLE_PROMPT_MS);

    return () => clearInterval(idlePromptTimerRef.current);
  }, [record?.status]);

  // ── Idle-remark: any movement while idle → prompt for remark, then resume ──
  useEffect(() => {
    if (record?.status !== "idle") { pendingResumeRef.current = false; return; }

    const onMove = () => {
      if (pendingResumeRef.current) return;
      pendingResumeRef.current = true;
      setIdleModalMode("resume");
      setShowIdleModal(true);
    };

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, onMove, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onMove));
  }, [record?.status]);

  // ── Idle-remark: close the popup if idle ends through some OTHER path ──────
  // Same gap as AttendancePanel.jsx — the existing "Resume" buttons here
  // (idleWarning banner + regular action row) call endBreak() directly,
  // bypassing this popup. Without this it could keep showing stale content
  // after the employee already resumed through one of those buttons.
  const prevIdleStatusRef = useRef(record?.status);
  useEffect(() => {
    const prev = prevIdleStatusRef.current;
    prevIdleStatusRef.current = record?.status;
    if (prev === "idle" && record?.status !== "idle" && showIdleModal) {
      setShowIdleModal(false);
      pendingResumeRef.current = false;
    }
  }, [record?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Idle-remark: derived data for the popup ─────────────────────────────────
  const currentIdleBreak = (() => {
    if (record?.status !== "idle" || record?.activeBreakIndex == null) return null;
    const br = record.breaks?.[record.activeBreakIndex];
    return br?.reason === "Auto Idle" ? { index: record.activeBreakIndex, ...br } : null;
  })();

  const pastPendingBreaks = (record?.breaks || [])
    .map((b, index) => ({ ...b, index }))
    .filter((b) => b.reason === "Auto Idle" && b.remarkStatus === "pending" && b.index !== record?.activeBreakIndex);

  // ── Idle-remark: save/skip handlers ─────────────────────────────────────────
  const closeIdleModal = async () => {
    setShowIdleModal(false);
    if (idleModalMode === "resume") {
      pendingResumeRef.current = false;
      try {
        const r = await api.post("/attendance/break/end");
        setRecord(r.data);
        setIdleWarning(false);
      } catch {}
    }
  };

  const handleSaveIdleRemark = async (text) => {
    try {
      const r = await api.post("/attendance/idle-remark", { remark: text });
      setRecord((prev) => (prev ? { ...prev, breaks: r.data?.breaks || prev.breaks } : prev));
    } catch {}
    closeIdleModal();
  };

  const handleSkipIdleRemark = async () => {
    try { await api.post("/attendance/idle-remark", { remark: "" }); } catch {}
    closeIdleModal();
  };

  const handleSavePendingRemark = async (breakIndex, text) => {
    try {
      const r = await api.post("/attendance/idle-remark", { remark: text, breakIndex });
      setRecord((prev) => (prev ? { ...prev, breaks: r.data?.breaks || prev.breaks } : prev));
    } catch {}
  };

  const clockIn    = async () => { try { const r = await api.post("/attendance/clock-in");              setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); } };
  const clockOut   = async () => { if (!confirm("Clock out for today?")) return; try { const r = await api.post("/attendance/clock-out"); setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); } };
  const startBreak = async () => { try { const r = await api.post("/attendance/break/start", { reason: "Manual Break" }); setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); } };
  const endBreak   = async () => { setIdleWarning(false); try { const r = await api.post("/attendance/break/end"); setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); } };

  const notClockedIn = !record || !record.loginTime;
  const isClockedOut = !!record?.logoutTime;
  const isOnBreak    = record?.status === "on_break" || record?.status === "idle";
  const isActive     = record?.status === "active";
  const totalBreakMins = computeTotalBreakMins(record);
  const workedMins = Math.floor(workedSecs / 60);

  const ST = {
    active:     { dot: "bg-emerald-400", color: "text-emerald-600 dark:text-emerald-400", label: "Active",     chipBg: "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800" },
    on_break:   { dot: "bg-amber-400",   color: "text-amber-600 dark:text-amber-400",     label: "On Break",   chipBg: "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800" },
    idle:       { dot: "bg-red-400",     color: "text-red-500 dark:text-red-400",         label: "Idle",       chipBg: "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800" },
    logged_out: { dot: "bg-gray-400",    color: "text-[#8B92A9]",                         label: "Logged Out", chipBg: "bg-[#F8F9FC] dark:bg-[#13161E] border-[#E4E7EF] dark:border-[#262A38]" },
  };
  const st = ST[record?.status] || ST["logged_out"];

  if (loading) return <div className="h-9 w-28 sm:w-32 rounded-xl bg-[#F1F4FF] dark:bg-[#1E2130] animate-pulse" />;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setPanelOpen(v => !v)}
        className={"flex items-center gap-1.5 sm:gap-2 h-9 px-2.5 sm:px-3 rounded-xl border text-[11px] sm:text-[12px] font-semibold transition-all hover:shadow-sm " + st.chipBg}
      >
        <span className={"w-2 h-2 rounded-full shrink-0 " + st.dot + (isActive ? " animate-pulse" : "")} />
        <svg className={"w-3.5 h-3.5 shrink-0 " + st.color} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/>
        </svg>
        <span className={st.color}>
          {notClockedIn ? "Clock In" : isClockedOut ? fmtMins(workedMins) : isActive ? fmtMins(workedMins) : st.label}
        </span>
        {idleWarning && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
        <svg className={"w-3 h-3 transition-transform " + st.color + (panelOpen ? " rotate-180" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {panelOpen && (
        <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-auto sm:top-11 mt-2 sm:mt-0 z-[200] w-auto sm:w-72 max-w-full sm:max-w-none bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-[#0F1117] dark:text-white">Attendance</p>
              <p className="text-[10px] text-[#8B92A9]">{new Date().toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short" })}</p>
            </div>
            {record && (
              <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full border " + st.chipBg + " " + st.color}>{st.label}</span>
            )}
          </div>

          {idleWarning && (
            <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Idle for 5 mins</p>
                <p className="text-[10px] text-red-400">Break started automatically.</p>
              </div>
              <button onClick={endBreak} className="shrink-0 px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold transition">Resume</button>
            </div>
          )}

          {record?.loginTime && (
            <div className="grid grid-cols-3 gap-2 px-3 pt-3">
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-2 py-2.5 text-center">
                <p className="text-[9px] text-[#8B92A9] font-semibold uppercase tracking-wide mb-1">Work</p>
                <p className="text-[13px] font-black text-[#0F1117] dark:text-white leading-none">{fmtMins(workedMins)}</p>
              </div>
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-2 py-2.5 text-center">
                <p className="text-[9px] text-[#8B92A9] font-semibold uppercase tracking-wide mb-1">Break</p>
                <p className="text-[13px] font-black text-amber-500 leading-none">{fmtMins(totalBreakMins)}</p>
              </div>
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-2 py-2.5 text-center">
                <p className="text-[9px] text-[#8B92A9] font-semibold uppercase tracking-wide mb-1">Login</p>
                <p className="text-[13px] font-black text-[#0F1117] dark:text-white leading-none">{fmtTime(record.loginTime)}</p>
              </div>
            </div>
          )}

          <div className="px-3 py-3 flex gap-2">
            {notClockedIn && (
              <button onClick={clockIn} className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold transition flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white/70" /> Clock In
              </button>
            )}
            {record?.loginTime && !isClockedOut && (
              <>
                {!isOnBreak && <button onClick={startBreak} className="flex-1 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[12px] font-bold transition">⏸ Break</button>}
                {isOnBreak  && <button onClick={endBreak}   className="flex-1 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-400 text-[12px] font-bold transition">▶ Resume</button>}
                <button onClick={clockOut} className="flex-1 py-2 rounded-xl bg-red-100 dark:bg-red-950/40 hover:bg-red-200 text-red-600 dark:text-red-400 text-[12px] font-bold transition">⏹ Clock Out</button>
              </>
            )}
            {isClockedOut && (
              <div className="flex-1 py-2 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] text-center text-[11px] text-[#8B92A9] font-semibold">
                Clocked out · {fmtTime(record.logoutTime)}
              </div>
            )}
          </div>

          {record?.breaks?.length > 0 && (
            <div className="mx-3 mb-3 border border-[#E4E7EF] dark:border-[#262A38] rounded-xl overflow-hidden">
              <p className="px-3 py-2 text-[9px] font-bold text-[#8B92A9] uppercase tracking-widest bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">Break Log</p>
              <div className="divide-y divide-[#F1F4FF] dark:divide-[#1E2130]">
                {record.breaks.map((b, i) => {
                  const durMins = breakEntryDurMins(b);
                  const isOngoing = b.startTime && !b.endTime;
                  return (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 flex-wrap gap-1">
                      <span className={"text-[10px] font-semibold px-1.5 py-0.5 rounded-full " + (b.reason === "Auto Idle" ? "bg-red-50 dark:bg-red-950/40 text-red-500" : "bg-amber-50 dark:bg-amber-950/40 text-amber-600")}>
                        {b.reason || "Break"}
                      </span>
                      <span className="text-[10px] text-[#8B92A9]">
                        {fmtTime(b.startTime)} → {b.endTime ? fmtTime(b.endTime) : "ongoing"}
                        {isOngoing ? " · ongoing" : ` · ${durMins}m`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="px-3 py-1.5 bg-[#F8F9FC] dark:bg-[#13161E] border-t border-[#E4E7EF] dark:border-[#262A38] flex justify-between">
                <span className="text-[9px] font-bold text-[#8B92A9] uppercase tracking-wide">Total break</span>
                <span className="text-[10px] font-bold text-amber-500">{fmtMins(totalBreakMins)}</span>
              </div>
            </div>
          )}

          {isClockedOut && record?.loginTime && (
            <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <div className="flex justify-between items-center flex-wrap gap-1">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Total worked today</span>
                <span className="text-[13px] font-black text-emerald-600 dark:text-emerald-400">{fmtMins(workedMins)}</span>
              </div>
              <div className="flex justify-between items-center mt-1 flex-wrap gap-1">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-500">{fmtTime(record.loginTime)} → {fmtTime(record.logoutTime)}</span>
                <span className="text-[10px] text-amber-500">−{fmtMins(totalBreakMins)} break</span>
              </div>
            </div>
          )}
        </div>
      )}

      <IdleRemarkModal
        open={showIdleModal}
        mode={idleModalMode}
        idleSince={currentIdleBreak?.startTime}
        pendingBreaks={pastPendingBreaks}
        onSave={handleSaveIdleRemark}
        onSkip={handleSkipIdleRemark}
        onClose={() => setShowIdleModal(false)}
        onSavePending={handleSavePendingRemark}
      />
    </div>
  );
}

// KPI / Chart / Activity helpers
function KpiCard({ label, value, sub, color, icon, trend, trendUp }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 sm:p-5 flex flex-col gap-2 sm:gap-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] sm:text-[12px] font-bold text-[#8B92A9] dark:text-[#D1D5DB] uppercase tracking-widest truncate">{label}</span>
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "18" }}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-[24px] sm:text-[32px] font-black text-[#0F1117] dark:text-white leading-none">{value}</p>
        {sub && <p className="text-[10px] sm:text-[11px] text-[#8B92A9] dark:text-[#D1D5DB] mt-1 truncate">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={"flex items-center gap-1 text-[11px] font-semibold " + (trendUp ? "text-emerald-500" : "text-red-500")}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={trendUp ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}/>
          </svg>
          {trend}
        </div>
      )}
    </div>
  );
}

function RadialProgress({ value, max, color, label, size = 88 }) {
  const r = size / 2 - 9;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E4E7EF" strokeWidth="8" className="dark:stroke-[#262A38]" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circ * pct + " " + circ} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[15px] font-black text-[#0F1117] dark:text-white">{value}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-[#8B92A9] dark:text-[#D1D5DB] font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-[9px] text-[#8B92A9] dark:text-[#D1D5DB]">/ {max} target</p>
      </div>
    </div>
  );
}

function ActivityItem({ lead, isLast }) {
  const s = STATUS_CONFIG[lead.status] || STATUS_CONFIG["New"];
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: s.dot + "20", color: s.dot }}>
          {lead.name ? lead.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase() : "?"}
        </div>
        {!isLast && <div className="w-px flex-1 bg-[#E4E7EF] dark:bg-[#262A38] mt-1 mb-1" />}
      </div>
      <div className="flex-1 pb-3 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-white truncate">{lead.name}</p>
            <p className="text-[10px] text-[#8B92A9] dark:text-[#D1D5DB] font-mono mt-0.5">{lead.phone ? maskPhone(lead.phone) : "—"}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StatusBadge status={lead.status} />
            <span className="text-[9px] text-[#8B92A9] dark:text-[#D1D5DB]">{timeAgo(lead._raw_date)}</span>
          </div>
        </div>
        {lead.remark && <p className="text-[11px] text-[#4B5168] dark:text-[#E5E7EB] mt-1 italic break-words">"{lead.remark}"</p>}
      </div>
    </div>
  );
}


    function ProjectDropdown({ projects, selectedProjects, toggleProject }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedNames = projects.filter(p => selectedProjects.includes(String(p._id)));

  return (
    <div ref={ref} className="relative">
      <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">
        Projects
      </label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-left transition focus:outline-none focus:border-[#2563EB] hover:border-[#2563EB]/50"
      >
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {selectedNames.length === 0 ? (
            <span className="text-[#8B92A9]">Select projects…</span>
          ) : (
            selectedNames.map(p => (
              <span
                key={p._id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                style={{ background: p.color || "#2563EB" }}
              >
                {p.name}
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); toggleProject(String(p._id)); }}
                  className="opacity-80 hover:opacity-100 cursor-pointer leading-none"
                >✕</span>
              </span>
            ))
          )}
        </div>
        <svg
          className={"w-3.5 h-3.5 shrink-0 ml-2 text-[#8B92A9] transition-transform " + (open ? "rotate-180" : "")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-[100] mt-1.5 w-full bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl shadow-xl overflow-hidden">
          <div className="py-1 max-h-48 overflow-y-auto">
            {projects.map(p => {
              const active = selectedProjects.includes(String(p._id));
              return (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => toggleProject(String(p._id))}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition text-left"
                >
                  {/* Color swatch */}
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: p.color || "#2563EB" }}
                  />
                  <span className="flex-1 font-medium text-[#0F1117] dark:text-white">{p.name}</span>
                  {/* Checkmark */}
                  {active && (
                    <svg className="w-3.5 h-3.5 shrink-0" style={{ color: p.color || "#2563EB" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          {selectedNames.length > 0 && (
            <div className="border-t border-[#E4E7EF] dark:border-[#262A38] px-3 py-2">
              <button
                type="button"
                onClick={() => selectedNames.forEach(p => toggleProject(String(p._id)))}
                className="text-[11px] text-red-500 hover:text-red-600 font-semibold transition"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function getTomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; }
function getTodayStr()    { return new Date().toISOString().split("T")[0]; }

// Kept in sync with the mobile app's OUTCOMES list (LeadDetailScreen.js) so the
// same call-remark outcomes are available on web and mobile, and so they match the
// backend outcomeAutomationService keys (answered / notAnswered / busy / switchOff / …).
const OUTCOME_OPTIONS = ["Answered","Not Answered","Busy","Switch Off","Call Back Later","Interested","Not Interested","Invalid","Client Meeting"];

// ── UpdateStatusModal ─────────────────────────────────────────────────────────
// Now accepts `projects` prop so users can assign/remove project tags while updating a lead.
function UpdateStatusModal({ lead, onClose, onSaved, onNotInterested, projects = [] }) {
  const [status,       setStatus]       = useState(lead.status === "Not Interested" ? "In Progress" : (lead.status || "New"));
  const [temp,         setTemp]         = useState(lead.temperature || lead.Quality || "");
  const [outcome,      setOutcome]      = useState("Answered");
  const [remark,       setRemark]       = useState(lead.remark || "");
  const [followUpDate, setFollowUpDate] = useState(getTomorrowStr());
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  // ── Project multi-select state ────────────────────────────────────────────
  const [selectedProjects, setSelectedProjects] = useState(() => {
    if (!Array.isArray(lead.projects)) return [];
    return lead.projects.map(p => String(p?._id || p)).filter(Boolean);
  });

  const toggleProject = (id) =>
    setSelectedProjects(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const CLS = "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB] transition";

  const handleStatusChange = (e) => {
    if (e.target.value === "Not Interested") { onNotInterested(); return; }
    setStatus(e.target.value);
  };

  const handleSave = async () => {
    setLoading(true); setError("");
    try {
      const body = { status, remark, outcome, projects: selectedProjects };
      if (temp) { body.temperature = temp; body.Quality = temp; }
      if (status !== "Not Interested") { body.followUpDate = followUpDate || getTomorrowStr(); }
      const res = await api.patch(`/lead/${lead.id || lead._id}`, body);
      onSaved({
        ...lead,
        ...(res.data || {}),
        id: lead.id || String(lead._id),
        status,
        remark,
        outcome,
        temperature: temp || res.data?.temperature || null,
        Quality: temp || res.data?.temperature || null,
        projects: selectedProjects,
        _newEntry: { outcome, remark, calledAt: new Date().toISOString(), userName: "You" },
      });
      onClose();
    } catch (e) {
      setError((e.response?.data?.message) || "Failed to update. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-[#0F1117] dark:text-white">Update Lead</h3>
            <p className="text-[11px] text-[#8B92A9] truncate">{lead.name}</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Status</label>
            <select value={status} onChange={handleStatusChange} className={CLS}>
              {["New","In Progress","Converted","Not Interested"].map(s => <option key={s}>{s}</option>)}
            </select>
            <p className="text-[10px] text-amber-500 mt-1">Selecting "Not Interested" opens the reassignment workflow.</p>
          </div>

          {/* Call Outcome */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Call Outcome</label>
            <select value={outcome} onChange={e => setOutcome(e.target.value)} className={CLS}>
              {OUTCOME_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {/* Lead Quality */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Lead Quality</label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {[
                {val:"",    label:"None",  Icon:null,      color:"#8B92A9", bg:"bg-gray-50 dark:bg-gray-900/30"},
                {val:"Hot", label:"Hot",   Icon:Flame,     color:"#DC2626", bg:"bg-red-50 dark:bg-red-950/30"},
                {val:"Warm",label:"Warm",  Icon:CloudSun,  color:"#D97706", bg:"bg-amber-50 dark:bg-amber-950/30"},
                {val:"Cold",label:"Cold",  Icon:Snowflake, color:"#2563EB", bg:"bg-blue-50 dark:bg-blue-950/30"},
              ].map(q => (
                <button key={q.val} type="button" onClick={() => setTemp(q.val)}
                  className={`py-2 px-1 rounded-xl border-2 text-[10px] sm:text-[11px] font-semibold transition ${q.bg} ${temp === q.val ? "border-current scale-[1.03]" : "border-transparent opacity-60 hover:opacity-100"}`}
                  style={{ color: q.color, borderColor: temp === q.val ? q.color : undefined }}><span className="inline-flex items-center justify-center gap-1">{q.Icon && <q.Icon className="w-3 h-3 shrink-0" />}{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Remark */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Remark</label>
            <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} className={CLS + " resize-none"} placeholder="Add a note…" />
          </div>

          {/* ── Project Tags (admin-created, read from props) ── */}
         {projects.length > 0 && (
  <ProjectDropdown
    projects={projects}
    selectedProjects={selectedProjects}
    toggleProject={toggleProject}
  />
)}
                   
         

          {/* Follow-up Date */}
          {status !== "Not Interested" && (
            <div>
              <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Follow-up Date</label>
              <input type="date" value={followUpDate} min={getTodayStr()} onChange={e => setFollowUpDate(e.target.value)} className={CLS} />
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 mb-3">
            <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex gap-2 sticky bottom-0 bg-white dark:bg-[#1A1D27] pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving…</> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Lead Modal (mirrors ReportPage) ──────────────────────────────────────
function EditLeadModal({ lead, onClose, onSave }) {
  const [form, setForm]             = useState({ ...lead });
  const [saving, setSaving]         = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-0">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 sm:p-6 w-full max-w-md sm:mx-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Edit Lead</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Lead Name", key: "name" },
            { label: "Campaign",  key: "campaign" },
            { label: "Remark",    key: "remark" },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
              <input type="text" value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]" />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Date</label>
            <input type="text" value={form.date || "—"} readOnly
              className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#8B92A9] dark:text-[#565C75] cursor-not-allowed" />
          </div>
          {[
            { label: "Source", key: "source", options: ALL_SOURCES },
            { label: "Status", key: "status", options: ALL_STATUSES },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
              <select value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none">
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition disabled:opacity-50">Cancel</button>
          <button disabled={saving} onClick={async () => {
            const leadId = form.id || form._id;
            const endpoint = `/lead/${leadId}`;
            try {
              setSaving(true);
              const basePayload = {
                name:     form.name,
                mobile:   form.phone || form.mobile,
                source:   form.source,
                campaign: form.campaign === "—" ? "" : form.campaign,
                status:   form.status,
                remark:   form.remark,
              };
              let payload = basePayload;
              const keyString = crm.getLocalKey();
              if (keyString) {
                try {
                  const encryptedData = await crm.encrypt(
                    { name: basePayload.name, mobile: basePayload.mobile, email: form.email || "", remark: basePayload.remark },
                    keyString
                  );
                  payload = { ...basePayload, encryptedData };
                } catch { /* send plain */ }
              }
              const { data: updated } = await api.put(endpoint, payload);
              onSave({ ...lead, ...form, ...updated });
              onClose();
            } catch (err) {
              alert("Failed to save: " + (err.response?.data?.message || err.message));
            } finally { setSaving(false); }
          }} className="flex-1 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Phone Numbers Modal (mirrors ReportPage) ──────────────────────────────────
function PhoneNumbersModal({ lead, onClose, onLeadUpdated }) {
  const leadId = lead.id || lead._id;
  const role   = getRole();

  const [primaryPhone,   setPrimaryPhone]   = useState(lead.primaryPhone   || lead.phone || lead.mobile || "");
  const [secondaryPhone, setSecondaryPhone] = useState(lead.secondaryPhone || "");
  const [newSecondary,   setNewSecondary]   = useState("");
  const [busy,           setBusy]           = useState(false);
  const [busyOp,         setBusyOp]         = useState(null);
  const [errorMsg,       setErrorMsg]       = useState("");
  const [mergeLead,      setMergeLead]      = useState(null);
  const [merging,        setMerging]        = useState(false);

  const ep = (path) => {
    const prefix = role === "superadmin" ? "superadmin" : role === "admin" ? "admin" : "";
    return prefix ? `/lead/${prefix}/${leadId}/${path}` : `/lead/${leadId}/${path}`;
  };

  const applyUpdate = (raw) => {
    const data         = raw?.lead ?? raw;
    const newPrimary   = data.primaryPhone   ?? primaryPhone;
    const newSecondary = data.secondaryPhone ?? "";
    setPrimaryPhone(newPrimary);
    setSecondaryPhone(newSecondary);
    onLeadUpdated({ ...lead, primaryPhone: newPrimary, secondaryPhone: newSecondary, phone: newPrimary, mobile: newPrimary });
  };

  const handleAdd = async () => {
    const trimmed = newSecondary.trim();
    if (!trimmed) { setErrorMsg("Please enter a phone number."); return; }
    if (!normalizePhone(trimmed)) { setErrorMsg("Enter a valid 10-digit phone number."); return; }
    if (normalizePhone(trimmed) === normalizePhone(primaryPhone)) { setErrorMsg("Secondary number must differ from the primary."); return; }
    setBusy(true); setBusyOp("add"); setErrorMsg("");
    try {
      const { data } = await api.put(ep("secondary-phone"), { secondaryPhone: trimmed });
      applyUpdate(data); setNewSecondary("");
    } catch (err) {
      const status = err.response?.status;
      const data   = err.response?.data;
      if (status === 409 && data?.existingLead) { setMergeLead(data.existingLead); }
      else { setErrorMsg(data?.message || "Failed to save secondary number."); }
    } finally { setBusy(false); setBusyOp(null); }
  };

  const handleRemove = async () => {
    setBusy(true); setBusyOp("remove"); setErrorMsg("");
    try { const { data } = await api.delete(ep("secondary-phone")); applyUpdate(data); }
    catch (err) { setErrorMsg(err.response?.data?.message || "Failed to remove."); }
    finally { setBusy(false); setBusyOp(null); }
  };

  const handleSwap = async () => {
    if (!secondaryPhone) return;
    setBusy(true); setBusyOp("swap"); setErrorMsg("");
    try { const { data } = await api.put(ep("swap-phones")); applyUpdate(data); }
    catch (err) { setErrorMsg(err.response?.data?.message || "Failed to swap."); }
    finally { setBusy(false); setBusyOp(null); }
  };

  const handleMerge = async () => {
    if (!mergeLead) return;
    const targetId    = mergeLead._id || mergeLead.id;
    const sourcePhone = normalizePhone((lead.primaryPhone || lead.phone || lead.mobile || "").trim());
    if (!sourcePhone) { setErrorMsg("Cannot determine current lead's primary number."); return; }
    setMerging(true); setErrorMsg("");
    try {
      const prefix = role === "superadmin" ? "superadmin" : role === "admin" ? "admin" : "";
      const mergeEp = prefix ? `/lead/${prefix}/${targetId}/merge` : `/lead/${targetId}/merge`;
      const { data } = await api.post(mergeEp, {
        secondaryPhone: sourcePhone,
        sourceName:     lead.name,
        sourceMobile:   sourcePhone,
        sourceLeadId:   lead.id || lead._id,
      });
      // Update the survivor lead in the list
      applyUpdate(data?.lead || data);
      // Remove the absorbed (source) lead — it's this modal's own lead — from the list
      const absorbedId = data?.absorbedLeadId || lead.id || String(lead._id);
      onLeadUpdated({ ...(data?.lead || data), _mergedAbsorbedId: absorbedId });
      setMergeLead(null); setNewSecondary(""); onClose();
    } catch (err) { setErrorMsg(err.response?.data?.message || "Merge failed."); }
    finally { setMerging(false); }
  };

  const Spinner = () => (
    <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );
  const PhoneIcon = ({ className = "" }) => (
    <svg className={`w-3.5 h-3.5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
    </svg>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-0">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 sm:p-6 w-full max-w-sm sm:mx-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Phone Numbers</h2>
            <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5 truncate">{lead.name}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Primary */}
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">Primary Number</p>
          <div className="flex items-center gap-2.5 bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl px-3 py-2.5">
            <PhoneIcon className="text-[#2563EB]" />
            <span className="text-[13px] font-semibold font-mono text-[#0F1117] dark:text-[#F0F2FA] flex-1 truncate">{primaryPhone || "—"}</span>
            <span className="text-[9px] font-bold uppercase tracking-wide text-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540] px-2 py-0.5 rounded-full shrink-0">Primary</span>
          </div>
        </div>

        {/* Secondary */}
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">Secondary Number</p>
          {secondaryPhone ? (
            <>
              <div className="flex items-center gap-2 bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl px-3 py-2.5">
                <PhoneIcon className="text-[#059669]" />
                <span className="text-[13px] font-semibold font-mono text-[#0F1117] dark:text-[#F0F2FA] flex-1 truncate">{secondaryPhone}</span>
                <button onClick={handleSwap} disabled={busy} title="Swap primary ↔ secondary"
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[#7C3AED] hover:bg-[#F3EEFF] dark:hover:bg-[#2A1F40] hover:border-[#7C3AED] transition disabled:opacity-50 shrink-0">
                  {busy && busyOp === "swap" ? <Spinner /> : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
                  )}
                </button>
                <button onClick={handleRemove} disabled={busy} title="Remove secondary"
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-[#DC2626] transition disabled:opacity-50 shrink-0">
                  {busy && busyOp === "remove" ? <Spinner /> : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-start gap-2 bg-[#F3EEFF] dark:bg-[#1E1030] border border-[#DDD6FE] dark:border-[#4C1D95] rounded-xl px-3 py-2">
                <svg className="w-3.5 h-3.5 text-[#7C3AED] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p className="text-[11px] text-[#6D28D9] dark:text-[#C4B5FD]">Use ↕ to promote the secondary to primary without losing either number.</p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2.5 bg-[#F8F9FC] dark:bg-[#13161E] border border-dashed border-[#C4C9D9] dark:border-[#3E4257] rounded-xl px-3 py-2.5">
              <PhoneIcon className="text-[#C4C9D9] dark:text-[#3E4257]" />
              <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75] italic">No secondary number added</span>
            </div>
          )}
        </div>

        {/* Add secondary form */}
        {!secondaryPhone && (
          <div className="border-t border-[#E4E7EF] dark:border-[#262A38] pt-4">
            <p className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-2">Add Secondary Number</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="tel" placeholder="e.g. +91 98765 43210" value={newSecondary}
                onChange={e => { setNewSecondary(e.target.value); setErrorMsg(""); }}
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition" />
              <button onClick={handleAdd} disabled={!newSecondary.trim() || busy}
                className="px-4 py-2 rounded-xl bg-[#059669] text-white text-[12px] font-semibold hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5 shrink-0">
                {busy && busyOp === "add" ? <Spinner /> : null} Save
              </button>
            </div>
          </div>
        )}

        {errorMsg && <p className="mt-2 text-[11px] text-red-500">{errorMsg}</p>}

        {/* Merge offer */}
        {mergeLead && (
          <div className="mt-3 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 overflow-hidden">
            <div className="px-3 py-2 border-b border-amber-200 dark:border-amber-800">
              <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> <span className="break-words">Number belongs to &quot;{mergeLead.name}&quot;</span>
              </p>
            </div>
            <div className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300 break-words">
              <p>Primary: <span className="font-mono">{mergeLead.primaryPhone || mergeLead.mobile}</span></p>
              {mergeLead.secondaryPhone && <p>Secondary: <span className="font-mono">{mergeLead.secondaryPhone}</span></p>}
            </div>
            {(() => {
              const isAlreadyPrimary = normalizePhone(newSecondary.trim()) === normalizePhone(mergeLead.primaryPhone || mergeLead.mobile || "");
              if (mergeLead.secondaryPhone && !isAlreadyPrimary) {
                return <p className="px-3 pb-2 text-[11px] text-red-500">Cannot merge — that lead already has two numbers.</p>;
              }
              return (
                <div className="px-3 pb-3 space-y-2">
                  {isAlreadyPrimary && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      This number is the <strong>primary</strong> of &quot;{mergeLead.name}&quot;. Click <strong>Merge Data</strong> to combine records.
                    </p>
                  )}
                  {errorMsg && <p className="text-[11px] text-red-500">{errorMsg}</p>}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => { setMergeLead(null); setErrorMsg(""); }}
                      className="flex-1 py-1.5 rounded-lg border border-amber-300 text-[12px] font-semibold text-amber-700 hover:bg-amber-100 transition">Cancel</button>
                    <button onClick={handleMerge} disabled={merging}
                      className="flex-1 py-1.5 rounded-lg bg-amber-500 text-white text-[12px] font-semibold hover:bg-amber-600 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
                      {merging ? "Merging…" : isAlreadyPrimary ? "Merge Data" : "Add as Secondary & Merge"}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38]">
          <button onClick={onClose} className="w-full py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── LeadDrawer ────────────────────────────────────────────────────────────────
// Now accepts `projects` prop and passes it through to UpdateStatusModal.
function LeadDrawer({ lead, onClose, onUpdate, projects = [] }) {
  const [showUpdate,  setShowUpdate]  = useState(false);
  const [showNIModal, setShowNIModal] = useState(false);
  const [showEdit,    setShowEdit]    = useState(false);
  const [showPhone,   setShowPhone]   = useState(false);
  const name  = lead.name || "Unknown";
  const phone = lead.phone || lead.mobile || "—";
  const s = STATUS_CONFIG[lead.status] || STATUS_CONFIG["New"];
  const callHistory    = lead.callHistory    || [];
  const scheduledCalls = lead.scheduledCalls || [];
  const pendingCalls   = scheduledCalls.filter(c => !c.done);
  const fmt = iso => iso ? new Date(iso).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "—";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full sm:max-w-[440px] bg-white dark:bg-[#1A1D27] h-full shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">
          <div className="flex items-start justify-between mb-3 gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black shrink-0" style={{ background: s.dot + "20", color: s.dot }}>
                {name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-[17px] sm:text-[18px] font-bold text-[#0F1117] dark:text-white truncate">{name}</h2>
                <p className="text-[12px] text-[#8B92A9] font-mono">{phone !== "—" ? maskPhone(phone) : "—"}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white transition shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={lead.status} />
            <TempBadge temp={lead.Quality || lead.temperature} />
            {/* Project tags — read-only display in drawer header */}
            {Array.isArray(lead.projects) && lead.projects.length > 0 && lead.projects.map(p => {
              const proj = projects.find(pr => String(pr._id) === String(p?._id || p));
              if (!proj) return null;
              return (
                <span key={String(proj._id)}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                  style={{ background: proj.color || "#2563EB" }}>
                  {proj.name}
                </span>
              );
            })}
            {lead.reassignCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                Reassigned {lead.reassignCount}
              </span>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 grid grid-cols-2 gap-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {[{label:"Source",value:lead.source||"—"},{label:"Campaign",value:lead.campaign||"—"},{label:"Date",value:lead.date||"—"},{label:"Remark",value:lead.remark||"No remark"}].map(item => (
            <div key={item.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-3 min-w-0">
              <p className="text-[9px] font-bold text-[#8B92A9] dark:text-[#D1D5DB] uppercase tracking-widest mb-1">{item.label}</p>
              <p className="text-[12px] font-medium text-[#0F1117] dark:text-white break-words">{item.value}</p>
            </div>
          ))}
        </div>

        {callHistory.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#D1D5DB] uppercase tracking-wide mb-3"> Call History ({callHistory.length})</p>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {callHistory.map((h, i) => (
                <div key={i} className="px-3 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
                  <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold text-[#0F1117] dark:text-white truncate">{h.userName || "Unknown Employee"}</span>
                    <span className="text-[10px] text-[#8B92A9] shrink-0">{fmt(h.calledAt)}</span>
                  </div>
                  <p className="text-[11px] text-[#4B5168] dark:text-[#E5E7EB] break-words">{h.remark}</p>
                  {h.outcome && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">{h.outcome}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingCalls.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#D1D5DB] uppercase tracking-wide mb-3"> Scheduled Follow-ups ({pendingCalls.length} pending)</p>
            <div className="space-y-2">
              {pendingCalls.map((sc, i) => {
                const isPast = new Date(sc.scheduledAt) < new Date();
                return (
                  <div key={i} className={"flex items-center gap-3 px-3 py-2.5 rounded-xl border flex-wrap sm:flex-nowrap " + (isPast ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : "bg-[#F8F9FC] dark:bg-[#13161E] border-[#E4E7EF] dark:border-[#262A38]")}>
                    <span className={"w-2 h-2 rounded-full shrink-0 " + (sc.type === "follow-up" ? "bg-blue-500" : "bg-purple-500")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#0F1117] dark:text-white capitalize">{sc.type}</p>
                      {sc.note && <p className="text-[10px] text-[#8B92A9] break-words">{sc.note}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={"text-[11px] font-semibold " + (isPast ? "text-red-500" : "text-[#4B5168] dark:text-[#E5E7EB]")}>{fmt(sc.scheduledAt)}</p>
                      {isPast && <p className="text-[9px] text-red-400 font-bold">OVERDUE</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-4 sm:px-6 py-4 space-y-2">
          <button onClick={() => setShowUpdate(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            <span className="truncate">Update Status / Lead Quality</span>
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={() => setShowEdit(true)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] text-[13px] font-semibold hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] hover:border-[#2563EB] hover:text-[#2563EB] transition">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              Edit Lead
            </button>
            <button onClick={() => setShowPhone(true)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] text-[13px] font-semibold hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] hover:border-[#059669] hover:text-[#059669] transition">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
              <span className="truncate">{lead.secondaryPhone ? "Manage Numbers" : "+ 2nd Number"}</span>
            </button>
          </div>
          <button onClick={() => setShowNIModal(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 text-[13px] font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30 transition">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            <span className="truncate">Mark Not Interested & Reassign</span>
          </button>
        </div>
        <div className="flex-1" />
      </div>

      {showUpdate && createPortal(
        <UpdateStatusModal
          lead={lead}
          onClose={() => setShowUpdate(false)}
          onNotInterested={() => { setShowUpdate(false); setShowNIModal(true); }}
          projects={projects}
          onSaved={updated => { onUpdate(updated); setShowUpdate(false); }}
        />,
        document.body
      )}
      {showEdit && createPortal(
        <EditLeadModal
          lead={lead}
          onClose={() => setShowEdit(false)}
          onSave={updated => { onUpdate(updated); setShowEdit(false); }}
        />,
        document.body
      )}
      {showPhone && createPortal(
        <PhoneNumbersModal
          lead={lead}
          onClose={() => setShowPhone(false)}
          onLeadUpdated={updated => { onUpdate(updated); }}
        />,
        document.body
      )}
      {showNIModal && createPortal(
        <NotInterestedModal lead={{ ...lead, _id: lead.id || lead._id }} onClose={() => setShowNIModal(false)}
          onSuccess={updatedLead => { onUpdate({ ...updatedLead, _reassigned: true }); setShowNIModal(false); onClose(); }} />,
        document.body
      )}
    </div>
  );
}

// ── Shared phone-format validator (mirrors AdminLeadsPage) ────────────────────
function validatePhoneField(value, label = "Phone") {
  const digits = value.replace(/\D/g, "");
  if (!digits) return `${label} is required.`;
  if (digits.length !== 10) return `${label} must be exactly 10 digits.`;
  if (!/^[6-9]/.test(digits)) return `${label} must start with 6, 7, 8, or 9.`;
  return "";
}

function AddLeadModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    name:           "",
    phone:          "",        // primary
    secondaryPhone: "",        // secondary (optional)
    email:          "",
    source:         "Manual",
    campaign:       "",
    status:         "New",
    remark:         "",
  });
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: "", submit: "" }));
  };

  const validate = () => {
    const e = {};

    // Name
    if (!form.name.trim() || form.name.trim().length < 2)
      e.name = "Name must be at least 2 characters.";

    // Primary phone
    const primaryErr = validatePhoneField(form.phone.trim(), "Phone");
    if (primaryErr) e.phone = primaryErr;

    // Secondary phone (optional, but validate format if provided)
    if (form.secondaryPhone.trim()) {
      const secErr = validatePhoneField(form.secondaryPhone.trim(), "Secondary phone");
      if (secErr) {
        e.secondaryPhone = secErr;
      } else if (
        form.phone.replace(/\D/g, "").slice(-10) ===
        form.secondaryPhone.replace(/\D/g, "").slice(-10)
      ) {
        e.secondaryPhone = "Secondary phone cannot match the primary phone.";
      }
    }

    // Email (optional)
    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    )
      e.email = "Enter a valid email address.";

    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSubmitting(true);
    try {
      const primaryPhone   = form.phone.trim().replace(/\D/g, "");
      const secondaryPhone = form.secondaryPhone.trim().replace(/\D/g, "") || undefined;

      const res = await api.post("/lead", {
        name:           form.name.trim(),
        mobile:         primaryPhone,          // existing field — never remove
        primaryPhone,                          // explicit primary
        ...(secondaryPhone ? { secondaryPhone } : {}),
        email:          form.email.trim() || null,
        source:         form.source,
        campaign:       form.campaign.trim() || null,
        status:         form.status,
        date:           new Date(),
        remark:         form.remark.trim() || "Manually added",
      });

      const saved = res.data;
      onAdd({
        id:             String(saved._id),
        name:           saved.name,
        phone:          saved.mobile || "",
        mobile:         saved.mobile || "",
        email:          saved.email  || "",
        source:         saved.source || "Web Form",
        campaign:       saved.campaign || "—",
        status:         saved.status,
        Quality:        saved.Quality     || null,
        temperature:    saved.temperature || null,
        remark:         saved.remark      || "",
        date:           new Date(saved.date).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                        }),
        _raw_date:      saved.date || saved.createdAt || null,
        callHistory:    [],
        scheduledCalls: [],
        reassignCount:  0,
        projects:       [],
      });
      onClose();
    } catch (err) {
      // Surface backend duplicate-phone (or any) error inline
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error   ||
        "Failed to save lead.";

      // Try to map backend message to a specific field
      const lower = msg.toLowerCase();
      if (lower.includes("secondary") || lower.includes("second")) {
        setErrors(e => ({ ...e, secondaryPhone: msg }));
      } else if (lower.includes("phone") || lower.includes("mobile") || lower.includes("duplicate") || lower.includes("exist")) {
        setErrors(e => ({ ...e, phone: msg }));
      } else {
        setErrors(e => ({ ...e, submit: msg }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const CLS = key =>
    "w-full px-3 py-2.5 rounded-xl border text-[13px] bg-white dark:bg-[#13161E] " +
    "text-[#0F1117] dark:text-white placeholder:text-[#8B92A9] focus:outline-none transition " +
    (errors[key]
      ? "border-red-400 dark:border-red-500"
      : "border-[#E4E7EF] dark:border-[#262A38] focus:border-[#2563EB]");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-white">Add New Lead</h2>
            <p className="text-[11px] text-[#8B92A9]">Assigned to you automatically</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Lead Name *</label>
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              className={CLS("name")}
            />
            {errors.name && <span className="text-[11px] text-red-500">{errors.name}</span>}
          </div>

          {/* Primary Phone */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Phone *</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="10-digit number"
              value={form.phone}
              onChange={e => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              className={CLS("phone")}
            />
            {errors.phone && <span className="text-[11px] text-red-500">{errors.phone}</span>}
          </div>

          {/* Secondary Phone — spans full width so it's visually distinct */}
          <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">
              Secondary Phone
              <span className="ml-1 font-normal normal-case text-[10px]">(optional)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Alternate 10-digit number"
              value={form.secondaryPhone}
              onChange={e => set("secondaryPhone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              className={CLS("secondaryPhone")}
            />
            {errors.secondaryPhone && (
              <span className="text-[11px] text-red-500">{errors.secondaryPhone}</span>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Email</label>
            <input
              type="text"
              placeholder="email@example.com"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              className={CLS("email")}
            />
            {errors.email && <span className="text-[11px] text-red-500">{errors.email}</span>}
          </div>

          {/* Campaign */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Campaign</label>
            <input
              type="text"
              placeholder="Campaign name"
              value={form.campaign}
              onChange={e => set("campaign", e.target.value)}
              className={CLS("campaign")}
            />
          </div>

          {/* Remark — spans full width */}
          <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Remark</label>
            <input
              type="text"
              placeholder="Notes"
              value={form.remark}
              onChange={e => set("remark", e.target.value)}
              className={CLS("remark")}
            />
          </div>

          {/* Source */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Source</label>
            <select
              value={form.source}
              onChange={e => set("source", e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none"
            >
              {["Google Ads","Facebook Ads","Web Form","Referral","Manual","CSV Import","Campaign","Other"].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Status</label>
            <select
              value={form.status}
              onChange={e => set("status", e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none"
            >
              {["New","In Progress","Converted"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

        </div>

        {/* General submit error (backend non-field errors) */}
        {errors.submit && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 mt-3">
            <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-[11px] text-red-600 dark:text-red-400">{errors.submit}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#E5E7EB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving…</>
              : "Add Lead"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

function UserChatWidget() {
  const socketRef = useRef(null);
  const [open, setOpen]               = useState(false);
  const [message, setMessage]         = useState("");
  const [messages, setMessages]       = useState([]);
  const [unread, setUnread]           = useState(0);
  const [editingId, setEditingId]     = useState(null);
  const [editingText, setEditingText] = useState("");
  const bottomRef = useRef(null);
  const user        = JSON.parse(localStorage.getItem("user") || "null");
  const username    = (user && user.name) || "user";
  const companyId   = user?.companyId || user?.company?._id || user?.company || null;
  const adminId     = user?.createdBy || null;

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL.replace(/\/api$/, "") 
    const socket = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = socket;
    const joinPayload = { username, userId: user?._id, company: companyId, adminId, displayName: user?.name };
    const doJoin = () => {
      sharedSocket.current = socket;
      socket.emit("user_join", joinPayload);
      // Bug 1 fix: also join the personal agent room so new_lead_assigned
      // events from leadController reach this browser tab.
      if (user?._id) socket.emit("agent_join", { userId: user._id });
    };
    socket.on("connect", doJoin);
    if (socket.connected) doJoin();
    socket.on("chat_history", history => {
      const isAdminMsg = (from) => from === "admin" || from?.startsWith("admin:") || from?.startsWith("superadmin:");
      setMessages(history.map(m => ({ _id: m._id, from: isAdminMsg(m.from) ? "Admin" : "You", message: m.message, ts: m.timestamp, isDeleted: m.isDeleted || false, editedAt: m.editedAt || null })));
    });
    socket.on("message_saved", data => {
      setMessages(prev => {
        const idx = [...prev].reverse().findIndex(m => m.from === "You" && !m._id);
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        const updated = [...prev];
        updated[realIdx] = { ...updated[realIdx], _id: data._id };
        return updated;
      });
    });
    socket.on("receive_admin_message", data => {
      setMessages(prev => [...prev, { _id: data._id, from: "Admin", message: data.message, isDeleted: false }]);
      setOpen(isOpen => { if (!isOpen) setUnread(n => n + 1); return isOpen; });
    });
    socket.on("message_edited", ({ _id, newText, editedAt }) => {
      setMessages(prev => prev.map(m => m._id?.toString() === _id?.toString() ? { ...m, message: newText, editedAt } : m));
    });
    socket.on("message_deleted", ({ _id }) => {
      setMessages(prev => prev.map(m => m._id?.toString() === _id?.toString() ? { ...m, message: "This message was deleted", isDeleted: true } : m));
    });
    // Bug 3 fix: handle new_lead_assigned — show browser notification + badge
    socket.on("new_lead_assigned", ({ leadName, source }) => {
      setUnread(n => n + 1);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("📋 New Lead Assigned", {
          body: `${leadName || "New Lead"} — ${source || "Web Form"}`,
          icon: "/skyup_logo1.svg",
        });
      }
    });
    return () => { sharedSocket.current = null; socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (open) { setUnread(0); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }
  }, [open, messages]);

  const sendMessage = () => {
    const msg = message.trim();
    if (!msg || !socketRef.current) return;
    socketRef.current.emit("user_message", { message: msg, username });
    setMessages(prev => [...prev, { from: "You", message: msg, isDeleted: false }]);
    setMessage("");
  };
  const startEdit  = m  => { if (m.isDeleted) return; setEditingId(m._id); setEditingText(m.message); };
  const submitEdit = () => { if (!editingText.trim() || !editingId) return; socketRef.current?.emit("edit_message", { _id: editingId, newText: editingText.trim(), requester: username }); setEditingId(null); setEditingText(""); };
  const cancelEdit = () => { setEditingId(null); setEditingText(""); };
  const deleteMsg  = id => { if (!window.confirm("Delete this message?")) return; socketRef.current?.emit("delete_message", { _id: id, requester: username }); };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[calc(100vw-2rem)] max-w-[320px] sm:w-80 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: "min(420px, 70vh)" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-[#2563EB]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[13px] font-semibold text-white">Support Chat</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-[#F8F9FC] dark:bg-[#13161E]">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="mb-2 flex justify-center text-[#8B92A9]"><MessageCircle className="w-7 h-7" strokeWidth={1.5} /></p>
                <p className="text-[12px] text-[#8B92A9]">Hi {user?.name?.split(" ")[0] || "there"}! How can we help?</p>
              </div>
            )}
            {messages.map((m, i) => {
              const isYou = m.from === "You";
              const isEditing = editingId === m._id;
              return (
                <div key={m._id || i} className={"flex group " + (isYou ? "justify-end" : "justify-start")}>
                  <div className="flex flex-col gap-0.5 max-w-[80%]">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus value={editingText} onChange={e => setEditingText(e.target.value)} onKeyDown={e => { if(e.key==="Enter") submitEdit(); if(e.key==="Escape") cancelEdit(); }}
                          className="px-2 py-1 rounded-lg border border-[#2563EB] text-[12px] text-[#0F1117] dark:text-white bg-white dark:bg-[#1A1D27] focus:outline-none w-40" />
                        <button onClick={submitEdit} className="text-[10px] text-[#2563EB] font-semibold hover:underline">Save</button>
                        <button onClick={cancelEdit}  className="text-[10px] text-[#8B92A9] hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <div className={"relative px-3 py-2 rounded-2xl text-[12px] break-words " + (m.isDeleted ? "italic text-[#8B92A9] bg-[#F8F9FC] dark:bg-[#1A1D27] border border-dashed border-[#E4E7EF] dark:border-[#262A38]" : isYou ? "bg-[#2563EB] text-white rounded-br-none" : "bg-white dark:bg-[#1A1D27] text-[#0F1117] dark:text-white rounded-bl-none border border-[#E4E7EF] dark:border-[#262A38]")}>
                        {m.message}
                        {m.editedAt && !m.isDeleted && <span className="text-[9px] opacity-60 ml-1">(edited)</span>}
                        {isYou && !m.isDeleted && m._id && (
                          <div className="absolute top-1 -left-14 hidden group-hover:flex items-center gap-1">
                            <button onClick={() => startEdit(m)} className="w-5 h-5 rounded-full bg-white dark:bg-[#262A38] border border-[#E4E7EF] dark:border-[#3A3F52] flex items-center justify-center text-[#8B92A9] hover:text-[#2563EB] transition shadow-sm">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div className="px-3 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex gap-2 bg-white dark:bg-[#1A1D27]">
            <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if(e.key==="Enter") sendMessage(); }} placeholder="Type a message…"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-white placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition" />
            <button onClick={sendMessage} className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center text-white hover:bg-blue-700 transition shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#2563EB] text-white shadow-lg flex items-center justify-center transition hover:bg-blue-700 hover:scale-105 active:scale-95 shrink-0">
        {open
          ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 11.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        }
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
    </div>
  );
}

function getGreeting() {
  // FIX (clock/timezone bug): .getHours() read the *browser's* local time,
  // so a user whose device/browser wasn't set to IST (e.g. traveling, or a
  // misconfigured system clock) would see "Good evening" at 10am IST. Use
  // the IST wall-clock hour instead, consistent with the rest of the app.
  const h = toIST(new Date()).getUTCHours();
  if (h < 12) return { text: "Good morning", emoji: "" };
  if (h < 17) return { text: "Good afternoon", emoji: "" };
  return { text: "Good evening", emoji: "" };
}

function mapLead(l) {
  // Strip country-code prefix — DB may store "919876543210" from legacy entries or WA webhook.
  // Always display as clean 10-digit number; sending layers add country code back.
  function strip91(raw) {
    if (!raw) return "";
    const d = String(raw).replace(/\D/g, "");
    if (d.startsWith("9191") && d.length === 14) return d.slice(4);
    if (d.startsWith("91")   && d.length === 12) return d.slice(2);
    return d.slice(-10) || String(raw);
  }

  const phone = strip91(l.mobile || l.phone || "");
  return {
    id:             String(l._id),
    name:           l.name           || "Unknown",
    phone,
    mobile:         phone,
    primaryPhone:   strip91(l.primaryPhone || l.mobile || l.phone || ""),
    secondaryPhone: l.secondaryPhone ? strip91(l.secondaryPhone) : "",
    source:         l.source         || "—",
    campaign:       l.campaign       || "—",
    status:         l.status         || "New",
    Quality:        l.temperature    || l.Quality    || null,
    temperature:    l.temperature    || l.Quality    || null,
    remark:         l.remark         || "",
    date:           l.date ? new Date(l.date).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "—",
    _raw_date:      l.date           || l.createdAt || null,
    callHistory:    Array.isArray(l.callHistory)    ? l.callHistory    : [],
    scheduledCalls: Array.isArray(l.scheduledCalls) ? l.scheduledCalls : [],
    previousAgents: Array.isArray(l.previousAgents) ? l.previousAgents : [],
    reassignCount:  l.reassignCount  || 0,
    projects:       Array.isArray(l.projects) ? l.projects : [],
  };
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
// ── ProjectsCard — sits next to Lead Quality, shows list → detail on click ────
function ProjectsCard({ projects, leads, projectFilter, setProjectFilter, setActiveTab, setPage }) {
  const [activeProj, setActiveProj] = useState(null);

  // Keep activeProj in sync if projects list changes
  useEffect(() => {
    if (activeProj) {
      const updated = projects.find(p => p._id === activeProj._id);
      if (updated) setActiveProj(updated);
      else setActiveProj(null);
    }
  }, [projects]);

  const projLeadsFor = (p) =>
    leads.filter(l =>
      Array.isArray(l.projects) &&
      l.projects.some(lp => String(lp?._id || lp) === String(p._id))
    );

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 sm:p-5 flex flex-col" style={{ minHeight: 220 }}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        {activeProj && (
          <button
            onClick={() => setActiveProj(null)}
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] transition shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
        )}
        <p className="text-[12px] font-bold text-[#0F1117] dark:text-white uppercase tracking-wide flex-1 truncate">
          {activeProj ? activeProj.name : "My Projects"}
        </p>
        {!activeProj && (
          <span className="text-[10px] font-semibold text-[#8B92A9] bg-[#F1F4FF] dark:bg-[#262A38] px-2 py-0.5 rounded-full shrink-0">
            {projects.length}
          </span>
        )}
        {activeProj && (
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: activeProj.color || "#2563EB" }} />
        )}
      </div>

      {/* ── Detail view ── */}
      {activeProj ? (() => {
        const p         = activeProj;
        const projLeads = projLeadsFor(p);
        const hot       = projLeads.filter(l => l.Quality === "Hot"  || l.temperature === "Hot").length;
        const warm      = projLeads.filter(l => l.Quality === "Warm" || l.temperature === "Warm").length;
        const cold      = projLeads.filter(l => l.Quality === "Cold" || l.temperature === "Cold").length;
        const converted = projLeads.filter(l => l.status === "Converted").length;
        const inProg    = projLeads.filter(l => l.status === "In Progress").length;
        const newL      = projLeads.filter(l => l.status === "New").length;
        const convPct   = projLeads.length > 0 ? Math.round(converted / projLeads.length * 100) : 0;
        const isFiltered = projectFilter === String(p._id);

        return (
          <div className="flex-1 flex flex-col gap-2.5">
            {/* Description */}
            {p.description
              ? <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] leading-snug break-words">{p.description}</p>
              : <p className="text-[11px] text-[#C4C9D9] dark:text-[#3E4257] italic">No description added</p>
            }

            {/* Stat rows */}
            <div className="space-y-1.5">
              {[
                { label: "Total Leads", value: projLeads.length, color: "#2563EB" },
                { label: "Converted",   value: converted,         color: "#059669" },
                { label: "In Progress", value: inProg,            color: "#D97706" },
                { label: "New",         value: newL,              color: "#8B92A9" },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB]">{s.label}</span>
                  <span className="text-[12px] font-bold" style={{ color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Quality pills */}
            {(hot > 0 || warm > 0 || cold > 0) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {hot  > 0 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-500 inline-flex items-center gap-0.5"><Flame className="w-2.5 h-2.5" /> {hot} Hot</span>}
                {warm > 0 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 inline-flex items-center gap-0.5"><Sun className="w-2.5 h-2.5" /> {warm} Warm</span>}
                {cold > 0 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-500 inline-flex items-center gap-0.5"><Snowflake className="w-2.5 h-2.5" /> {cold} Cold</span>}
              </div>
            )}

            {/* Conversion bar */}
            <div>
              <div className="flex justify-between text-[10px] text-[#8B92A9] mb-1">
                <span>Conversion rate</span>
                <span className="font-bold" style={{ color: p.color || "#2563EB" }}>{convPct}%</span>
              </div>
              <div className="h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: convPct + "%", background: p.color || "#2563EB" }} />
              </div>
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => {
                setProjectFilter(isFiltered ? "All" : String(p._id));
                setActiveTab("leads");
                setPage(1);
              }}
              className="mt-auto w-full py-2 rounded-xl text-[11px] font-semibold transition border"
              style={{
                background:  isFiltered ? (p.color || "#2563EB") : "transparent",
                borderColor: p.color || "#2563EB",
                color:       isFiltered ? "#fff" : (p.color || "#2563EB"),
              }}
            >
              {isFiltered ? "✓ Filtering leads — click to clear" : "Filter leads by this project"}
            </button>
          </div>
        );
      })() : (

        /* ── List view ── */
        projects.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-4">
            <svg className="w-8 h-8 text-[#E4E7EF] dark:text-[#262A38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">No projects assigned yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {projects.map(p => {
              const count = projLeadsFor(p).length;
              return (
                <button
                  key={p._id}
                  onClick={() => setActiveProj(p)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition group text-left"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || "#2563EB" }} />
                  <span className="flex-1 text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate group-hover:text-[#2563EB] dark:group-hover:text-[#4F8EF7] transition">
                    {p.name}
                  </span>
                  {count > 0 && (
                    <span className="text-[10px] font-bold text-[#8B92A9] shrink-0 bg-[#F1F4FF] dark:bg-[#262A38] px-1.5 py-0.5 rounded-full">
                      {count}
                    </span>
                  )}
                  <svg className="w-3 h-3 text-[#C4C9D9] dark:text-[#3E4257] shrink-0 group-hover:text-[#2563EB] transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ── TelegramSetupWidget — employee sets their own Telegram chat ID ────────────
// Appears as a send-icon button in the sub-header.
// On click opens a small popover to enter and save their personal chat ID.
// When saved, lead assignment notifications will be sent to their Telegram chat.
function TelegramSetupWidget({ user }) {
  const [open,    setOpen]    = useState(false);
  const [chatId,  setChatId]  = useState(() => user?.telegramChatId || "");
  const [draft,   setDraft]   = useState(() => user?.telegramChatId || "");
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState({ type: "", text: "" });
  const popRef  = useRef(null);
  const btnRef  = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popRef.current && !popRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const flash = (type, text) => {
    setMsg({ type, text });
    if (type === "ok") setTimeout(() => setMsg({ type: "", text: "" }), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/auth/my-telegram", { telegramChatId: draft.trim() });
      setChatId(draft.trim());
      flash("ok", "Saved! You'll now receive lead notifications on Telegram.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Save failed.");
    } finally { setSaving(false); }
  };

  const isConfigured = !!chatId;
  const hasChanges   = draft !== chatId;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        title={isConfigured ? "Telegram notifications active" : "Set up Telegram notifications"}
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all shrink-0 ${
          open
            ? "bg-sky-50 dark:bg-sky-500/15 border-sky-300 dark:border-sky-700 text-sky-600"
            : "border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#6B7280] hover:text-sky-500 hover:border-sky-300"
        }`}
      >
        {/* Send/paper-plane icon */}
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
        </svg>
        {isConfigured && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white dark:border-[#1A1D27]" />
        )}
      </button>

      {open && (
        <div
          ref={popRef}
          className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-auto sm:top-full mt-2 w-auto sm:w-[300px] max-w-full bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-xl z-[500] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-[#F0F2FA] dark:border-[#262A38]">
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Lead Notifications</p>
              <p className="text-[10px] text-[#8B92A9]">Telegram — personal alerts</p>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto w-6 h-6 flex items-center justify-center rounded-lg text-[#8B92A9] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold flex-wrap ${
              isConfigured
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
            }`}>
              <span className="inline-flex items-center gap-1">{isConfigured ? <><Check className="w-3 h-3" /> Active</> : <><AlertTriangle className="w-3 h-3" /> Not configured</>}</span>
              <span className="font-normal opacity-75">
                {isConfigured ? "You'll receive lead notifications on Telegram" : "Add your chat ID to get notified when leads are assigned"}
              </span>
            </div>

            {/* Chat ID input */}
            <div>
              <label className="block text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-1.5">
                Your Telegram Chat ID
                {isConfigured && <span className="ml-1.5 text-[10px] font-normal text-emerald-500">● set</span>}
              </label>
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
                placeholder="e.g. 123456789"
                className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] font-mono focus:outline-none focus:border-[#2563EB] transition"
              />
              <p className="text-[10px] text-[#8B92A9] mt-1">
                Message <span className="font-mono font-semibold">@userinfobot</span> on Telegram to get your ID
              </p>
            </div>

            {/* Feedback */}
            {msg.text && (
              <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-medium ${
                msg.type === "ok"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-950/30 text-red-600 border border-red-200 dark:border-red-800"
              }`}>
                {msg.type === "ok" ? "✓" : "✕"} {msg.text}
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="w-full py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-[12px] font-semibold transition flex items-center justify-center gap-1.5"
            >
              {saving
                ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              }
              {saving ? "Saving…" : isConfigured ? "Update" : "Save Chat ID"}
            </button>

            {/* What triggers notifications */}
            <div className="border-t border-[#F0F2FA] dark:border-[#262A38] pt-2">
              <p className="text-[10px] text-[#8B92A9] font-semibold mb-1">You'll be notified when:</p>
              {["A new lead is assigned to you", "A lead is reassigned to you"].map(t => (
                <p key={t} className="text-[10px] text-[#8B92A9] flex items-center gap-1.5">
                  <svg className="w-2.5 h-2.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  {t}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserDashboard() {
  const user     = JSON.parse(localStorage.getItem("user") || "null");
  const greeting = getGreeting();
  const [leads,         setLeads]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [selected,      setSelected]      = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterSt,      setFilterSt]      = useState("All");
  const [filterTemp,    setFilterTemp]    = useState("All");
  const [sortBy,        setSortBy]        = useState("date_desc");
  const [page,          setPage]          = useState(1);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editLead,      setEditLead]      = useState(null);
  const [phoneLead,     setPhoneLead]     = useState(null);
  const [activeTab,     setActiveTab]     = useState("leads");
  const [csvImporting,  setCsvImporting]  = useState(false);
  const [csvResult,     setCsvResult]     = useState(null);

  // ── Projects (read-only — admin-created, used for filtering + tagging) ────
  const [projects,      setProjects]      = useState([]);
  const [projectFilter, setProjectFilter] = useState("All");

  const PER_PAGE = 10;

  const fetchLeads = useCallback(() => {
    setLoading(true);
    // Backend /lead/my-leads returns { leads[], total, page, pages } and caps
    // each page at a limit (default 200). FIX: fetch every page and combine so
    // dashboard KPIs are accurate for users with more than one page of leads
    // (previously only the first 200 were counted).
    const PAGE_LIMIT = 200;
    api.get(`/lead/my-leads?page=1&limit=${PAGE_LIMIT}`)
      .then(async res => {
        const firstLeads = Array.isArray(res.data)
          ? res.data
          : (res.data?.leads || res.data?.data || []);
        const pages = res.data?.pages ?? 1;

        let raw = firstLeads;
        if (pages > 1) {
          const rest = await Promise.all(
            Array.from({ length: pages - 1 }, (_, i) =>
              api
                .get(`/lead/my-leads?page=${i + 2}&limit=${PAGE_LIMIT}`)
                .then(r => (Array.isArray(r.data) ? r.data : (r.data?.leads || r.data?.data || []))),
            ),
          );
          raw = [firstLeads, ...rest].flat();
        }

        setLeads(raw.map(mapLead));
        setError("");
      })
      .catch(() => setError("Failed to load your leads. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Fetch admin-created projects (global ones visible to users)
  useEffect(() => {
    api.get("/project")
      .then(res => setProjects(Array.isArray(res.data) ? res.data : []))
      .catch(() => setProjects([]));
  }, []);

  const kpi = useMemo(() => {
    const total        = leads.length;
    const todayLeads   = leads.filter(l => isToday(l.date)).length;
    const weekLeads    = leads.filter(l => isThisWeek(l.date)).length;
    const converted    = leads.filter(l => l.status === "Converted").length;
    const inProgress   = leads.filter(l => l.status === "In Progress").length;
    const notInt       = leads.filter(l => l.status === "Not Interested").length;
    const newLeads     = leads.filter(l => l.status === "New").length;
    const hot          = leads.filter(l => l.Quality === "Hot").length;
    const warm         = leads.filter(l => l.Quality === "Warm").length;
    const cold         = leads.filter(l => l.Quality === "Cold").length;
    const unclassified = leads.filter(l => !l.Quality).length;
    const convRate     = total > 0 ? Math.round((converted / total) * 100) : 0;
    const weekLabels   = [];
    const weekData     = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      weekLabels.push(["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()]);
      weekData.push(leads.filter(l => parseDate(l.date).toDateString() === d.toDateString()).length);
    }
    return { total, todayLeads, weekLeads, converted, inProgress, notInt, newLeads, hot, warm, cold, unclassified, convRate, weekLabels, weekData };
  }, [leads]);

  const displayed = useMemo(() => {
    let res = leads.filter(l => {
      const q            = search.toLowerCase();
      const matchSearch  = !q || l.name.toLowerCase().includes(q) || (l.phone||"").includes(q) || (l.campaign||"").toLowerCase().includes(q);
      const matchSt      = filterSt   === "All" || l.status  === filterSt;
      const matchTemp    = filterTemp === "All" || l.Quality === filterTemp;
      const matchProject = projectFilter === "All" || (Array.isArray(l.projects) && l.projects.some(p => (p?._id || p) === projectFilter));
      return matchSearch && matchSt && matchTemp && matchProject;
    });
    return res.slice().sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b._raw_date||0) - new Date(a._raw_date||0);
      if (sortBy === "date_asc")  return new Date(a._raw_date||0) - new Date(b._raw_date||0);
      if (sortBy === "name_asc")  return a.name.localeCompare(b.name);
      if (sortBy === "status")    return a.status.localeCompare(b.status);
      return 0;
    });
  }, [leads, search, filterSt, filterTemp, projectFilter, sortBy]);

  const totalPages     = Math.ceil(displayed.length / PER_PAGE);
  const paged          = displayed.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const recentActivity = useMemo(() => leads.slice().sort((a,b) => new Date(b._raw_date||0) - new Date(a._raw_date||0)).slice(0, 8), [leads]);

  const handleUpdate = updated => {
    if (updated._reassigned) { setLeads(prev => prev.filter(l => l.id !== (updated.id || String(updated._id)))); setSelected(null); return; }
    // Merge: remove the absorbed source lead from the list, update the survivor
    if (updated._mergedAbsorbedId) {
      const absorbedId = String(updated._mergedAbsorbedId);
      setLeads(prev => prev.filter(l => l.id !== absorbedId));
      if (selected?.id === absorbedId) setSelected(null);
      if (phoneLead?.id === absorbedId) setPhoneLead(null);
    }
    const norm = {
      ...updated,
      id: updated.id || String(updated._id),
      Quality: updated.temperature || updated.Quality || null,
      temperature: updated.temperature || updated.Quality || null,
      // Preserve updated projects array so table tags refresh immediately
      projects: Array.isArray(updated.projects) ? updated.projects : (updated.projects || []),
    };
    setLeads(prev => prev.map(l => l.id === norm.id ? { ...l, ...norm } : l));
    if (selected?.id === norm.id) setSelected(s => ({ ...s, ...norm }));
  };

  const handleAddLead  = newLead => { setLeads(prev => [newLead, ...prev]); setPage(1); };
  const handleDeleteLead = async id => {
    try { await api.delete("/lead/" + id); setLeads(prev => prev.filter(l => l.id !== id)); if (selected?.id === id) setSelected(null); }
    catch { /* ignore */ } finally { setDeleteConfirm(null); }
  };

  // ── CSV template download ─────────────────────────────────────────────────
  const downloadCSVTemplate = () => {
    const headers = ["name", "mobile", "email", "source", "campaign", "status", "remark"];
    const blob = new Blob([headers.join(",")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: "leads_import_template.csv",
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── CSV import ────────────────────────────────────────────────────────────
  const handleImportCSV = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setCsvImporting(true);
    setCsvResult(null);

    try {
      const text  = await file.text();
      const lines = text.trim().split("\n").map(l => l.replace(/\r$/, "")).filter(Boolean);
      if (lines.length < 2) {
        setCsvResult({ error: "CSV must have a header row and at least one data row." });
        setCsvImporting(false);
        return;
      }

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

      const existingNormalized = new Set(
        leads.map(l => normalizeForDupCheck(l.phone || l.mobile)).filter(Boolean)
      );

      const seenInFile    = new Set();
      const leadsToImport = [];
      const clientErrors  = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row    = {};
        headers.forEach((h, idx) => { row[h] = (values[idx] || "").trim(); });

        const rawName   = row.name || row["full name"] || row["fullname"] || row["full_name"] || row["contact name"] || row["contact"] || "";
        const rawMobile = row.mobile || row.phone || row["phone number"] || row["phonenumber"] || row["mobile number"] || row["mobile_number"] || row["phone_number"] || row["contact number"] || row["contact_number"] || row["number"] || "";

        if (!rawName && !rawMobile) continue;

        const cleanMobile = rawMobile.replace(/\D/g, "");
        if (!cleanMobile) {
          clientErrors.push({ index: i, row: rawName || `Row ${i}`, message: "Mobile number missing or unrecognised column." });
          continue;
        }

        const normMobile = normalizeForDupCheck(cleanMobile);

        if (seenInFile.has(normMobile)) {
          clientErrors.push({ index: i, row: rawName || `Row ${i}`, message: `Duplicate in CSV: ${rawMobile} appears more than once.` });
          continue;
        }
        seenInFile.add(normMobile);

        if (existingNormalized.has(normMobile)) {
          clientErrors.push({ index: i, row: rawName || `Row ${i}`, message: `${rawMobile} already exists in your leads — skipped.` });
          continue;
        }

        leadsToImport.push({
          name:     rawName || "Unknown",
          mobile:   cleanMobile,
          email:    row.email    || "",
          source:   row.source   || "CSV Import",
          campaign: row.campaign || "",
          status:   row.status   || "New",
          date:     row.date     || null,
          remark:   row.remark   || row.notes || "Imported via CSV",
        });
      }

      if (!leadsToImport.length) {
        setCsvResult({
          error:        "No new leads to import — all rows were either invalid or already exist in your CRM.",
          errorDetails: clientErrors,
        });
        setCsvImporting(false);
        return;
      }

      const res = await api.post("/lead/import-csv", { leads: leadsToImport });
      const imported = res.data.saved || [];

      setLeads(prev => [...imported.map(mapLead), ...prev]);
      setPage(1);

      const serverErrors = (res.data.errors || []).map(e => ({
        index:   e.index,
        row:     e.row    || e.name || "Unknown",
        message: e.message || "Rejected by server.",
      }));
      const allErrors = [...clientErrors, ...serverErrors];

      setCsvResult({
        saved:        res.data.savedCount || imported.length,
        errors:       allErrors.length,
        total:        leadsToImport.length + clientErrors.length,
        errorDetails: allErrors,
      });

    } catch (err) {
      setCsvResult({ error: err.response?.data?.message || "Import failed. Please try again." });
    } finally {
      setCsvImporting(false);
    }
  };

  const initials = user?.name ? user.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase() : "U";

  return (
    <div className="min-h-screen bg-[#F0F4FF] dark:bg-[#0D0F14]">
      {/* ── Sub-header ── */}
<div className="relative px-4 sm:px-6 py-4 bg-white dark:bg-[#1A1D27] border-b border-[#E4E7EF] dark:border-[#262A38] shadow-sm overflow-visible">
  <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <p className="text-[#8B92A9] dark:text-[#D1D5DB] text-[11px] sm:text-[12px] font-medium">{greeting.emoji} {greeting.text}</p>
              <h1 className="text-[18px] sm:text-[22px] font-black text-[#0F1117] dark:text-white mt-0.5 break-words">
                {user?.name || "Employee"}
                <span className="text-[#8B92A9] dark:text-[#D1D5DB] text-[13px] sm:text-[16px] font-normal ml-2 block sm:inline">— My Workspace</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] sm:text-[13px] font-semibold hover:bg-blue-700 transition">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              <span className="whitespace-nowrap">Add Lead</span>
            </button>

            {/* CSV import / template */}
            <div className="flex items-center rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
              <label className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-[#4B5168] dark:text-[#E5E7EB] text-[11px] sm:text-[13px] font-semibold hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition cursor-pointer border-r border-[#E4E7EF] dark:border-[#262A38] ${csvImporting ? "opacity-60 cursor-not-allowed" : ""}`}>
                <input type="file" accept=".csv" className="hidden" disabled={csvImporting} onChange={handleImportCSV}/>
                {csvImporting
                  ? <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                }
                <span className="whitespace-nowrap">{csvImporting ? "Importing…" : "Import CSV"}</span>
              </label>
              <button onClick={downloadCSVTemplate} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-[#2563EB] dark:text-[#4F8EF7] text-[11px] sm:text-[12px] font-semibold hover:bg-[#EEF3FF] dark:hover:bg-[#1A2540] transition whitespace-nowrap">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Template
              </button>
            </div>

            <AttendanceMiniWidget />

            {/* Telegram self-setup */}
            <TelegramSetupWidget user={user} />

            {/* CSV result toast */}
            {csvResult && (
              <div className={`flex flex-col gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold border w-full sm:max-w-xs
                ${csvResult.error || csvResult.saved === 0
                  ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                  : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"}`}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="break-words">
                  {csvResult.error
                    ? csvResult.error
                    : `${csvResult.saved > 0 ? "✓ " : ""}${csvResult.saved}/${csvResult.total} imported${csvResult.errors > 0 ? ` · ${csvResult.errors} skipped` : ""}`}
                  </span>
                  <button onClick={() => setCsvResult(null)} className="ml-1 opacity-70 hover:opacity-100 shrink-0">✕</button>
                </div>
                {csvResult.errorDetails?.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5 text-[10px] font-normal opacity-90">
                    {csvResult.errorDetails.slice(0, 5).map((e, i) => (
                      <li key={i} className="break-words">Row {e.index} ({e.row}): {e.message}</li>
                    ))}
                    {csvResult.errorDetails.length > 5 && (
                      <li>…and {csvResult.errorDetails.length - 5} more skipped.</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[13px] font-black text-[#2563EB] dark:text-[#4F8EF7] border border-[#C7D7FF] dark:border-[#2D3A6B] shrink-0">{initials}</div>
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="flex items-center gap-3 sm:gap-6 mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex-wrap">
          {[
            { label:"My Total Leads", value:kpi.total,          color:"text-[#0F1117] dark:text-white" },
            { label:"Today",          value:kpi.todayLeads,     color:"text-[#2563EB] dark:text-[#4F8EF7]" },
            { label:"This Week",      value:kpi.weekLeads,      color:"text-[#2563EB] dark:text-[#4F8EF7]" },
            { label:"Converted",      value:kpi.converted,      color:"text-[#059669] dark:text-[#34D399]" },
            { label:"Conv. Rate",     value:kpi.convRate + "%", color:"text-[#059669] dark:text-[#34D399]" },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-1.5 sm:gap-2">
              <span className={"text-[15px] sm:text-[18px] font-black " + stat.color}>{stat.value}</span>
              <span className="text-[11px] sm:text-[14px] text-[#8B92A9] dark:text-[#D1D5DB] font-medium whitespace-nowrap">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-[12px] font-medium flex-wrap">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span className="break-words">{error}</span>
            <button onClick={fetchLeads} className="ml-auto text-red-600 underline underline-offset-2 font-semibold shrink-0">Retry</button>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard label="My Total Leads" value={kpi.total}      sub="All assigned to you"             color="#2563EB" icon={<UsersIcon className="w-5 h-5"/>} />
          <KpiCard label="Converted"      value={kpi.converted}  sub={kpi.convRate + "% success rate"} color="#059669" icon={<CheckIcon className="w-5 h-5"/>} trendUp={kpi.convRate > 20} trend={kpi.convRate + "% rate"} />
          <KpiCard label="In Progress"    value={kpi.inProgress} sub="Awaiting follow-up"              color="#D97706" icon={<LoaderIcon className="w-5 h-5"/>} />
          <KpiCard label="Hot Leads"      value={kpi.hot}        sub="Call these first!"               color="#DC2626" icon={<FlameIcon className="w-5 h-5"/>} />
        </div>

        {/* Targets + Quality + Projects — 3-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">

          {/* Daily Targets */}
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 sm:p-5">
            <p className="text-[13px] sm:text-[14px] font-bold text-[#0F1117] dark:text-white uppercase tracking-wide mb-4"> My Daily Targets</p>
            <div className="flex items-center justify-around flex-wrap gap-3">
              <RadialProgress value={kpi.todayLeads} max={10} color="#2563EB" label="Leads" size={80} />
              <RadialProgress value={leads.filter(l => isToday(l.date) && l.status==="Converted").length} max={5} color="#059669" label="Convert" size={80} />
              <RadialProgress value={leads.filter(l => isToday(l.date) && l.status==="In Progress").length} max={8} color="#D97706" label="Active" size={80} />
            </div>
            <p className="text-[9px] text-center text-[#8B92A9] dark:text-[#D1D5DB] mt-3 font-medium uppercase tracking-wide">Targets: 10 leads · 5 conversions · 8 follow-ups</p>
          </div>

          {/* Lead Quality */}
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 sm:p-5">
            <p className="text-[12px] font-bold text-[#0F1117] dark:text-white uppercase tracking-wide mb-4">Lead Quality</p>
            <div className="space-y-3">
              {[{label:"Hot",color:"#DC2626",icon:"",count:kpi.hot},{label:"Warm",color:"#D97706",icon:"",count:kpi.warm},{label:"Cold",color:"#2563EB",icon:"",count:kpi.cold},{label:"Unclassified",color:"#8B92A9",icon:"—",count:kpi.unclassified}].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-4 text-center text-[14px] shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[13px] sm:text-[14px] mb-0.5 gap-2">
                      <span className="font-semibold text-[#0F1117] dark:text-white truncate">{item.label}</span>
                      <span className="font-bold shrink-0" style={{ color: item.color }}>{item.count}</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: (kpi.total > 0 ? (item.count/kpi.total)*100 : 0) + "%", background: item.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* My Projects — list + detail panel */}
          <ProjectsCard projects={projects} leads={leads} projectFilter={projectFilter} setProjectFilter={setProjectFilter} setActiveTab={setActiveTab} setPage={setPage} />

        </div>
        {/* Status filter pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label:"New",            count:kpi.newLeads,   color:"#2563EB", bg:"bg-blue-100 dark:bg-blue-950/70",      icon:"" },
            { label:"In Progress",    count:kpi.inProgress, color:"#D97706", bg:"bg-amber-50 dark:bg-amber-950/30",     icon:"" },
            { label:"Converted",      count:kpi.converted,  color:"#059669", bg:"bg-emerald-50 dark:bg-emerald-950/30", icon:"" },
            { label:"Not Interested", count:kpi.notInt,     color:"#DC2626", bg:"bg-red-50 dark:bg-red-950/30",         icon:"" },
          ].map(item => (
            <button key={item.label}
              onClick={() => { setFilterSt(filterSt === item.label ? "All" : item.label); setActiveTab("leads"); setPage(1); }}
              className={item.bg + " rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3 border-2 transition hover:scale-[1.01] min-w-0 " + (filterSt === item.label ? "" : "border-transparent")}
              style={{ borderColor: filterSt === item.label ? item.color : undefined }}>
              <span className="text-[16px] sm:text-[18px] shrink-0">{item.icon}</span>
              <div className="text-left min-w-0">
                <p className="text-[16px] sm:text-[18px] font-black" style={{ color: item.color }}>{item.count}</p>
                <p className="text-[12px] sm:text-[14px] font-semibold text-[#8B92A9] leading-tight truncate">{item.label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Leads / Activity table */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
          <div className="flex items-center border-b border-[#E4E7EF] dark:border-[#262A38] px-3 sm:px-5 flex-wrap">
            {[{id:"leads",label:"My Leads",count:displayed.length},{id:"activity",label:"Recent Activity",count:recentActivity.length}].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={"flex items-center gap-2 px-3 sm:px-4 py-3 sm:py-4 text-[11px] sm:text-[12px] font-semibold border-b-2 transition whitespace-nowrap " + (activeTab === tab.id ? "border-[#2563EB] text-[#2563EB] dark:text-[#4F8EF7]" : "border-transparent text-[#8B92A9] dark:text-[#D1D5DB] hover:text-[#0F1117] dark:hover:text-white")}>
                {tab.label}
                <span className={"px-1.5 py-0.5 rounded-full text-[12px] sm:text-[14px] font-bold " + (activeTab === tab.id ? "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7]" : "bg-[#F1F4FF] dark:bg-[#1E2130] text-[#8B92A9]")}>{tab.count}</span>
              </button>
            ))}
            {activeTab === "leads" && (
              <div className="w-full lg:w-auto lg:ml-auto flex items-center gap-2 py-2 flex-wrap">
                <div className="relative flex-1 min-w-[120px] sm:flex-none">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…"
                    className="pl-7 pr-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] sm:text-[14px] text-[#0F1117] dark:text-white placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] w-full sm:w-36 transition" />
                </div>
                <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }} className="px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] sm:text-[14px] text-[#0F1117] dark:text-white focus:outline-none">
                  <option value="date_desc">Newest</option><option value="date_asc">Oldest</option><option value="name_asc">Name A–Z</option><option value="status">By Status</option>
                </select>
                {/* Project filter */}
                {projects.length > 0 && (
                  <select value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(1); }}
                    className="px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] sm:text-[14px] text-[#0F1117] dark:text-white focus:outline-none">
                    <option value="All">All Projects</option>
                    {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                )}
                {(search || filterSt !== "All" || filterTemp !== "All" || projectFilter !== "All") && (
                  <button onClick={() => { setSearch(""); setFilterSt("All"); setFilterTemp("All"); setProjectFilter("All"); setPage(1); }} className="px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[13px] sm:text-[14px] text-[#8B92A9] hover:text-red-500 hover:border-red-300 transition font-semibold">✕ Clear</button>
                )}
              </div>
            )}
          </div>

          {activeTab === "leads" && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-[#8B92A9]">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  <span className="text-[14px]">Loading your leads…</span>
                </div>
              ) : paged.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
                  <p className="text-[16px] sm:text-[18px] font-semibold text-[#0F1117] dark:text-white">{leads.length === 0 ? "No leads yet" : "No leads match your filters"}</p>
                  <p className="text-[13px] sm:text-[14px] text-[#8B92A9]">{leads.length === 0 ? "Add your first lead to get started." : "Try adjusting your search or filters."}</p>
                  {leads.length === 0 && <button onClick={() => setShowAddModal(true)} className="mt-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold hover:bg-blue-700 transition">+ Add First Lead</button>}
                </div>
              ) : (
                <>
                {/* ── Mobile card list (< md) ── */}
                <div className="md:hidden divide-y divide-[#F1F4FF] dark:divide-[#1E2130]">
                  {paged.map(l => {
                    const sc = STATUS_CONFIG[l.status] || STATUS_CONFIG["New"];
                    return (
                      <div key={l.id} className="p-4 active:bg-[#F8F9FC] dark:active:bg-[#13161E] transition" onClick={() => setSelected(l)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{ background: sc.dot + "20", color: sc.dot }}>
                              {l.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[13px] text-[#0F1117] dark:text-white truncate">{l.name}{l.reassignCount > 0 && <span className="ml-1.5 text-[11px] font-bold text-purple-500">↻{l.reassignCount}</span>}</p>
                              <p className="text-[11px] font-mono text-[#4B5168] dark:text-[#E5E7EB]">{l.phone ? maskPhone(l.phone) : "—"}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <StatusBadge status={l.status} />
                            {isToday(l.date) && <span className="text-[9px] font-bold text-emerald-500">TODAY</span>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2.5 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <TempBadge temp={l.Quality} />
                            <span className="text-[10px] text-[#8B92A9] truncate">{l.campaign !== "—" ? l.campaign : l.source} · {l.date}</span>
                          </div>
                        </div>
                        {Array.isArray(l.projects) && l.projects.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {l.projects.map(p => {
                              const proj = projects.find(pr => String(pr._id) === String(p?._id || p));
                              if (!proj) return null;
                              return (
                                <span key={String(proj._id)} className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold text-white" style={{ background: proj.color || "#2563EB" }}>{proj.name}</span>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <button onClick={e => { e.stopPropagation(); setSelected(l); }} className="flex-1 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] text-[11px] font-semibold gap-1 active:bg-[#EEF3FF] dark:active:bg-[#1A2540] transition">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg> View
                          </button>
                          <button onClick={e => { e.stopPropagation(); setEditLead(l); }} className="flex-1 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] text-[11px] font-semibold gap-1 active:bg-[#EEF3FF] dark:active:bg-[#1A2540] transition">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> Edit
                          </button>
                          <button onClick={e => { e.stopPropagation(); setPhoneLead(l); }} className="flex-1 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] text-[11px] font-semibold gap-1 active:bg-emerald-50 dark:active:bg-emerald-950/20 transition">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg> Phone
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Desktop / tablet table (>= md) ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                        {["Lead","Phone","Campaign / Source","Date","Status","Lead Quality","Projects",""].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[14px] font-bold text-[#8B92A9] dark:text-[#D1D5DB] uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white dark:divide-[#1E2130]">
                      {paged.map(l => {
                        const sc = STATUS_CONFIG[l.status] || STATUS_CONFIG["New"];
                        return (
                          <tr key={l.id} className="hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition cursor-pointer group" onClick={() => setSelected(l)}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: sc.dot + "20", color: sc.dot }}>
                                  {l.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-semibold text-[#0F1117] dark:text-white whitespace-nowrap">{l.name}</span>
                                  {l.reassignCount > 0 && <span className="ml-1.5 text-[14px] font-bold text-purple-500">{l.reassignCount}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-[#4B5168] dark:text-[#E5E7EB]">{l.phone ? maskPhone(l.phone) : "—"}</td>
                            <td className="px-4 py-3">
                              <p className="text-[#0F1117] dark:text-white font-medium truncate max-w-[120px]">{l.campaign !== "—" ? l.campaign : l.source}</p>
                              {l.campaign !== "—" && <p className="text-[14px] text-[#8B92A9]">{l.source}</p>}
                            </td>
                            <td className="px-4 py-3 text-[#8B92A9] dark:text-white whitespace-nowrap">
                              <p>{l.date}</p>
                              {isToday(l.date) && <span className="text-[14px] font-bold text-emerald-500">TODAY</span>}
                            </td>
                            <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                            <td className="px-4 py-3"><TempBadge temp={l.Quality} /></td>
                            <td className="px-4 py-3">
                              {/* Read-only project tags — assigned by admin or updated by user */}
                              <div className="flex flex-wrap gap-1">
                                {Array.isArray(l.projects) && l.projects.length > 0
                                  ? l.projects.map(p => {
                                      const proj = projects.find(pr => String(pr._id) === String(p?._id || p));
                                      if (!proj) return null;
                                      return (
                                        <span key={String(proj._id)}
                                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white whitespace-nowrap"
                                          style={{ background: proj.color || "#2563EB" }}>
                                          {proj.name}
                                        </span>
                                      );
                                    })
                                  : <span className="text-[11px] text-[#C4C9D9] dark:text-[#3E4257]">—</span>
                                }
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={e => { e.stopPropagation(); setSelected(l); }} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#2563EB] hover:border-[#2563EB] hover:bg-[#EEF3FF] dark:hover:bg-[#1A2540] transition" title="View details">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                                </button>
                                <button onClick={e => { e.stopPropagation(); setEditLead(l); }} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#2563EB] hover:border-[#2563EB] hover:bg-[#EEF3FF] dark:hover:bg-[#1A2540] transition" title="Edit lead">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                </button>
                                <button onClick={e => { e.stopPropagation(); setPhoneLead(l); }} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#059669] hover:border-[#059669] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition" title={l.secondaryPhone ? "Manage phone numbers" : "Add secondary number"}>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}
              {totalPages > 1 && (
                <div className="px-3 sm:px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between gap-2 flex-wrap bg-[#F8F9FC] dark:bg-[#13161E]">
                  <span className="text-[12px] sm:text-[14px] text-[#8B92A9]">Showing {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE, displayed.length)} of {displayed.length} leads</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                      return <button key={n} onClick={() => setPage(n)} className={"w-7 h-7 rounded-lg text-[14px] font-semibold transition " + (page===n ? "bg-[#2563EB] text-white" : "border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27]")}>{n}</button>;
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "activity" && (
            <div className="p-4 sm:p-5">
              {loading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-[#8B92A9]">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  Loading activity…
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-12"><p className="text-[14px] text-[#8B92A9]">No recent activity yet.</p></div>
              ) : (
                <div>
                  <p className="text-[13px] sm:text-[14px] font-bold text-[#8B92A9] uppercase tracking-wide mb-4">Latest 8 lead interactions</p>
                  {recentActivity.map((lead, i) => <ActivityItem key={lead.id} lead={lead} isLast={i === recentActivity.length - 1} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Motivational banner */}
        {!loading && kpi.total > 0 && (
          <div className="rounded-2xl p-4 flex items-center gap-4 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] flex-wrap">
            <span className="text-[28px]">{kpi.convRate >= 50 ? "" : kpi.convRate >= 30 ? "" : kpi.convRate >= 15 ? "" : ""}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] sm:text-[14px] font-bold text-[#0F1117] dark:text-white">
                {kpi.convRate >= 50 ? "Outstanding performance! You're a top converter!" :
                 kpi.convRate >= 30 ? "Great work! Your conversion rate is above average." :
                 kpi.convRate >= 15 ? "Good progress! Keep following up on hot leads." :
                 "Every lead counts — focus on your hot leads today!"}
              </p>
              <p className="text-[12px] sm:text-[14px] text-[#8B92A9] mt-0.5">
                {kpi.hot > 0 ? `You have ${kpi.hot} hot lead${kpi.hot > 1 ? "s" : ""} waiting for a call.` : "Classify leads by Quality to prioritize your calls."}
              </p>
            </div>
          </div>
        )}

        
      </div>

  

      {/* ── Modals / Drawers ── */}
      {/* Pass projects so LeadDrawer → UpdateStatusModal can show project pills */}
      {selected      && <LeadDrawer lead={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} projects={projects} />}
      {showAddModal  && <AddLeadModal onClose={() => setShowAddModal(false)} onAdd={handleAddLead} />}
      {editLead && createPortal(
        <EditLeadModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSave={updated => { handleUpdate(updated); setEditLead(null); }}
        />,
        document.body
      )}
      {phoneLead && createPortal(
        <PhoneNumbersModal
          lead={phoneLead}
          onClose={() => setPhoneLead(null)}
          onLeadUpdated={updated => { handleUpdate(updated); setPhoneLead({ ...phoneLead, ...updated }); }}
        />,
        document.body
      )}
      {/* {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-white text-center mb-2">Delete Lead?</h2>
            <p className="text-[12px] text-[#8B92A9] text-center mb-5">This will permanently remove <strong className="text-[#0F1117] dark:text-white">{deleteConfirm.name}</strong> from your list.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#E5E7EB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
              <button onClick={() => handleDeleteLead(deleteConfirm.id)} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </div>
      )} */}

      <UserChatWidget />
    </div>
  );
}
