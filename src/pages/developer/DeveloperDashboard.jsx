// src/pages/developer/DeveloperDashboard.jsx — UPDATED (fixed API path; no /api prefix since baseURL already includes it)
import { useEffect, useState } from "react";
import api from "../../data/axiosConfig";

export default function DeveloperDashboard() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    api.get("/developer/dashboard")
      .then(r => setStats(r.data))
      .catch(() => setError("Failed to load dashboard stats"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <p className="text-sm text-gray-500">Loading platform stats…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-red-600 dark:text-red-400 text-sm">
        {error}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Platform Dashboard</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Aggregated platform-level metrics only. No CRM data.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Companies"  value={stats?.totalCompanies}  color="blue" />
        <StatCard label="Active Companies" value={stats?.activeCompanies} color="green" />
        <StatCard label="Total Admins"     value={stats?.totalAdmins}     color="purple" />
        <StatCard label="Total Employees"  value={stats?.totalUsers}      color="amber" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "blue" }) {
  const colors = {
    blue:   "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
    green:  "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",
    purple: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
    amber:  "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${colors[color]}`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value ?? "—"}</p>
    </div>
  );
}