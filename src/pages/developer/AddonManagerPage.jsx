// src/pages/developer/AddonManagerPage.jsx
// Developer panel: browse all companies and manage their addons using
// the existing AddonManager component.

import { useState, useEffect, useCallback } from "react";
import { Building2, Search, Loader2, ChevronRight, Package } from "lucide-react";
import api from "../../data/axiosConfig";
import AddonManager from "../../components/AddonManager";

const STATUS_STYLE = {
  active:    "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400",
  trial:     "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
  cancelled: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
  expired:   "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

const PLAN_STYLE = {
  basic:      "bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400",
  pro:        "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  enterprise: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

export default function AddonManagerPage() {
  const [companies,  setCompanies]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [selected,   setSelected]   = useState(null); // { _id, name }
  const [addons,     setAddons]     = useState([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [error,      setError]      = useState("");

  // Load company list
  useEffect(() => {
    api.get("/developer/companies")
      .then(r => setCompanies(r.data || []))
      .catch(() => setError("Failed to load companies."))
      .finally(() => setLoading(false));
  }, []);

  // Load addons when a company is selected
  const loadAddons = useCallback(async (company) => {
    setSelected(company);
    setLoadingAddons(true);
    setAddons([]);
    try {
      const res = await api.get(`/addons/${company._id}`);
      setAddons(res.data?.addons || []);
    } catch {
      setAddons([]);
    } finally {
      setLoadingAddons(false);
    }
  }, []);

  const filtered = companies.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-6 sm:py-8 font-poppins">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-5 h-5 text-blue-500" />
          <h1 className="text-[22px] sm:text-[24px] font-bold text-[#0F1117] dark:text-white">Addon Manager</h1>
        </div>
        <p className="text-[13px] text-[#8B92A9]">
          Select a company to grant, renew, or disable addons for their account.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Company list ── */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl overflow-hidden flex flex-col">

          {/* Search */}
          <div className="px-4 py-3 border-b border-[#F0F2FA] dark:border-[#1E2130]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9DA3BB]" />
              <input
                type="text"
                placeholder="Search companies…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9DA] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[70vh]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#9DA3BB]">
                <Building2 className="w-6 h-6 text-[#D1D5DB] dark:text-[#374151]" />
                <p className="text-[13px]">{search ? "No matches found." : "No companies yet."}</p>
              </div>
            ) : filtered.map(c => (
              <button
                key={c._id}
                onClick={() => loadAddons(c)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#F8F9FC] dark:border-[#13161E] text-left hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition ${
                  selected?._id === c._id ? "bg-blue-50 dark:bg-blue-500/10" : ""
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                  <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400">
                    {(c.name || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{c.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${PLAN_STYLE[c.plan] || PLAN_STYLE.basic}`}>
                      {c.plan || "basic"}
                    </span>
                    {c.subscriptionStatus && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${STATUS_STYLE[c.subscriptionStatus] || ""}`}>
                        {c.subscriptionStatus}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${selected?._id === c._id ? "text-blue-500" : "text-[#D1D5DB] dark:text-[#374151]"}`} />
              </button>
            ))}
          </div>

          {/* Footer count */}
          {!loading && (
            <div className="px-4 py-2.5 border-t border-[#F0F2FA] dark:border-[#1E2130]">
              <p className="text-[11px] text-[#9DA3BB]">{filtered.length} of {companies.length} companies</p>
            </div>
          )}
        </div>

        {/* ── Addon panel ── */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl flex flex-col items-center justify-center py-20 gap-3 text-[#9DA3BB]">
              <div className="w-14 h-14 rounded-2xl bg-[#F0F2FA] dark:bg-[#13161E] flex items-center justify-center">
                <Package className="w-7 h-7 text-[#C4C9DA] dark:text-[#374151]" />
              </div>
              <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">Select a company</p>
              <p className="text-[12px] text-center max-w-[200px]">
                Choose a company from the list to view and manage their addons.
              </p>
            </div>
          ) : loadingAddons ? (
            <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div>
              {/* Company context bar */}
              <div className="flex items-center gap-3 mb-4 px-1">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    {selected.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{selected.name}</p>
                  <p className="text-[11px] text-[#8B92A9]">Managing addons</p>
                </div>
              </div>

              <AddonManager
                companyId={selected._id}
                addons={addons}
                onRefresh={() => loadAddons(selected)}
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-[12px] text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
