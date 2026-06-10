import { useState, useEffect, useCallback } from "react";
import AttendanceFilters from "../components/AttendanceFilters";
import AttendanceTable   from "../components/AttendanceTable";
import { fetchAttendanceReport, fetchAttendanceExport } from "../services/attendanceService";
import api from "../data/axiosConfig";

// ── xlsx (SheetJS) export ─────────────────────────────────────────────────────
async function exportToExcel(params) {
  // Dynamically import xlsx so it's not in the main bundle
  const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");

  const rows = await fetchAttendanceExport(params);

  if (!rows.length) {
    alert("No data to export for the selected filters.");
    return;
  }

  const wsData = [
    ["Employee Name", "Email", "Date", "Check-In", "Check-Out", "Working Hours", "Break (mins)", "Status", "Remarks"],
    ...rows.map(r => [
      r.employeeName, r.email, r.date, r.checkIn, r.checkOut,
      r.workingHours, r.breakMinutes, r.status, r.remarks,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = [22, 28, 12, 10, 10, 14, 14, 12, 24].map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Attendance_${dateTag}.xlsx`);
}

// ── Summary counts ────────────────────────────────────────────────────────────
const SUMMARY_ITEMS = [
  { key: "present",  label: "Present",  color: "emerald" },
  { key: "absent",   label: "Absent",   color: "red"     },
  { key: "late",     label: "Late",     color: "amber"   },
  { key: "half_day", label: "Half-Day", color: "blue"    },
  { key: "leave",    label: "Leave",    color: "purple"  },
];

const today = new Date().toISOString().slice(0, 10);

const DEFAULT_FILTERS = {
  startDate : today,
  endDate   : today,
  userId    : "",
  crmStatus : "",
  quick     : "today",
};

// ── ClockInLocationSettings ───────────────────────────────────────────────────
// Lets admin set the office lat/lng and radius. Employees must clock in
// from within that radius unless they have client-meeting permission.
function ClockInLocationSettings() {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState({ type: "", text: "" });

  // Form state
  const [enabled,   setEnabled]   = useState(false);
  const [latitude,  setLatitude]  = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius,    setRadius]    = useState("100");
  const [detecting, setDetecting] = useState(false);

  // Load current config when panel opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get("/admin/company/clock-in-location")
      .then(r => {
        const d = r.data || {};
        setEnabled(d.enabled || false);
        setLatitude(d.latitude  != null ? String(d.latitude)  : "");
        setLongitude(d.longitude != null ? String(d.longitude) : "");
        setRadius(d.radius  != null ? String(d.radius)  : "100");
      })
      .catch(() => setMsg({ type: "err", text: "Failed to load settings." }))
      .finally(() => setLoading(false));
  }, [open]);

  const flash = (type, text) => {
    setMsg({ type, text });
    if (type === "ok") setTimeout(() => setMsg({ type: "", text: "" }), 3000);
  };

  // Auto-detect current device location
  const detectLocation = () => {
    if (!navigator.geolocation) {
      flash("err", "Geolocation not supported by this browser.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLatitude(pos.coords.latitude.toFixed(7));
        setLongitude(pos.coords.longitude.toFixed(7));
        setDetecting(false);
        flash("ok", "Location detected! Verify it on the map link below, then save.");
      },
      () => {
        setDetecting(false);
        flash("err", "Could not detect location. Please allow location access or enter manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    if (enabled && (!latitude || !longitude)) {
      flash("err", "Enter latitude and longitude before enabling location restriction.");
      return;
    }
    setSaving(true);
    try {
      await api.put("/admin/company/clock-in-location", {
        enabled,
        latitude:  latitude  ? parseFloat(latitude)  : null,
        longitude: longitude ? parseFloat(longitude) : null,
        radius:    radius    ? parseInt(radius, 10)   : 100,
      });
      flash("ok", "Clock-in location settings saved.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const mapUrl = latitude && longitude
    ? `https://www.google.com/maps?q=${latitude},${longitude}&z=17`
    : null;

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Clock-In Location Settings"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[12px] font-semibold transition ${
          open
            ? "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
            : "border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#4B5168] dark:text-[#9DA3BB] hover:border-indigo-300 hover:text-indigo-700"
        }`}
      >
        {/* Location pin icon */}
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        Clock-In Location
        {enabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Location restriction active" />}
      </button>

      {/* Settings panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F0F2FA] dark:border-[#262A38]">
            <div>
              <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Clock-In Location</p>
              <p className="text-[11px] text-[#8B92A9] mt-0.5">Restrict employee clock-in to your office area</p>
            </div>
            <button onClick={() => setOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8B92A9] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="w-5 h-5 animate-spin text-[#8B92A9]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">

              {/* Enable / Disable toggle */}
              <button
                onClick={() => setEnabled(v => !v)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition ${
                  enabled
                    ? "border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/10"
                    : "border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]"
                }`}
              >
                <div className="text-left">
                  <p className={`text-[13px] font-semibold ${enabled ? "text-emerald-700 dark:text-emerald-400" : "text-[#0F1117] dark:text-[#F0F2FA]"}`}>
                    {enabled ? "Location restriction ON" : "Location restriction OFF"}
                  </p>
                  <p className="text-[11px] text-[#8B92A9] mt-0.5">
                    {enabled ? "Employees must be within the set radius to clock in" : "Employees can clock in from anywhere"}
                  </p>
                </div>
                {/* Toggle pill */}
                <div className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${enabled ? "bg-emerald-500" : "bg-[#D1D5DB] dark:bg-[#3E4257]"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
              </button>

              {/* Coordinates */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Office Coordinates</label>
                  <button
                    onClick={detectLocation}
                    disabled={detecting}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold hover:bg-indigo-100 transition disabled:opacity-60"
                  >
                    {detecting
                      ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm-9 3H1m22 0h-2M12 3V1m0 22v-2"/></svg>
                    }
                    {detecting ? "Detecting…" : "Use my location"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#8B92A9] mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.0000001"
                      value={latitude}
                      onChange={e => setLatitude(e.target.value)}
                      placeholder="e.g. 12.9716"
                      className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] font-mono focus:outline-none focus:border-indigo-400 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#8B92A9] mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.0000001"
                      value={longitude}
                      onChange={e => setLongitude(e.target.value)}
                      placeholder="e.g. 77.5946"
                      className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] font-mono focus:outline-none focus:border-indigo-400 transition"
                    />
                  </div>
                </div>

                {/* Radius */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-1.5">
                    Allowed Radius (metres)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="50"
                      value={radius}
                      onChange={e => setRadius(e.target.value)}
                      className="flex-1 accent-indigo-600"
                    />
                    <span className="w-16 text-center px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[12px] font-bold font-mono">
                      {radius}m
                    </span>
                  </div>
                  <p className="text-[10px] text-[#8B92A9] mt-1">Employees within {radius} metres of these coordinates can clock in</p>
                </div>

                {/* Map preview link */}
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                    Verify on Google Maps ↗
                  </a>
                )}
              </div>

              {/* How to get coordinates hint */}
              <div className="px-3 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
                <p className="text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">How to get your office coordinates</p>
                <ol className="text-[10px] text-[#8B92A9] space-y-0.5 list-decimal list-inside">
                  <li>Click <strong>"Use my location"</strong> while at the office — quickest way</li>
                  <li>Or open Google Maps → right-click your office → copy coordinates</li>
                  <li>Or search <strong>google.com/maps</strong> → navigate to office → URL shows lat,lng</li>
                </ol>
              </div>

              {/* Client meeting permission note */}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-700">
                <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  Employees on a <strong>client meeting</strong> can be granted temporary remote clock-in permission from the Employee Management page (📍 pin icon next to each employee).
                </p>
              </div>

              {/* Feedback */}
              {msg.text && (
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold ${
                  msg.type === "ok"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 dark:bg-red-950/30 text-red-600 border border-red-200"
                }`}>
                  {msg.type === "ok" ? "✓" : "✕"} {msg.text}
                </div>
              )}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving
                  ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving…</>
                  : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Save Location Settings</>
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const [filters,     setFilters]     = useState(DEFAULT_FILTERS);
  const [records,     setRecords]     = useState([]);
  const [pagination,  setPagination]  = useState({ total: 0, page: 1, pages: 1 });
  const [loading,     setLoading]     = useState(true);
  const [exporting,   setExporting]   = useState(false);

  const loadData = useCallback(async (overrideFilters) => {
    setLoading(true);
    const f = overrideFilters || filters;
    try {
      const params = {
        startDate : f.startDate,
        endDate   : f.endDate,
        ...(f.userId    && { userId:    f.userId    }),
        ...(f.crmStatus && { crmStatus: f.crmStatus }),
        limit: 100,
      };
      const data = await fetchAttendanceReport(params);
      setRecords(data.records || []);
      setPagination({ total: data.total, page: data.page, pages: data.pages });
    } catch (e) {
      console.error("Attendance load error:", e);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    loadData(newFilters);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {
        startDate : filters.startDate,
        endDate   : filters.endDate,
        ...(filters.userId    && { userId:    filters.userId    }),
        ...(filters.crmStatus && { crmStatus: filters.crmStatus }),
      };
      await exportToExcel(params);
    } catch (e) {
      console.error("Export error:", e);
      alert("Export failed. Please try again.");
    }
    setExporting(false);
  };

  // Summary counts from loaded records
  const summary = SUMMARY_ITEMS.reduce((acc, { key }) => {
    acc[key] = records.filter(r => r.derivedCrmStatus === key).length;
    return acc;
  }, {});

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-[#0D0F14]">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Attendance Management</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Track, filter and manage employee attendance</p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Clock-in location restriction settings */}
          <ClockInLocationSettings />
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold shadow transition disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting ? "Exporting…" : "Export Excel"}
          </button>
        </div>
      </div>

      {/* ── Summary Pills ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
        {SUMMARY_ITEMS.map(({ key, label, color }) => (
          <div key={key}
            className={`bg-${color}-50 dark:bg-${color}-950/30 border border-${color}-100 dark:border-${color}-900/30 rounded-xl px-4 py-3`}
          >
            <p className={`text-[22px] font-bold text-${color}-600 dark:text-${color}-400`}>
              {loading ? "—" : summary[key] ?? 0}
            </p>
            <p className={`text-[11px] font-semibold text-${color}-500 dark:text-${color}-500 mt-0.5`}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <AttendanceFilters filters={filters} onChange={handleFilterChange} />

      {/* ── Result count + refresh ────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-gray-400">
          {loading ? "Loading…" : `${pagination.total} record${pagination.total !== 1 ? "s" : ""} found`}
        </p>
        <button
          onClick={() => loadData()}
          className="text-[12px] font-semibold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <AttendanceTable
        records={records}
        loading={loading}
        onRefresh={() => loadData()}
      />

    </div>
  );
}
