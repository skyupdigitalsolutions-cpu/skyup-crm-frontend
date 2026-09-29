// src/pages/Admin/CallMonitoring.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin Call Monitoring — SIM-based call analytics for the team, built from the
// call logs the SKYUP mobile app syncs (MobileCallLog).
//
// Tabs:
//   Summary        call-type totals, incoming/outgoing split, per-employee report
//   Clients        one row per unique phone number (the "Unique clients" figure)
//   Analysis       daily trend, hour-of-day activity, call length mix, top numbers
//   Never Attended missed callers nobody has connected with since
//   Call History   searchable, filterable list with inline recording playback
//   Recordings     calls that have an uploaded recording (plan: call-recording)
//
// Every number is a drill-down: clicking it opens the matching calls (or
// clients) through a single onDrill({ tab, callType, userId, phone, sort, date }).
//
// Backend: GET /api/call-logs/monitoring/{summary,history,never-attended,clients}
// Phone numbers are masked for admins (eye toggle to reveal), shown in full for
// super admins — same convention as AttendanceTable.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, Phone, PhoneCall,
  RefreshCw, Download, Search, Eye, EyeOff, Users, Clock, UserCheck,
  BarChart3, History, Mic, AlertCircle, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, X, PhoneForwarded, Smartphone, Contact, ChevronRight as Chevron,
} from "lucide-react";
import api, { clearCache } from "../../data/axiosConfig";
import { getUser } from "../../data/sessionStore";
import { maskPhone } from "../../utils/maskPhone";
import useEntitlements from "../../hooks/useEntitlements";

// ── Formatting helpers ────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

