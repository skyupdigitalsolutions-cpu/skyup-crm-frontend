// src/pages/developer/Companies.jsx — UPDATED (fixed API paths; added create-company + super-admin modals)
import { useEffect, useState } from "react";
import api from "../../data/axiosConfig";

export default function Companies() {
  const [companies,        setCompanies]        = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [showCreate,       setShowCreate]       = useState(false);
  const [showSaModal,      setShowSaModal]      = useState(false);
  const [selectedCompany,  setSelectedCompany]  = useState(null);
  const [form,   setForm]   = useState({ name: "", email: "", phone: "", plan: "basic" });
  const [saForm, setSaForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/developer/companies")
      .then(r => setCompanies(r.data))
      .catch(() => setError("Failed to load companies"))
      .finally(() => setLoading(false));
  }, []);

  const createCompany = async () => {
    if (!form.name || !form.email) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/developer/companies", form);
      setCompanies(prev => [...prev, res.data]);
      setShowCreate(false);
      setForm({ name: "", email: "", phone: "", plan: "basic" });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create company");
    } finally {
      setSubmitting(false);
    }
  };

  const openSaModal = (companyId) => {
    setSelectedCompany(companyId);
    setSaForm({ name: "", email: "", password: "" });
    setError("");
    setShowSaModal(true);
  };

  const createSuperAdmin = async () => {
    if (!saForm.name || !saForm.email || !saForm.password) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/developer/companies/${selectedCompany}/super-admin`, saForm);
      setShowSaModal(false);
      setSelectedCompany(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create super admin");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.put(`/developer/companies/${id}/toggle`);
      setCompanies(prev =>
        prev.map(c => c._id === id ? { ...c, isActive: !c.isActive } : c)
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to toggle company status");
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Companies</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{companies.length} total</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setError(""); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition"
        >
          + Create Company
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Companies Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
        ) : companies.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">No companies yet. Create one to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c._id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.email}</td>
                  <td className="px-4 py-3 capitalize">
                    <span className="px-2 py-0.5 rounded text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-medium">
                      {c.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.isActive
                      ? "bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400"
                      : "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400"}`}>
                      {c.isActive ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleStatus(c._id)}
                        className="text-xs border border-gray-200 dark:border-gray-600 px-2.5 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition"
                      >
                        {c.isActive ? "Suspend" : "Activate"}
                      </button>
                      <button
                        onClick={() => openSaModal(c._id)}
                        className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700 transition"
                      >
                        + Super Admin
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Company Modal */}
      {showCreate && (
        <Modal title="Create Company" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <Field label="Company Name *" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Acme Corp" />
            <Field label="Email *" type="email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} placeholder="admin@acme.com" />
            <Field label="Phone" value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} placeholder="+91 99999 00000" />
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Plan</label>
              <select
                value={form.plan}
                onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                Cancel
              </button>
              <button onClick={createCompany} disabled={submitting || !form.name || !form.email} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
                {submitting ? "Creating…" : "Create Company"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Super Admin Modal */}
      {showSaModal && (
        <Modal title="Create Super Admin" onClose={() => { setShowSaModal(false); setError(""); }}>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">This admin will have full control over their company's CRM. Each company can only have one super admin.</p>
          <div className="space-y-4">
            <Field label="Full Name *" value={saForm.name} onChange={v => setSaForm(p => ({ ...p, name: v }))} placeholder="Jane Doe" />
            <Field label="Email *" type="email" value={saForm.email} onChange={v => setSaForm(p => ({ ...p, email: v }))} placeholder="jane@company.com" />
            <Field label="Password *" type="password" value={saForm.password} onChange={v => setSaForm(p => ({ ...p, password: v }))} placeholder="••••••••" />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowSaModal(false); setError(""); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                Cancel
              </button>
              <button onClick={createSuperAdmin} disabled={submitting || !saForm.name || !saForm.email || !saForm.password} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
                {submitting ? "Creating…" : "Create Super Admin"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Reusable Modal wrapper ─────────────────────────────────────────────────────
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Reusable text field ────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
      />
    </div>
  );
}