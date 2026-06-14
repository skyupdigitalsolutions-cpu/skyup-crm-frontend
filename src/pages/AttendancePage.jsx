import { useState, useEffect, useCallback } from "react";
import {
  MapPin, Navigation, Save, X, Check, AlertCircle,
  ExternalLink, RefreshCw, Download, MapPinned,
  LocateFixed, Clock, Activity, Loader2,
  Info, PhoneCall, UserCheck, Bell, CalendarDays, PartyPopper,
} from "lucide-react";
import AttendanceFilters from "../components/AttendanceFilters";
import AttendanceTable   from "../components/AttendanceTable";
import { fetchAttendanceReport, fetchAttendanceExport } from "../services/attendanceService";
import api from "../data/axiosConfig";
import { getRole, getStoredUser } from "../data/dataService";

// ── xlsx export ───────────────────────────────────────────────────────────────
async function exportToExcel(params) {
  const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
  const rows = await fetchAttendanceExport(params);
  if (!rows.length) { alert("No data to export for the selected filters."); return; }
  const wsData = [
    ["Employee Name", "Email", "Date", "Check-In", "Check-Out", "Working Hours", "Break (mins)", "Status", "Remarks"],
    ...rows.map(r => [r.employeeName, r.email, r.date, r.checkIn, r.checkOut, r.workingHours, r.breakMinutes, r.status, r.remarks]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [22, 28, 12, 10, 10, 14, 14, 12, 24].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  XLSX.writeFile(wb, `Attendance_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Summary config ────────────────────────────────────────────────────────────
const SUMMARY_ITEMS = [
  { key: "present",  label: "Present",  color: "emerald" },
  { key: "absent",   label: "Absent",   color: "red"     },
  { key: "late",     label: "Late",     color: "amber"   },
  { key: "half_day", label: "Half-Day", color: "blue"    },
  { key: "leave",    label: "Leave",    color: "purple"  },
];

const today = new Date().toISOString().slice(0, 10);
const DEFAULT_FILTERS = { startDate: today, endDate: today, userId: "", crmStatus: "", quick: "today" };

// ── Shared sub-components ─────────────────────────────────────────────────────
function Toggle({ enabled, onToggle, label, description }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
        enabled
          ? "border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/10"
          : "border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] hover:border-[#CBD5E1] dark:hover:border-[#3E4257]"
      }`}
    >
      {/* Toggle pill — fixed size, always on right, never pushed out */}
      <div className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${enabled ? "bg-emerald-500" : "bg-[#D1D5DB] dark:bg-[#3E4257]"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
      {/* Text — takes remaining space, truncates cleanly */}
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold leading-tight ${enabled ? "text-emerald-700 dark:text-emerald-400" : "text-[#0F1117] dark:text-[#F0F2FA]"}`}>
          {label}
        </p>
        <p className="text-[11px] text-[#8B92A9] mt-0.5 leading-snug">{description}</p>
      </div>
    </button>
  );
}

function PanelHeader({ icon: Icon, title, subtitle, onClose, iconColor = "text-indigo-500", iconBg = "bg-indigo-50 dark:bg-indigo-500/10" }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-4 pb-3.5 border-b border-[#F0F2FA] dark:border-[#262A38]">
      <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={15} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{title}</p>
        <p className="text-[11px] text-[#8B92A9] mt-0.5">{subtitle}</p>
      </div>
      <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8B92A9] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition shrink-0">
        <X size={15} />
      </button>
    </div>
  );
}

function Feedback({ msg }) {
  if (!msg?.text) return null;
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-semibold border ${
      msg.type === "ok"
        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
        : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
    }`}>
      {msg.type === "ok" ? <Check size={13} /> : <AlertCircle size={13} />}
      {msg.text}
    </div>
  );
}

function SaveButton({ saving, onClick, disabled, label = "Save Changes" }) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition flex items-center justify-center gap-2"
    >
      {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
      {saving ? "Saving…" : label}
    </button>
  );
}

