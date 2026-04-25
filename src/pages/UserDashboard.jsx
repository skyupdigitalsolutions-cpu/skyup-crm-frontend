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

// ── Status / Quality configs ──────────────────────────────────────────────
const STATUS_CONFIG = {
  "New":            { bg:"bg-blue-50 dark:bg-blue-950/40",    text:"text-blue-600 dark:text-blue-400",    dot:"#2563EB" },
  "In Progress":    { bg:"bg-amber-50 dark:bg-amber-950/40",  text:"text-amber-600 dark:text-amber-400",  dot:"#D97706" },
  "Converted":      { bg:"bg-emerald-50 dark:bg-emerald-950/40", text:"text-emerald-600 dark:text-emerald-400", dot:"#059669" },
  "Not Interested": { bg:"bg-red-50 dark:bg-red-950/40",      text:"text-red-600 dark:text-red-400",      dot:"#DC2626" },
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

// ── Attendance Mini Widget (inline header chip) ───────────────────────────────
const IDLE_MS = 5 * 60 * 1000;

function fmtMins(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function AttendanceMiniWidget() {
  const [record, setRecord]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [elapsed, setElapsed]     = useState(0);
  const [idleWarning, setIdleWarning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef(null);
  const lastMoveRef  = useRef(Date.now());
  const idleTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  const tickTimerRef = useRef(null);

  const fetchRecord = useCallback(async () => {
    try { const res = await api.get("/attendance/my-today"); setRecord(res.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen]);

  // Live timer
  useEffect(() => {
    if (!record?.loginTime || record?.logoutTime) { setElapsed(0); return; }
    const tick = () => {
      const breakMins = record.totalBreakMinutes +
        (record.activeBreakIndex !== null
          ? Math.round((Date.now() - new Date(record.breaks[record.activeBreakIndex]?.startTime || Date.now())) / 60000)
          : 0);
      const secs = Math.max(0, Math.round((Date.now() - new Date(record.loginTime)) / 1000) - breakMins * 60);
      setElapsed(secs);
    };
    tick();
    tickTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickTimerRef.current);
  }, [record]);

  // Ping
  useEffect(() => {
    if (!record?.loginTime || record?.logoutTime) return;
    pingTimerRef.current = setInterval(async () => {
      try { await api.post("/attendance/ping"); } catch {}
    }, 60000);
    return () => clearInterval(pingTimerRef.current);
  }, [record?.loginTime, record?.logoutTime]);

  // Idle detection
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
    return () => { events.forEach(e => window.removeEventListener(e, resetIdle)); clearTimeout(idleTimerRef.current); };
  }, [record?.loginTime, record?.logoutTime, record?.status]);

  const clockIn    = async () => { try { const r = await api.post("/attendance/clock-in");  setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); } };
  const clockOut   = async () => { if (!confirm("Clock out for today?")) return; try { const r = await api.post("/attendance/clock-out"); setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); } };
  const startBreak = async () => { try { const r = await api.post("/attendance/break/start", { reason: "Manual Break" }); setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); } };
  const endBreak   = async () => { setIdleWarning(false); try { const r = await api.post("/attendance/break/end"); setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); } };

  const notClockedIn = !record || !record.loginTime;
  const isClockedOut = !!record?.logoutTime;
  const isOnBreak    = record?.status === "on_break" || record?.status === "idle";
  const isActive     = record?.status === "active";

  // Status config for chip
  const ST = {
    active:     { dot: "bg-emerald-400", color: "text-emerald-600 dark:text-emerald-400", label: "Active",     chipBg: "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800" },
    on_break:   { dot: "bg-amber-400",   color: "text-amber-600 dark:text-amber-400",     label: "On Break",   chipBg: "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800" },
    idle:       { dot: "bg-red-400",     color: "text-red-500 dark:text-red-400",          label: "Idle",       chipBg: "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800" },
    logged_out: { dot: "bg-gray-400",    color: "text-[#8B92A9]",                          label: "Logged Out", chipBg: "bg-[#F8F9FC] dark:bg-[#13161E] border-[#E4E7EF] dark:border-[#262A38]" },
  };
  const st = ST[record?.status] || ST["logged_out"];

  if (loading) return (
    <div className="h-9 w-32 rounded-xl bg-[#F1F4FF] dark:bg-[#1E2130] animate-pulse" />
  );

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Chip trigger button ── */}
      <button
        onClick={() => setPanelOpen(v => !v)}
        className={"flex items-center gap-2 h-9 px-3 rounded-xl border text-[12px] font-semibold transition-all hover:shadow-sm " + st.chipBg}
      >
        {/* Status dot */}
        <span className={"w-2 h-2 rounded-full shrink-0 " + st.dot + (isActive ? " animate-pulse" : "")} />

        {/* Clock icon */}
        <svg className={"w-3.5 h-3.5 shrink-0 " + st.color} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/>
        </svg>

        {/* Label + timer */}
        <span className={st.color}>
          {notClockedIn ? "Clock In" : isClockedOut ? "Clocked Out" : isActive ? fmtMins(Math.floor(elapsed / 60)) : st.label}
        </span>

        {/* Idle alert badge */}
        {idleWarning && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}

        {/* Chevron */}
        <svg className={"w-3 h-3 transition-transform " + st.color + (panelOpen ? " rotate-180" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* ── Dropdown panel ── */}
      {panelOpen && (
        <div className="absolute right-0 top-11 z-[200] w-72 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl overflow-hidden">

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Attendance</p>
              <p className="text-[10px] text-[#8B92A9]">{new Date().toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short" })}</p>
            </div>
            {record && (
              <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full border " + st.chipBg + " " + st.color}>
                {st.label}
              </span>
            )}
          </div>

          {/* Idle warning */}
          {idleWarning && (
            <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold text-red-600 dark:text-red-400">⚠️ Idle for 5 mins</p>
                <p className="text-[10px] text-red-400">Break started automatically.</p>
              </div>
              <button onClick={endBreak} className="shrink-0 px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold transition">Resume</button>
            </div>
          )}

          {/* Stats */}
          {record?.loginTime && (
            <div className="grid grid-cols-3 gap-2 px-3 pt-3">
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-2 py-2.5 text-center">
                <p className="text-[9px] text-[#8B92A9] font-semibold uppercase tracking-wide mb-1">Work</p>
                <p className="text-[13px] font-black text-[#0F1117] dark:text-[#F0F2FA] leading-none">{fmtMins(Math.floor(elapsed / 60))}</p>
              </div>
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-2 py-2.5 text-center">
                <p className="text-[9px] text-[#8B92A9] font-semibold uppercase tracking-wide mb-1">Break</p>
                <p className="text-[13px] font-black text-amber-500 leading-none">{fmtMins(record.totalBreakMinutes)}</p>
              </div>
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-2 py-2.5 text-center">
                <p className="text-[9px] text-[#8B92A9] font-semibold uppercase tracking-wide mb-1">Login</p>
                <p className="text-[13px] font-black text-[#0F1117] dark:text-[#F0F2FA] leading-none">{fmtTime(record.loginTime)}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-3 py-3 flex gap-2">
            {notClockedIn && (
              <button onClick={clockIn} className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold transition flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white/70" />
                Clock In
              </button>
            )}
            {record?.loginTime && !isClockedOut && (
              <>
                {!isOnBreak && (
                  <button onClick={startBreak} className="flex-1 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[12px] font-bold transition">
                    ⏸ Break
                  </button>
                )}
                {isOnBreak && (
                  <button onClick={endBreak} className="flex-1 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-400 text-[12px] font-bold transition">
                    ▶ Resume
                  </button>
                )}
                <button onClick={clockOut} className="flex-1 py-2 rounded-xl bg-red-100 dark:bg-red-950/40 hover:bg-red-200 text-red-600 dark:text-red-400 text-[12px] font-bold transition">
                  ⏹ Clock Out
                </button>
              </>
            )}
            {isClockedOut && (
              <div className="flex-1 py-2 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] text-center text-[11px] text-[#8B92A9] font-semibold">
                Clocked out · {fmtTime(record.logoutTime)}
              </div>
            )}
          </div>

          {/* Break log */}
          {record?.breaks?.length > 0 && (
            <div className="mx-3 mb-3 border border-[#E4E7EF] dark:border-[#262A38] rounded-xl overflow-hidden">
              <p className="px-3 py-2 text-[9px] font-bold text-[#8B92A9] uppercase tracking-widest bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">Break Log</p>
              <div className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                {record.breaks.map((b, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5">
                    <span className={"text-[10px] font-semibold px-1.5 py-0.5 rounded-full " + (b.reason === "Auto Idle" ? "bg-red-50 dark:bg-red-950/40 text-red-500" : "bg-amber-50 dark:bg-amber-950/40 text-amber-600")}>
                      {b.reason}
                    </span>
                    <span className="text-[10px] text-[#8B92A9]">
                      {fmtTime(b.startTime)} → {b.endTime ? fmtTime(b.endTime) : "ongoing"}
                      {b.durationMinutes != null ? ` · ${b.durationMinutes}m` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon, trend, trendUp }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px]" style={{ background: color + "18" }}>{icon}</div>
      </div>
      <div>
        <p className="text-[32px] font-black text-[#0F1117] dark:text-[#F0F2FA] leading-none">{value}</p>
        {sub && <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-1">{sub}</p>}
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
          <span className="text-[15px] font-black text-[#0F1117] dark:text-[#F0F2FA]">{value}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-[#8B92A9] dark:text-[#565C75] font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-[9px] text-[#8B92A9] dark:text-[#565C75]">/ {max} target</p>
      </div>
    </div>
  );
}

function MiniBarChart({ data, labels, color }) {
  color = color || "#2563EB";
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map(function(v, i) {
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full rounded-t-sm transition-all duration-500"
              style={{ height: ((v / max) * 52) + "px", background: i === data.length - 1 ? color : color + "60", minHeight: 2 }} />
            <span className="text-[8px] text-[#8B92A9] dark:text-[#565C75]">{labels[i]}</span>
          </div>
        );
      })}
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
          {lead.name ? lead.name.split(" ").map(function(n){ return n[0]; }).join("").slice(0,2).toUpperCase() : "?"}
        </div>
        {!isLast && <div className="w-px flex-1 bg-[#E4E7EF] dark:bg-[#262A38] mt-1 mb-1" />}
      </div>
      <div className="flex-1 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{lead.name}</p>
            <p className="text-[10px] text-[#8B92A9] dark:text-[#565C75] font-mono mt-0.5">{lead.phone ? maskPhone(lead.phone) : "—"}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={lead.status} />
            <span className="text-[9px] text-[#8B92A9] dark:text-[#565C75]">{timeAgo(lead._raw_date)}</span>
          </div>
        </div>
        {lead.remark && (
          <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-1 italic">"{lead.remark}"</p>
        )}
      </div>
    </div>
  );
}

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function UpdateStatusModal({ lead, onClose, onSaved, onNotInterested }) {
  const [status,       setStatus]       = useState(lead.status === "Not Interested" ? "In Progress" : (lead.status || "New"));
  const [remark,       setRemark]       = useState(lead.remark || "");
  const [temp,         setTemp]         = useState(lead.Quality || "");
  const [followUpDate, setFollowUpDate] = useState(getTomorrowStr());
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const CLS = "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition";

  const showDatePicker = status !== "Not Interested";

  const handleStatusChange = function(e) {
    const val = e.target.value;
    if (val === "Not Interested") { onNotInterested(); return; }
    setStatus(val);
  };

  const handleSave = async function() {
    setLoading(true); setError("");
    try {
      const body = { status, remark };
      if (status !== "Not Interested") { body.followUpDate = followUpDate || getTomorrowStr(); }
      await api.patch("/lead/" + (lead.id || lead._id), body);
      if (temp) await api.patch("/lead/" + (lead.id || lead._id) + "/Quality", { Quality: temp });
      onSaved(Object.assign({}, lead, { status, remark, Quality: temp || lead.Quality }));
      onClose();
    } catch (e) {
      setError((e.response && e.response.data && e.response.data.message) || "Failed to update");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-6 shadow-2xl" onClick={function(e){ e.stopPropagation(); }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Update Lead</h3>
            <p className="text-[11px] text-[#8B92A9] truncate">{lead.name}</p>
          </div>
        </div>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Status</label>
            <select value={status} onChange={handleStatusChange} className={CLS}>
              {["New","In Progress","Converted","Not Interested"].map(function(s){ return <option key={s}>{s}</option>; })}
            </select>
            <p className="text-[10px] text-amber-500 mt-1">⚠ Selecting "Not Interested" opens the reassignment workflow.</p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Lead Quality</label>
            <select value={temp} onChange={function(e){ setTemp(e.target.value); }} className={CLS}>
              <option value="">— Not set —</option>
              <option>Hot</option><option>Warm</option><option>Cold</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">Remark</label>
            <textarea value={remark} onChange={function(e){ setRemark(e.target.value); }} rows={2} className={CLS + " resize-none"} placeholder="Add a note…" />
          </div>
          {showDatePicker && (
            <div>
              <label className="block text-[11px] font-semibold text-[#8B92A9] mb-1 uppercase tracking-wide">📅 Follow-up Date</label>
              <input type="date" value={followUpDate} min={getTodayStr()} onChange={function(e){ setFollowUpDate(e.target.value); }} className={CLS} />
              <p className="text-[10px] text-[#8B92A9] mt-1">Leave as tomorrow (default) or pick a future date.</p>
            </div>
          )}
        </div>
        {error && <p className="text-[11px] text-red-500 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition disabled:opacity-60">
            {loading ? "Saving…" : "Save Changes"}
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
  const pendingCalls   = scheduledCalls.filter(function(c){ return !c.done; });

  const fmt = function(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-[440px] bg-white dark:bg-[#1A1D27] h-full shadow-2xl overflow-y-auto flex flex-col" onClick={function(e){ e.stopPropagation(); }}>
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black" style={{ background: s.dot + "20", color: s.dot }}>
                {name.split(" ").map(function(n){ return n[0]; }).join("").slice(0,2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{name}</h2>
                <p className="text-[12px] text-[#8B92A9] font-mono">{phone !== "—" ? maskPhone(phone) : "—"}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={lead.status} />
            <TempBadge temp={lead.Quality} />
            {lead.reassignCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                🔄 Reassigned {lead.reassignCount}×
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {[
            { label:"Source",   value:lead.source   || "—", icon:"📡" },
            { label:"Campaign", value:lead.campaign  || "—", icon:"🎯" },
            { label:"Date",     value:lead.date      || "—", icon:"📅" },
            { label:"Remark",   value:lead.remark    || "No remark", icon:"📝" },
          ].map(function(item){ return (
            <div key={item.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-3">
              <p className="text-[9px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-1">{item.icon} {item.label}</p>
              <p className="text-[12px] font-medium text-[#0F1117] dark:text-[#F0F2FA] break-words">{item.value}</p>
            </div>
          ); })}
        </div>

        {callHistory.length > 0 && (
          <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <span>📞</span> Previous Call History ({callHistory.length})
            </p>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {callHistory.map(function(h, i) {
                return (
                  <div key={i} className="px-3 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{h.userName || "Unknown Agent"}</span>
                      <span className="text-[10px] text-[#8B92A9]">{fmt(h.calledAt)}</span>
                    </div>
                    <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB]">{h.remark}</p>
                    {h.outcome && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">{h.outcome}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pendingCalls.length > 0 && (
          <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <span>🗓️</span> Scheduled Follow-ups ({pendingCalls.length} pending)
            </p>
            <div className="space-y-2">
              {pendingCalls.map(function(sc, i) {
                const isPast = new Date(sc.scheduledAt) < new Date();
                return (
                  <div key={i} className={"flex items-center gap-3 px-3 py-2.5 rounded-xl border " + (isPast ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : "bg-[#F8F9FC] dark:bg-[#13161E] border-[#E4E7EF] dark:border-[#262A38]")}>
                    <span className={"w-2 h-2 rounded-full shrink-0 " + (sc.type === "follow-up" ? "bg-blue-500" : "bg-purple-500")} />
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] capitalize">{sc.type}</p>
                      {sc.note && <p className="text-[10px] text-[#8B92A9]">{sc.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className={"text-[11px] font-semibold " + (isPast ? "text-red-500" : "text-[#4B5168] dark:text-[#9DA3BB]")}>{fmt(sc.scheduledAt)}</p>
                      {isPast && <p className="text-[9px] text-red-400 font-bold">OVERDUE</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-6 py-4 space-y-2">
          <button onClick={function(){ setShowUpdate(true); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Update Status / Lead Quality
          </button>
          <button onClick={function(){ setShowNIModal(true); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 text-[13px] font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            Mark Not Interested & Reassign
          </button>
        </div>
        <div className="flex-1" />
      </div>

      {showUpdate && createPortal(
        <UpdateStatusModal
          lead={lead}
          onClose={function(){ setShowUpdate(false); }}
          onNotInterested={function(){ setShowUpdate(false); setShowNIModal(true); }}
          onSaved={function(updated){ onUpdate(updated); setShowUpdate(false); }}
        />,
        document.body
      )}
      {showNIModal && createPortal(
        <NotInterestedModal
          lead={{ ...lead, _id: lead.id || lead._id }}
          onClose={function(){ setShowNIModal(false); }}
          onSuccess={function(updatedLead) {
            onUpdate({ ...updatedLead, _reassigned: true });
            setShowNIModal(false);
            onClose();
          }}
        />,
        document.body
      )}
    </div>
  );
}

function AddLeadModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name:"", phone:"", source:"Google Ads", campaign:"", status:"New", remark:"" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const set = function(k, v) { setForm(function(f){ return Object.assign({}, f, { [k]: v }); }); setErrors(function(e){ return Object.assign({}, e, { [k]: "" }); }); };
  const validate = function() {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Name must be at least 2 characters.";
    if (!form.phone.trim()) e.phone = "Phone is required.";
    else if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "Phone must be exactly 10 digits.";
    return e;
  };
  const handleSubmit = async function() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try {
      const res = await api.post("/lead", { name:form.name.trim(), mobile:form.phone.trim(), source:form.source, campaign:form.campaign.trim()||null, status:form.status, date:new Date(), remark:form.remark.trim()||"Manually added" });
      const saved = res.data;
      onAdd({ id:String(saved._id), name:saved.name, phone:saved.mobile||"", mobile:saved.mobile||"", source:saved.source||"Web Form", campaign:saved.campaign||"—", status:saved.status, Quality:saved.Quality||null, remark:saved.remark||"", date:new Date(saved.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}), _raw_date:saved.date||saved.createdAt||null, callHistory:[], scheduledCalls:[], reassignCount:0 });
      onClose();
    } catch (err) {
      setErrors({ submit:(err.response&&err.response.data&&err.response.data.message)||"Failed to save lead." });
    } finally { setSubmitting(false); }
  };
  const CLS = function(key) { return "w-full px-3 py-2.5 rounded-xl border text-[13px] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none transition " + (errors[key] ? "border-red-400" : "border-[#E4E7EF] dark:border-[#262A38] focus:border-[#2563EB]"); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Add New Lead</h2>
            <p className="text-[11px] text-[#8B92A9]">Assigned to you automatically</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[{label:"Lead Name *",key:"name",placeholder:"Full name"},{label:"Phone *",key:"phone",placeholder:"10-digit number"},{label:"Campaign",key:"campaign",placeholder:"Campaign name"},{label:"Remark",key:"remark",placeholder:"Notes"}].map(function(f){ return (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">{f.label}</label>
              <input type="text" placeholder={f.placeholder} value={form[f.key]} onChange={function(e){ set(f.key, e.target.value); }} className={CLS(f.key)} />
              {errors[f.key] && <span className="text-[11px] text-red-500">{errors[f.key]}</span>}
            </div>
          ); })}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Source</label>
            <select value={form.source} onChange={function(e){ set("source", e.target.value); }} className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none">
              {["Google Ads","Facebook Ads","Web Form","Referral","Campaign","Other"].map(function(s){ return <option key={s}>{s}</option>; })}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Status</label>
            <select value={form.status} onChange={function(e){ set("status", e.target.value); }} className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none">
              {["New","In Progress","Converted"].map(function(s){ return <option key={s}>{s}</option>; })}
            </select>
          </div>
        </div>
        {errors.submit && <p className="text-[12px] text-red-500 mt-3 text-center">{errors.submit}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
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
  const [open, setOpen]         = useState(false);
  const [message, setMessage]   = useState("");
  const [messages, setMessages] = useState([]);
  const [unread, setUnread]     = useState(0);
  const bottomRef = useRef(null);
  const user = JSON.parse(localStorage.getItem("user") || "null");
  useEffect(function() {
    const socket = io(import.meta.env.VITE_SOCKET_URL || "https://skyup-crm-backend.onrender.com", { withCredentials: true });
    socketRef.current = socket;
    socket.emit("user_join", (user && user.name) || "user");
    socket.on("chat_history", function(history) {
      setMessages(history.map(function(m){ return { from: m.from === "admin" ? "Admin" : "You", message: m.message, ts: m.timestamp }; }));
    });
    socket.on("receive_admin_message", function(data) {
      setMessages(function(prev){ return prev.concat([{ from: "Admin", message: data.message }]); });
      setOpen(function(isOpen) { if (!isOpen) setUnread(function(n){ return n + 1; }); return isOpen; });
    });
    return function() { socket.disconnect(); };
  }, []);
  useEffect(function() {
    if (open) { setUnread(0); bottomRef.current && bottomRef.current.scrollIntoView({ behavior: "smooth" }); }
  }, [open, messages]);
  const sendMessage = function() {
    const msg = message.trim();
    if (!msg || !socketRef.current) return;
    socketRef.current.emit("user_message", { message: msg, username: (user && user.name) || "user" });
    setMessages(function(prev){ return prev.concat([{ from: "You", message: msg }]); });
    setMessage("");
  };
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: 400 }}>
          <div className="flex items-center justify-between px-4 py-3 bg-[#2563EB]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[13px] font-semibold text-white">Support Chat</span>
            </div>
            <button onClick={function(){ setOpen(false); }} className="text-white/70 hover:text-white transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-[#F8F9FC] dark:bg-[#13161E]">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[28px] mb-2">👋</p>
                <p className="text-[12px] text-[#8B92A9]">Hi {user && user.name ? user.name.split(" ")[0] : "there"}! How can we help?</p>
              </div>
            )}
            {messages.map(function(m, i){ return (
              <div key={i} className={"flex " + (m.from === "You" ? "justify-end" : "justify-start")}>
                <div className={"max-w-[80%] px-3 py-2 rounded-2xl text-[12px] " + (m.from === "You" ? "bg-[#2563EB] text-white rounded-br-none" : "bg-white dark:bg-[#1A1D27] text-[#0F1117] dark:text-[#F0F2FA] rounded-bl-none border border-[#E4E7EF] dark:border-[#262A38]")}>
                  {m.message}
                </div>
              </div>
            ); })}
            <div ref={bottomRef} />
          </div>
          <div className="px-3 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex gap-2 bg-white dark:bg-[#1A1D27]">
            <input value={message} onChange={function(e){ setMessage(e.target.value); }} onKeyDown={function(e){ if(e.key==="Enter") sendMessage(); }} placeholder="Type a message…"
              className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition" />
            <button onClick={sendMessage} className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center text-white hover:bg-blue-700 transition shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </button>
          </div>
        </div>
      )}
      <button onClick={function(){ setOpen(function(o){ return !o; }); }}
        className="relative w-14 h-14 rounded-full bg-[#2563EB] text-white shadow-lg flex items-center justify-center transition hover:bg-blue-700 hover:scale-105 active:scale-95">
        {open
          ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        }
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning", emoji: "☀️" };
  if (h < 17) return { text: "Good afternoon", emoji: "🌤️" };
  return { text: "Good evening", emoji: "🌙" };
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
    Quality:    l.Quality    || null,
    remark:         l.remark         || "",
    date:           l.date ? new Date(l.date).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "—",
    _raw_date:      l.date           || l.createdAt || null,
    callHistory:    Array.isArray(l.callHistory)    ? l.callHistory    : [],
    scheduledCalls: Array.isArray(l.scheduledCalls) ? l.scheduledCalls : [],
    previousAgents: Array.isArray(l.previousAgents) ? l.previousAgents : [],
    reassignCount:  l.reassignCount  || 0,
  };
}

export default function UserDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
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
  const PER_PAGE = 10;

  const fetchLeads = useCallback(function() {
    setLoading(true);
    api.get("/lead/my-leads")
      .then(function(res) {
        const raw = Array.isArray(res.data) ? res.data : (res.data && res.data.data ? res.data.data : []);
        setLeads(raw.map(mapLead));
        setError("");
      })
      .catch(function() { setError("Failed to load your leads. Please refresh."); })
      .finally(function() { setLoading(false); });
  }, []);

  useEffect(function() { fetchLeads(); }, [fetchLeads]);

  const kpi = useMemo(function() {
    const total      = leads.length;
    const todayLeads = leads.filter(function(l){ return isToday(l.date); }).length;
    const weekLeads  = leads.filter(function(l){ return isThisWeek(l.date); }).length;
    const converted  = leads.filter(function(l){ return l.status === "Converted"; }).length;
    const inProgress = leads.filter(function(l){ return l.status === "In Progress"; }).length;
    const notInt     = leads.filter(function(l){ return l.status === "Not Interested"; }).length;
    const newLeads   = leads.filter(function(l){ return l.status === "New"; }).length;
    const hot        = leads.filter(function(l){ return l.Quality === "Hot"; }).length;
    const warm       = leads.filter(function(l){ return l.Quality === "Warm"; }).length;
    const cold       = leads.filter(function(l){ return l.Quality === "Cold"; }).length;
    const unclassified = leads.filter(function(l){ return !l.Quality; }).length;
    const convRate   = total > 0 ? Math.round((converted / total) * 100) : 0;
    const weekLabels = [];
    const weekData   = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      weekLabels.push(["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()]);
      weekData.push(leads.filter(function(l){ return parseDate(l.date).toDateString() === d.toDateString(); }).length);
    }
    return { total, todayLeads, weekLeads, converted, inProgress, notInt, newLeads, hot, warm, cold, unclassified, convRate, weekLabels, weekData };
  }, [leads]);

  const displayed = useMemo(function() {
    let res = leads.filter(function(l) {
      const q = search.toLowerCase();
      const matchSearch = !q || l.name.toLowerCase().includes(q) || (l.phone||"").includes(q) || (l.campaign||"").toLowerCase().includes(q);
      const matchSt   = filterSt   === "All" || l.status      === filterSt;
      const matchTemp = filterTemp === "All" || l.Quality === filterTemp;
      return matchSearch && matchSt && matchTemp;
    });
    res = res.slice().sort(function(a, b) {
      if (sortBy === "date_desc") return new Date(b._raw_date||0) - new Date(a._raw_date||0);
      if (sortBy === "date_asc")  return new Date(a._raw_date||0) - new Date(b._raw_date||0);
      if (sortBy === "name_asc")  return a.name.localeCompare(b.name);
      if (sortBy === "status")    return a.status.localeCompare(b.status);
      return 0;
    });
    return res;
  }, [leads, search, filterSt, filterTemp, sortBy]);

  const totalPages = Math.ceil(displayed.length / PER_PAGE);
  const paged = displayed.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const recentActivity = useMemo(function() {
    return leads.slice().sort(function(a,b){ return new Date(b._raw_date||0) - new Date(a._raw_date||0); }).slice(0, 8);
  }, [leads]);

  const handleUpdate = function(updated) {
    if (updated._reassigned) {
      setLeads(function(prev){ return prev.filter(function(l){ return l.id !== (updated.id || updated._id); }); });
      setSelected(null);
      return;
    }
    const mapped = updated._id ? mapLead(updated) : updated;
    setLeads(function(prev){ return prev.map(function(l){ return l.id === mapped.id ? Object.assign({}, l, mapped) : l; }); });
    if (selected && selected.id === mapped.id) setSelected(function(s){ return Object.assign({}, s, mapped); });
  };
  const handleAddLead = function(newLead) { setLeads(function(prev){ return [newLead].concat(prev); }); setPage(1); };
  const handleDeleteLead = async function(id) {
    try { await api.delete("/lead/" + id); setLeads(function(prev){ return prev.filter(function(l){ return l.id !== id; }); }); if (selected && selected.id === id) setSelected(null); }
    catch(e) { /* silently ignore */ } finally { setDeleteConfirm(null); }
  };

  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult,    setCsvResult]    = useState(null);

  const downloadCSVTemplate = function() {
    const headers = ["name", "mobile", "email", "source", "campaign", "status", "remark"];
    const example = ["John Doe", "9876543210", "john@example.com", "Website", "Summer Campaign", "New", "Interested in premium plan"];
    const csv = [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const text = await file.text();
      const lines = text.trim().split("\n").map(function(l){ return l.replace(/\r$/, ""); }).filter(Boolean);
      if (lines.length < 2) { setCsvResult({ error: "CSV must have a header row and at least one data row." }); setCsvImporting(false); return; }
      const headers = parseCSVLine(lines[0]).map(function(h){ return h.replace(/\r/g, "").toLowerCase(); });
      const leadsToImport = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach(function(h, idx) { row[h] = (values[idx] || "").replace(/\r/g, "").trim(); });
        const nameVal   = row.name || row["full name"] || row["fullname"] || row["full_name"] || row["contact name"] || row["contact"] || "";
        const mobileVal = row.mobile || row.phone || row["phone number"] || row["phonenumber"] || row["mobile number"] || row["mobile_number"] || row["phone_number"] || row["contact number"] || row["contact_number"] || row["number"] || "";
        if (!nameVal && !mobileVal) continue;
        const cleanMobile = mobileVal.replace(/\D/g, "");
        if (!cleanMobile) { leadsToImport.push({ _skipError: true, name: nameVal || ("Row " + i), reason: "mobile number missing or unrecognised column" }); continue; }
        leadsToImport.push({ name:nameVal, mobile:cleanMobile, email:row.email||"", source:row.source||"CSV Import", campaign:row.campaign||"", status:row.status||"New", date:row.date||null, remark:row.remark||row.notes||"Imported via CSV" });
      }
      const clientErrors = leadsToImport.filter(function(r){ return r._skipError; }).map(function(r, idx){ return { index:idx, row:r.name, message:r.reason }; });
      const validLeads   = leadsToImport.filter(function(r){ return !r._skipError; });
      if (!validLeads.length) { setCsvResult({ error: "No valid rows found. Check that your CSV has 'name' and 'mobile' (or 'phone') columns.", errorDetails: clientErrors }); setCsvImporting(false); return; }
      const res = await api.post("/lead/import-csv", { leads: validLeads });
      const imported = res.data.saved || [];
      setLeads(function(prev) { return imported.map(mapLead).concat(prev); });
      setPage(1);
      const allErrors = (res.data.errors || []).concat(clientErrors);
      setCsvResult({ saved: res.data.savedCount, errors: allErrors.length, total: res.data.total + clientErrors.length, errorDetails: allErrors });
    } catch (err) {
      setCsvResult({ error: (err.response && err.response.data && err.response.data.message) || "Import failed." });
    } finally { setCsvImporting(false); }
  };

  const initials = user && user.name ? user.name.split(" ").map(function(n){ return n[0]; }).join("").slice(0,2).toUpperCase() : "U";

  return (
    <div className="min-h-screen bg-[#F0F4FF] dark:bg-[#0D0F14]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 bg-white dark:bg-[#1A1D27] border-b border-[#E4E7EF] dark:border-[#262A38]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[#8B92A9] dark:text-[#565C75] text-[12px] font-medium">
              {greeting.emoji} {greeting.text}
            </p>
            <h1 className="text-[22px] font-black text-[#0F1117] dark:text-[#F0F2FA] mt-0.5">
              {(user && user.name) || "Agent"}
              <span className="text-[#8B92A9] dark:text-[#565C75] text-[16px] font-normal ml-2">— My Workspace</span>
            </h1>
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Add Lead */}
            <button onClick={function(){ setShowAddModal(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add Lead
            </button>

            {/* Import CSV + Template */}
            <div className="flex items-center rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
              <label
                className={`flex items-center gap-2 px-4 py-2 text-[#4B5168] dark:text-[#9DA3BB] text-[13px] font-semibold hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition cursor-pointer border-r border-[#E4E7EF] dark:border-[#262A38] ${csvImporting ? "opacity-60 cursor-not-allowed" : ""}`}
                title="Import CSV — columns: name, mobile, email, source, campaign, status, remark">
                <input type="file" accept=".csv" className="hidden" disabled={csvImporting} onChange={handleImportCSV}/>
                {csvImporting
                  ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                }
                {csvImporting ? "Importing…" : "Import CSV"}
              </label>
              <button
                onClick={downloadCSVTemplate}
                title="Download CSV template"
                className="flex items-center gap-1.5 px-3 py-2 text-[#2563EB] dark:text-[#4F8EF7] text-[12px] font-semibold hover:bg-[#EEF3FF] dark:hover:bg-[#1A2540] transition whitespace-nowrap">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Template
              </button>
            </div>

            {/* ── Attendance Mini Widget ── */}
            <AttendanceMiniWidget />

            {/* CSV result toast */}
            {csvResult && (
              <div className={`flex flex-col gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold border ${csvResult.error || csvResult.saved === 0 ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400" : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"}`}>
                <div className="flex items-center gap-1.5">
                  {csvResult.error ? csvResult.error : `${csvResult.saved > 0 ? "✓ " : ""}${csvResult.saved}/${csvResult.total} imported${csvResult.errors > 0 ? ` (${csvResult.errors} failed)` : ""}`}
                  <button onClick={function(){ setCsvResult(null); }} className="ml-1 opacity-70 hover:opacity-100">✕</button>
                </div>
                {!csvResult.error && csvResult.errorDetails && csvResult.errorDetails.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5 text-[10px] font-normal opacity-90">
                    {csvResult.errorDetails.map(function(e, i){ return <li key={i}>Row {e.index + 1} ({e.row}): {e.message}</li>; })}
                  </ul>
                )}
              </div>
            )}

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[13px] font-black text-[#2563EB] dark:text-[#4F8EF7] border border-[#C7D7FF] dark:border-[#2D3A6B]">
              {initials}
            </div>
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex-wrap">
          {[
            { label:"My Total Leads", value:kpi.total,          color:"text-[#0F1117] dark:text-[#F0F2FA]" },
            { label:"Today",          value:kpi.todayLeads,     color:"text-[#2563EB] dark:text-[#4F8EF7]" },
            { label:"This Week",      value:kpi.weekLeads,      color:"text-[#2563EB] dark:text-[#4F8EF7]" },
            { label:"Converted",      value:kpi.converted,      color:"text-[#059669] dark:text-[#34D399]" },
            { label:"Conv. Rate",     value:kpi.convRate + "%", color:"text-[#059669] dark:text-[#34D399]" },
          ].map(function(stat){ return (
            <div key={stat.label} className="flex items-center gap-2">
              <span className={"text-[18px] font-black " + stat.color}>{stat.value}</span>
              <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] font-medium">{stat.label}</span>
            </div>
          ); })}
        </div>
      </div>

      <div className="p-6 space-y-6">

        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-[12px] font-medium">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {error}
            <button onClick={fetchLeads} className="ml-auto text-red-600 underline underline-offset-2 font-semibold">Retry</button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="My Total Leads" value={kpi.total}      sub="All assigned to you"             color="#2563EB" icon="👤" />
          <KpiCard label="Converted"      value={kpi.converted}  sub={kpi.convRate + "% success rate"} color="#059669" icon="✅" trendUp={kpi.convRate > 20} trend={kpi.convRate + "% rate"} />
          <KpiCard label="In Progress"    value={kpi.inProgress} sub="Awaiting follow-up"              color="#D97706" icon="⏳" />
          <KpiCard label="Hot Leads "   value={kpi.hot}        sub="Call these first!"               color="#DC2626" icon="" />
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[14px]">🎯</span>
              <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA] uppercase tracking-wide">My Daily Targets</p>
            </div>
            <div className="flex items-center justify-around">
              <RadialProgress value={kpi.todayLeads} max={10} color="#2563EB" label="Leads"   size={80} />
              <RadialProgress value={leads.filter(function(l){ return isToday(l.date) && l.status==="Converted"; }).length} max={5} color="#059669" label="Convert" size={80} />
              <RadialProgress value={leads.filter(function(l){ return isToday(l.date) && l.status==="In Progress"; }).length} max={8} color="#D97706" label="Active"  size={80} />
            </div>
            <p className="text-[9px] text-center text-[#8B92A9] dark:text-[#565C75] mt-3 font-medium uppercase tracking-wide">
              Targets: 10 leads · 5 conversions · 8 follow-ups
            </p>
          </div>

          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px]">📊</span>
              <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA] uppercase tracking-wide">My Weekly Activity</p>
            </div>
            <p className="text-[10px] text-[#8B92A9] mb-4">{kpi.weekLeads} leads added this week</p>
            <MiniBarChart data={kpi.weekData} labels={kpi.weekLabels} color="#2563EB" />
          </div>

          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[14px]">🌡️</span>
              <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA] uppercase tracking-wide">Lead Quality</p>
            </div>
            <div className="space-y-3">
              {[
                { label:"Hot",          count:kpi.hot,          color:"#DC2626", icon:"" },
                { label:"Warm",         count:kpi.warm,         color:"#D97706", icon:"" },
                { label:"Cold",         count:kpi.cold,         color:"#2563EB", icon:"" },
                { label:"Unclassified", count:kpi.unclassified, color:"#8B92A9", icon:"—"  },
              ].map(function(item){ return (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-4 text-center text-[12px]">{item.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>{item.count}</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: (kpi.total > 0 ? (item.count/kpi.total)*100 : 0) + "%", background: item.color }} />
                    </div>
                  </div>
                </div>
              ); })}
            </div>
          </div>
        </div>

        {/* Status filter chips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label:"New",           count:kpi.newLeads,   color:"#2563EB", bg:"bg-blue-50 dark:bg-blue-950/30",       icon:"🆕" },
            { label:"In Progress",   count:kpi.inProgress, color:"#D97706", bg:"bg-amber-50 dark:bg-amber-950/30",     icon:"⏳" },
            { label:"Converted",     count:kpi.converted,  color:"#059669", bg:"bg-emerald-50 dark:bg-emerald-950/30", icon:"✅" },
            { label:"Not Interested",count:kpi.notInt,     color:"#DC2626", bg:"bg-red-50 dark:bg-red-950/30",         icon:"❌" },
          ].map(function(item){ return (
            <button key={item.label}
              onClick={function(){ setFilterSt(filterSt === item.label ? "All" : item.label); setActiveTab("leads"); setPage(1); }}
              className={item.bg + " rounded-xl p-3 flex items-center gap-3 border-2 transition hover:scale-[1.01] " + (filterSt === item.label ? "" : "border-transparent")}
              style={{ borderColor: filterSt === item.label ? item.color : undefined }}>
              <span className="text-[18px]">{item.icon}</span>
              <div className="text-left">
                <p className="text-[18px] font-black" style={{ color: item.color }}>{item.count}</p>
                <p className="text-[10px] font-semibold text-[#8B92A9] leading-tight">{item.label}</p>
              </div>
            </button>
          ); })}
        </div>

        {/* Leads / Activity tabs */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
          <div className="flex items-center border-b border-[#E4E7EF] dark:border-[#262A38] px-5">
            {[
              { id:"leads",    label:"My Leads",        icon:"📋", count:displayed.length },
              { id:"activity", label:"Recent Activity", icon:"🕐", count:recentActivity.length },
            ].map(function(tab){ return (
              <button key={tab.id} onClick={function(){ setActiveTab(tab.id); }}
                className={"flex items-center gap-2 px-4 py-4 text-[12px] font-semibold border-b-2 transition " + (activeTab === tab.id ? "border-[#2563EB] text-[#2563EB] dark:text-[#4F8EF7]" : "border-transparent text-[#8B92A9] dark:text-[#565C75] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]")}>
                <span>{tab.icon}</span>
                {tab.label}
                <span className={"px-1.5 py-0.5 rounded-full text-[10px] font-bold " + (activeTab === tab.id ? "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7]" : "bg-[#F1F4FF] dark:bg-[#1E2130] text-[#8B92A9]")}>{tab.count}</span>
              </button>
            ); })}

            {activeTab === "leads" && (
              <div className="ml-auto flex items-center gap-2 py-2 flex-wrap">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input value={search} onChange={function(e){ setSearch(e.target.value); setPage(1); }} placeholder="Search…"
                    className="pl-7 pr-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] w-36 transition" />
                </div>
                <select value={filterTemp} onChange={function(e){ setFilterTemp(e.target.value); setPage(1); }}
                  className="px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none">
                  <option value="All">All qualities</option><option>Hot</option><option>Warm</option><option>Cold</option>
                </select>
                <select value={sortBy} onChange={function(e){ setSortBy(e.target.value); }}
                  className="px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none">
                  <option value="date_desc">Newest</option><option value="date_asc">Oldest</option><option value="name_asc">Name A–Z</option><option value="status">By Status</option>
                </select>
                {(search || filterSt !== "All" || filterTemp !== "All") && (
                  <button onClick={function(){ setSearch(""); setFilterSt("All"); setFilterTemp("All"); setPage(1); }}
                    className="px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[10px] text-[#8B92A9] hover:text-red-500 hover:border-red-300 transition font-semibold">
                    ✕ Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {activeTab === "leads" && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-[#8B92A9]">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  <span className="text-[13px]">Loading your leads…</span>
                </div>
              ) : paged.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <span className="text-[48px]">{leads.length === 0 ? "📭" : "🔍"}</span>
                  <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{leads.length === 0 ? "No leads yet" : "No leads match your filters"}</p>
                  <p className="text-[12px] text-[#8B92A9]">{leads.length === 0 ? "Add your first lead to get started." : "Try adjusting your search or filters."}</p>
                  {leads.length === 0 && (
                    <button onClick={function(){ setShowAddModal(true); }} className="mt-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">+ Add First Lead</button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                        {["Lead","Phone","Campaign / Source","Date","Status","Lead Quality",""].map(function(h){ return (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ); })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                      {paged.map(function(l){ return (
                        <tr key={l.id} className="hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition cursor-pointer group" onClick={function(){ setSelected(l); }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                                style={{ background: ((STATUS_CONFIG[l.status] && STATUS_CONFIG[l.status].dot) || "#2563EB") + "20", color: (STATUS_CONFIG[l.status] && STATUS_CONFIG[l.status].dot) || "#2563EB" }}>
                                {l.name.split(" ").map(function(n){ return n[0]; }).join("").slice(0,2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">{l.name}</span>
                                {l.reassignCount > 0 && (
                                  <span className="ml-1.5 text-[9px] font-bold text-purple-500">🔄{l.reassignCount}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[#4B5168] dark:text-[#9DA3BB]">{l.phone ? maskPhone(l.phone) : "—"}</td>
                          <td className="px-4 py-3">
                            <p className="text-[#0F1117] dark:text-[#F0F2FA] font-medium truncate max-w-[120px]">{l.campaign !== "—" ? l.campaign : l.source}</p>
                            {l.campaign !== "—" && <p className="text-[10px] text-[#8B92A9]">{l.source}</p>}
                          </td>
                          <td className="px-4 py-3 text-[#8B92A9] dark:text-[#565C75] whitespace-nowrap">
                            <div>
                              <p>{l.date}</p>
                              {isToday(l.date) && <span className="text-[9px] font-bold text-emerald-500">TODAY</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                          <td className="px-4 py-3"><TempBadge temp={l.Quality} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button onClick={function(e){ e.stopPropagation(); setSelected(l); }} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#2563EB] hover:border-[#2563EB] transition" title="View details">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                              </button>
                              <button onClick={function(e){ e.stopPropagation(); setDeleteConfirm(l); }} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-red-500 hover:border-red-400 transition" title="Delete lead">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                </div>
              )}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between bg-[#F8F9FC] dark:bg-[#13161E]">
                  <span className="text-[11px] text-[#8B92A9]">Showing {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE, displayed.length)} of {displayed.length} leads</span>
                  <div className="flex items-center gap-1">
                    <button onClick={function(){ setPage(function(p){ return Math.max(1, p-1); }); }} disabled={page === 1} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, function(_, i){ const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i; return (
                      <button key={n} onClick={function(){ setPage(n); }} className={"w-7 h-7 rounded-lg text-[11px] font-semibold transition " + (page === n ? "bg-[#2563EB] text-white" : "border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27]")}>{n}</button>
                    ); })}
                    <button onClick={function(){ setPage(function(p){ return Math.min(totalPages, p+1); }); }} disabled={page === totalPages} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
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
                <div className="text-center py-12">
                  <p className="text-[32px] mb-2">📭</p>
                  <p className="text-[13px] text-[#8B92A9]">No recent activity yet.</p>
                </div>
              ) : (
                <div>
                  <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-wide mb-4">Latest 8 lead interactions</p>
                  {recentActivity.map(function(lead, i){ return (
                    <ActivityItem key={lead.id} lead={lead} isLast={i === recentActivity.length - 1} />
                  ); })}
                </div>
              )}
            </div>
          )}
        </div>

        {!loading && kpi.total > 0 && (
          <div className="rounded-2xl p-4 flex items-center gap-4 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38]">
            <span className="text-[28px]">
              {kpi.convRate >= 50 ? "🏆" : kpi.convRate >= 30 ? "💪" : kpi.convRate >= 15 ? "📈" : "🚀"}
            </span>
            <div>
              <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                {kpi.convRate >= 50 ? "Outstanding performance! You're a top converter!" :
                 kpi.convRate >= 30 ? "Great work! Your conversion rate is above average." :
                 kpi.convRate >= 15 ? "Good progress! Keep following up on hot leads." :
                 "Every lead counts — focus on your hot leads today! "}
              </p>
              <p className="text-[11px] text-[#8B92A9] mt-0.5">
                {kpi.hot > 0 ? "You have " + kpi.hot + " hot lead" + (kpi.hot > 1 ? "s" : "") + " waiting for a call." : "Classify leads by Quality to prioritize your calls."}
              </p>
            </div>
          </div>
        )}

      </div>

      {selected && <LeadDrawer lead={selected} onClose={function(){ setSelected(null); }} onUpdate={handleUpdate} />}
      {showAddModal && <AddLeadModal onClose={function(){ setShowAddModal(false); }} onAdd={handleAddLead} />}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] text-center mb-2">Delete Lead?</h2>
            <p className="text-[12px] text-[#8B92A9] text-center mb-5">This will permanently remove <strong className="text-[#0F1117] dark:text-[#F0F2FA]">{deleteConfirm.name}</strong> from your list.</p>
            <div className="flex gap-2">
              <button onClick={function(){ setDeleteConfirm(null); }} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
              <button onClick={function(){ handleDeleteLead(deleteConfirm.id); }} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      <UserChatWidget />
    </div>
  );
}