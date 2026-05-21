import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import api from "../data/axiosConfig";
import { maskPhone } from "../utils/maskPhone";
import { io } from "socket.io-client";
import NotInterestedModal from "../components/Notinterestedmodal";

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
/**
 * Strips all non-digits, then removes leading country code (91 for India, 1 for US)
 * when the result would be 12+ digits, leaving a 10-digit local number.
 * Returns the cleaned string so two numbers can be compared with ===.
 */
function normalizeForDupCheck(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  // Strip leading 91 (India) if the total is 12 digits
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  // Strip leading 1 (US/Canada) if the total is 11 digits
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
const IDLE_MS = 5 * 60 * 1000;

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
      try { await api.post("/attendance/ping"); } catch {}
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
      setIdleWarning(true);
      try { const res = await api.post("/attendance/break/start", { reason: "Auto Idle" }); setRecord(res.data); } catch {}
    };
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    idleTimerRef.current = setTimeout(goIdle, IDLE_MS);
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle));
      clearTimeout(idleTimerRef.current);
    };
  }, [record?.loginTime, record?.logoutTime, record?.status]);

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

  if (loading) return <div className="h-9 w-32 rounded-xl bg-[#F1F4FF] dark:bg-[#1E2130] animate-pulse" />;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setPanelOpen(v => !v)}
        className={"flex items-center gap-2 h-9 px-3 rounded-xl border text-[12px] font-semibold transition-all hover:shadow-sm " + st.chipBg}
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
        <div className="absolute right-0 top-11 z-[200] w-72 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl overflow-hidden">
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
                <p className="text-[11px] font-bold text-red-600 dark:text-red-400">⚠ Idle for 5 mins</p>
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
                    <div key={i} className="flex items-center justify-between px-3 py-1.5">
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
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Total worked today</span>
                <span className="text-[13px] font-black text-emerald-600 dark:text-emerald-400">{fmtMins(workedMins)}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-500">{fmtTime(record.loginTime)} → {fmtTime(record.logoutTime)}</span>
                <span className="text-[10px] text-amber-500">−{fmtMins(totalBreakMins)} break</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── KPI / Chart / Activity helpers (unchanged) ────────────────────────────────
function KpiCard({ label, value, sub, color, icon, trend, trendUp }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-[#8B92A9] dark:text-[#D1D5DB] uppercase tracking-widest">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px]" style={{ background: color + "18" }}>{icon}</div>
      </div>
      <div>
        <p className="text-[32px] font-black text-[#0F1117] dark:text-white leading-none">{value}</p>
        {sub && <p className="text-[11px] text-[#8B92A9] dark:text-[#D1D5DB] mt-1">{sub}</p>}
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
      <div className="flex-1 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-white">{lead.name}</p>
            <p className="text-[10px] text-[#8B92A9] dark:text-[#D1D5DB] font-mono mt-0.5">{lead.phone ? maskPhone(lead.phone) : "—"}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={lead.status} />
            <span className="text-[9px] text-[#8B92A9] dark:text-[#D1D5DB]">{timeAgo(lead._raw_date)}</span>
          </div>
        </div>
        {lead.remark && <p className="text-[11px] text-[#4B5168] dark:text-[#E5E7EB] mt-1 italic">"{lead.remark}"</p>}
      </div>
    </div>
  );
}

function getTomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; }
function getTodayStr()    { return new Date().toISOString().split("T")[0]; }

const OUTCOME_OPTIONS = ["Call Back","Interested","Not Reachable","Meeting Scheduled","Demo Done","Converted","Not Interested"];

