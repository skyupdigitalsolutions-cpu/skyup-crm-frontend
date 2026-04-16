import { useState, useEffect, useCallback } from "react";
import api from "../data/axiosConfig";

function fmt(mins) {
  if (!mins) return "0h 00m";
  return `${Math.floor(mins / 60)}h ${(mins % 60).toString().padStart(2, "0")}m`;
}
function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE = {
  active:       { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400",  badge: "bg-emerald-50 dark:bg-emerald-950/40",  label: "Active" },
  on_break:     { dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400",      badge: "bg-amber-50 dark:bg-amber-950/40",      label: "On Break" },
  idle:         { dot: "bg-red-500 animate-pulse", text: "text-red-600 dark:text-red-400", badge: "bg-red-50 dark:bg-red-950/40",          label: "Idle" },
  logged_out:   { dot: "bg-gray-400",    text: "text-gray-500 dark:text-gray-400",         badge: "bg-gray-50 dark:bg-gray-900/40",         label: "Logged Out" },
  not_logged_in:{ dot: "bg-gray-300",    text: "text-gray-400",                            badge: "bg-gray-50 dark:bg-gray-900/40",         label: "Not In" },
};

export default function AdminAttendanceView() {
  const [records, setRecords] = useState([]);
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(`/attendance/company?date=${date}`);
      setRecords(res.data || []);
    } catch {}
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  const summary = {
    active:    records.filter(r => r.status === "active").length,
    on_break:  records.filter(r => r.status === "on_break").length,
    idle:      records.filter(r => r.status === "idle").length,
    logged_out:records.filter(r => r.status === "logged_out").length,
    not_in:    records.filter(r => r.status === "not_logged_in").length,
  };

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">Team Attendance</h3>
          <p className="text-[11px] text-gray-400">Auto-refreshes every 30s</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} max={new Date().toISOString().slice(0,10)}
            onChange={e => setDate(e.target.value)}
            className="text-[12px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0D0F14] rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300" />
          <button onClick={fetchData} className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 text-[12px] font-bold hover:bg-blue-100 transition">↻ Refresh</button>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[["Active", summary.active, "emerald"], ["On Break", summary.on_break, "amber"], ["Idle", summary.idle, "red"], ["Logged Out", summary.logged_out, "gray"], ["Not In", summary.not_in, "slate"]].map(([label, count, color]) => (
          <span key={label} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full bg-${color}-50 dark:bg-${color}-950/40 text-${color}-600 dark:text-${color}-400`}>
            {label}: {count}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {records.map((rec, i) => {
            const st = STATUS_STYLE[rec.status] || STATUS_STYLE["not_logged_in"];
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-[12px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                  {(rec.user?.name || "?").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{rec.user?.name || "Unknown"}</p>
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.badge} ${st.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                    {rec.status === "idle" && (
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full">⚠ IDLE</span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-0.5 text-[10px] text-gray-400 flex-wrap">
                    <span>In: {fmtTime(rec.loginTime)}</span>
                    {rec.logoutTime && <span>Out: {fmtTime(rec.logoutTime)}</span>}
                    <span>Work: {fmt(rec.liveWorkMinutes ?? rec.totalWorkMinutes)}</span>
                    <span>Breaks: {fmt(rec.totalBreakMinutes)}</span>
                    {rec.breaks?.length > 0 && <span>{rec.breaks.length} break{rec.breaks.length > 1 ? "s" : ""}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}