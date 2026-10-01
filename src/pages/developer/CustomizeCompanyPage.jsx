// src/pages/developer/CustomizeCompanyPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Developer sidebar → "Customize CRM".
// Pick a company, then edit its full CRM customization (modules, statuses,
// outcomes, lead quality, lists, fields, workflows, alerts, permissions,
// branding). Same editor as Company Details → "Customize CRM" tab.
//
//   /developer/customize          → choose a company
//   /developer/customize/:id      → editor for that company
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../data/axiosConfig";
import CustomizeCRM from "./CustomizeCRM";

export default function CustomizeCompanyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/developer/companies")
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.companies || r.data?.data || []);
        setCompanies(list);
      })
      .catch(() => setError("Failed to load companies"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return companies;
    return companies.filter((c) =>
      String(c.name || c.companyName || "").toLowerCase().includes(s) ||
      String(c.email || c.ownerEmail || "").toLowerCase().includes(s));
  }, [companies, q]);

  const current = companies.find((c) => String(c._id) === String(id));

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Customize CRM</h1>
          <p className="text-[13px] text-[#8B92A9]">
            Per-company settings: modules, statuses, outcomes, lead fields, workflows, alerts, permissions and branding.
          </p>
        </div>
        <div className="w-full sm:w-[360px]">
          <label className="block text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">Company</label>
          <select
            value={id || ""}
            disabled={loading}
            onChange={(e) => navigate(e.target.value ? `/developer/customize/${e.target.value}` : "/developer/customize")}
            className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">{loading ? "Loading companies…" : "— Select a company —"}</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>{c.name || c.companyName || c._id}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-[13px] text-red-500 mb-4">{error}</p>}

      {id ? (
        <div>
          {current && (
            <p className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB] mb-4">
              Editing <strong className="text-[#0F1117] dark:text-white">{current.name || current.companyName}</strong>
              {" · "}changes apply to this company only and reach its users instantly.
            </p>
          )}
          <CustomizeCRM key={id} companyId={id} embedded />
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-4 sm:p-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search companies…"
            className="w-full sm:w-[320px] mb-4 px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB]"
          />
          {loading ? (
            <p className="text-[13px] text-[#8B92A9]">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-[#8B92A9]">No companies found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((c) => (
                <button
                  key={c._id}
                  onClick={() => navigate(`/developer/customize/${c._id}`)}
                  className="text-left p-4 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#2563EB] hover:bg-[#F5F8FF] dark:hover:bg-[#1A2540] transition"
                >
                  <p className="text-[14px] font-semibold text-[#0F1117] dark:text-white truncate">{c.name || c.companyName || c._id}</p>
                  <p className="text-[12px] text-[#8B92A9] truncate">{c.email || c.ownerEmail || c.plan || ""}</p>
                  <p className="text-[12px] font-semibold text-[#2563EB] mt-2">Customize →</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