// 1666 → "00:27:46" (matches the call-monitoring convention of HH:MM:SS)
function fmtHMS(secs) {
  const s = Math.max(0, Math.round(secs || 0));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function fmtShortDur(secs) {
  const s = Math.max(0, Math.round(secs || 0));
  if (s === 0) return "0s";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${r}s`;
  return `${r}s`;
}

function fmtMinutes(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}

function fmtDateTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtHour(h) {
  const suffix = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${suffix}`;
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Local calendar date key (YYYY-MM-DD) — en-CA formats as ISO date.
const dayKey = (d) => d.toLocaleDateString("en-CA");
// Parse "YYYY-MM-DD" as a LOCAL date (new Date("YYYY-MM-DD") would be UTC).
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const TZ_OFFSET = -new Date().getTimezoneOffset();

const RANGE_PRESETS = [
  { key: "today",     label: "Today",        get: () => [dayKey(new Date()), dayKey(new Date())] },
  { key: "yesterday", label: "Yesterday",    get: () => { const y = dayKey(addDays(new Date(), -1)); return [y, y]; } },
  { key: "7d",        label: "Last 7 days",  get: () => [dayKey(addDays(new Date(), -6)), dayKey(new Date())] },
  { key: "30d",       label: "Last 30 days", get: () => [dayKey(addDays(new Date(), -29)), dayKey(new Date())] },
];

// ── Call type presentation ────────────────────────────────────────────────────
const TYPE_META = {
  incoming:  { label: "Incoming",  Icon: PhoneIncoming, text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", bar: "bg-emerald-500" },
  outgoing:  { label: "Outgoing",  Icon: PhoneOutgoing, text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-500/10",       bar: "bg-blue-500" },
  missed:    { label: "Missed",    Icon: PhoneMissed,   text: "text-red-600 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-500/10",         bar: "bg-red-500" },
  rejected:  { label: "Rejected",  Icon: PhoneOff,      text: "text-orange-600 dark:text-orange-400",   bg: "bg-orange-50 dark:bg-orange-500/10",   bar: "bg-orange-400" },
  voicemail: { label: "Voicemail", Icon: Phone,         text: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-50 dark:bg-purple-500/10",   bar: "bg-purple-400" },
  blocked:   { label: "Blocked",   Icon: PhoneOff,      text: "text-slate-600 dark:text-slate-400",     bg: "bg-slate-100 dark:bg-slate-500/10",    bar: "bg-slate-400" },
  unknown:   { label: "Other",     Icon: Phone,         text: "text-slate-500 dark:text-slate-400",     bg: "bg-slate-100 dark:bg-slate-500/10",    bar: "bg-slate-300" },
};

function CallTypeBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.unknown;
  const Icon = m.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${m.bg} ${m.text}`}>
      <Icon className="w-3 h-3" />{m.label}
    </span>
  );
}

// ── Data hooks ────────────────────────────────────────────────────────────────
// Fetches `url` whenever it (or refreshKey) changes. Responses for an older
// url are dropped, so fast filter changes can't paint stale data. The last
// good data stays on screen while the next request is in flight.
function useApi(url, refreshKey = 0) {
  const key = `${url}#${refreshKey}`;
  const [res, setRes] = useState({ key: null, data: null, error: "" });
  const [retryN, setRetryN] = useState(0);
  const fullKey = `${key}#${retryN}`;

  useEffect(() => {
    if (!url) return undefined;
    let alive = true;
    api.get(url)
      .then((r) => { if (alive) setRes({ key: fullKey, data: r.data, error: "" }); })
      .catch((err) => {
        if (alive) setRes((prev) => ({
          key: fullKey, data: prev.data,
          error: err?.response?.data?.message || "Couldn't load this data. Check your connection and try again.",
        }));
      });
    return () => { alive = false; };
  }, [url, fullKey]);

  return {
    data: res.data,
    error: res.key === fullKey ? res.error : "",
    loading: res.key !== fullKey,
    retry: () => setRetryN((n) => n + 1),
  };
}

// Page number that snaps back to 1 whenever `resetKey` changes (filters).
function usePage(resetKey) {
  const [st, setSt] = useState({ resetKey, page: 1 });
  const page = st.resetKey === resetKey ? st.page : 1;
  return [page, (p) => setSt({ resetKey, page: p })];
}

// ── Shared UI bits ────────────────────────────────────────────────────────────
const card = "bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl";
const th   = "px-3 py-2.5 text-[11px] font-semibold text-[#8B92A9] whitespace-nowrap";
const td   = "px-3 py-2.5 text-[13px] text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap";

function PhoneText({ phone, isSuperAdmin, className = "" }) {
  const [revealed, setRevealed] = useState(false);
  if (!phone) return <span className={`text-[#8B92A9] ${className}`}>—</span>;
  if (isSuperAdmin) return <span className={`font-mono ${className}`}>{phone}</span>;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="font-mono tracking-wide select-none">{revealed ? phone : maskPhone(phone)}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setRevealed((v) => !v); }}
        className="p-0.5 rounded text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        aria-label={revealed ? "Hide number" : "Show number"}
      >
        {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}

// A number that opens the calls behind it. Zero / no handler → plain text.
function DrillNum({ value, onClick, title, className = "" }) {
  const n = typeof value === "number" ? value : null;
  if (!onClick || n === 0) return <span className={className}>{value}</span>;
  return (
    <button type="button" onClick={onClick} title={title}
      className={`${className} tabular-nums rounded underline decoration-dotted decoration-[#C5CAD8] dark:decoration-[#3E4257] underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400 hover:decoration-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500`}>
      {value}
    </button>
  );
}

function EmptyState({ icon = PhoneCall, title, hint }) {
  const Icon = icon;
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-11 h-11 rounded-2xl bg-[#F1F4FF] dark:bg-[#262A38] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-indigo-500" />
      </div>
      <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{title}</p>
      {hint && <p className="text-[12px] text-[#8B92A9] mt-1 max-w-sm">{hint}</p>}
    </div>
  );
}

function Pager({ page, totalPages, total, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#F0F2FA] dark:border-[#262A38]">
      <p className="text-[12px] text-[#8B92A9]">Page {page} of {totalPages} · {total.toLocaleString("en-IN")} records</p>
      <div className="flex gap-1.5">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"
          className="w-8 h-8 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#0F1117] dark:text-[#F0F2FA] disabled:opacity-40 hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page"
          className="w-8 h-8 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#0F1117] dark:text-[#F0F2FA] disabled:opacity-40 hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-500/10 text-[13px] text-red-700 dark:text-red-300">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && <button onClick={onRetry} className="font-semibold underline">Try again</button>}
    </div>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────
function downloadCSV(filename, header, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ═════════════════════════════════════════════════════════════════════════════
// SUMMARY TAB
// ═════════════════════════════════════════════════════════════════════════════

function CallTypeTable({ types, totalCalls, totalDuration, onDrill }) {
  const rows = ["incoming", "outgoing", "missed", "rejected"];
  const other = (types.voicemail?.count || 0) + (types.blocked?.count || 0) + (types.unknown?.count || 0);
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-4 pt-4 pb-3">
        <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Calls by type</p>
      </div>

      {/* Call mix — one proportional bar for the whole range */}
      <div className="px-4 pb-3">
        <div className="flex h-2.5 rounded-full overflow-hidden bg-[#F0F2FA] dark:bg-[#262A38]" role="img"
          aria-label={rows.map((t) => `${TYPE_META[t].label} ${pct(types[t]?.count, totalCalls)}%`).join(", ")}>
          {rows.map((t) => types[t]?.count > 0 && (
            <div key={t} className={TYPE_META[t].bar} style={{ width: `${pct(types[t].count, totalCalls)}%` }} />
          ))}
        </div>
      </div>

      <table className="w-full">
        <thead className="bg-[#F8F9FC] dark:bg-[#13161E]">
          <tr>
            <th className={`${th} text-left`}>Call type</th>
            <th className={`${th} text-right`}>Calls</th>
            <th className={`${th} text-right`}>Share</th>
            <th className={`${th} text-right`}>Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#262A38]">
          {rows.map((t) => {
            const m = TYPE_META[t]; const Icon = m.Icon;
            const hasDuration = t === "incoming" || t === "outgoing";
            return (
              <tr key={t}>
                <td className={td}><span className={`inline-flex items-center gap-2 font-semibold ${m.text}`}><Icon className="w-3.5 h-3.5" />{m.label}</span></td>
                <td className={`${td} text-right tabular-nums font-semibold`}>
                  <DrillNum value={types[t]?.count || 0} title={`Show ${m.label.toLowerCase()} calls`} onClick={() => onDrill({ tab: "history", callType: t })} />
                </td>
                <td className={`${td} text-right tabular-nums text-[#8B92A9]`}>{pct(types[t]?.count, totalCalls)}%</td>
                <td className={`${td} text-right tabular-nums font-mono`}>{hasDuration ? fmtHMS(types[t]?.duration) : "—"}</td>
              </tr>
            );
          })}
          {other > 0 && (
            <tr>
              <td className={`${td} text-[#8B92A9]`}>Other</td>
              <td className={`${td} text-right tabular-nums`}>{other}</td>
              <td className={`${td} text-right tabular-nums text-[#8B92A9]`}>{pct(other, totalCalls)}%</td>
              <td className={`${td} text-right`}>—</td>
            </tr>
          )}
          <tr className="bg-[#F8F9FC] dark:bg-[#13161E]">
            <td className={`${td} font-bold`}>Total</td>
            <td className={`${td} text-right tabular-nums font-bold`}>
              <DrillNum value={totalCalls} title="Show all calls" onClick={() => onDrill({ tab: "history" })} />
            </td>
            <td className={`${td} text-right`} />
            <td className={`${td} text-right tabular-nums font-mono font-bold`}>{fmtHMS(totalDuration)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DirectionSplit({ employees, onDrill }) {
  // Team-level incoming vs outgoing detail, one row per employee (top 6).
  const top = employees.filter((e) => e.incoming + e.outgoing > 0).slice(0, 6);
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-4 pt-4 pb-3">
        <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Incoming vs outgoing</p>
        <p className="text-[11px] text-[#8B92A9] mt-0.5">Connected = the other side picked up</p>
      </div>
      {top.length === 0 ? (
        <EmptyState title="No incoming or outgoing calls" hint="Calls appear here once the mobile app syncs them." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F8F9FC] dark:bg-[#13161E]">
                <th className={`${th} text-left`} rowSpan={2}>Employee</th>
                <th className={`${th} text-center border-l border-[#E4E7EF] dark:border-[#262A38] text-emerald-600 dark:text-emerald-400`} colSpan={2}>
                  <span className="inline-flex items-center gap-1"><PhoneIncoming className="w-3 h-3" />Incoming</span>
                </th>
                <th className={`${th} text-center border-l border-[#E4E7EF] dark:border-[#262A38] text-blue-600 dark:text-blue-400`} colSpan={3}>
                  <span className="inline-flex items-center gap-1"><PhoneOutgoing className="w-3 h-3" />Outgoing</span>
                </th>
              </tr>
              <tr className="bg-[#F8F9FC] dark:bg-[#13161E]">
                <th className={`${th} text-right border-l border-[#E4E7EF] dark:border-[#262A38]`}>Calls</th>
                <th className={`${th} text-right`}>Duration</th>
                <th className={`${th} text-right border-l border-[#E4E7EF] dark:border-[#262A38]`}>Calls</th>
                <th className={`${th} text-right`}>Connected</th>
                <th className={`${th} text-right`}>Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#262A38]">
              {top.map((e) => (
                <tr key={e.userId}>
                  <td className={`${td} max-w-[140px] truncate font-medium`} title={e.name}>{e.name}</td>
                  <td className={`${td} text-right tabular-nums border-l border-[#F0F2FA] dark:border-[#262A38]`}>
                    <DrillNum value={e.incoming} title={`${e.name}: incoming calls`} onClick={() => onDrill({ tab: "history", userId: e.userId, callType: "incoming" })} />
                  </td>
                  <td className={`${td} text-right tabular-nums font-mono`}>{fmtHMS(e.incomingDuration)}</td>
                  <td className={`${td} text-right tabular-nums border-l border-[#F0F2FA] dark:border-[#262A38]`}>
                    <DrillNum value={e.outgoing} title={`${e.name}: outgoing calls`} onClick={() => onDrill({ tab: "history", userId: e.userId, callType: "outgoing" })} />
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    <DrillNum value={e.outgoingConnected} title={`${e.name}: outgoing calls that connected`} onClick={() => onDrill({ tab: "history", userId: e.userId, callType: "outgoing_connected" })} />
                  </td>
                  <td className={`${td} text-right tabular-nums font-mono`}>{fmtHMS(e.outgoingDuration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatTile({ icon, label, value, hint, tone = "indigo", onClick, action }) {
  const Icon = icon;
  const tones = {
    indigo:  "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    amber:   "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
    red:     "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
    blue:    "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
  };
  const body = (
    <>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}><Icon className="w-4 h-4" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[#8B92A9]">{label}</p>
        <p className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-tight tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-[#8B92A9] mt-0.5 truncate">{hint}</p>}
      </div>
      {onClick && <Chevron className="w-4 h-4 text-[#C5CAD8] dark:text-[#3E4257] group-hover:text-indigo-500 shrink-0 self-center transition" />}
    </>
  );
  if (!onClick) return <div className={`${card} px-4 py-3.5 flex items-start gap-3`}>{body}</div>;
  return (
    <button type="button" onClick={onClick} title={action}
      className={`${card} group px-4 py-3.5 flex items-start gap-3 text-left w-full transition hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500`}>
      {body}
    </button>
  );
}

const EMP_COLUMNS = [
  { key: "name",           label: "Employee",        align: "left" },
  { key: "totalCalls",     label: "Total calls" },
  { key: "totalDuration",  label: "Total duration" },
  { key: "workingSeconds", label: "Working hours",   title: "First call to last call, added up for each day" },
  { key: "clockedMinutes", label: "Clocked in",      title: "Time clocked in on Attendance" },
  { key: "uniqueClients",  label: "Unique clients" },
  { key: "connected",      label: "Connected" },
  { key: "notPickedUp",    label: "Not picked up",   title: "Outgoing calls the client didn't answer" },
  { key: "missed",         label: "Missed" },
  { key: "rejected",       label: "Rejected" },
  { key: "avgDuration",    label: "Avg call" },
  { key: "lastCallAt",     label: "Last call" },
];

function EmployeeReport({ employees, onViewCalls, onDrill, onExport, isSingle }) {
  const [sort, setSort] = useState({ key: "totalCalls", dir: "desc" });

  const sorted = useMemo(() => {
    const arr = [...employees];
    arr.sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key];
      if (sort.key === "name") return sort.dir === "asc" ? String(av).localeCompare(bv) : String(bv).localeCompare(av);
      if (sort.key === "lastCallAt") { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [employees, sort]);

  const totals = useMemo(() => employees.reduce((t, e) => {
    for (const k of ["totalCalls", "totalDuration", "workingSeconds", "clockedMinutes", "connected", "notPickedUp", "missed", "rejected"]) t[k] = (t[k] || 0) + e[k];
    return t;
  }, {}), [employees]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));

  const cell = (e, key, onView) => {
    switch (key) {
      case "name":
        return (
          <div className="min-w-[160px]">
            <button onClick={() => onView(e.userId)} title={`View ${e.name}'s calls`}
              className="font-semibold truncate max-w-[200px] block text-left text-indigo-600 dark:text-indigo-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 rounded">
              {e.name}
            </button>
            <p className="text-[11px] text-[#8B92A9] truncate max-w-[200px] flex items-center gap-1">
              {e.deviceModel ? <><Smartphone className="w-3 h-3 shrink-0" />{e.deviceModel}</> : e.email}
              {!e.callLogSyncEnabled && <span className="ml-1 px-1.5 rounded bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold">Sync off</span>}
            </p>
          </div>
        );
      case "totalDuration":  return <span className="font-mono">{fmtHMS(e.totalDuration)}</span>;
      case "workingSeconds": return <span className="font-mono">{fmtHMS(e.workingSeconds)}</span>;
      case "clockedMinutes": return e.clockedMinutes ? fmtMinutes(e.clockedMinutes) : <span className="text-[#8B92A9]">—</span>;
      case "lastCallAt":     return e.lastCallAt ? fmtDateTime(e.lastCallAt) : <span className="text-[#8B92A9]">No calls</span>;
      case "totalCalls":     return <DrillNum value={e.totalCalls} title={`${e.name}: all calls`} onClick={() => onDrill({ tab: "history", userId: e.userId })} />;
      case "uniqueClients":  return <DrillNum value={e.uniqueClients} title={`${e.name}: clients`} onClick={() => onDrill({ tab: "clients", userId: e.userId })} />;
      case "connected":      return <DrillNum value={e.connected} title={`${e.name}: connected calls`} onClick={() => onDrill({ tab: "history", userId: e.userId, callType: "connected" })} />;
      case "missed":         return <DrillNum value={e.missed} className={e.missed ? "text-red-600 dark:text-red-400 font-semibold" : ""} title={`${e.name}: missed calls`} onClick={() => onDrill({ tab: "history", userId: e.userId, callType: "missed" })} />;
      case "rejected":       return <DrillNum value={e.rejected} title={`${e.name}: rejected calls`} onClick={() => onDrill({ tab: "history", userId: e.userId, callType: "rejected" })} />;
      case "notPickedUp":    return <DrillNum value={e.notPickedUp} className={e.notPickedUp ? "text-amber-600 dark:text-amber-400" : ""} title={`${e.name}: calls not picked up`} onClick={() => onDrill({ tab: "history", userId: e.userId, callType: "not_picked" })} />;
      case "avgDuration":    return <DrillNum value={fmtShortDur(e.avgDuration)} title={`${e.name}: longest calls first`} onClick={e.connected ? () => onDrill({ tab: "history", userId: e.userId, callType: "connected", sort: "duration" }) : undefined} />;
      default:               return e[key];
    }
  };

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Employee report</p>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">Click a column heading to sort. Click any underlined number to see the calls behind it.</p>
        </div>
        <button onClick={onExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]">
          <Download className="w-3.5 h-3.5" />Export report
        </button>
      </div>
      {employees.length === 0 ? (
        <EmptyState icon={Users} title="No employees in your team yet" hint="Employees you add under User Management appear here once they log in on the mobile app." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F8F9FC] dark:bg-[#13161E]">
              <tr>
                {EMP_COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  const SortIcon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th key={c.key} className={`${th} ${c.align === "left" ? "text-left" : "text-right"}`} title={c.title}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                      <button onClick={() => toggleSort(c.key)} className={`inline-flex items-center gap-1 hover:text-[#0F1117] dark:hover:text-[#F0F2FA] ${active ? "text-[#0F1117] dark:text-[#F0F2FA]" : ""}`}>
                        {c.label}<SortIcon className="w-3 h-3" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#262A38]">
              {sorted.map((e) => (
                <tr key={e.userId} className={`hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] ${e.totalCalls === 0 ? "opacity-60" : ""}`}>
                  {EMP_COLUMNS.map((c) => (
                    <td key={c.key} className={`${td} ${c.align === "left" ? "text-left" : "text-right tabular-nums"}`}>{cell(e, c.key, onViewCalls)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {!isSingle && employees.length > 1 && (
              <tfoot className="bg-[#F8F9FC] dark:bg-[#13161E] border-t border-[#E4E7EF] dark:border-[#262A38]">
                <tr>
                  <td className={`${td} font-bold`}>Team total</td>
                  <td className={`${td} text-right tabular-nums font-bold`}><DrillNum value={totals.totalCalls} title="All calls" onClick={() => onDrill({ tab: "history" })} /></td>
                  <td className={`${td} text-right font-mono font-bold`}>{fmtHMS(totals.totalDuration)}</td>
                  <td className={`${td} text-right font-mono font-bold`}>{fmtHMS(totals.workingSeconds)}</td>
                  <td className={`${td} text-right font-bold`}>{fmtMinutes(totals.clockedMinutes)}</td>
                  <td className={`${td} text-right text-[#8B92A9]`}>—</td>
                  <td className={`${td} text-right tabular-nums font-bold`}><DrillNum value={totals.connected} title="All connected calls" onClick={() => onDrill({ tab: "history", callType: "connected" })} /></td>
                  <td className={`${td} text-right tabular-nums font-bold`}><DrillNum value={totals.notPickedUp} title="All calls not picked up" onClick={() => onDrill({ tab: "history", callType: "not_picked" })} /></td>
                  <td className={`${td} text-right tabular-nums font-bold`}><DrillNum value={totals.missed} title="All missed calls" onClick={() => onDrill({ tab: "history", callType: "missed" })} /></td>
                  <td className={`${td} text-right tabular-nums font-bold`}><DrillNum value={totals.rejected} title="All rejected calls" onClick={() => onDrill({ tab: "history", callType: "rejected" })} /></td>
                  <td className={td} /><td className={td} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryTab({ data, onViewCalls, onDrill, onExportEmployees, isSingle }) {
  const s = data.summary;
  const scrollToReport = () => document.getElementById("cm-employee-report")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile icon={PhoneCall} label="Connected calls" value={s.connected} hint={`${pct(s.connected, s.totalCalls)}% of all calls`} tone="emerald"
          onClick={s.connected ? () => onDrill({ tab: "history", callType: "connected" }) : undefined} action="Show connected calls" />
        <StatTile icon={PhoneForwarded} label="Not picked up" value={s.notPickedUp} hint="Client didn't answer" tone="amber"
          onClick={s.notPickedUp ? () => onDrill({ tab: "history", callType: "not_picked" }) : undefined} action="Show calls not picked up" />
        <StatTile icon={Users} label="Unique clients" value={s.uniqueClients} hint="Distinct phone numbers" tone="blue"
          onClick={s.uniqueClients ? () => onDrill({ tab: "clients" }) : undefined} action="Show every client" />
        <StatTile icon={Clock} label="Average call" value={fmtShortDur(s.avgDuration)} hint="Across connected calls"
          onClick={s.connected ? () => onDrill({ tab: "history", callType: "connected", sort: "duration" }) : undefined} action="Show connected calls, longest first" />
        <StatTile icon={UserCheck} label="Active employees" value={`${s.activeEmployees}/${s.totalEmployees}`} hint="Made or received a call" tone="indigo"
          onClick={s.totalEmployees ? scrollToReport : undefined} action="Jump to the employee report" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-2"><CallTypeTable types={s.types} totalCalls={s.totalCalls} totalDuration={s.totalDuration} onDrill={onDrill} /></div>
        <div className="xl:col-span-3"><DirectionSplit employees={data.employees} onDrill={onDrill} /></div>
      </div>

      <div id="cm-employee-report" className="scroll-mt-4">
        <EmployeeReport employees={data.employees} onViewCalls={onViewCalls} onDrill={onDrill} onExport={onExportEmployees} isSingle={isSingle} />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ANALYSIS TAB
// ═════════════════════════════════════════════════════════════════════════════

function DailyTrend({ daily, onDrill }) {
  const max = Math.max(1, ...daily.map((d) => d.total));
  const showEvery = daily.length > 14 ? Math.ceil(daily.length / 10) : 1;
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Calls per day</p>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">Click a day to see its calls</p>
        </div>
        <div className="flex gap-3 text-[11px] text-[#8B92A9]">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" />Incoming</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" />Outgoing</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" />Missed/rejected</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1 h-44" style={{ minWidth: `${daily.length * 18}px` }}>
          {daily.map((d, i) => (
            <button type="button" key={d.date} disabled={!d.total} onClick={() => onDrill({ tab: "history", date: d.date })}
              aria-label={`${d.date}: ${d.total} calls — show them`}
              className="flex-1 min-w-[12px] h-full flex flex-col items-center justify-end group relative rounded hover:bg-[#F1F4FF] dark:hover:bg-[#13161E] disabled:cursor-default disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
              <div className="w-full max-w-[28px] flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${(d.total / max) * 100}%` }}>
                {d.incoming > 0 && <div className="bg-emerald-500" style={{ flex: d.incoming }} />}
                {d.outgoing > 0 && <div className="bg-blue-500" style={{ flex: d.outgoing }} />}
                {d.missed > 0 && <div className="bg-red-500" style={{ flex: d.missed }} />}
              </div>
              <div className="pointer-events-none absolute bottom-full mb-1 hidden group-hover:block z-10 whitespace-nowrap rounded-lg bg-[#0F1117] text-white text-[11px] px-2 py-1 shadow-lg">
                {parseKey(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}: {d.total} calls · {fmtShortDur(d.duration)}
              </div>
              <span className={`mt-1 text-[10px] text-[#8B92A9] tabular-nums ${i % showEvery ? "invisible" : ""}`}>
                {parseKey(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: daily.length > 7 ? undefined : "short" })}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HourlyHeat({ hourly }) {
  const max = Math.max(1, ...hourly.map((h) => h.total));
  const peak = hourly.reduce((p, h) => (h.total > p.total ? h : p), hourly[0]);
  return (
    <div className={`${card} p-4`}>
      <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Busiest hours</p>
      <p className="text-[11px] text-[#8B92A9] mt-0.5 mb-4">
        {peak.total ? `Peak at ${fmtHour(peak.hour)} with ${peak.total} calls` : "No calls in this range"}
      </p>
      <div className="grid grid-cols-12 gap-1">
        {hourly.map((h) => {
          const intensity = h.total / max;
          return (
            <div key={h.hour} className="flex flex-col items-center gap-1">
              <div
                className="w-full aspect-square rounded-md border border-[#E4E7EF] dark:border-[#262A38]"
                style={{ backgroundColor: h.total ? `rgba(79, 70, 229, ${0.12 + intensity * 0.88})` : undefined }}
                title={`${fmtHour(h.hour)}: ${h.total} calls (${h.connected} connected, ${h.missed} missed)`}
              />
              <span className="text-[9px] text-[#8B92A9]">{h.hour % 3 === 0 ? fmtHour(h.hour) : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DurationMix({ buckets }) {
  const total = buckets.reduce((a, b) => a + b.count, 0);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className={`${card} p-4`}>
      <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Call length</p>
      <p className="text-[11px] text-[#8B92A9] mt-0.5 mb-4">Connected calls grouped by how long they lasted</p>
      <div className="space-y-2.5">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="w-20 text-[12px] text-[#0F1117] dark:text-[#F0F2FA] shrink-0">{b.label}</span>
            <div className="flex-1 h-2 rounded-full bg-[#F0F2FA] dark:bg-[#262A38] overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(b.count / max) * 100}%` }} />
            </div>
            <span className="w-16 text-right text-[12px] tabular-nums text-[#8B92A9]">{b.count} · {pct(b.count, total)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopNumbers({ rows, isSuperAdmin, onDrill }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-4 pt-4 pb-3">
        <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Most contacted numbers</p>
      </div>
      {rows.length === 0 ? <EmptyState title="No calls in this range" /> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F8F9FC] dark:bg-[#13161E]">
              <tr>
                <th className={`${th} text-left`}>Contact</th>
                <th className={`${th} text-right`}>Calls</th>
                <th className={`${th} text-right`}>Connected</th>
                <th className={`${th} text-right`}>Talk time</th>
                <th className={`${th} text-right`}>Last call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#262A38]">
              {rows.map((r) => (
                <tr key={r._id}>
                  <td className={td}>
                    <PhoneText phone={r.phoneNumber} isSuperAdmin={isSuperAdmin} className="text-[13px] font-semibold" />
                    <p className="text-[11px] text-[#8B92A9]">{r.lead ? `Lead: ${r.lead.name}` : r.name || "Not in CRM"}</p>
                  </td>
                  <td className={`${td} text-right tabular-nums font-semibold`}>
                    <DrillNum value={r.calls} title="Show calls with this number" onClick={() => onDrill({ tab: "history", phone: r._id, phoneLabel: r.phoneNumber })} />
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{r.connected}</td>
                  <td className={`${td} text-right font-mono`}>{fmtHMS(r.duration)}</td>
                  <td className={`${td} text-right text-[#8B92A9]`}>{fmtDateTime(r.lastCallAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnalysisTab({ data, isSuperAdmin, onDrill }) {
  return (
    <div className="space-y-4">
      <DailyTrend daily={data.daily} onDrill={onDrill} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HourlyHeat hourly={data.hourly} />
        <DurationMix buckets={data.durationBuckets} />
      </div>
      <TopNumbers rows={data.topNumbers} isSuperAdmin={isSuperAdmin} onDrill={onDrill} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// NEVER ATTENDED TAB
// ═════════════════════════════════════════════════════════════════════════════

function NeverAttendedTab({ query, refreshKey, isSuperAdmin, onDrill }) {
  const [status, setStatus] = useState("");
  const baseParams = new URLSearchParams(query);
  if (status) baseParams.set("status", status);
  const [page, setPage] = usePage(baseParams.toString());
  baseParams.set("page", page);
  baseParams.set("limit", 25);
  const state = useApi(`/call-logs/monitoring/never-attended?${baseParams}`, refreshKey);
  const load = state.retry;

  const counts = state.data?.counts || { total: 0, notCalledBack: 0, calledBackNoAnswer: 0 };
  const chips = [
    { key: "",                      label: "All",                        n: counts.total },
    { key: "not_called_back",       label: "Not called back",            n: counts.notCalledBack },
    { key: "called_back_no_answer", label: "Called back, no answer",     n: counts.calledBackNoAnswer },
  ];

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-4 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Never attended</p>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">Missed or rejected callers that no one on the team has spoken to since</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by callback status">
          {chips.map((c) => (
            <button key={c.key || "all"} onClick={() => setStatus(c.key)} aria-pressed={status === c.key}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ${status === c.key
                ? "bg-[#0F1117] dark:bg-[#F0F2FA] text-white dark:text-[#0F1117] border-transparent"
                : "border-[#E4E7EF] dark:border-[#262A38] text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]"}`}>
              {c.label} <span className="tabular-nums opacity-70">{c.n}</span>
            </button>
          ))}
        </div>
      </div>

      {state.error ? <div className="p-4"><ErrorBanner message={state.error} onRetry={load} /></div>
        : state.loading && !state.data ? <TableSkeleton />
        : !state.data?.rows?.length ? (
          <EmptyState icon={UserCheck} title="Every missed caller has been reached"
            hint="Nobody is waiting for a callback in this date range." />
        ) : (
          <>
            <div className={`overflow-x-auto ${state.loading ? "opacity-60" : ""}`}>
              <table className="w-full">
                <thead className="bg-[#F8F9FC] dark:bg-[#13161E]">
                  <tr>
                    <th className={`${th} text-left`}>Caller</th>
                    <th className={`${th} text-right`}>Missed</th>
                    <th className={`${th} text-left`}>Last missed</th>
                    <th className={`${th} text-left`}>Status</th>
                    <th className={`${th} text-left`}>Missed by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#262A38]">
                  {state.data.rows.map((r) => (
                    <tr key={r.phoneKey}>
                      <td className={td}>
                        <PhoneText phone={r.phoneNumber} isSuperAdmin={isSuperAdmin} className="text-[13px] font-semibold" />
                        <p className="text-[11px] text-[#8B92A9]">{r.lead ? `Lead: ${r.lead.name}` : r.name || "Not in CRM"}</p>
                      </td>
                      <td className={`${td} text-right tabular-nums font-semibold text-red-600 dark:text-red-400`}>
                        <DrillNum value={r.missedCount} title="Show every call with this number" onClick={() => onDrill({ tab: "history", phone: r.phoneKey, phoneLabel: r.phoneNumber })} />
                      </td>
                      <td className={td}>{fmtDateTime(r.lastMissedAt)}</td>
                      <td className={td}>
                        {r.status === "not_called_back" ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">Not called back</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            title={`Last attempt ${fmtDateTime(r.lastAttemptAt)}`}>Called back, no answer</span>
                        )}
                      </td>
                      <td className={`${td} max-w-[220px] truncate text-[#8B92A9]`} title={r.employees.join(", ")}>{r.employees.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={state.data.page} totalPages={state.data.totalPages} total={state.data.total} onChange={setPage} />
          </>
        )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CALL HISTORY / RECORDINGS TAB
// ═════════════════════════════════════════════════════════════════════════════

const HISTORY_FILTERS = [
  { key: "",           label: "All calls" },
  { key: "incoming",   label: "Incoming" },
  { key: "outgoing",   label: "Outgoing" },
  { key: "missed",     label: "Missed" },
  { key: "rejected",   label: "Rejected" },
  { key: "connected",  label: "Connected" },
  { key: "outgoing_connected", label: "Outgoing connected" },
  { key: "not_picked", label: "Not picked up" },
];

function TableSkeleton({ rows = 6 }) {
  return (
    <div className="p-4 space-y-2 animate-pulse" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#F0F2FA] dark:bg-[#262A38]" />)}
    </div>
  );
}

// `initial` comes from a drill-down click ({ callType, phone, phoneLabel, sort }).
// The page remounts this tab (via key) for each new drill, so these are just
// starting values the user can change afterwards.
function HistoryTab({ query, refreshKey, isSuperAdmin, recordingsOnly = false, initial = {} }) {
  const [callType, setCallType] = useState(initial.callType || "");
  const [phone, setPhone] = useState(initial.phone ? { key: initial.phone, label: initial.phoneLabel || initial.phone } : null);
  const [sort, setSort] = useState(initial.sort || "recent");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  // Debounce search typing (setState inside a timer callback, not the effect body)
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput.trim()), 350); return () => clearTimeout(t); }, [searchInput]);

  const buildParams = useCallback((p, limit) => {
    const params = new URLSearchParams({ ...query, page: p, limit });
    if (callType) params.set("callType", callType);
    if (search) params.set("search", search);
    if (phone) params.set("phone", phone.key);
    if (sort !== "recent") params.set("sort", sort);
    if (recordingsOnly) params.set("hasRecording", "true");
    return params;
  }, [query, callType, search, phone, sort, recordingsOnly]);

  const [page, setPage] = usePage(buildParams(1, 25).toString());
  const state = useApi(`/call-logs/monitoring/history?${buildParams(page, 25)}`, refreshKey);
  const load = state.retry;

  const exportCSV = async () => {
    setExporting(true);
    try {
      const first = await api.get(`/call-logs/monitoring/history?${buildParams(1, 500)}`);
      const pages = Math.min(first.data.totalPages || 1, 20); // cap at 10,000 rows
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) => api.get(`/call-logs/monitoring/history?${buildParams(i + 2, 500)}`)),
      );
      const logs = [first, ...rest].flatMap((r) => r.data.logs || []);
      downloadCSV(
        `call-history_${query.startDate}_to_${query.endDate}${callType ? "_" + callType : ""}.csv`,
        ["Date & time", "Employee", "Phone", "Contact name", "Lead", "Call type", "Duration (s)", "Duration", "Recordings"],
        logs.map((l) => [
          new Date(l.timestamp).toLocaleString("en-IN"),
          l.user?.name || "",
          isSuperAdmin ? l.phoneNumber : maskPhone(l.phoneNumber),
          l.name || "", l.matchedLead?.name || "", l.callType, l.duration || 0, fmtHMS(l.duration), (l.recordings || []).length,
        ]),
      );
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const logs = state.data?.logs || [];

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-[#8B92A9] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search number or contact name"
              aria-label="Search calls"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            {searchInput && (
              <button onClick={() => setSearchInput("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {phone && (
            <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-[12px] font-semibold text-indigo-700 dark:text-indigo-300">
              Number: <span className="font-mono">{isSuperAdmin ? phone.label : maskPhone(phone.label)}</span>
              <button onClick={() => setPhone(null)} aria-label="Show all numbers" className="p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort calls"
            className="px-2.5 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] bg-[#F8F9FC] dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA]">
            <option value="recent">Newest first</option>
            <option value="duration">Longest first</option>
          </select>
          <button onClick={exportCSV} disabled={exporting || !logs.length}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] disabled:opacity-50">
            <Download className="w-3.5 h-3.5" />{exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
        {state.data && (
          <p className="text-[12px] text-[#8B92A9]" aria-live="polite">
            <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums">{state.data.total.toLocaleString("en-IN")}</span> {state.data.total === 1 ? "call" : "calls"}
            {callType && <> · {HISTORY_FILTERS.find((f) => f.key === callType)?.label.toLowerCase()}</>}
          </p>
        )}
        {!recordingsOnly && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by call type">
            {HISTORY_FILTERS.map((f) => (
              <button key={f.key || "all"} onClick={() => setCallType(f.key)} aria-pressed={callType === f.key}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ${callType === f.key
                  ? "bg-[#0F1117] dark:bg-[#F0F2FA] text-white dark:text-[#0F1117] border-transparent"
                  : "border-[#E4E7EF] dark:border-[#262A38] text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]"}`}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {state.error ? <div className="p-4"><ErrorBanner message={state.error} onRetry={load} /></div>
        : state.loading && !state.data ? <TableSkeleton />
        : logs.length === 0 ? (
          <EmptyState icon={recordingsOnly ? Mic : History}
            title={recordingsOnly ? "No recordings in this range" : "No calls match these filters"}
            hint={recordingsOnly
              ? "Recordings appear after employees' phones upload them from the SKYUP app."
              : "Try a wider date range or clear the search."} />
        ) : (
          <>
            <div className={`overflow-x-auto ${state.loading ? "opacity-60" : ""}`}>
              <table className="w-full">
                <thead className="bg-[#F8F9FC] dark:bg-[#13161E]">
                  <tr>
                    <th className={`${th} text-left`}>Date & time</th>
                    <th className={`${th} text-left`}>Employee</th>
                    <th className={`${th} text-left`}>Contact</th>
                    <th className={`${th} text-left`}>Type</th>
                    <th className={`${th} text-right`}>Duration</th>
                    <th className={`${th} text-left`}>Recording</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#262A38]">
                  {logs.map((l) => (
                    <tr key={l._id} className="hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] align-top">
                      <td className={td}>
                        <p className="font-medium">{new Date(l.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                        <p className="text-[11px] text-[#8B92A9]">{fmtTime(l.timestamp)}</p>
                      </td>
                      <td className={`${td} max-w-[160px] truncate`} title={l.user?.email}>{l.user?.name || "—"}</td>
                      <td className={td}>
                        <PhoneText phone={l.phoneNumber} isSuperAdmin={isSuperAdmin} className="text-[13px] font-semibold" />
                        <p className="text-[11px] text-[#8B92A9] max-w-[200px] truncate">
                          {l.matchedLead ? <span className="text-indigo-600 dark:text-indigo-400">Lead: {l.matchedLead.name}</span> : l.name || "Not in CRM"}
                        </p>
                      </td>
                      <td className={td}><CallTypeBadge type={l.callType} /></td>
                      <td className={`${td} text-right font-mono tabular-nums`}>{l.duration ? fmtHMS(l.duration) : <span className="text-[#8B92A9]">—</span>}</td>
                      <td className={td}>
                        {l.recordings?.length ? (
                          <div className="space-y-1.5">
                            {l.recordings.map((r) => (
                              <div key={r._id || r.url}>
                                <audio controls preload="none" src={r.url} className="h-8 w-56 max-w-full" aria-label={`Recording of call with ${l.name || "contact"}`} />
                                {r.summary?.summary && <p className="text-[11px] text-[#8B92A9] mt-0.5 max-w-[240px] whitespace-normal line-clamp-2" title={r.summary.summary}>{r.summary.summary}</p>}
                              </div>
                            ))}
                          </div>
                        ) : <span className="text-[12px] text-[#8B92A9]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={state.data.page} totalPages={state.data.totalPages} total={state.data.total} onChange={setPage} />
          </>
        )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
// CLIENTS TAB — one row per unique phone number
// ═════════════════════════════════════════════════════════════════════════════

const CLIENT_SORTS = [
  { key: "calls",    label: "Most calls" },
  { key: "duration", label: "Most talk time" },
  { key: "missed",   label: "Most missed" },
  { key: "recent",   label: "Most recent" },
];

function ClientsTab({ query, refreshKey, isSuperAdmin, onDrill }) {
  const [sort, setSort] = useState("calls");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput.trim()), 350); return () => clearTimeout(t); }, [searchInput]);

  const buildParams = useCallback((p, limit) => {
    const params = new URLSearchParams({ ...query, page: p, limit, sort });
    if (search) params.set("search", search);
    return params;
  }, [query, sort, search]);

  const [page, setPage] = usePage(buildParams(1, 25).toString());
  const state = useApi(`/call-logs/monitoring/clients?${buildParams(page, 25)}`, refreshKey);
  const rows = state.data?.rows || [];
  const openClient = (r) => onDrill({ tab: "history", phone: r.phoneKey, phoneLabel: r.phoneNumber });

  const exportCSV = async () => {
    setExporting(true);
    try {
      const first = await api.get(`/call-logs/monitoring/clients?${buildParams(1, 200)}`);
      const pages = Math.min(first.data.totalPages || 1, 50);
      const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => api.get(`/call-logs/monitoring/clients?${buildParams(i + 2, 200)}`)));
      const all = [first, ...rest].flatMap((r) => r.data.rows || []);
      downloadCSV(
        `clients_${query.startDate}_to_${query.endDate}.csv`,
        ["Phone", "Contact name", "Lead", "Calls", "Incoming", "Outgoing", "Connected", "Not picked up", "Missed/rejected", "Talk time", "First call", "Last call", "Handled by"],
        all.map((r) => [
          isSuperAdmin ? r.phoneNumber : maskPhone(r.phoneNumber), r.name || "", r.lead?.name || "", r.calls, r.incoming, r.outgoing,
          r.connected, r.notPickedUp, r.missed, fmtHMS(r.duration),
          new Date(r.firstCallAt).toLocaleString("en-IN"), new Date(r.lastCallAt).toLocaleString("en-IN"), r.employees.join(" / "),
        ]),
      );
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Clients</p>
            <p className="text-[11px] text-[#8B92A9] mt-0.5">
              {state.data ? <><span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums">{state.data.total.toLocaleString("en-IN")}</span> unique phone numbers. </> : null}
              Click a client to see every call with them.
            </p>
          </div>
          <button onClick={exportCSV} disabled={exporting || !rows.length}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] disabled:opacity-50">
            <Download className="w-3.5 h-3.5" />{exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-[#8B92A9] absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search number or contact name" aria-label="Search clients"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
            {searchInput && (
              <button onClick={() => setSearchInput("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort clients"
            className="px-2.5 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] bg-[#F8F9FC] dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA]">
            {CLIENT_SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {state.error ? <div className="p-4"><ErrorBanner message={state.error} onRetry={state.retry} /></div>
        : state.loading && !state.data ? <TableSkeleton />
        : rows.length === 0 ? (
          <EmptyState icon={Contact} title={search ? "No clients match this search" : "No clients in this range"}
            hint={search ? "Check the number or try part of it." : "Try a wider date range."} />
        ) : (
          <>
            <div className={`overflow-x-auto ${state.loading ? "opacity-60" : ""}`}>
              <table className="w-full">
                <thead className="bg-[#F8F9FC] dark:bg-[#13161E]">
                  <tr>
                    <th className={`${th} text-left`}>Client</th>
                    <th className={`${th} text-right`}>Calls</th>
                    <th className={`${th} text-right`}>Incoming</th>
                    <th className={`${th} text-right`}>Outgoing</th>
                    <th className={`${th} text-right`}>Connected</th>
                    <th className={`${th} text-right`}>Not picked up</th>
                    <th className={`${th} text-right`}>Missed</th>
                    <th className={`${th} text-right`}>Talk time</th>
                    <th className={`${th} text-right`}>Last call</th>
                    <th className={`${th} text-left`}>Handled by</th>
                    <th className={th}><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#262A38]">
                  {rows.map((r) => (
                    <tr key={r.phoneKey} onClick={() => openClient(r)} className="cursor-pointer hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]">
                      <td className={td}>
                        <PhoneText phone={r.phoneNumber} isSuperAdmin={isSuperAdmin} className="text-[13px] font-semibold" />
                        <p className="text-[11px] text-[#8B92A9] max-w-[200px] truncate">
                          {r.lead ? <span className="text-indigo-600 dark:text-indigo-400">Lead: {r.lead.name}</span> : r.name || "Not in CRM"}
                        </p>
                      </td>
                      <td className={`${td} text-right tabular-nums font-semibold`}>{r.calls}</td>
                      <td className={`${td} text-right tabular-nums`}>{r.incoming}</td>
                      <td className={`${td} text-right tabular-nums`}>{r.outgoing}</td>
                      <td className={`${td} text-right tabular-nums`}>{r.connected}</td>
                      <td className={`${td} text-right tabular-nums ${r.notPickedUp ? "text-amber-600 dark:text-amber-400" : ""}`}>{r.notPickedUp}</td>
                      <td className={`${td} text-right tabular-nums ${r.missed ? "text-red-600 dark:text-red-400 font-semibold" : ""}`}>{r.missed}</td>
                      <td className={`${td} text-right font-mono`}>{fmtHMS(r.duration)}</td>
                      <td className={`${td} text-right text-[#8B92A9]`}>{fmtDateTime(r.lastCallAt)}</td>
                      <td className={`${td} max-w-[180px] truncate text-[#8B92A9]`} title={r.employees.join(", ")}>{r.employees.join(", ") || "—"}</td>
                      <td className={`${td} text-right`}>
                        <button onClick={(e) => { e.stopPropagation(); openClient(r); }} aria-label={`Show calls with ${r.name || "this client"}`}
                          className="p-1 rounded-lg text-[#8B92A9] hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
                          <Chevron className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={state.data.page} totalPages={state.data.totalPages} total={state.data.total} onChange={setPage} />
          </>
        )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${card} h-[76px]`} />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className={`${card} h-72 xl:col-span-2`} /><div className={`${card} h-72 xl:col-span-3`} />
      </div>
      <div className={`${card} h-80`} />
    </div>
  );
}

export default function CallMonitoring() {
  const user = getUser();
  const isSuperAdmin = user?.role === "super_admin" || user?.role === "superadmin";
  const { hasFeature } = useEntitlements();
  const canRecordings = hasFeature("callRecording");

  const [tab, setTab] = useState("summary");
  const [preset, setPreset] = useState("today");
  const [range, setRange] = useState(() => RANGE_PRESETS[0].get());
  const [employee, setEmployee] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const query = useMemo(() => {
    const q = { startDate: range[0], endDate: range[1], tzOffset: String(TZ_OFFSET) };
    if (employee) q.userId = employee;
    return q;
  }, [range, employee]);

  const state = useApi(`/call-logs/monitoring/summary?${new URLSearchParams(query)}`, refreshKey);
  const loadSummary = state.retry;
  // `team` is always the full list the admin can see, even when drilled into one employee.
  const team = state.data?.team || [];

  // Clear the 30s GET cache so Refresh really hits the server.
  const refresh = () => { clearCache("/call-logs/monitoring"); setRefreshKey((k) => k + 1); };

  const pickPreset = (p) => { setPreset(p.key); setRange(p.get()); };
  const setCustom = (idx, val) => {
    if (!val) return;
    setPreset("custom");
    setRange((r) => { const n = [...r]; n[idx] = val; if (n[0] > n[1]) n[idx === 0 ? 1 : 0] = val; return n; });
  };

  // Drill-down: every clickable number calls this. `n` changes on each drill so
  // the target tab remounts with the new starting filter.
  const [drill, setDrill] = useState({ n: 0 });
  const onDrill = ({ tab: target, userId, date, ...filters }) => {
    if (userId !== undefined) setEmployee(userId);
    if (date) { setPreset("custom"); setRange([date, date]); }
    setDrill((d) => ({ n: d.n + 1, ...filters }));
    setTab(target);
    document.getElementById("cm-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Choosing a tab by hand starts it unfiltered.
  const openTab = (key) => { setDrill((d) => ({ n: d.n + 1 })); setTab(key); };
  const viewCalls = (userId) => onDrill({ tab: "history", userId });

  const exportEmployees = () => {
    const rows = state.data?.employees || [];
    downloadCSV(
      `call-report_${range[0]}_to_${range[1]}.csv`,
      ["Employee", "Email", "Device", "Total calls", "Total duration", "Incoming", "Incoming duration", "Outgoing", "Outgoing connected", "Outgoing duration", "Not picked up", "Missed", "Rejected", "Connected", "Unique clients", "Working hours", "Clocked in", "Average call (s)", "Longest call", "Last call"],
      rows.map((e) => [
        e.name, e.email, e.deviceModel || "", e.totalCalls, fmtHMS(e.totalDuration), e.incoming, fmtHMS(e.incomingDuration),
        e.outgoing, e.outgoingConnected, fmtHMS(e.outgoingDuration), e.notPickedUp, e.missed, e.rejected, e.connected,
        e.uniqueClients, fmtHMS(e.workingSeconds), fmtMinutes(e.clockedMinutes), e.avgDuration, fmtHMS(e.longestCall),
        e.lastCallAt ? new Date(e.lastCallAt).toLocaleString("en-IN") : "",
      ]),
    );
  };

  const TABS = [
    { key: "summary",   label: "Summary",        icon: BarChart3 },
    { key: "clients",   label: "Clients",        icon: Contact },
    { key: "analysis",  label: "Analysis",       icon: Clock },
    { key: "never",     label: "Never attended", icon: PhoneMissed },
    { key: "history",   label: "Call history",   icon: History },
    ...(canRecordings ? [{ key: "recordings", label: "Recordings", icon: Mic }] : []),
  ];

  const selectedName = employee ? team.find((t) => String(t._id) === String(employee))?.name : null;
  const data = state.data;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-6 overflow-x-hidden">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-tight">Call monitoring</h1>
          <p className="text-[13px] text-[#8B92A9] mt-1">
            SIM call activity synced from your team's phones
            {data && <> · {parseKey(data.range.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              {data.range.startDate !== data.range.endDate && <> – {parseKey(data.range.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</>}
            </>}
          </p>
        </div>
        <button onClick={refresh} disabled={state.loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0F1117] dark:bg-[#F0F2FA] text-white dark:text-[#0F1117] text-[12px] font-semibold disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${state.loading ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>

      {/* ── Filters ── */}
      <div className={`${card} p-3 mb-4 flex flex-wrap items-center gap-2`}>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Date range">
          {RANGE_PRESETS.map((p) => (
            <button key={p.key} onClick={() => pickPreset(p)} aria-pressed={preset === p.key}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${preset === p.key
                ? "bg-indigo-600 text-white"
                : "text-[#0F1117] dark:text-[#F0F2FA] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38]"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input type="date" value={range[0]} max={dayKey(new Date())} onChange={(e) => setCustom(0, e.target.value)} aria-label="From date"
            className={`px-2.5 py-1.5 rounded-lg border text-[12px] bg-[#F8F9FC] dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] ${preset === "custom" ? "border-indigo-500" : "border-[#E4E7EF] dark:border-[#262A38]"}`} />
          <span className="text-[12px] text-[#8B92A9]">to</span>
          <input type="date" value={range[1]} max={dayKey(new Date())} onChange={(e) => setCustom(1, e.target.value)} aria-label="To date"
            className={`px-2.5 py-1.5 rounded-lg border text-[12px] bg-[#F8F9FC] dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] ${preset === "custom" ? "border-indigo-500" : "border-[#E4E7EF] dark:border-[#262A38]"}`} />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <select value={employee} onChange={(e) => setEmployee(e.target.value)} aria-label="Employee"
            className="px-2.5 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[12px] bg-[#F8F9FC] dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] max-w-[220px]">
            <option value="">All employees ({team.length})</option>
            {team.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          {employee && (
            <button onClick={() => setEmployee("")} className="p-1.5 rounded-lg text-[#8B92A9] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38]" aria-label="Show all employees">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div id="cm-tabs" className="flex gap-1 mb-4 overflow-x-auto border-b border-[#E4E7EF] dark:border-[#262A38] scroll-mt-4" role="tablist">
        {TABS.map((t) => {
          const { key, label } = t;
          const TabIcon = t.icon;
          return (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => openTab(key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 -mb-px transition ${tab === key
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]"}`}>
            <TabIcon className="w-4 h-4" />{label}
            {key === "summary" && data && <span className="ml-0.5 text-[11px] tabular-nums px-1.5 rounded-full bg-[#F0F2FA] dark:bg-[#262A38] text-[#8B92A9]">{data.summary.totalCalls}</span>}
            {key === "clients" && data && <span className="ml-0.5 text-[11px] tabular-nums px-1.5 rounded-full bg-[#F0F2FA] dark:bg-[#262A38] text-[#8B92A9]">{data.summary.uniqueClients}</span>}
          </button>
          );
        })}
      </div>

      {selectedName && (
        <p className="text-[12px] text-[#8B92A9] mb-3">Showing calls for <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{selectedName}</span></p>
      )}

      {/* ── Content ── */}
      {(tab === "summary" || tab === "analysis") && (
        state.error && !data ? <ErrorBanner message={state.error} onRetry={loadSummary} />
          : !data ? <PageSkeleton />
          : (
            <div className={state.loading ? "opacity-60 transition-opacity" : ""}>
              {state.error && <div className="mb-3"><ErrorBanner message={state.error} onRetry={loadSummary} /></div>}
              {data.summary.totalCalls === 0 && (
                <div className={`${card} mb-4`}>
                  <EmptyState icon={Smartphone} title="No calls synced for this range"
                    hint="Calls show up once employees sign in to the SKYUP mobile app with call-log permission on. Try a wider date range." />
                </div>
              )}
              {tab === "summary"
                ? <SummaryTab data={data} onViewCalls={viewCalls} onDrill={onDrill} onExportEmployees={exportEmployees} isSingle={!!employee} />
                : <AnalysisTab data={data} isSuperAdmin={isSuperAdmin} onDrill={onDrill} />}
            </div>
          )
      )}
      {tab === "clients" && <ClientsTab key={`clients-${drill.n}`} query={query} refreshKey={refreshKey} isSuperAdmin={isSuperAdmin} onDrill={onDrill} />}
      {tab === "never" && <NeverAttendedTab query={query} refreshKey={refreshKey} isSuperAdmin={isSuperAdmin} onDrill={onDrill} />}
      {tab === "history" && <HistoryTab key={`history-${drill.n}`} query={query} refreshKey={refreshKey} isSuperAdmin={isSuperAdmin} initial={drill} />}
      {tab === "recordings" && canRecordings && <HistoryTab key="recordings" query={query} refreshKey={refreshKey} isSuperAdmin={isSuperAdmin} recordingsOnly />}
    </div>
  );
}
