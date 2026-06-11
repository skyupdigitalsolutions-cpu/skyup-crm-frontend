import { useState, useEffect, useCallback } from "react";
import {
  Download,
  RefreshCw,
  MapPin,
  Navigation,
  Check,
  X,
  Loader2,
  ExternalLink,
  Users,
  AlertCircle,
  CircleAlert,
} from "lucide-react";
import AttendanceFilters from "../components/AttendanceFilters";
import AttendanceTable from "../components/AttendanceTable";
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
  startDate: today,
  endDate: today,
  userId: "",
  crmStatus: "",
  quick: "today",
};

// ── MeetingTrackingSettings ───────────────────────────────────────────────────
// Admin sets whether location tracking is enabled during client meetings,
// and the interval (5–60 min). Appears as a button in the Attendance header.
function MeetingTrackingSettings() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [interval, setInterval] = useState(15);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get("/attendance/meeting-tracking")
      .then(r => { setEnabled(r.data.enabled || false); setInterval(r.data.intervalMinutes || 15); })
      .catch(() => setMsg({ type: "err", text: "Failed to load settings." }))
      .finally(() => setLoading(false));
  }, [open]);

  const flash = (type, text) => {
    setMsg({ type, text });
    if (type === "ok") setTimeout(() => setMsg({ type: "", text: "" }), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/attendance/meeting-tracking", { enabled, intervalMinutes: interval });
      flash("ok", "Saved! Employees will be tracked every " + interval + " min when on a client meeting.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Client Meeting Location Tracking"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[12px] font-semibold transition ${
          open
            ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
            : "border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#4B5168] dark:text-[#9DA3BB] hover:border-emerald-300 hover:text-emerald-700"
        }`}
      >
        <Navigation className="w-4 h-4 shrink-0" strokeWidth={2} />
        Client Tracking
        {enabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[320px] bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F0F2FA] dark:border-[#262A38]">
            <div>
              <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Client Meeting Tracking</p>
              <p className="text-[11px] text-[#8B92A9] mt-0.5">Track employee GPS during approved client visits</p>
            </div>
            <button onClick={() => setOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8B92A9] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#8B92A9]" />
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">

              {/* Enable toggle */}
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
                    {enabled ? "Location tracking ON" : "Location tracking OFF"}
                  </p>
                  <p className="text-[11px] text-[#8B92A9] mt-0.5">
                    {enabled
                      ? "GPS pings stored every " + interval + " min during approved meetings"
                      : "No GPS data collected during client visits"}
                  </p>
                </div>
                <div className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${enabled ? "bg-emerald-500" : "bg-[#D1D5DB] dark:bg-[#3E4257]"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
              </button>

              {/* Interval slider */}
              <div>
                <label className="block text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-2">
                  Tracking Interval
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min="5" max="60" step="5"
                    value={interval}
                    onChange={e => setInterval(Number(e.target.value))}
                    className="flex-1 accent-emerald-600"
                  />
                  <span className="w-16 text-center px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[12px] font-bold font-mono">
                    {interval} min
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-[#8B92A9] mt-1">
                  <span>5 min (frequent)</span><span>30 min (balanced)</span><span>60 min (light)</span>
                </div>
              </div>

              {/* How it works */}
              <div className="px-3 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
                <p className="text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">How it works</p>
                <ul className="text-[10px] text-[#8B92A9] space-y-0.5 list-disc list-inside">
                  <li>Only activates when you approve an employee's remote clock-in request</li>
                  <li>Employee must grant Location permission on their device</li>
                  <li>GPS pings are stored in your database for 30 days</li>
                  <li>View the trail on the Attendance page → employee detail</li>
                </ul>
              </div>

              {msg.text && (
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold ${
                  msg.type === "ok"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}>
                  {msg.type === "ok" ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                  {msg.text}
                </div>
              )}

              <button
                onClick={handleSave} disabled={saving}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                  : <><Check className="w-4 h-4" strokeWidth={2.5} />Save Tracking Settings</>
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── LiveLocationsPanel ────────────────────────────────────────────────────────
// Admin views today's GPS trail for employees who are on client meetings.
// Shows a map link for each ping and the full trail in chronological order.
function LiveLocationsPanel({ open, onClose }) {
  const [pings, setPings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const loadPings = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/attendance/live-locations?limit=200");
      setPings(r.data.pings || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) loadPings(); }, [open, loadPings]);

  if (!open) return null;

  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
  const mapUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}&z=17`;

  // Group pings by employee
  const grouped = pings.reduce((acc, p) => {
    const uid = p.user?._id || p.user;
    if (!acc[uid]) acc[uid] = { user: p.user, pings: [] };
    acc[uid].pings.push(p);
    return acc;
  }, {});

  const employees = Object.values(grouped).filter(g => {
    if (!filter) return true;
    const name = g.user?.name || "";
    return name.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F2FA] dark:border-[#262A38]">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-500 shrink-0" strokeWidth={2} />
            <div>
              <p className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Live Client Meeting Locations</p>
              <p className="text-[11px] text-[#8B92A9] mt-0.5">Today's GPS trail — {pings.length} pings from {employees.length} employee{employees.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadPings} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8B92A9] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38]">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8B92A9] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38]">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[#F0F2FA] dark:border-[#262A38]">
          <input
            type="text" placeholder="Filter by employee name…"
            value={filter} onChange={e => setFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-indigo-400 transition"
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#8B92A9]" />
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Users className="w-10 h-10 text-[#565C75]" strokeWidth={1.5} />
              <p className="text-[13px] text-[#565C75]">No location pings today.</p>
              <p className="text-[11px] text-[#8B92A9] text-center max-w-xs">Pings appear here when employees with approved remote clock-in send GPS updates.</p>
            </div>
          ) : (
            employees.map(({ user, pings: empPings }) => (
              <div key={user?._id || user} className="border-b border-[#F0F2FA] dark:border-[#262A38] last:border-0">
                {/* Employee header */}
                <div className="flex items-center gap-2.5 px-5 py-3 bg-[#F8F9FC] dark:bg-[#13161E]">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-[11px] font-bold text-indigo-700 dark:text-indigo-400 shrink-0">
                    {(user?.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{user?.name || "Unknown"}</p>
                    <p className="text-[11px] text-[#8B92A9]">{empPings.length} ping{empPings.length !== 1 ? "s" : ""} today</p>
                  </div>
                  {/* Latest location map link */}
                  {empPings[0] && (
                    <a
                      href={mapUrl(empPings[0].latitude, empPings[0].longitude)}
                      target="_blank" rel="noreferrer"
                      className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold hover:bg-indigo-100 transition shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" strokeWidth={2} />
                      Latest
                    </a>
                  )}
                </div>

                {/* Pings trail */}
                <div className="px-5 py-2 space-y-1.5">
                  {empPings.map((ping, idx) => (
                    <div key={ping._id} className="flex items-center gap-3 py-1.5">
                      <div className="relative flex flex-col items-center shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? "bg-emerald-500" : "bg-[#565C75]"}`} />
                        {idx < empPings.length - 1 && <div className="w-px h-4 bg-[#E4E7EF] dark:bg-[#262A38] mt-0.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] font-mono">
                            {ping.latitude.toFixed(5)}, {ping.longitude.toFixed(5)}
                          </span>
                          {ping.accuracy && (
                            <span className="text-[10px] text-[#8B92A9]">±{Math.round(ping.accuracy)}m</span>
                          )}
                        </div>
                        {ping.address && (
                          <p className="text-[11px] text-[#8B92A9] truncate">{ping.address}</p>
                        )}
                        <p className="text-[10px] text-[#565C75]">{fmtTime(ping.capturedAt)}</p>
                      </div>
                      <a
                        href={mapUrl(ping.latitude, ping.longitude)}
                        target="_blank" rel="noreferrer"
                        className="shrink-0 text-[#8B92A9] hover:text-indigo-500 transition"
                        title="Open in Google Maps"
                      >
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── ClockInLocationSettings ───────────────────────────────────────────────────
// Lets admin set the office lat/lng and radius. Employees must clock in
// from within that radius unless they have client-meeting permission.
function ClockInLocationSettings() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("100");
  const [detecting, setDetecting] = useState(false);

  // Load current config when panel opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get("/admin/company/clock-in-location")
      .then(r => {
        const d = r.data || {};
        setEnabled(d.enabled || false);
        setLatitude(d.latitude != null ? String(d.latitude) : "");
        setLongitude(d.longitude != null ? String(d.longitude) : "");
        setRadius(d.radius != null ? String(d.radius) : "100");
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
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        radius: radius ? parseInt(radius, 10) : 100,
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
        <MapPin className="w-4 h-4 shrink-0" strokeWidth={2} />
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
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#8B92A9]" />
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
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Navigation className="w-3 h-3" strokeWidth={2.5} />
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
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                    Verify on Google Maps
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
                <CircleAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  Employees on a <strong>client meeting</strong> can be granted temporary remote clock-in permission from the Employee Management page (location pin icon next to each employee).
                </p>
              </div>

              {/* Feedback */}
              {msg.text && (
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold ${
                  msg.type === "ok"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 dark:bg-red-950/30 text-red-600 border border-red-200"
                }`}>
                  {msg.type === "ok" ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                  {msg.text}
                </div>
              )}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                  : <><Check className="w-4 h-4" strokeWidth={2.5} />Save Location Settings</>
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
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showLiveLocations, setShowLiveLocations] = useState(false);

  const loadData = useCallback(async (overrideFilters) => {
    setLoading(true);
    const f = overrideFilters || filters;
    try {
      const params = {
        startDate: f.startDate,
        endDate: f.endDate,
        ...(f.userId && { userId: f.userId }),
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
        startDate: filters.startDate,
        endDate: filters.endDate,
        ...(filters.userId && { userId: filters.userId }),
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
          {/* Client meeting location tracking settings */}
          <MeetingTrackingSettings />
          {/* Clock-in location restriction settings */}
          <ClockInLocationSettings />
          {/* View live employee locations */}
          <button
            onClick={() => setShowLiveLocations(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#4B5168] dark:text-[#9DA3BB] text-[12px] font-semibold hover:border-indigo-300 hover:text-indigo-700 transition"
            title="View live client meeting locations"
          >
            <MapPin className="w-4 h-4 shrink-0" strokeWidth={2} />
            Live Locations
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold shadow transition disabled:opacity-60"
          >
            {exporting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" strokeWidth={2} />
            }
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
          className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
          Refresh
        </button>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <AttendanceTable
        records={records}
        loading={loading}
        onRefresh={() => loadData()}
      />

      {/* Live client meeting location viewer */}
      <LiveLocationsPanel open={showLiveLocations} onClose={() => setShowLiveLocations(false)} />

    </div>
  );
}
