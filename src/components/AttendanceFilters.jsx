import { useState, useEffect } from "react";
import { fetchAttendanceUsers } from "../services/attendanceService";

const STATUS_OPTIONS = [
  { value: "",         label: "All Statuses" },
  { value: "present",  label: "Present" },
  { value: "absent",   label: "Absent" },
  { value: "late",     label: "Late" },
  { value: "half_day", label: "Half-Day" },
  { value: "leave",    label: "Leave" },
];

function getQuickRange(type) {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);

  if (type === "today") return { startDate: today, endDate: today };

  if (type === "week") {
    const day  = now.getDay(); // 0=Sun
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const mon  = new Date(now.setDate(diff));
    const sun  = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return {
      startDate: mon.toISOString().slice(0, 10),
      endDate:   sun.toISOString().slice(0, 10),
    };
  }

  if (type === "month") {
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1).toISOString().slice(0, 10);
    const last  = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    return { startDate: first, endDate: last };
  }

  if (type === "year") {
    const y = now.getFullYear();
    return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
  }

  return { startDate: today, endDate: today };
}

export default function AttendanceFilters({ filters, onChange }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchAttendanceUsers()
      .then(setUsers)
      .catch(() => {});
  }, []);

  const set = (key, val) => onChange({ ...filters, [key]: val });

  const applyQuick = (type) => {
    const { startDate, endDate } = getQuickRange(type);
    onChange({ ...filters, startDate, endDate, quick: type });
  };

  const QUICK_BTNS = [
    { label: "Today",   key: "today" },
    { label: "Week",    key: "week"  },
    { label: "Month",   key: "month" },
    { label: "Year",    key: "year"  },
  ];

  const inputCls =
    "text-[12px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0D0F14] rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/50";

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 mb-4">
      {/* Quick range buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_BTNS.map(({ label, key }) => (
          <button
            key={key}
            onClick={() => applyQuick(key)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition
              ${filters.quick === key
                ? "bg-indigo-600 text-white shadow"
                : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">From</label>
          <input
            type="date"
            value={filters.startDate}
            max={filters.endDate || new Date().toISOString().slice(0, 10)}
            onChange={e => set("startDate", e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">To</label>
          <input
            type="date"
            value={filters.endDate}
            min={filters.startDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => set("endDate", e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Employee filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Employee</label>
          <select
            value={filters.userId || ""}
            onChange={e => set("userId", e.target.value)}
            className={inputCls}
          >
            <option value="">All Employees</option>
            {users.map(u => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</label>
          <select
            value={filters.crmStatus || ""}
            onChange={e => set("crmStatus", e.target.value)}
            className={inputCls}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Reset */}
        <button
          onClick={() => onChange({ startDate: new Date().toISOString().slice(0,10), endDate: new Date().toISOString().slice(0,10), userId: "", crmStatus: "", quick: "today" })}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
        >
          Reset
        </button>
      </div>
    </div>
  );
}