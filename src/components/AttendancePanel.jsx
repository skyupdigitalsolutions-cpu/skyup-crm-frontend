import { useState, useEffect, useRef, useCallback } from "react";
import api from "../data/axiosConfig";

const IDLE_MS = 5 * 60 * 1000; // 5 minutes

function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function AttendancePanel() {
  const [record, setRecord]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [elapsed, setElapsed]     = useState(0);  // live work seconds
  const [idleWarning, setIdleWarning] = useState(false);

  const lastMoveRef   = useRef(Date.now());
  const idleTimerRef  = useRef(null);
  const pingTimerRef  = useRef(null);
  const tickTimerRef  = useRef(null);

  // ── Fetch today's record ───────────────────────────────────────────────────
  const fetchRecord = useCallback(async () => {
    try {
      const res = await api.get("/attendance/my-today");
      setRecord(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  // ── Live work timer ────────────────────────────────────────────────────────
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

  // ── Ping activity every 60s ───────────────────────────────────────────────
  useEffect(() => {
    if (!record?.loginTime || record?.logoutTime) return;
    pingTimerRef.current = setInterval(async () => {
      try { await api.post("/attendance/ping"); } catch {}
    }, 60000);
    return () => clearInterval(pingTimerRef.current);
  }, [record?.loginTime, record?.logoutTime]);

  // ── Idle detection ────────────────────────────────────────────────────────
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
      try {
        const res = await api.post("/attendance/break/start", { reason: "Auto Idle" });
        setRecord(res.data);
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

  // ── Actions ───────────────────────────────────────────────────────────────
  const clockIn = async () => {
    try { const r = await api.post("/attendance/clock-in"); setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); }
  };
  const clockOut = async () => {
    if (!confirm("Clock out for today?")) return;
    try { const r = await api.post("/attendance/clock-out"); setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); }
  };
  const startBreak = async () => {
    try { const r = await api.post("/attendance/break/start", { reason: "Manual Break" }); setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); }
  };
  const endBreak = async () => {
    setIdleWarning(false);
    try { const r = await api.post("/attendance/break/end"); setRecord(r.data); } catch (e) { alert(e.response?.data?.message || "Error"); }
  };

  // ── Status badge ──────────────────────────────────────────────────────────
  const STATUS = {
    active:      { color: "#059669", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", label: "● Active" },
    on_break:    { color: "#D97706", bg: "bg-amber-50 dark:bg-amber-950/40",    text: "text-amber-600 dark:text-amber-400",    label: "⏸ On Break" },
    idle:        { color: "#DC2626", bg: "bg-red-50 dark:bg-red-950/40",         text: "text-red-600 dark:text-red-400",         label: "💤 Idle" },
    logged_out:  { color: "#8B92A9", bg: "bg-gray-50 dark:bg-gray-900/40",       text: "text-gray-500 dark:text-gray-400",        label: "⏹ Logged Out" },
  };
  const st = STATUS[record?.status] || STATUS["logged_out"];

  if (loading) return <div className="h-32 animate-pulse bg-gray-100 dark:bg-white/5 rounded-2xl" />;

  const notClockedIn = !record || !record.loginTime;
  const isClockedOut = record?.logoutTime;

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-bold text-gray-800 dark:text-gray-100">Attendance</h3>
          <p className="text-[11px] text-gray-400">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>
        {record && (
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>
            {st.label}
          </span>
        )}
      </div>

      {/* Idle warning banner */}
      {idleWarning && (
        <div className="mb-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold text-red-600 dark:text-red-400">⚠️ You've been idle for 5 minutes</p>
            <p className="text-[11px] text-red-400">Break started automatically. Click Resume to continue.</p>
          </div>
          <button onClick={endBreak} className="shrink-0 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[12px] font-bold transition">Resume</button>
        </div>
      )}

      {/* Stats row */}
      {record?.loginTime && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3 text-center">
            <p className="text-[11px] text-gray-400 mb-1">Work Time</p>
            <p className="text-[16px] font-black text-gray-800 dark:text-gray-100">
              {fmt(Math.floor(elapsed / 60))}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3 text-center">
            <p className="text-[11px] text-gray-400 mb-1">Break Time</p>
            <p className="text-[16px] font-black text-amber-500">
              {fmt(record.totalBreakMinutes)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3 text-center">
            <p className="text-[11px] text-gray-400 mb-1">Login</p>
            <p className="text-[16px] font-black text-gray-800 dark:text-gray-100">
              {fmtTime(record.loginTime)}
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {notClockedIn && (
          <button onClick={clockIn} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold transition">
            🟢 Clock In
          </button>
        )}
        {record?.loginTime && !isClockedOut && (
          <>
            {record.status !== "on_break" && record.status !== "idle" && (
              <button onClick={startBreak} className="flex-1 py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[13px] font-bold transition">
                ⏸ Break
              </button>
            )}
            {(record.status === "on_break" || record.status === "idle") && (
              <button onClick={endBreak} className="flex-1 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-400 text-[13px] font-bold transition">
                ▶ Resume
              </button>
            )}
            <button onClick={clockOut} className="flex-1 py-2.5 rounded-xl bg-red-100 dark:bg-red-950/40 hover:bg-red-200 text-red-600 dark:text-red-400 text-[13px] font-bold transition">
              ⏹ Clock Out
            </button>
          </>
        )}
        {isClockedOut && (
          <div className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-center text-[13px] text-gray-400 font-semibold">
            Clocked out at {fmtTime(record.logoutTime)}
          </div>
        )}
      </div>

      {/* Break log */}
      {record?.breaks?.length > 0 && (
        <div className="mt-4 border-t border-gray-100 dark:border-white/5 pt-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Break Log</p>
          <div className="space-y-1.5">
            {record.breaks.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${b.reason === "Auto Idle" ? "bg-red-50 dark:bg-red-950/40 text-red-500" : "bg-amber-50 dark:bg-amber-950/40 text-amber-600"}`}>
                  {b.reason}
                </span>
                <span className="text-gray-400">
                  {fmtTime(b.startTime)} → {b.endTime ? fmtTime(b.endTime) : "ongoing"} {b.durationMinutes != null ? `(${b.durationMinutes}m)` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}