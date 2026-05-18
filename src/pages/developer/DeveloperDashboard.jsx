// src/pages/developer/DeveloperDashboard.jsx
import { useEffect, useState, useRef } from "react";
import {
  Building2, ShieldCheck, Users, UserCheck,
  RefreshCw, AlertTriangle, TrendingUp, Activity,
  BarChart2, CheckCircle, XCircle, Zap,
} from "lucide-react";
import api from "../../data/axiosConfig";

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-6 sm:py-8 animate-pulse">
      <div className="h-7 w-52 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-2" />
      <div className="h-4 w-72 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-64" />
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-64" />
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KPI_STYLES = {
  blue:   { icon: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",       ring: "hover:ring-blue-200 dark:hover:ring-blue-800" },
  green:  { icon: "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",   ring: "hover:ring-green-200 dark:hover:ring-green-800" },
  purple: { icon: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400", ring: "hover:ring-purple-200 dark:hover:ring-purple-800" },
  amber:  { icon: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",   ring: "hover:ring-amber-200 dark:hover:ring-amber-800" },
};

function KpiCard({ label, value, sub, up, IconComponent, variant = "blue" }) {
  const s = KPI_STYLES[variant] || KPI_STYLES.blue;
  return (
    <div
      className={`bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38]
        rounded-2xl p-4 sm:p-5 hover:shadow-md transition-all duration-200`}
    >
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <span className="text-[10px] sm:text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider leading-tight pr-2">
          {label}
        </span>
        <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 ${s.icon}`}>
          {IconComponent && <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </span>
      </div>
      <div className="text-[24px] sm:text-[30px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none mb-1.5 tabular-nums">
        {value ?? "—"}
      </div>
      {sub && (
        <div className={`text-[11px] sm:text-[12px] font-medium flex items-center gap-1 ${up ? "text-green-600 dark:text-green-400" : "text-[#6B7280] dark:text-[#565C75]"}`}>
          {up && <TrendingUp className="w-3 h-3 shrink-0" />}
          <span className="truncate">{sub}</span>
        </div>
      )}
    </div>
  );
}

// ── Company Row in table ──────────────────────────────────────────────────────
function CompanyRow({ c }) {
  const planColors = {
    basic:      "bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400",
    pro:        "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
    enterprise: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400",
  };
  return (
    <tr className="border-t border-[#F0F2FA] dark:border-[#1E2130] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
              {(c.name || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{c.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-[12px] text-[#6B7280] dark:text-[#565C75]">{c.email}</td>
      <td className="px-4 py-3">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${planColors[c.plan] || planColors.basic}`}>
          {c.plan || "basic"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full
          ${c.isActive
            ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
            : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? "bg-green-500" : "bg-red-500"}`} />
          {c.isActive ? "Active" : "Suspended"}
        </span>
      </td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DeveloperDashboard() {
  const [stats,      setStats]      = useState(null);
  const [companies,  setCompanies]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState("");

  const loadData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError("");

    Promise.all([
      api.get("/developer/dashboard"),
      api.get("/developer/companies"),
    ])
      .then(([dashRes, companiesRes]) => {
        setStats(dashRes.data);
        setCompanies(companiesRes.data || []);
      })
      .catch(() => setError("Failed to load platform stats. Please retry."))
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <Skeleton />;

  const activePct = stats?.totalCompanies > 0
    ? Math.round((stats.activeCompanies / stats.totalCompanies) * 100)
    : 0;

  const recentCompanies = [...companies].slice(-5).reverse();

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-4 sm:px-6 py-6 sm:py-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-[20px] sm:text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Platform Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400">
              Developer
            </span>
          </div>
          <p className="text-[12px] sm:text-[13px] text-[#6B7280] dark:text-[#565C75] truncate">
            Aggregated platform-level metrics · No CRM data exposed
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className={`p-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27]
            text-[#6B7280] hover:text-[#2563EB] dark:hover:text-[#4F8EF7]
            hover:border-blue-300 dark:hover:border-blue-700
            transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
            ${refreshing ? "opacity-60 cursor-not-allowed" : ""}`}
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-[13px] font-semibold text-red-700 dark:text-red-400 truncate">{error}</p>
          </div>
          <button
            onClick={() => loadData()}
            className="text-[12px] font-bold text-red-600 dark:text-red-400 underline underline-offset-2 shrink-0 hover:text-red-800 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-6">
        <KpiCard
          label="Total Companies"
          value={stats?.totalCompanies?.toLocaleString()}
          sub={`${activePct}% active`}
          up={activePct > 50}
          IconComponent={Building2}
          variant="blue"
        />
        <KpiCard
          label="Active Companies"
          value={stats?.activeCompanies?.toLocaleString()}
          sub="Currently operational"
          up={stats?.activeCompanies > 0}
          IconComponent={CheckCircle}
          variant="green"
        />
        <KpiCard
          label="Total Admins"
          value={stats?.totalAdmins?.toLocaleString()}
          sub="Super admins across all"
          IconComponent={ShieldCheck}
          variant="purple"
        />
        <KpiCard
          label="Total Employees"
          value={stats?.totalUsers?.toLocaleString()}
          sub="Users across all orgs"
          IconComponent={Users}
          variant="amber"
        />
      </div>

      {/* ── Middle Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">

        {/* Health Overview */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-4 sm:p-5">
          <h2 className="text-[13px] sm:text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4 sm:mb-5">Platform Health</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Active rate */}
            <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#565C75]">Active Rate</span>
              <div className="flex items-end gap-2">
                <span className="text-[28px] font-bold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums leading-none">{activePct}%</span>
              </div>
              <div className="h-2 bg-[#E5E7EB] dark:bg-[#262A38] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-700"
                  style={{ width: `${activePct}%` }}
                />
              </div>
              <span className="text-[11px] text-[#6B7280] dark:text-[#565C75]">
                {stats?.activeCompanies} of {stats?.totalCompanies} active
              </span>
            </div>

            {/* Admins per company */}
            <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#565C75]">Admins / Company</span>
              <div className="flex items-end gap-2">
                <span className="text-[28px] font-bold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums leading-none">
                  {stats?.totalCompanies > 0 ? (stats.totalAdmins / stats.totalCompanies).toFixed(1) : "—"}
                </span>
              </div>
              <div className="h-2 bg-[#E5E7EB] dark:bg-[#262A38] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-700"
                  style={{ width: `${Math.min(((stats?.totalAdmins / Math.max(stats?.totalCompanies, 1)) / 3) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[11px] text-[#6B7280] dark:text-[#565C75]">
                {stats?.totalAdmins} total admins
              </span>
            </div>

            {/* Users per company */}
            <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#565C75]">Users / Company</span>
              <div className="flex items-end gap-2">
                <span className="text-[28px] font-bold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums leading-none">
                  {stats?.totalCompanies > 0 ? (stats.totalUsers / stats.totalCompanies).toFixed(1) : "—"}
                </span>
              </div>
              <div className="h-2 bg-[#E5E7EB] dark:bg-[#262A38] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-700"
                  style={{ width: `${Math.min(((stats?.totalUsers / Math.max(stats?.totalCompanies, 1)) / 20) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[11px] text-[#6B7280] dark:text-[#565C75]">
                {stats?.totalUsers} total users
              </span>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-4 sm:p-5">
          <h2 className="text-[13px] sm:text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">Platform Summary</h2>
          <div className="space-y-3">
            {[
              { label: "Total Companies",  value: stats?.totalCompanies,  color: "#2563EB", Icon: Building2 },
              { label: "Active",           value: stats?.activeCompanies, color: "#16A34A", Icon: CheckCircle },
              { label: "Suspended",        value: (stats?.totalCompanies || 0) - (stats?.activeCompanies || 0), color: "#DC2626", Icon: XCircle },
              { label: "Admins",           value: stats?.totalAdmins,     color: "#7C3AED", Icon: ShieldCheck },
              { label: "Employees",        value: stats?.totalUsers,      color: "#D97706", Icon: UserCheck },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}15` }}>
                  <item.Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                </div>
                <span className="text-[12px] text-[#4B5563] dark:text-[#9DA3BB] flex-1">{item.label}</span>
                <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums">{item.value ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Companies Table ── */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#F0F2FA] dark:border-[#1E2130]">
          <h2 className="text-[13px] sm:text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Recently Added Companies</h2>
          <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] bg-[#F3F4F6] dark:bg-[#13161E] px-2.5 py-1 rounded-full">
            Last {recentCompanies.length}
          </span>
        </div>
        {recentCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Building2 className="w-8 h-8 text-[#D1D5DB] dark:text-[#374151]" />
            <p className="text-[13px] text-[#6B7280] dark:text-[#565C75]">No companies yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F9FC] dark:bg-[#13161E]">
                <tr>
                  {["Company", "Email", "Plan", "Status"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#9CA3AF] dark:text-[#565C75] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentCompanies.map(c => <CompanyRow key={c._id} c={c} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
