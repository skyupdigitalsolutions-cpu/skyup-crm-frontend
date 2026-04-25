import { useState, useEffect, useCallback } from "react";
import AttendanceFilters from "../components/AttendanceFilters";
import AttendanceTable   from "../components/AttendanceTable";
import { fetchAttendanceReport, fetchAttendanceExport } from "../services/attendanceService";

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

      {/* ── Summary Pills ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
        {SUMMARY_ITEMS.map(({ key, label, color }) => (
          <div key={key}
            className={`bg-${color}-50 dark:bg-${color}-950/30 border border-${color}-100 dark:border-${color}-900/30 rounded-xl px-4 py-3 cursor-pointer transition hover:shadow-sm`}
            onClick={() => handleFilterChange({ ...filters, crmStatus: filters.crmStatus === key ? "" : key })}
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