// ── ClockInLocationSettings ───────────────────────────────────────────────────
function ClockInLocationSettings() {
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [msg,       setMsg]       = useState({ type: "", text: "" });
  const [enabled,   setEnabled]   = useState(false);
  const [latitude,  setLatitude]  = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius,    setRadius]    = useState("100");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get("/admin/company/clock-in-location")
      .then(r => {
        const d = r.data || {};
        setEnabled(d.enabled || false);
        setLatitude(d.latitude  != null ? String(d.latitude)  : "");
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

  const detectLocation = () => {
    if (!navigator.geolocation) { flash("err", "Geolocation not supported."); return; }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLatitude(pos.coords.latitude.toFixed(7));
        setLongitude(pos.coords.longitude.toFixed(7));
        setDetecting(false);
        flash("ok", "Location detected — verify on map then save.");
      },
      () => { setDetecting(false); flash("err", "Could not detect location."); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    if (enabled && (!latitude || !longitude)) {
      flash("err", "Enter coordinates before enabling restriction."); return;
    }
    setSaving(true);
    try {
      await api.put("/admin/company/clock-in-location", {
        enabled,
        latitude:  latitude  ? parseFloat(latitude)  : null,
        longitude: longitude ? parseFloat(longitude) : null,
        radius:    radius    ? parseInt(radius, 10)   : 100,
      });
      flash("ok", "Location settings saved.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Failed to save.");
    } finally { setSaving(false); }
  };

  const mapUrl = latitude && longitude
    ? `https://www.google.com/maps?q=${latitude},${longitude}&z=17` : null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Clock-In Location Settings"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[12px] font-semibold transition-all ${
          open
            ? "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
            : "border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#4B5168] dark:text-[#9DA3BB] hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300"
        }`}
      >
        <MapPin size={15} className="shrink-0" />
        <span>Office Location</span>
        {enabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-[360px] sm:w-[360px] bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl z-50 overflow-hidden">
          <PanelHeader
            icon={MapPin}
            title="Clock-In Location"
            subtitle="Restrict clock-in to your office area"
            onClose={() => setOpen(false)}
          />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[#8B92A9]" />
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">

              <Toggle
                enabled={enabled}
                onToggle={() => setEnabled(v => !v)}
                label={enabled ? "Restriction enabled" : "No restriction"}
                description={enabled ? "Employees must be within the set radius" : "Employees can clock in from anywhere"}
              />

              {/* Coordinates section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Office Coordinates</p>
                  <button
                    onClick={detectLocation}
                    disabled={detecting}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition disabled:opacity-60"
                  >
                    {detecting ? <Loader2 size={12} className="animate-spin" /> : <LocateFixed size={12} />}
                    {detecting ? "Detecting…" : "Use my location"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Latitude",  val: latitude,  set: setLatitude,  ph: "e.g. 12.9716" },
                    { label: "Longitude", val: longitude, set: setLongitude, ph: "e.g. 77.5946" },
                  ].map(({ label, val, set, ph }) => (
                    <div key={label}>
                      <label className="block text-[10px] font-semibold text-[#8B92A9] mb-1.5">{label}</label>
                      <input
                        type="number" step="0.0000001" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                        className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] font-mono focus:outline-none focus:border-indigo-400 transition"
                      />
                    </div>
                  ))}
                </div>

                {/* Radius slider */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Radius</label>
                    <span className="text-[12px] font-bold text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-lg">{radius}m</span>
                  </div>
                  <input
                    type="range" min="50" max="1000" step="50" value={radius}
                    onChange={e => setRadius(e.target.value)}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[9px] text-[#8B92A9] mt-1">
                    <span>50m</span><span>500m</span><span>1000m</span>
                  </div>
                </div>

                {/* Map link */}
                {mapUrl && (
                  <a href={mapUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold w-fit"
                  >
                    <ExternalLink size={12} />
                    Verify on Google Maps
                  </a>
                )}
              </div>

              {/* Hint */}
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Info size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  Employees on a <strong>client visit</strong> can be granted temporary remote clock-in from the Employee Management page.
                </p>
              </div>

              <Feedback msg={msg} />
              <SaveButton saving={saving} onClick={handleSave} label="Save Location Settings" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AttendanceSettings ────────────────────────────────────────────────────────
// Company-wide attendance configuration set by admin/superadmin.
// Covers: shift timings, late threshold, half/full-day rules, weekly off days,
// and specific holiday dates. Applies to ALL employees (not per-employee).
function AttendanceSettings() {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState({ type: "", text: "" });

  const [cfg, setCfg] = useState({
    shiftStartHour: 9, shiftStartMinute: 0,
    shiftEndHour: 18,  shiftEndMinute: 0,
    lateLoginHour: 10, lateLoginMinute: 30,
    halfDayMinMinutes: 240, fullDayMinMinutes: 480,
    weeklyOffDays: [0],
    holidays: [],
  });

  // New holiday input
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get("/admin/company/attendance-config")
      .then(r => setCfg(c => ({ ...c, ...r.data, weeklyOffDays: r.data.weeklyOffDays || [0], holidays: r.data.holidays || [] })))
      .catch(() => setMsg({ type: "err", text: "Failed to load settings." }))
      .finally(() => setLoading(false));
  }, [open]);

  const flash = (type, text) => {
    setMsg({ type, text });
    if (type === "ok") setTimeout(() => setMsg({ type: "", text: "" }), 3000);
  };

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const toggleWeeklyOff = (day) => {
    setCfg(c => ({
      ...c,
      weeklyOffDays: c.weeklyOffDays.includes(day)
        ? c.weeklyOffDays.filter(d => d !== day)
        : [...c.weeklyOffDays, day].sort(),
    }));
  };

  const addHoliday = () => {
    if (!newHolidayDate) { flash("err", "Pick a holiday date first."); return; }
    if (cfg.holidays.some(h => h.date === newHolidayDate)) { flash("err", "That date is already added."); return; }
    setCfg(c => ({
      ...c,
      holidays: [...c.holidays, { date: newHolidayDate, name: newHolidayName.trim() || "Holiday" }]
        .sort((a, b) => a.date.localeCompare(b.date)),
    }));
    setNewHolidayDate("");
    setNewHolidayName("");
  };

  const removeHoliday = (date) => {
    setCfg(c => ({ ...c, holidays: c.holidays.filter(h => h.date !== date) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/admin/company/attendance-config", cfg);
      flash("ok", "Attendance settings saved for the whole company.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Failed to save.");
    } finally { setSaving(false); }
  };

  const fmt = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const DAYS = [
    { n: 1, label: "Mon" }, { n: 2, label: "Tue" }, { n: 3, label: "Wed" },
    { n: 4, label: "Thu" }, { n: 5, label: "Fri" }, { n: 6, label: "Sat" }, { n: 0, label: "Sun" },
  ];

  const TimeField = ({ label, h, m, onH, onM, accent = "indigo" }) => (
    <div>
      <label className="block text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-1.5">{label}</label>
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} max={23} value={h} onChange={e => onH(Number(e.target.value))}
          className={`w-full px-2 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] font-mono text-center text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-${accent}-400 transition`} />
        <span className="text-[#8B92A9] font-bold">:</span>
        <input type="number" min={0} max={59} value={m} onChange={e => onM(Number(e.target.value))}
          className={`w-full px-2 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] font-mono text-center text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-${accent}-400 transition`} />
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Company Attendance Settings"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[12px] font-semibold transition-all ${
          open
            ? "bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
            : "border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#4B5168] dark:text-[#9DA3BB] hover:border-amber-300 dark:hover:border-amber-700 hover:text-amber-700 dark:hover:text-amber-300"
        }`}
      >
        <Clock size={15} className="shrink-0" />
        <span>Attendance Setup</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-[400px] sm:w-[400px] max-h-[80vh] overflow-y-auto bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl z-50">
          <div className="sticky top-0 bg-white dark:bg-[#1A1D27] z-10">
            <PanelHeader
              icon={Clock}
              title="Attendance Setup"
              subtitle="Company-wide shift, holidays & rules"
              onClose={() => setOpen(false)}
              iconColor="text-amber-500"
              iconBg="bg-amber-50 dark:bg-amber-500/10"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-[#8B92A9]" />
            </div>
          ) : (
            <div className="px-5 py-4 space-y-5">

              {/* Shift timings */}
              <div>
                <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Shift Timings</p>
                <div className="grid grid-cols-2 gap-3">
                  <TimeField label="Shift Start" h={cfg.shiftStartHour} m={cfg.shiftStartMinute}
                    onH={v => set("shiftStartHour", v)} onM={v => set("shiftStartMinute", v)} accent="emerald" />
                  <TimeField label="Shift End" h={cfg.shiftEndHour} m={cfg.shiftEndMinute}
                    onH={v => set("shiftEndHour", v)} onM={v => set("shiftEndMinute", v)} accent="red" />
                </div>
                <p className="text-[10px] text-[#8B92A9] mt-1.5">
                  Standard working hours: {fmt(cfg.shiftStartHour, cfg.shiftStartMinute)} – {fmt(cfg.shiftEndHour, cfg.shiftEndMinute)}
                </p>
              </div>

              {/* Late threshold */}
              <div>
                <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Late Threshold</p>
                <TimeField label="Mark Late After" h={cfg.lateLoginHour} m={cfg.lateLoginMinute}
                  onH={v => set("lateLoginHour", v)} onM={v => set("lateLoginMinute", v)} accent="amber" />
                <p className="text-[10px] text-[#8B92A9] mt-1.5">
                  Clock-in after <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{fmt(cfg.lateLoginHour, cfg.lateLoginMinute)}</span> is marked Late.
                </p>
              </div>

              {/* Day rules */}
              <div>
                <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2.5">⏱ Day Rules</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-1.5">Half-Day (min hrs)</label>
                    <input type="number" min={0} value={(cfg.halfDayMinMinutes / 60).toFixed(1)}
                      onChange={e => set("halfDayMinMinutes", Math.round(Number(e.target.value) * 60))}
                      className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] font-mono text-center text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-blue-400 transition" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-1.5">Full-Day (min hrs)</label>
                    <input type="number" min={0} value={(cfg.fullDayMinMinutes / 60).toFixed(1)}
                      onChange={e => set("fullDayMinMinutes", Math.round(Number(e.target.value) * 60))}
                      className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] font-mono text-center text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-emerald-400 transition" />
                  </div>
                </div>
                <p className="text-[10px] text-[#8B92A9] mt-1.5">
                  Work &lt; {(cfg.halfDayMinMinutes / 60).toFixed(1)}h = Half-Day · ≥ {(cfg.fullDayMinMinutes / 60).toFixed(1)}h = Present
                </p>
              </div>

              {/* Weekly off days */}
              <div>
                <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2.5 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Weekly Off Days</p>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map(d => {
                    const isOff = cfg.weeklyOffDays.includes(d.n);
                    return (
                      <button key={d.n} onClick={() => toggleWeeklyOff(d.n)}
                        className={`w-11 py-2 rounded-lg text-[11px] font-bold border transition ${
                          isOff
                            ? "border-purple-400 bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400"
                            : "border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:border-purple-300"
                        }`}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[#8B92A9] mt-1.5">
                  {cfg.weeklyOffDays.length === 0 ? "No weekly off set" : `${cfg.weeklyOffDays.length} day(s) marked as weekly off`}
                </p>
              </div>

              {/* Holidays */}
              <div>
                <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2.5 flex items-center gap-1.5"><PartyPopper className="w-3.5 h-3.5" /> Holidays</p>

                {/* Add holiday row */}
                <div className="flex gap-2 mb-2">
                  <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)}
                    className="flex-1 px-2.5 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-pink-400 transition" />
                  <input type="text" placeholder="Name" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)}
                    className="w-24 px-2.5 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-pink-400 transition" />
                  <button onClick={addHoliday}
                    className="px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-[12px] font-bold transition shrink-0">+</button>
                </div>

                {/* Holiday list */}
                {cfg.holidays.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {cfg.holidays.map(h => (
                      <div key={h.date} className="flex items-center justify-between px-3 py-2 rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/40">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-pink-700 dark:text-pink-400 truncate">{h.name}</p>
                          <p className="text-[10px] text-[#8B92A9] font-mono">{h.date}</p>
                        </div>
                        <button onClick={() => removeHoliday(h.date)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/40 transition shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#8B92A9] italic">No holidays added yet.</p>
                )}
              </div>

              <Feedback msg={msg} />
              <SaveButton saving={saving} onClick={handleSave} label="Save Attendance Settings" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// Superadmin-only toggle. Controls whether employees' phones can sync call logs
// to the CRM. Uses the existing PUT /superadmin/companies/:id/call-log-sync API.
function CallLogSyncSettings({ companyId }) {
  const [open,    setOpen]    = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState({ type: "", text: "" });

  useEffect(() => {
    if (!open || !companyId) return;
    setLoading(true);
    api.get(`/superadmin/companies/${companyId}`)
      .then(r => {
        const c = r.data?.company ?? r.data;
        setEnabled(c?.callLogSyncEnabled !== false);
      })
      .catch(() => setMsg({ type: "err", text: "Failed to load sync setting." }))
      .finally(() => setLoading(false));
  }, [open, companyId]);

  const flash = (type, text) => {
    setMsg({ type, text });
    if (type === "ok") setTimeout(() => setMsg({ type: "", text: "" }), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/superadmin/companies/${companyId}/call-log-sync`, { enabled });
      flash("ok", `Call log sync ${enabled ? "enabled" : "disabled"} successfully.`);
    } catch (e) {
      flash("err", e.response?.data?.message || "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Device Call Log Sync Permission"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[12px] font-semibold transition-all ${
          open
            ? "bg-cyan-50 dark:bg-cyan-500/15 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300"
            : "border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#4B5168] dark:text-[#9DA3BB] hover:border-cyan-300 dark:hover:border-cyan-700 hover:text-cyan-700 dark:hover:text-cyan-300"
        }`}
      >
        <PhoneCall size={15} className="shrink-0" />
        <span>Call Log Sync</span>
        {/* Live status dot */}
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${enabled ? "bg-emerald-500" : "bg-red-400"}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-[340px] sm:w-[340px] bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl z-50 overflow-hidden">
          <PanelHeader
            icon={PhoneCall}
            title="Device Call Log Sync"
            subtitle="Control whether employees' phones sync call logs"
            onClose={() => setOpen(false)}
            iconColor="text-cyan-500"
            iconBg="bg-cyan-50 dark:bg-cyan-500/10"
          />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[#8B92A9]" />
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">

              <Toggle
                enabled={enabled}
                onToggle={() => setEnabled(v => !v)}
                label={enabled ? "Sync enabled" : "Sync disabled"}
                description={
                  enabled
                    ? "Employees' phones are actively syncing call logs to the CRM"
                    : "All sync requests from this company will be rejected (403)"
                }
              />

              {/* Warning when disabling */}
              {!enabled && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                  <Info size={13} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-700 dark:text-red-400 leading-relaxed">
                    Employees will see a sync-disabled message on their device. Existing logs already in the database are <strong>not</strong> deleted.
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
                <Info size={13} className="text-[#8B92A9] shrink-0 mt-0.5" />
                <p className="text-[10px] text-[#8B92A9] leading-relaxed">
                  This setting is company-wide. Individual employee permissions are not affected.
                </p>
              </div>

              <Feedback msg={msg} />
              <SaveButton saving={saving} onClick={handleSave} label="Save Sync Permission" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── MeetingTrackingSettings ───────────────────────────────────────────────────
function MeetingTrackingSettings() {
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [enabled,  setEnabled]  = useState(false);
  const [interval, setInterval] = useState(15);
  const [msg,      setMsg]      = useState({ type: "", text: "" });

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
      flash("ok", `Tracking every ${interval} min when on client visits.`);
    } catch (e) {
      flash("err", e.response?.data?.message || "Failed to save.");
    } finally { setSaving(false); }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Client Meeting Location Tracking"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[12px] font-semibold transition-all ${
          open
            ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
            : "border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#4B5168] dark:text-[#9DA3BB] hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-300"
        }`}
      >
        <Navigation size={15} className="shrink-0" />
        <span>Client Tracking</span>
        {enabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-[340px] sm:w-[340px] bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl z-50 overflow-hidden">
          <PanelHeader
            icon={Navigation}
            title="Client Visit Tracking"
            subtitle="GPS pings during approved remote clock-ins"
            onClose={() => setOpen(false)}
            iconColor="text-emerald-500"
            iconBg="bg-emerald-50 dark:bg-emerald-500/10"
          />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[#8B92A9]" />
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">

              <Toggle
                enabled={enabled}
                onToggle={() => setEnabled(v => !v)}
                label={enabled ? "Tracking enabled" : "Tracking disabled"}
                description={enabled ? `GPS ping every ${interval} min during visits` : "No GPS data collected"}
              />

              {/* Interval */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Ping Interval</label>
                  <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-lg">{interval} min</span>
                </div>
                <input
                  type="range" min="5" max="60" step="5" value={interval}
                  onChange={e => setInterval(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
                <div className="flex justify-between text-[9px] text-[#8B92A9] mt-1">
                  <span>5 min (frequent)</span><span>30 min</span><span>60 min (light)</span>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
                <Info size={13} className="text-[#8B92A9] shrink-0 mt-0.5" />
                <div className="text-[10px] text-[#8B92A9] space-y-1 leading-relaxed">
                  <p>Only activates after you <strong className="text-[#4B5168] dark:text-[#9DA3BB]">approve</strong> a remote clock-in request.</p>
                  <p>Employee must grant Location permission on their device.</p>
                  <p>Pings stored in database for 30 days.</p>
                </div>
              </div>

              <Feedback msg={msg} />
              <SaveButton saving={saving} onClick={handleSave} label="Save Tracking Settings" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── LiveLocationsPanel ────────────────────────────────────────────────────────
function LiveLocationsPanel({ open, onClose }) {
  const [pings,   setPings]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState("");

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
  const mapUrl  = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}&z=17`;

  const grouped = pings.reduce((acc, p) => {
    const uid = String(p.user?._id || p.user);
    if (!acc[uid]) acc[uid] = { user: p.user, pings: [] };
    acc[uid].pings.push(p);
    return acc;
  }, {});

  const employees = Object.values(grouped).filter(g =>
    !filter || (g.user?.name || "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#F0F2FA] dark:border-[#262A38]">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
            <MapPinned size={17} className="text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Live Client Locations</p>
            <p className="text-[11px] text-[#8B92A9] mt-0.5">
              Today · {pings.length} ping{pings.length !== 1 ? "s" : ""} · {employees.length} employee{employees.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={loadPings}
            className={`w-8 h-8 flex items-center justify-center rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
            <X size={15} />
          </button>
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
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#8B92A9]" />
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F8F9FC] dark:bg-[#13161E] flex items-center justify-center">
                <MapPin size={22} className="text-[#565C75]" />
              </div>
              <p className="text-[13px] font-semibold text-[#565C75]">No location pings today</p>
              <p className="text-[11px] text-[#8B92A9] text-center max-w-xs leading-relaxed px-4">
                Pings appear here when employees with approved remote clock-in send GPS updates.
              </p>
            </div>
          ) : (
            employees.map(({ user, pings: empPings }) => (
              <div key={user?._id || user} className="border-b border-[#F0F2FA] dark:border-[#262A38] last:border-0">
                {/* Employee row */}
                <div className="flex items-center gap-3 px-5 py-3 bg-[#F8F9FC] dark:bg-[#13161E]">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-[11px] font-bold text-indigo-700 dark:text-indigo-400 shrink-0">
                    {(user?.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{user?.name || "Unknown"}</p>
                    <p className="text-[11px] text-[#8B92A9]">{empPings.length} ping{empPings.length !== 1 ? "s" : ""}</p>
                  </div>
                  {empPings[0] && (
                    <a
                      href={mapUrl(empPings[0].latitude, empPings[0].longitude)}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold hover:bg-indigo-100 transition shrink-0"
                    >
                      <ExternalLink size={11} />
                      Latest
                    </a>
                  )}
                </div>

                {/* Ping trail */}
                <div className="px-5 py-2">
                  {empPings.map((ping, idx) => (
                    <div key={ping._id} className="flex items-start gap-3 py-2">
                      <div className="flex flex-col items-center pt-1 shrink-0">
                        <div className={`w-2 h-2 rounded-full ${idx === 0 ? "bg-emerald-500" : "bg-[#CBD5E1] dark:bg-[#3E4257]"}`} />
                        {idx < empPings.length - 1 && <div className="w-px h-5 bg-[#E4E7EF] dark:bg-[#262A38] mt-0.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] font-mono">
                          {ping.latitude.toFixed(5)}, {ping.longitude.toFixed(5)}
                          {ping.accuracy && <span className="text-[10px] text-[#8B92A9] font-sans ml-1.5">±{Math.round(ping.accuracy)}m</span>}
                        </p>
                        {ping.address && <p className="text-[11px] text-[#8B92A9] truncate">{ping.address}</p>}
                        <p className="text-[10px] text-[#565C75] flex items-center gap-1 mt-0.5">
                          <Clock size={9} />
                          {fmtTime(ping.capturedAt)}
                        </p>
                      </div>
                      <a href={mapUrl(ping.latitude, ping.longitude)} target="_blank" rel="noreferrer"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8B92A9] hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition shrink-0"
                        title="Open in Maps"
                      >
                        <ExternalLink size={13} />
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

// ── PendingRemoteClockInPanel ─────────────────────────────────────────────────
// Shows employees with a pending remote clock-in (client meeting) request so
// admins can approve/deny directly from the Attendance page, even if they
// missed the bell notification (e.g. notifications were off on their device).
function PendingRemoteClockInPanel() {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [busyId,   setBusyId]   = useState(null);
  const [msg,      setMsg]      = useState({ type: "", text: "" });

  const fmtAgo = (iso) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  };

  const flash = (type, text) => {
    setMsg({ type, text });
    if (type === "ok") setTimeout(() => setMsg({ type: "", text: "" }), 3000);
  };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/company/users");
      const users = res.data?.users || [];
      setRequests(users.filter(u => u.meetingPermissionStatus === "pending"));
    } catch {
      /* silent — non-critical panel */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Auto-refresh every 30s alongside the team attendance view
  useEffect(() => {
    const t = setInterval(loadRequests, 30000);
    return () => clearInterval(t);
  }, [loadRequests]);

  const respond = async (user, grant) => {
    const uid = user._id || user.id;
    setBusyId(uid);
    try {
      await api.put(`/admin/user/${uid}/meeting-permission`, { grant });
      setRequests(prev => prev.filter(r => (r._id || r.id) !== uid));
      flash("ok", `${user.name} ${grant ? "approved for remote clock-in (24h)" : "request denied"}.`);
    } catch (e) {
      flash("err", e.response?.data?.message || "Failed to update request.");
    } finally {
      setBusyId(null);
    }
  };

  if (!loading && requests.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-orange-200 dark:border-orange-900/40 rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
          <Bell size={16} className="text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">Pending Remote Clock-In Requests</h3>
          <p className="text-[11px] text-gray-400">Employees requesting permission to clock in from a client meeting</p>
        </div>
        {requests.length > 0 && (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 shrink-0">
            {requests.length} pending
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((u) => {
            const uid = u._id || u.id;
            const isBusy = busyId === uid;
            return (
              <div key={uid} className="flex items-center gap-3 p-3 rounded-xl bg-orange-50/60 dark:bg-orange-500/[0.06] border border-orange-100 dark:border-orange-900/30">
                <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-[12px] font-bold text-orange-600 dark:text-orange-400 shrink-0">
                  {(u.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{u.name}</p>
                  <div className="flex flex-wrap gap-2 mt-0.5 text-[10px] text-gray-400">
                    {u.meetingPermissionLocation && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {u.meetingPermissionLocation}</span>}
                    {u.meetingPermissionReason && <span>· {u.meetingPermissionReason}</span>}
                    <span>· requested {fmtAgo(u.meetingPermissionRequestedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => respond(u, false)}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] text-[11px] font-semibold hover:border-red-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition disabled:opacity-50"
                  >
                    <X size={12} />
                    Deny
                  </button>
                  <button
                    onClick={() => respond(u, true)}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-semibold transition"
                  >
                    {isBusy ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
                    Approve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <Feedback msg={msg} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const [filters,           setFilters]           = useState(DEFAULT_FILTERS);
  const [records,           setRecords]           = useState([]);
  const [pagination,        setPagination]        = useState({ total: 0, page: 1, pages: 1 });
  const [loading,           setLoading]           = useState(true);
  const [exporting,         setExporting]         = useState(false);
  const [showLiveLocations, setShowLiveLocations] = useState(false);

  // ── Role + company ────────────────────────────────────────────────────────
  const role         = getRole();
  const isSuperAdmin = role === "superadmin";
  const storedUser   = getStoredUser();
  // SuperAdminLogin stores the id under "companyId"; AdminLogin stores it under
  // both "company" and "companyId". Read both so the toggle appears regardless
  // of which login path was used.
  const companyId    = storedUser?.companyId || storedUser?.company || null;

  const loadData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetchAttendanceReport({ ...filters, page });
      setRecords(res.records || []);
      setPagination({ total: res.total || 0, page: res.page || 1, pages: res.pages || 1 });
    } catch (e) {
      console.error("Attendance load error:", e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadData(1); }, [loadData]);

  const handleFilterChange = useCallback(newFilters => {
    setFilters(f => ({ ...f, ...newFilters }));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try { await exportToExcel(filters); }
    catch (e) { console.error("Export error:", e); alert("Export failed. Please try again."); }
    setExporting(false);
  };

  const summary = SUMMARY_ITEMS.reduce((acc, { key }) => {
    acc[key] = records.filter(r => r.derivedCrmStatus === key).length;
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-gray-50 dark:bg-[#0D0F14] overflow-x-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-[18px] sm:text-[20px] font-bold text-gray-800 dark:text-gray-100">Attendance Management</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Track, filter and manage employee attendance</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Office location restriction */}
          <ClockInLocationSettings />

          {/* Client meeting GPS tracking */}
          <MeetingTrackingSettings />

          {/* Late login threshold — superadmin only */}
          {isSuperAdmin && (
            <AttendanceSettings />
          )}

          {/* Call log sync toggle — superadmin only */}
          {isSuperAdmin && companyId && (
            <CallLogSyncSettings companyId={companyId} />
          )}

          {/* Live locations viewer */}
          <button
            onClick={() => setShowLiveLocations(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#4B5168] dark:text-[#9DA3BB] text-[12px] font-semibold hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all"
            title="View live employee locations"
          >
            <Activity size={15} className="shrink-0" />
            <span>Live Locations</span>
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[12px] font-semibold shadow-sm transition-all"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>

      {/* ── Pending Remote Clock-In Requests ──────────────────────────────────── */}
      <PendingRemoteClockInPanel />

      {/* ── Summary Pills ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
        {SUMMARY_ITEMS.map(({ key, label, color }) => (
          <div key={key} className={`bg-${color}-50 dark:bg-${color}-950/30 border border-${color}-100 dark:border-${color}-900/30 rounded-xl px-4 py-3`}>
            <p className={`text-[22px] font-bold text-${color}-600 dark:text-${color}-400`}>
              {loading ? "—" : summary[key] ?? 0}
            </p>
            <p className={`text-[11px] font-semibold text-${color}-500 mt-0.5`}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <AttendanceFilters filters={filters} onChange={handleFilterChange} />

      {/* ── Record count + refresh ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-gray-400">
          {loading ? "Loading…" : `${pagination.total} record${pagination.total !== 1 ? "s" : ""} found`}
        </p>
        <button
          onClick={() => loadData()}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <AttendanceTable records={records} loading={loading} onRefresh={() => loadData()} />

      {/* ── Live Locations Modal ────────────────────────────────────────────── */}
      <LiveLocationsPanel open={showLiveLocations} onClose={() => setShowLiveLocations(false)} />

    </div>
  );
}
