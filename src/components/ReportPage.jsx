import { useState, useMemo, useEffect } from "react";
import { fetchAll, getRole, getStoredUser } from "../data/dataService";
import api from "../data/axiosConfig";
  import { useDateFilter } from "../components/DataFilter";

  // ── Constants ─────────────────────────────────────────────────────────────────
  const SOURCE_COLORS = {
    "Google Ads":   "#2563EB",
    "Campaign":     "#7C3AED",
    "Facebook Ads": "#0891B2",
    "Web Form":     "#059669",
    "Referral":     "#D97706",
  };

  const STATUS_STYLE = {
    "Converted":      { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#065F46] dark:text-[#34D399]" },
    "In Progress":    { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#92400E] dark:text-[#FCD34D]" },
    "Not Interested": { bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]", text: "text-[#991B1B] dark:text-[#F87171]" },
    "New":            { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#1D4ED8] dark:text-[#4F8EF7]" },
  };

  const ALL_SOURCES  = ["Google Ads", "Campaign", "Facebook Ads", "Web Form", "Referral"];
  const ALL_STATUSES = ["Converted", "In Progress", "Not Interested", "New"];

  let nextId = 100;

  // ── Helper: format today as "DD Mon YYYY" ─────────────────────────────────────
  function todayAsCustomDate() {
    return new Date().toLocaleDateString("en-GB", {
      day:   "2-digit",
      month: "short",
      year:  "numeric",
    }); // → "25 Mar 2026"
  }

  // ── Stat card ─────────────────────────────────────────────────────────────────
  function StatCard({ label, value, sub, accent }) {
    return (
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5 flex flex-col gap-1">
        <span className="text-[12px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{label}</span>
        <span className="text-[28px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{value}</span>
        {sub && <span className={`text-[12px] font-medium ${accent}`}>{sub}</span>}
      </div>
    );
  }

  // ── Mini bar ──────────────────────────────────────────────────────────────────
  function MiniBar({ value, max, color }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75] w-8 text-right">{value}</span>
      </div>
    );
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  function Skeleton() {
    return (
      <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-6 py-8 animate-pulse">
        <div className="h-8 w-48 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-3" />
        <div className="h-4 w-64 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-8" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5 h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-64" />
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-64" />
        </div>
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-96" />
      </div>
    );
  }

  // ── Add Lead Modal ────────────────────────────────────────────────────────────
 // ── Add Lead Modal ────────────────────────────────────────────────────────────
function AddLeadModal({ agents, onClose, onAdd }) {
  const today = todayAsCustomDate();

  const [form, setForm] = useState({
    name: "", phone: "", source: "Google Ads", campaign: "",
    agent: agents[0]?.name || "", status: "New", date: today, remark: "",
  });

  const [errors, setErrors] = useState({});
  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    // Clear error on change
    setErrors(e => ({ ...e, [k]: "" }));
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};

    if (!form.name.trim() || form.name.trim().length < 2)
      newErrors.name = "Name must be at least 2 characters.";

    if (!form.phone.trim())
      newErrors.phone = "Phone is required.";
    else if (!/^\d{10}$/.test(form.phone.trim()))
      newErrors.phone = "Phone must be exactly 10 digits.";

    if (!form.date.trim())
      newErrors.date = "Date is required.";
    else if (!/^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(form.date.trim()))
      newErrors.date = 'Use format: 25 Mar 2026';

    return newErrors;
  };

  const handleSubmit = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Resolve agent name → _id
    const agentObj = agents.find(a => a.name === form.agent) ?? null;

    // Build the payload the backend expects
    const payload = {
      name:     form.name.trim(),
      mobile:   Number(form.phone.trim()),
      source:   form.source,
      campaign: form.campaign.trim() || null,
      status:   form.status,
      date:     new Date(form.date),
      remark:   form.remark.trim() || "Manually added",
      ...(agentObj?.id ? { user: agentObj.id } : {}),
      // SuperAdmin has no company — pass it from the selected agent's company
      ...(getRole() === "superadmin" && agentObj?.company
        ? { companyId: agentObj.company }
        : {}),
    };

    // Pick the right endpoint based on role
    const role = getRole();
    const endpoint =
      role === "superadmin" ? "/lead/superadmin/create" :
      role === "admin"      ? "/lead/admin/create" :
                              "/lead";

    try {
      const res = await api.post(endpoint, payload);
      // Format the saved lead the same way fetchAll does
      const saved = res.data;
      onAdd({
        id:       saved._id,
        name:     saved.name,
        mobile:   saved.mobile,
        source:   saved.source   || "Web Form",
        campaign: saved.campaign || "—",
        status:   saved.status,
        date:     new Date(saved.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        remark:   saved.remark,
        agent:    form.agent,
        company:  saved.company,
      });
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to save lead. Please try again.";
      setErrors({ submit: msg });
    }
  };

  // ── Field configs ───────────────────────────────────────────────────────────
  const textFields = [
    { label: "Lead Name *", key: "name",     placeholder: "Full name" },
    { label: "Phone *",     key: "phone",    placeholder: "10-digit number" },
    { label: "Campaign",    key: "campaign", placeholder: "Campaign name" },
    { label: "Remark",      key: "remark",   placeholder: "Notes" },
  ];

  const selectFields = [
    { label: "Source", key: "source", options: ALL_SOURCES },
    { label: "Agent",  key: "agent",  options: agents.map(a => a.name) },
    { label: "Status", key: "status", options: ALL_STATUSES },
  ];

  const inputCls = (key) =>
    `px-3 py-2 rounded-xl border text-[13px] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none transition
    ${errors[key]
      ? "border-red-400 dark:border-red-500 focus:border-red-500"
      : "border-[#E4E7EF] dark:border-[#262A38] focus:border-[#2563EB]"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Add New Lead</h2>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Text fields */}
          {textFields.map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">
                {f.label}
              </label>
              <input
                type="text"
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => set(f.key, e.target.value)}
                className={inputCls(f.key)}
              />
              {errors[f.key] && (
                <span className="text-[11px] text-red-500 flex items-center gap-1 mt-0.5">
                  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  {errors[f.key]}
                </span>
              )}
            </div>
          ))}

          {/* Select fields */}
          {selectFields.map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">
                {f.label}
              </label>
              <select
                value={form[f.key]}
                onChange={e => set(f.key, e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none">
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}

          {/* Date field */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">
              Date *
            </label>
            <input
              type="text"
              value={form.date}
              onChange={e => set("date", e.target.value)}
              placeholder="25 Mar 2026"
              className={inputCls("date")}
            />
            {errors.date && (
              <span className="text-[11px] text-red-500 flex items-center gap-1 mt-0.5">
                <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                {errors.date}
              </span>
            )}
          </div>
        </div>

        {/* Submit error */}
        {errors.submit && (
          <p className="text-[12px] text-red-500 mt-3 text-center">{errors.submit}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
            Cancel
          </button>
          <button onClick={handleSubmit}
            className="flex-1 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
            Add Lead
          </button>
        </div>
      </div>
    </div>
  );
}

  // ── Edit Lead Modal ───────────────────────────────────────────────────────────
  function EditLeadModal({ lead, agents, onClose, onSave }) {
    const [form, setForm] = useState({ ...lead });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Edit Lead</h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Lead Name", key: "name" },
              { label: "Phone",     key: "phone" },
              { label: "Campaign",  key: "campaign" },
              { label: "Remark",    key: "remark" },
              { label: "Date",      key: "date" },
            ].map(f => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
                <input type="text" value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]" />
              </div>
            ))}
            {[
              { label: "Source", key: "source", options: ALL_SOURCES },
              { label: "Agent",  key: "agent",  options: agents.map(a => a.name) },
              { label: "Status", key: "status", options: ALL_STATUSES },
            ].map(f => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
                <select value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none">
                  {f.options.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
            <button onClick={() => { onSave(form); onClose(); }} className="flex-1 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">Save Changes</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main component ────────────────────────────────────────────────────────────
  export default function ReportPage() {
    const [leads, setLeads]     = useState([]);
    const [agents, setAgents]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
      fetchAll()
        .then(({ agents, leads }) => {
          setAgents(agents);
          setLeads(leads);
          nextId = leads.reduce((m, l) => Math.max(m, l.id), 0) + 1;
        })
        .catch(err => setFetchError(err.message))
        .finally(() => setLoading(false));
    }, []);

    const [search, setSearch]         = useState("");
    const [statusFilter, setStatus]   = useState("All");
    const [agentFilter, setAgent]     = useState("All");
    const [sortBy, setSortBy]         = useState("date");
    const [page, setPage]             = useState(1);
    const [showAddModal, setAddModal] = useState(false);
    const [editLead, setEditLead]     = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [timeFilter, setTimeFilter] = useState("All");
    const PER_PAGE = 8;

    const isWithinRange = useDateFilter(timeFilter);
    const statuses   = ["All", ...ALL_STATUSES];
    const agentNames = ["All", ...agents.map(a => a.name)];

    const agentStats = useMemo(() => agents.map(agent => {
      const agentLeads = leads.filter(l => l.agent === agent.name);
      return { ...agent, leads: agentLeads.length, converted: agentLeads.filter(l => l.status === "Converted").length };
    }), [leads, agents]);

    const sourceStats = useMemo(() => ALL_SOURCES.map(src => ({
      label: src, count: leads.filter(l => l.source === src).length, color: SOURCE_COLORS[src],
    })).filter(s => s.count > 0), [leads]);

    const converted = leads.filter(l => l.status === "Converted").length;
    const convRate  = leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0;
    const maxLeads  = Math.max(...agentStats.map(a => a.leads), 1);

    const filtered = useMemo(() => leads
      .filter(l => {
        if (!isWithinRange(l.date)) return false;
        const q = search.toLowerCase();
        return (
          (!q || l.name.toLowerCase().includes(q) || l.phone.includes(q) || l.campaign.toLowerCase().includes(q)) &&
          (statusFilter === "All" || l.status === statusFilter) &&
          (agentFilter  === "All" || l.agent  === agentFilter)
        );
      })
      .sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name) : b.id - a.id),
    [leads, search, statusFilter, agentFilter, sortBy, isWithinRange]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const addLead    = lead    => { setLeads(ls => [lead, ...ls]); setPage(1); };
    const saveLead   = updated => setLeads(ls => ls.map(l => l.id === updated.id ? updated : l));
    const deleteLead = id      => { setLeads(ls => ls.filter(l => l.id !== id)); setDeleteConfirm(null); };

    // ✅ FIXED: display date — handle both "DD Mon YYYY" and ISO fallback gracefully
    const displayDate = (dateStr) => {
      if (!dateStr) return "—";
      // Already in "DD Mon YYYY" format
      if (/^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(dateStr)) return dateStr;
      // Fallback: parse ISO or other formats
      const d = new Date(dateStr);
      return isNaN(d) ? dateStr : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };

    const exportCSV = () => {
      const headers = ["#", "Name", "Phone", "Source", "Campaign", "Agent", "Status", "Date", "Remark"];
      const rows = filtered.map((l, i) =>
        [i + 1, l.name, l.phone, l.source, l.campaign, l.agent, l.status, l.date, l.remark]
          .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
      );
      const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "leads_export.csv" });
      a.click();
    };

    const filterBtn = (current, setter, arr) =>
      arr.map(v => (
        <button key={v} onClick={() => { setter(v); setPage(1); }}
          className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition whitespace-nowrap
            ${v === current
              ? "bg-[#2563EB] text-white"
              : "bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB]"
            }`}>{v}</button>
      ));

    if (loading) return <Skeleton />;

    if (fetchError) return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FC] dark:bg-[#0D0F14]">
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-8 max-w-sm text-center">
          <div className="text-red-500 text-[14px] font-semibold mb-2">Failed to load data</div>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mb-4">{fetchError}</p>
          <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75]">
            Make sure <code className="bg-[#F1F4FF] dark:bg-[#262A38] px-1 rounded">mockData.json</code> is in the same directory and your dev server is running.
          </p>
        </div>
      </div>
    );

    return (
      <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-6 py-8">

        {showAddModal && <AddLeadModal agents={agents} onClose={() => setAddModal(false)} onAdd={addLead} />}
        {editLead     && <EditLeadModal lead={editLead} agents={agents} onClose={() => setEditLead(null)} onSave={saveLead} />}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2">Delete Lead?</h2>
              <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mb-5">
                This will permanently remove <strong className="text-[#0F1117] dark:text-[#F0F2FA]">{deleteConfirm.name}</strong> from the list.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
                <button onClick={() => deleteLead(deleteConfirm.id)} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 transition">Delete</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Report Page</h1>
            <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{leads.length} total leads · {agents.length} agents</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#059669] text-white text-[13px] font-semibold hover:bg-emerald-700 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add Lead
            </button>
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Leads"    value={leads.length} sub={`${leads.length} in pipeline`} accent="text-[#059669] dark:text-[#34D399]" />
          <StatCard label="Converted"      value={converted} sub={`${convRate}% conversion rate`} accent="text-[#059669] dark:text-[#34D399]" />
          <StatCard label="In Progress"    value={leads.filter(l => l.status === "In Progress").length} sub="Active pipeline" accent="text-[#D97706] dark:text-[#FCD34D]" />
          <StatCard label="Not Interested" value={leads.filter(l => l.status === "Not Interested").length} sub="Review needed" accent="text-[#DC2626] dark:text-[#F87171]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">Agent performance</h2>
            <div className="space-y-4">
              {agentStats.sort((a, b) => b.leads - a.leads).map(a => (
                <div key={a.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: a.color }}>{a.avatar}</div>
                      <span className="text-[13px] font-medium text-[#0F1117] dark:text-[#F0F2FA]">{a.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-[#8B92A9] dark:text-[#565C75]">
                      <span className="text-[#059669] dark:text-[#34D399] font-semibold">{a.converted} conv</span>
                      <span>{a.leads} leads</span>
                    </div>
                  </div>
                  <MiniBar value={a.leads} max={maxLeads} color={a.color} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">Leads by source</h2>
            <div className="space-y-3">
              {sourceStats.map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB] flex-1">{s.label}</span>
                  <div className="flex-1 h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round(s.count / leads.length * 100)}%`, background: s.color }} />
                  </div>
                  <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] w-5 text-right">{s.count}</span>
                  <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] w-8 text-right">{Math.round(s.count / leads.length * 100)}%</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-5 border-t border-[#E4E7EF] dark:border-[#262A38]">
              <h3 className="text-[12px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-3">Pipeline status</h3>
              <div className="grid grid-cols-2 gap-2">
                {ALL_STATUSES.map(s => {
                  const count = leads.filter(l => l.status === s).length;
                  const st = STATUS_STYLE[s];
                  return (
                    <div key={s} className={`rounded-xl px-3 py-2.5 ${st.bg}`}>
                      <div className={`text-[18px] font-bold ${st.text}`}>{count}</div>
                      <div className={`text-[10px] font-medium ${st.text} opacity-80`}>{s}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                All leads
                <span className="ml-2 text-[12px] font-medium text-[#8B92A9] dark:text-[#565C75]">
                  {filtered.length} results
                </span>
              </h2>

              <div className="flex items-center gap-2">
                <select
                  value={timeFilter}
                  onChange={e => { setTimeFilter(e.target.value); setPage(1); }}
                  className="px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none"
                >
                  <option value="All">Time: All</option>
                  <option value="Daily">Time: Daily</option>
                  <option value="Weekly">Time: Weekly</option>
                  <option value="Monthly">Time: Monthly</option>
                  <option value="Quarterly">Time: Quarterly</option>
                </select>

                <select
                  value={sortBy}
                  onChange={e => { setSortBy(e.target.value); setPage(1); }}
                  className="px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none"
                >
                  <option value="date">Sort: Latest</option>
                  <option value="name">Sort: Name A–Z</option>
                </select>

                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] w-44"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {filterBtn(statusFilter, setStatus, statuses)}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] self-center mr-1">Agent:</span>
              {filterBtn(agentFilter, setAgent, agentNames)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                  {["#", "Lead Name", "Phone", "Source", "Campaign", "Agent", "Status", "Date", "Remark", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-[13px] text-[#8B92A9] dark:text-[#565C75]">No leads match your filters.</td></tr>
                ) : paged.map((lead, i) => {
                  const st = STATUS_STYLE[lead.status];
                  return (
                    <tr key={lead.id} className={`border-b border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A] transition ${i % 2 === 0 ? "" : "bg-[#FAFBFF] dark:bg-[#1E2130]"}`}>
                      <td className="px-4 py-3 text-[#8B92A9] dark:text-[#565C75]">{(page - 1) * PER_PAGE + i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
                            {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">{lead.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{lead.phone}</td>
                      <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{lead.source}</td>
                      <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB]">{lead.campaign}</td>
                      <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{lead.agent}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${st.bg} ${st.text}`}>{lead.status}</span>
                      </td>
                      {/* ✅ FIXED: use displayDate helper instead of new Date().toLocaleDateString */}
                      <td className="px-4 py-3 text-[#8B92A9] dark:text-[#565C75] whitespace-nowrap">{displayDate(lead.date)}</td>
                      <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] max-w-[160px] truncate">{lead.remark}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setEditLead(lead)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#2563EB] hover:text-[#2563EB] text-[#8B92A9] transition" title="Edit">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button onClick={() => setDeleteConfirm(lead)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-red-400 hover:text-red-500 text-[#8B92A9] transition" title="Delete">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
              <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75]">
                Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="h-8 w-8 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-30 disabled:cursor-not-allowed transition">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setPage(n)}
                    className={`h-8 w-8 rounded-lg text-[12px] font-semibold transition ${n === page ? "bg-[#2563EB] text-white border border-[#2563EB]" : "border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB]"}`}>{n}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="h-8 w-8 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-30 disabled:cursor-not-allowed transition">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }