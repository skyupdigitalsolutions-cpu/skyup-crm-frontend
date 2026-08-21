import { useState, useEffect, useRef, useCallback } from "react";
import api from "../data/axiosConfig";
import { Moon } from "lucide-react";
// FIX (clock/timezone bug): this component used to have its own local
// fmtTime() that called toLocaleTimeString("en-IN", {...}) with no
// `timeZone`, so it silently rendered in the *browser's* local timezone
// instead of IST — even though utils/dateUtils.js already exists as the
// single, IST-forced source of truth for date/time formatting across the
// app. Using it here means this widget always matches the mobile app and
// the rest of the website, regardless of the viewer's machine/browser TZ.
import { formatTime } from "../utils/dateUtils";
import IdleRemarkModal from "./IdleRemarkModal";

const IDLE_MS         = 5 * 60 * 1000;
const IDLE_PROMPT_MS  = 5 * 60 * 1000; // re-prompt every 5 min while still idle

function fmt(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function fmtTime(d) {
  if (!d) return "—";
  return formatTime(d);
}

export default function AttendancePanel() {
  const [record,      setRecord]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [elapsed,     setElapsed]     = useState(0);
  const [idleWarning, setIdleWarning] = useState(false);

  // ── Idle-remark popup state ─────────────────────────────────────────────
  const [showIdleModal, setShowIdleModal] = useState(false);
  const [idleModalMode,  setIdleModalMode]  = useState("recurring"); // "recurring" | "resume"

  const idleTimerRef       = useRef(null);
  const pingTimerRef       = useRef(null);
  const tickTimerRef       = useRef(null);
  const idlePromptTimerRef = useRef(null);
  const pendingResumeRef   = useRef(false); // true once movement was detected while idle

  // ── Fetch today's record ──────────────────────────────────────────────────
  const fetchRecord = useCallback(async () => {
    try {
      const res = await api.get("/attendance/my-today");
      setRecord(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  // ── Live work timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!record?.loginTime || record?.logoutTime) {
      setElapsed(0);
      return;
    }

    const tick = () => {
      const ongoingBreakMins =
        record.activeBreakIndex !== null && record.activeBreakIndex !== undefined
          ? Math.round(
              (Date.now() - new Date(record.breaks?.[record.activeBreakIndex]?.startTime || Date.now())) / 60000
            )
          : 0;
      const breakMins = (record.totalBreakMinutes || 0) + ongoingBreakMins;
      const secs = Math.max(
        0,
        Math.round((Date.now() - new Date(record.loginTime)) / 1000) - breakMins * 60
      );
      setElapsed(secs);
    };

    tick();
    tickTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickTimerRef.current);
  }, [record]);

  // ── Ping every 60 s ───────────────────────────────────────────────────────
  // FIX: this used to fire-and-forget — the response (which tells us whether
  // the backend just auto-resumed an idle session back to "active") was
  // discarded entirely. So after 5 min idle → auto-break → then the employee
  // resumes working without ever clicking "Resume" (the banner was already
  // dismissed on their first mouse move), the backend correctly flips them
  // back to active on the next ping, but this widget kept showing the red
  // "Idle" badge indefinitely — no button left to fix it, only a full page
  // reload would. This component has no socket connection (unlike
  // UserDashboard.jsx / mobile, which pick this up via the backend's
  // matching emitAttendanceUpdate fix), so it has to apply its own response.
  useEffect(() => {
    if (!record?.loginTime || record?.logoutTime) return;
    pingTimerRef.current = setInterval(async () => {
      try {
        const res = await api.post("/attendance/ping");
        if (res.data?.status && res.data.status !== "idle") {
          setRecord((prev) => (prev ? { ...prev, status: res.data.status, activeBreakIndex: null } : prev));
        }
      } catch {}
    }, 60_000);
    return () => clearInterval(pingTimerRef.current);
  }, [record?.loginTime, record?.logoutTime]);

  // ── Idle detection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!record?.loginTime || record?.logoutTime || record?.status !== "active") return;

    const goIdle = async () => {
      try {
        const res = await api.post("/attendance/break/start", { reason: "Auto Idle" });
        setRecord(res.data);
        // FIX (mobile/web not in sync): the backend now guards Auto-Idle
        // requests against cross-device activity — if the employee has
        // been active on another device (e.g. still on a call in the
        // mobile app) within the idle cutoff, it keeps status "active"
        // instead of honoring this browser tab's own idle timer. Only show
        // the "you've been idle" banner when the record actually went
        // idle, so the web UI doesn't falsely claim idle while the
        // employee is demonstrably working elsewhere.
        setIdleWarning(res.data?.status === "idle");
      } catch {}
    };

    const resetIdle = () => {
      setIdleWarning(false);
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(goIdle, IDLE_MS);
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

    // Show immediately on going idle, then every 5 min after.
    setIdleModalMode("recurring");
    setShowIdleModal(true);
    idlePromptTimerRef.current = setInterval(() => {
      setIdleModalMode("recurring");
      setShowIdleModal(true);
    }, IDLE_PROMPT_MS);

    return () => clearInterval(idlePromptTimerRef.current);
  }, [record?.status]);

  // ── Idle-remark: any movement while idle → prompt for remark, then resume ──
  // The regular idle-detection effect above only attaches its listeners while
  // status is "active" (it's what WATCHES for going idle). This is the
  // opposite case — the employee is currently idle and just moved the mouse /
  // typed / tapped, which should immediately surface the remark prompt and
  // resume the session right on dismissal, instead of silently waiting for
  // the next 60s background ping to catch it.
  useEffect(() => {
    if (record?.status !== "idle") { pendingResumeRef.current = false; return; }

    const onMove = () => {
      if (pendingResumeRef.current) return; // already captured this resume
      pendingResumeRef.current = true;
      setIdleModalMode("resume");
      setShowIdleModal(true);
    };

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, onMove, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onMove));
  }, [record?.status]);

  // ── Idle-remark: close the popup if idle ends through some OTHER path ──────
  // The pre-existing "Resume" button (in the idleWarning banner and the
  // regular action row) calls endBreak() directly, bypassing this popup
  // entirely. Without this, a recurring/resume popup that happened to be
  // open at that moment would keep showing stale content after the employee
  // already resumed through the other button.
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
  const resumeNow = async () => {
    try {
      const r = await api.post("/attendance/break/end");
      setRecord(r.data);
      setIdleWarning(false);
    } catch {}
  };

  const closeIdleModal = async (didResume) => {
    setShowIdleModal(false);
    if (idleModalMode === "resume" || didResume) {
      pendingResumeRef.current = false;
      await resumeNow();
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
    try {
      await api.post("/attendance/idle-remark", { remark: "" }); // explicit skip, stays pending
    } catch {}
    closeIdleModal();
  };

  const handleSavePendingRemark = async (breakIndex, text) => {
    try {
      const r = await api.post("/attendance/idle-remark", { remark: text, breakIndex });
      setRecord((prev) => (prev ? { ...prev, breaks: r.data?.breaks || prev.breaks } : prev));
    } catch {}
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const clockIn = async () => {
    try {
      const r = await api.post("/attendance/clock-in");
      setRecord(r.data);
    } catch (e) {
      alert(e.response?.data?.message || "Clock-in failed.");
    }
  };

  const clockOut = async () => {
    if (!window.confirm("Clock out for today?")) return;
    try {
      const r = await api.post("/attendance/clock-out");
      setRecord(r.data);
    } catch (e) {
      alert(e.response?.data?.message || "Clock-out failed.");
    }
  };

  const startBreak = async () => {
    try {
      const r = await api.post("/attendance/break/start", { reason: "Manual Break" });
      setRecord(r.data);
    } catch (e) {
      alert(e.response?.data?.message || "Error starting break.");
    }
  };

  const endBreak = async () => {
    setIdleWarning(false);
    try {
      const r = await api.post("/attendance/break/end");
      setRecord(r.data);
    } catch (e) {
      alert(e.response?.data?.message || "Error ending break.");
    }
  };

  // ── Status config ─────────────────────────────────────────────────────────
  const STATUS = {
    active:     { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", label: "● Active"     },
    on_break:   { bg: "bg-amber-50 dark:bg-amber-950/40",     text: "text-amber-600 dark:text-amber-400",     label: "⏸ On Break"  },
    idle:       { bg: "bg-red-50 dark:bg-red-950/40",         text: "text-red-600 dark:text-red-400",         Icon: Moon, label: "Idle"     },
    logged_out: { bg: "bg-gray-50 dark:bg-gray-900/40",       text: "text-gray-500 dark:text-gray-400",       label: "⏹ Logged Out" },
  };
  const st = STATUS[record?.status] ?? STATUS.logged_out;

  if (loading) return <div className="h-32 animate-pulse bg-gray-100 dark:bg-white/5 rounded-2xl" />;

  const notClockedIn = !record?.loginTime;
  const isClockedOut = !!record?.logoutTime;
  const onBreak      = record?.status === "on_break" || record?.status === "idle";

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-bold text-gray-800 dark:text-gray-100">Attendance</h3>
          <p className="text-[11px] text-gray-400">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", day: "2-digit", month: "short", year: "numeric",
            })}
          </p>
        </div>
        {record && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>
            {st.Icon && <st.Icon className="w-3 h-3" />}{st.label}
          </span>
        )}
      </div>

      {/* Idle warning */}
      {idleWarning && (
        <div className="mb-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-red-600 dark:text-red-400">You've been idle for 5 minutes</p>
            <p className="text-[12px] text-red-400">Break started automatically. Click Resume to continue.</p>
          </div>
          <button
            onClick={endBreak}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[12px] font-bold transition"
          >
            Resume
          </button>
        </div>
      )}

      {/* Stats */}
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
              {fmt(record.totalBreakMinutes || 0)}
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
          <button
            onClick={clockIn}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold transition"
          >
            Clock In
          </button>
        )}

        {record?.loginTime && !isClockedOut && (
          <>
            {!onBreak && (
              <button
                onClick={startBreak}
                className="flex-1 py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[13px] font-bold transition"
              >
                Break
              </button>
            )}
            {onBreak && (
              <button
                onClick={endBreak}
                className="flex-1 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-400 text-[13px] font-bold transition"
              >
                Resume
              </button>
            )}
            <button
              onClick={clockOut}
              className="flex-1 py-2.5 rounded-xl bg-red-100 dark:bg-red-950/40 hover:bg-red-200 text-red-600 dark:text-red-400 text-[13px] font-bold transition"
            >
              Clock Out
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
          <div className="space-y-2">
            {record.breaks.map((b, i) => (
              <div key={i} className="text-[11px]">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${
                    b.reason === "Auto Idle"
                      ? "bg-red-50 dark:bg-red-950/40 text-red-500"
                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-600"
                  }`}>
                    {b.reason}
                  </span>
                  <span className="text-gray-400">
                    {fmtTime(b.startTime)} → {b.endTime ? fmtTime(b.endTime) : "ongoing"}
                    {b.durationMinutes != null ? ` (${b.durationMinutes}m)` : ""}
                  </span>
                </div>
                {b.reason === "Auto Idle" && (
                  b.remarkStatus === "filled" ? (
                    <p className="text-[10px] text-gray-500 italic mt-1">"{b.remark}"</p>
                  ) : b.remarkStatus === "pending" ? (
                    <p className="text-[10px] text-amber-500 font-semibold mt-1">Reason pending</p>
                  ) : null
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <IdleRemarkModal
        open={showIdleModal}
        mode={idleModalMode}
        idleSince={currentIdleBreak?.startTime}
        pendingBreaks={pastPendingBreaks}
        onSave={handleSaveIdleRemark}
        onSkip={handleSkipIdleRemark}
        onSavePending={handleSavePendingRemark}
      />
    </div>
  );
}
