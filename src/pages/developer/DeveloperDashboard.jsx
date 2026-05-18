import { useEffect, useState } from "react";
import api from "../../data/axiosConfig";

export default function DeveloperDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/developer/dashboard")
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Platform Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Companies"  value={stats?.totalCompanies} />
        <StatCard label="Active Companies" value={stats?.activeCompanies} />
        <StatCard label="Total Admins"     value={stats?.totalAdmins} />
        <StatCard label="Total Users"      value={stats?.totalUsers} />
      </div>
      {/* No leads, chats, messages, or employee data here */}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-3xl font-bold mt-1">{value ?? "—"}</p>
    </div>
  );
}