function UpdateStatusModal({ lead, onClose, onSaved, onNotInterested }) {
  const [status,       setStatus]       = useState(lead.status === "Not Interested" ? "In Progress" : (lead.status || "New"));
  const [temp,         setTemp]         = useState(lead.temperature || lead.Quality || "");
  const [outcome,      setOutcome]      = useState("Call Back");
  const [remark,       setRemark]       = useState(lead.remark || "");
  const [followUpDate, setFollowUpDate] = useState(getTomorrowStr());
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const CLS = "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB] transition";

  const handleStatusChange = (e) => {
    if (e.target.value === "Not Interested") { onNotInterested(); return; }
    setStatus(e.target.value);
  };

  const handleSave = async () => {
    setLoading(true); setError("");
    try {
      const body = { status, remark, outcome };
      if (temp) { body.temperature = temp; body.Quality = temp; }
      if (status !== "Not Interested") { body.followUpDate = followUpDate || getTomorrowStr(); }
      const res = await api.patch(`/lead/${lead.id || lead._id}`, body);
      onSaved({ ...lead, ...(res.data || {}), id: lead.id || String(lead._id), status, remark, outcome, temperature: temp || res.data?.temperature || null, Quality: temp || res.data?.temperature || null, _newEntry: { outcome, remark, calledAt: new Date().toISOString(), userName: "You" } });
      onClose();
    } catch (e) {
      setError((e.response?.data?.message) || "Failed to update. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-[#0F1117] dark:text-white">Update Lead</h3>
            <p className="text-[11px] text-[#8B92A9] truncate">{lead.name}</p>
          </div>
        </div>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Status</label>
            <select value={status} onChange={handleStatusChange} className={CLS}>
              {["New","In Progress","Converted","Not Interested"].map(s => <option key={s}>{s}</option>)}
            </select>
            <p className="text-[10px] text-amber-500 mt-1">Selecting "Not Interested" opens the reassignment workflow.</p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Call Outcome</label>
            <select value={outcome} onChange={e => setOutcome(e.target.value)} className={CLS}>
              {OUTCOME_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Lead Quality</label>
            <div className="grid grid-cols-4 gap-2">
              {[{val:"",label:"None",color:"#8B92A9",bg:"bg-gray-50 dark:bg-gray-900/30"},{val:"Hot",label:" Hot",color:"#DC2626",bg:"bg-red-50 dark:bg-red-950/30"},{val:"Warm",label:"🌤 Warm",color:"#D97706",bg:"bg-amber-50 dark:bg-amber-950/30"},{val:"Cold",label:"❄️ Cold",color:"#2563EB",bg:"bg-blue-50 dark:bg-blue-950/30"}].map(q => (
                <button key={q.val} type="button" onClick={() => setTemp(q.val)}
                  className={`py-2 px-1 rounded-xl border-2 text-[11px] font-semibold transition ${q.bg} ${temp === q.val ? "border-current scale-[1.03]" : "border-transparent opacity-60 hover:opacity-100"}`}
                  style={{ color: q.color, borderColor: temp === q.val ? q.color : undefined }}>{q.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Remark</label>
            <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2} className={CLS + " resize-none"} placeholder="Add a note…" />
          </div>
          {status !== "Not Interested" && (
            <div>
              <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide"> Follow-up Date</label>
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
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving…</> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadDrawer({ lead, onClose, onUpdate }) {
  const [showUpdate,  setShowUpdate]  = useState(false);
  const [showNIModal, setShowNIModal] = useState(false);
  const name  = lead.name || "Unknown";
  const phone = lead.phone || lead.mobile || "—";
  const s = STATUS_CONFIG[lead.status] || STATUS_CONFIG["New"];
  const callHistory    = lead.callHistory    || [];
  const scheduledCalls = lead.scheduledCalls || [];
  const pendingCalls   = scheduledCalls.filter(c => !c.done);
  const fmt = iso => iso ? new Date(iso).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "—";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-[440px] bg-white dark:bg-[#1A1D27] h-full shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black" style={{ background: s.dot + "20", color: s.dot }}>
                {name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-[#0F1117] dark:text-white">{name}</h2>
                <p className="text-[12px] text-[#8B92A9] font-mono">{phone !== "—" ? maskPhone(phone) : "—"}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={lead.status} />
            <TempBadge temp={lead.Quality || lead.temperature} />
            {lead.reassignCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                 Reassigned {lead.reassignCount}
              </span>
            )}
          </div>
        </div>
        <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {[{label:"Source",value:lead.source||"—"},{label:"Campaign",value:lead.campaign||"—"},{label:"Date",value:lead.date||"—"},{label:"Remark",value:lead.remark||"No remark"}].map(item => (
            <div key={item.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-3">
              <p className="text-[9px] font-bold text-[#8B92A9] dark:text-[#D1D5DB] uppercase tracking-widest mb-1">{item.label}</p>
              <p className="text-[12px] font-medium text-[#0F1117] dark:text-white break-words">{item.value}</p>
            </div>
          ))}
        </div>
        {callHistory.length > 0 && (
          <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#D1D5DB] uppercase tracking-wide mb-3"> Call History ({callHistory.length})</p>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {callHistory.map((h, i) => (
                <div key={i} className="px-3 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-[#0F1117] dark:text-white">{h.userName || "Unknown Employee"}</span>
                    <span className="text-[10px] text-[#8B92A9]">{fmt(h.calledAt)}</span>
                  </div>
                  <p className="text-[11px] text-[#4B5168] dark:text-[#E5E7EB]">{h.remark}</p>
                  {h.outcome && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">{h.outcome}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {pendingCalls.length > 0 && (
          <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#D1D5DB] uppercase tracking-wide mb-3"> Scheduled Follow-ups ({pendingCalls.length} pending)</p>
            <div className="space-y-2">
              {pendingCalls.map((sc, i) => {
                const isPast = new Date(sc.scheduledAt) < new Date();
                return (
                  <div key={i} className={"flex items-center gap-3 px-3 py-2.5 rounded-xl border " + (isPast ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : "bg-[#F8F9FC] dark:bg-[#13161E] border-[#E4E7EF] dark:border-[#262A38]")}>
                    <span className={"w-2 h-2 rounded-full shrink-0 " + (sc.type === "follow-up" ? "bg-blue-500" : "bg-purple-500")} />
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-[#0F1117] dark:text-white capitalize">{sc.type}</p>
                      {sc.note && <p className="text-[10px] text-[#8B92A9]">{sc.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className={"text-[11px] font-semibold " + (isPast ? "text-red-500" : "text-[#4B5168] dark:text-[#E5E7EB]")}>{fmt(sc.scheduledAt)}</p>
                      {isPast && <p className="text-[9px] text-red-400 font-bold">OVERDUE</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="px-6 py-4 space-y-2">
          <button onClick={() => setShowUpdate(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Update Status / Lead Quality
          </button>
          <button onClick={() => setShowNIModal(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 text-[13px] font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            Mark Not Interested & Reassign
          </button>
        </div>
        <div className="flex-1" />
      </div>

      {showUpdate && createPortal(
        <UpdateStatusModal lead={lead} onClose={() => setShowUpdate(false)}
          onNotInterested={() => { setShowUpdate(false); setShowNIModal(true); }}
          onSaved={updated => { onUpdate(updated); setShowUpdate(false); }} />,
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

function AddLeadModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name:"", phone:"", source:"Google Ads", campaign:"", status:"New", remark:"" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: "" })); };
  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Name must be at least 2 characters.";
    if (!form.phone.trim()) e.phone = "Phone is required.";
    else if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "Phone must be exactly 10 digits.";
    return e;
  };
  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try {
      const res = await api.post("/lead", { name:form.name.trim(), mobile:form.phone.trim(), source:form.source, campaign:form.campaign.trim()||null, status:form.status, date:new Date(), remark:form.remark.trim()||"Manually added" });
      const saved = res.data;
      onAdd({ id:String(saved._id), name:saved.name, phone:saved.mobile||"", mobile:saved.mobile||"", source:saved.source||"Web Form", campaign:saved.campaign||"—", status:saved.status, Quality:saved.Quality||null, temperature:saved.temperature||null, remark:saved.remark||"", date:new Date(saved.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}), _raw_date:saved.date||saved.createdAt||null, callHistory:[], scheduledCalls:[], reassignCount:0 });
      onClose();
    } catch (err) {
      setErrors({ submit:(err.response?.data?.message)||"Failed to save lead." });
    } finally { setSubmitting(false); }
  };
  const CLS = key => "w-full px-3 py-2.5 rounded-xl border text-[13px] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-white placeholder:text-[#8B92A9] focus:outline-none transition " + (errors[key] ? "border-red-400" : "border-[#E4E7EF] dark:border-[#262A38] focus:border-[#2563EB]");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-white">Add New Lead</h2>
            <p className="text-[11px] text-[#8B92A9]">Assigned to you automatically</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[{label:"Lead Name *",key:"name",placeholder:"Full name"},{label:"Phone *",key:"phone",placeholder:"10-digit number"},{label:"Campaign",key:"campaign",placeholder:"Campaign name"},{label:"Remark",key:"remark",placeholder:"Notes"}].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">{f.label}</label>
              <input type="text" placeholder={f.placeholder} value={form[f.key]} onChange={e => set(f.key, e.target.value)} className={CLS(f.key)} />
              {errors[f.key] && <span className="text-[11px] text-red-500">{errors[f.key]}</span>}
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Source</label>
            <select value={form.source} onChange={e => set("source", e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none">
              {["Google Ads","Facebook Ads","Web Form","Referral","Campaign","Other"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none">
              {["New","In Progress","Converted"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {errors.submit && <p className="text-[12px] text-red-500 mt-3 text-center">{errors.submit}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#E5E7EB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 transition disabled:opacity-60">
            {submitting ? "Saving…" : "Add Lead"}
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
  // Pass company and assigned adminId so the server can scope this employee's chat
  const companyId   = user?.company?._id || user?.company || null;
  const adminId     = user?.createdBy || null; // the admin who created/assigned this employee

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, "") : "https://skyup-crm-backend.onrender.com");
    const socket = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = socket;
    socket.on("connect", () => { sharedSocket.current = socket; });
    if (socket.connected) sharedSocket.current = socket;
    // Send full identity so server can scope to correct admin thread
    socket.emit("user_join", { username, userId: user?._id, company: companyId, adminId, displayName: user?.name });
    socket.on("chat_history", history => {
      // from can be 'admin:<id>', 'superadmin:<id>', or the employee's username
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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: 420 }}>
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
                <p className="text-[28px] mb-2">💬</p>
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
                      <div className={"relative px-3 py-2 rounded-2xl text-[12px] " + (m.isDeleted ? "italic text-[#8B92A9] bg-[#F8F9FC] dark:bg-[#1A1D27] border border-dashed border-[#E4E7EF] dark:border-[#262A38]" : isYou ? "bg-[#2563EB] text-white rounded-br-none" : "bg-white dark:bg-[#1A1D27] text-[#0F1117] dark:text-white rounded-bl-none border border-[#E4E7EF] dark:border-[#262A38]")}>
                        {m.message}
                        {m.editedAt && !m.isDeleted && <span className="text-[9px] opacity-60 ml-1">(edited)</span>}
                        {isYou && !m.isDeleted && m._id && (
                          <div className="absolute top-1 -left-14 hidden group-hover:flex items-center gap-1">
                            <button onClick={() => startEdit(m)} className="w-5 h-5 rounded-full bg-white dark:bg-[#262A38] border border-[#E4E7EF] dark:border-[#3A3F52] flex items-center justify-center text-[#8B92A9] hover:text-[#2563EB] transition shadow-sm">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button onClick={() => deleteMsg(m._id)} className="w-5 h-5 rounded-full bg-white dark:bg-[#262A38] border border-[#E4E7EF] dark:border-[#3A3F52] flex items-center justify-center text-[#8B92A9] hover:text-red-500 transition shadow-sm">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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
              className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-white placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition" />
            <button onClick={sendMessage} className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center text-white hover:bg-blue-700 transition shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} className="relative w-14 h-14 rounded-full bg-[#2563EB] text-white shadow-lg flex items-center justify-center transition hover:bg-blue-700 hover:scale-105 active:scale-95">
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
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning", emoji: "" };
  if (h < 17) return { text: "Good afternoon", emoji: "" };
  return { text: "Good evening", emoji: "" };
}

function mapLead(l) {
  return {
    id:             String(l._id),
    name:           l.name           || "Unknown",
    phone:          l.mobile         || l.phone || "",
    mobile:         l.mobile         || l.phone || "",
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
  };
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
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
  const [activeTab,     setActiveTab]     = useState("leads");
  const [csvImporting,  setCsvImporting]  = useState(false);
  const [csvResult,     setCsvResult]     = useState(null);

  // ── Company branding: fetch once and cache in localStorage ────────────────
  const [companyBrand, setCompanyBrand] = useState(() => {
    try { return JSON.parse(localStorage.getItem("company_brand") || "null"); } catch { return null; }
  });
  useEffect(() => {
    api.get("/admin/company/brand")
      .then(res => {
        if (res.data) {
          setCompanyBrand(res.data);
          localStorage.setItem("company_brand", JSON.stringify(res.data));
        }
      })
      .catch(() => {}); // silent — branding is optional
    const handler = () => {
      try { setCompanyBrand(JSON.parse(localStorage.getItem("company_brand") || "null")); } catch { /* ignore */ }
    };
    window.addEventListener("company_brand_updated", handler);
    return () => window.removeEventListener("company_brand_updated", handler);
  }, []);

  const PER_PAGE = 10;

  const fetchLeads = useCallback(() => {
    setLoading(true);
    api.get("/lead/my-leads")
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.leads || res.data?.data || []);
        setLeads(raw.map(mapLead));
        setError("");
      })
      .catch(() => setError("Failed to load your leads. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

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
      const q           = search.toLowerCase();
      const matchSearch = !q || l.name.toLowerCase().includes(q) || (l.phone||"").includes(q) || (l.campaign||"").toLowerCase().includes(q);
      const matchSt     = filterSt   === "All" || l.status  === filterSt;
      const matchTemp   = filterTemp === "All" || l.Quality === filterTemp;
      return matchSearch && matchSt && matchTemp;
    });
    return res.slice().sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b._raw_date||0) - new Date(a._raw_date||0);
      if (sortBy === "date_asc")  return new Date(a._raw_date||0) - new Date(b._raw_date||0);
      if (sortBy === "name_asc")  return a.name.localeCompare(b.name);
      if (sortBy === "status")    return a.status.localeCompare(b.status);
      return 0;
    });
  }, [leads, search, filterSt, filterTemp, sortBy]);

  const totalPages     = Math.ceil(displayed.length / PER_PAGE);
  const paged          = displayed.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const recentActivity = useMemo(() => leads.slice().sort((a,b) => new Date(b._raw_date||0) - new Date(a._raw_date||0)).slice(0, 8), [leads]);

  const handleUpdate = updated => {
    if (updated._reassigned) { setLeads(prev => prev.filter(l => l.id !== (updated.id || String(updated._id)))); setSelected(null); return; }
    const norm = { ...updated, id: updated.id || String(updated._id), Quality: updated.temperature || updated.Quality || null, temperature: updated.temperature || updated.Quality || null };
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

  // ── CSV import with FULL duplicate checking ───────────────────────────────
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

      // ── Step 1: Build a normalised set of ALL phone numbers the user already has
      //    so we can check duplicates without hitting the server per-row.
      const existingNormalized = new Set(
        leads.map(l => normalizeForDupCheck(l.phone || l.mobile)).filter(Boolean)
      );

      // ── Step 2: Parse CSV rows and apply three layers of dedup ───────────
      const seenInFile    = new Set();   // dedup within the CSV itself
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

        // Layer A — duplicate within the CSV itself
        if (seenInFile.has(normMobile)) {
          clientErrors.push({ index: i, row: rawName || `Row ${i}`, message: `Duplicate in CSV: ${rawMobile} appears more than once.` });
          continue;
        }
        seenInFile.add(normMobile);

        // Layer B — already exists in the user's current lead list
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

      // Nothing to send
      if (!leadsToImport.length) {
        setCsvResult({
          error:        "No new leads to import — all rows were either invalid or already exist in your CRM.",
          errorDetails: clientErrors,
        });
        setCsvImporting(false);
        return;
      }

      // ── Step 3: Send to server (server applies its own dedup as a safety net)
      const res = await api.post("/lead/import-csv", { leads: leadsToImport });
      const imported = res.data.saved || [];

      // Prepend freshly imported leads to state
      setLeads(prev => [...imported.map(mapLead), ...prev]);
      setPage(1);

      // ── Step 4: Merge client + server errors for the result panel
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
      {/* ── Header ── */}
      <div className="px-6 py-5 bg-white dark:bg-[#1A1D27] border-b border-[#E4E7EF] dark:border-[#262A38]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {/* Company brand logo/name set by SuperAdmin */}
            {companyBrand?.logoUrl ? (
              <img src={companyBrand.logoUrl} alt={companyBrand?.name || "logo"} className="h-9 w-auto max-w-[100px] object-contain" />
            ) : (
              <img src="/skyup_logo1.svg" alt="skyup_crm" className="w-9 h-9" />
            )}
            <div>
              <p className="text-[#8B92A9] dark:text-[#D1D5DB] text-[12px] font-medium">{greeting.emoji} {greeting.text}</p>
              <h1 className="text-[22px] font-black text-[#0F1117] dark:text-white mt-0.5">
                {user?.name || "Employee"}
                <span className="text-[#8B92A9] dark:text-[#D1D5DB] text-[16px] font-normal ml-2">— My Workspace</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add Lead
            </button>

            {/* CSV import / template */}
            <div className="flex items-center rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
              <label className={`flex items-center gap-2 px-4 py-2 text-[#4B5168] dark:text-[#E5E7EB] text-[13px] font-semibold hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition cursor-pointer border-r border-[#E4E7EF] dark:border-[#262A38] ${csvImporting ? "opacity-60 cursor-not-allowed" : ""}`}>
                <input type="file" accept=".csv" className="hidden" disabled={csvImporting} onChange={handleImportCSV}/>
                {csvImporting
                  ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                }
                {csvImporting ? "Importing…" : "Import CSV"}
              </label>
              <button onClick={downloadCSVTemplate} className="flex items-center gap-1.5 px-3 py-2 text-[#2563EB] dark:text-[#4F8EF7] text-[12px] font-semibold hover:bg-[#EEF3FF] dark:hover:bg-[#1A2540] transition whitespace-nowrap">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Template
              </button>
            </div>

            <AttendanceMiniWidget />

            {/* CSV result toast */}
            {csvResult && (
              <div className={`flex flex-col gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold border max-w-xs
                ${csvResult.error || csvResult.saved === 0
                  ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                  : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"}`}>
                <div className="flex items-center gap-1.5">
                  {csvResult.error
                    ? csvResult.error
                    : `${csvResult.saved > 0 ? "✓ " : ""}${csvResult.saved}/${csvResult.total} imported${csvResult.errors > 0 ? ` · ${csvResult.errors} skipped` : ""}`}
                  <button onClick={() => setCsvResult(null)} className="ml-1 opacity-70 hover:opacity-100 shrink-0">✕</button>
                </div>
                {/* Show the first 5 skip reasons inline */}
                {csvResult.errorDetails?.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5 text-[10px] font-normal opacity-90">
                    {csvResult.errorDetails.slice(0, 5).map((e, i) => (
                      <li key={i}>Row {e.index} ({e.row}): {e.message}</li>
                    ))}
                    {csvResult.errorDetails.length > 5 && (
                      <li>…and {csvResult.errorDetails.length - 5} more skipped.</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[13px] font-black text-[#2563EB] dark:text-[#4F8EF7] border border-[#C7D7FF] dark:border-[#2D3A6B]">{initials}</div>
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex-wrap">
          {[
            { label:"My Total Leads", value:kpi.total,          color:"text-[#0F1117] dark:text-white" },
            { label:"Today",          value:kpi.todayLeads,     color:"text-[#2563EB] dark:text-[#4F8EF7]" },
            { label:"This Week",      value:kpi.weekLeads,      color:"text-[#2563EB] dark:text-[#4F8EF7]" },
            { label:"Converted",      value:kpi.converted,      color:"text-[#059669] dark:text-[#34D399]" },
            { label:"Conv. Rate",     value:kpi.convRate + "%", color:"text-[#059669] dark:text-[#34D399]" },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-2">
              <span className={"text-[18px] font-black " + stat.color}>{stat.value}</span>
              <span className="text-[14px] text-[#8B92A9] dark:text-[#D1D5DB] font-medium">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-[12px] font-medium">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {error}
            <button onClick={fetchLeads} className="ml-auto text-red-600 underline underline-offset-2 font-semibold">Retry</button>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="My Total Leads" value={kpi.total}      sub="All assigned to you"             color="#2563EB" icon="" />
          <KpiCard label="Converted"      value={kpi.converted}  sub={kpi.convRate + "% success rate"} color="#059669" icon="" trendUp={kpi.convRate > 20} trend={kpi.convRate + "% rate"} />
          <KpiCard label="In Progress"    value={kpi.inProgress} sub="Awaiting follow-up"              color="#D97706" icon="" />
          <KpiCard label="Hot Leads "   value={kpi.hot}        sub="Call these first!"               color="#DC2626" icon="" />
        </div>

        {/* Targets + Quality */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
            <p className="text-[14px] font-bold text-[#0F1117] dark:text-white uppercase tracking-wide mb-4"> My Daily Targets</p>
            <div className="flex items-center justify-around">
              <RadialProgress value={kpi.todayLeads} max={10} color="#2563EB" label="Leads" size={80} />
              <RadialProgress value={leads.filter(l => isToday(l.date) && l.status==="Converted").length} max={5} color="#059669" label="Convert" size={80} />
              <RadialProgress value={leads.filter(l => isToday(l.date) && l.status==="In Progress").length} max={8} color="#D97706" label="Active" size={80} />
            </div>
            <p className="text-[9px] text-center text-[#8B92A9] dark:text-[#D1D5DB] mt-3 font-medium uppercase tracking-wide">Targets: 10 leads · 5 conversions · 8 follow-ups</p>
          </div>
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
            <p className="text-[12px] font-bold text-[#0F1117] dark:text-white uppercase tracking-wide mb-4">Lead Quality</p>
            <div className="space-y-3">
              {[{label:"Hot",color:"#DC2626",icon:"",count:kpi.hot},{label:"Warm",color:"#D97706",icon:"",count:kpi.warm},{label:"Cold",color:"#2563EB",icon:"",count:kpi.cold},{label:"Unclassified",color:"#8B92A9",icon:"—",count:kpi.unclassified}].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-4 text-center text-[14px]">{item.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-[14px] mb-0.5">
                      <span className="font-semibold text-[#0F1117] dark:text-white">{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>{item.count}</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: (kpi.total > 0 ? (item.count/kpi.total)*100 : 0) + "%", background: item.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label:"New",            count:kpi.newLeads,   color:"#2563EB", bg:"bg-blue-100 dark:bg-blue-950/70",      icon:"" },
            { label:"In Progress",    count:kpi.inProgress, color:"#D97706", bg:"bg-amber-50 dark:bg-amber-950/30",     icon:"" },
            { label:"Converted",      count:kpi.converted,  color:"#059669", bg:"bg-emerald-50 dark:bg-emerald-950/30", icon:"" },
            { label:"Not Interested", count:kpi.notInt,     color:"#DC2626", bg:"bg-red-50 dark:bg-red-950/30",         icon:"" },
          ].map(item => (
            <button key={item.label}
              onClick={() => { setFilterSt(filterSt === item.label ? "All" : item.label); setActiveTab("leads"); setPage(1); }}
              className={item.bg + " rounded-xl p-3 flex items-center gap-3 border-2 transition hover:scale-[1.01] " + (filterSt === item.label ? "" : "border-transparent")}
              style={{ borderColor: filterSt === item.label ? item.color : undefined }}>
              <span className="text-[18px]">{item.icon}</span>
              <div className="text-left">
                <p className="text-[18px] font-black" style={{ color: item.color }}>{item.count}</p>
                <p className="text-[14px] font-semibold text-[#8B92A9] leading-tight">{item.label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Leads / Activity table */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
          <div className="flex items-center border-b border-[#E4E7EF] dark:border-[#262A38] px-5">
            {[{id:"leads",label:"My Leads",count:displayed.length},{id:"activity",label:"Recent Activity",count:recentActivity.length}].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={"flex items-center gap-2 px-4 py-4 text-[12px] font-semibold border-b-2 transition " + (activeTab === tab.id ? "border-[#2563EB] text-[#2563EB] dark:text-[#4F8EF7]" : "border-transparent text-[#8B92A9] dark:text-[#D1D5DB] hover:text-[#0F1117] dark:hover:text-white")}>
                {tab.label}
                <span className={"px-1.5 py-0.5 rounded-full text-[14px] font-bold " + (activeTab === tab.id ? "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7]" : "bg-[#F1F4FF] dark:bg-[#1E2130] text-[#8B92A9]")}>{tab.count}</span>
              </button>
            ))}
            {activeTab === "leads" && (
              <div className="ml-auto flex items-center gap-2 py-2 flex-wrap">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…"
                    className="pl-7 pr-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-white placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] w-36 transition" />
                </div>
                <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }} className="px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-white focus:outline-none">
                  <option value="date_desc">Newest</option><option value="date_asc">Oldest</option><option value="name_asc">Name A–Z</option><option value="status">By Status</option>
                </select>
                {(search || filterSt !== "All" || filterTemp !== "All") && (
                  <button onClick={() => { setSearch(""); setFilterSt("All"); setFilterTemp("All"); setPage(1); }} className="px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[14px] text-[#8B92A9] hover:text-red-500 hover:border-red-300 transition font-semibold">✕ Clear</button>
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
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <p className="text-[18px] font-semibold text-[#0F1117] dark:text-white">{leads.length === 0 ? "No leads yet" : "No leads match your filters"}</p>
                  <p className="text-[14px] text-[#8B92A9]">{leads.length === 0 ? "Add your first lead to get started." : "Try adjusting your search or filters."}</p>
                  {leads.length === 0 && <button onClick={() => setShowAddModal(true)} className="mt-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold hover:bg-blue-700 transition">+ Add First Lead</button>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                        {["Lead","Phone","Campaign / Source","Date","Status","Lead Quality",""].map(h => (
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
                              <div className="flex items-center gap-1">
                                <button onClick={e => { e.stopPropagation(); setSelected(l); }} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#2563EB] hover:border-[#2563EB] hover:bg-[#EEF3FF] dark:hover:bg-[#1A2540] transition" title="View details">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                                </button>
                                <button onClick={e => { e.stopPropagation(); setDeleteConfirm(l); }} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-red-500 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition" title="Delete lead">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between bg-[#F8F9FC] dark:bg-[#13161E]">
                  <span className="text-[14px] text-[#8B92A9]">Showing {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE, displayed.length)} of {displayed.length} leads</span>
                  <div className="flex items-center gap-1">
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
            <div className="p-5">
              {loading ? (
                <div className="flex items-center justify-center py-12 gap-3 text-[#8B92A9]">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  Loading activity…
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-12"><p className="text-[14px] text-[#8B92A9]">No recent activity yet.</p></div>
              ) : (
                <div>
                  <p className="text-[14px] font-bold text-[#8B92A9] uppercase tracking-wide mb-4">Latest 8 lead interactions</p>
                  {recentActivity.map((lead, i) => <ActivityItem key={lead.id} lead={lead} isLast={i === recentActivity.length - 1} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Motivational banner */}
        {!loading && kpi.total > 0 && (
          <div className="rounded-2xl p-4 flex items-center gap-4 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38]">
            <span className="text-[28px]">{kpi.convRate >= 50 ? "" : kpi.convRate >= 30 ? "" : kpi.convRate >= 15 ? "" : ""}</span>
            <div>
              <p className="text-[14px] font-bold text-[#0F1117] dark:text-white">
                {kpi.convRate >= 50 ? "Outstanding performance! You're a top converter!" :
                 kpi.convRate >= 30 ? "Great work! Your conversion rate is above average." :
                 kpi.convRate >= 15 ? "Good progress! Keep following up on hot leads." :
                 "Every lead counts — focus on your hot leads today!"}
              </p>
              <p className="text-[14px] text-[#8B92A9] mt-0.5">
                {kpi.hot > 0 ? `You have ${kpi.hot} hot lead${kpi.hot > 1 ? "s" : ""} waiting for a call.` : "Classify leads by Quality to prioritize your calls."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals / Drawers ── */}
      {selected      && <LeadDrawer lead={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} />}
      {showAddModal  && <AddLeadModal onClose={() => setShowAddModal(false)} onAdd={handleAddLead} />}
      {deleteConfirm && (
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
      )}

      <UserChatWidget />
    </div>
  );
}
