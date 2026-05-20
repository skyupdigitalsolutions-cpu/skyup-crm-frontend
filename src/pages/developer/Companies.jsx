// src/pages/developer/Companies.jsx
import { useEffect, useState, useRef } from "react";
import {
  Building2, Plus, UploadCloud, X, ChevronRight,
  CheckCircle2, XCircle, ShieldCheck, Image, Loader2,
} from "lucide-react";
import api from "../../data/axiosConfig";

// ── Plan badge styles ─────────────────────────────────────────────────────────
const PLAN = {
  basic:      { label: "Basic",      cls: "bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  pro:        { label: "Pro",        cls: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" },
  enterprise: { label: "Enterprise", cls: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400" },
};

export default function Companies() {
  const [companies,  setCompanies]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const emptyForm = {
    companyName: "", email: "", phone: "", plan: "basic",
    saName: "", saPassword: "",
    logoFile: null, logoPreview: null,
  };
  const [form, setForm] = useState(emptyForm);
  const fileRef = useRef();

  useEffect(() => {
    api.get("/developer/companies")
      .then(r => setCompanies(r.data))
      .catch(() => setError("Failed to load companies"))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => { setForm(emptyForm); setError(""); setShowCreate(true); };
  const closeCreate = () => { setShowCreate(false); setError(""); };

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setForm(p => ({ ...p, logoFile: file, logoPreview: preview }));
  };

  const removeLogo = () => {
    setForm(p => ({ ...p, logoFile: null, logoPreview: null }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const f = (key) => (v) => setForm(p => ({ ...p, [key]: v }));

  const handleCreate = async () => {
    const { companyName, email, saName, saPassword } = form;
    if (!companyName || !email || !saName || !saPassword) {
      setError("Please fill all required fields.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      // Build multipart if logo present, else JSON
      let companyRes;
      if (form.logoFile) {
        const fd = new FormData();
        fd.append("name",  companyName);
        fd.append("email", email);
        fd.append("phone", form.phone);
        fd.append("plan",  form.plan);
        fd.append("logo",  form.logoFile);
        companyRes = await api.post("/developer/companies", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        companyRes = await api.post("/developer/companies", {
          name: companyName, email, phone: form.phone, plan: form.plan,
        });
      }

      const company = companyRes.data;

      await api.post(`/developer/companies/${company._id}/super-admin`, {
        name: saName, email, password: saPassword,
      });

      setCompanies(prev => [...prev, { ...company, name: companyName }]);
      closeCreate();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create company.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.put(`/developer/companies/${id}/toggle`);
      setCompanies(prev => prev.map(c => c._id === id ? { ...c, isActive: !c.isActive } : c));
    } catch {
      setError("Failed to toggle company status.");
    }
  };

  const avatarLetter = (name = "") => (name.trim().charAt(0) || "?").toUpperCase();

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-6 sm:py-8 font-poppins">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F1117] dark:text-[#F0F2FA] tracking-tight">
            Companies
          </h1>
          <p className="text-sm text-[#6B7280] dark:text-[#565C75] mt-0.5">
            {companies.length} {companies.length === 1 ? "company" : "companies"} registered
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold transition-all duration-150 shadow-sm shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Create Company</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* ── Global error ── */}
      {error && !showCreate && (
        <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Table Card ── */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl overflow-hidden shadow-sm">

        {loading ? (
          <div className="flex flex-col items-center justify-center h-52 gap-3 text-[#9DA3BB]">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Loading companies…</span>
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 gap-3 text-[#9DA3BB]">
            <div className="w-12 h-12 rounded-2xl bg-[#F0F2FA] dark:bg-[#13161E] flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[#C4C9DA]" />
            </div>
            <p className="text-sm text-center">No companies yet.<br/>Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E5E7EB] dark:border-[#262A38]">
                  {["Company", "Email", "Plan", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((c, i) => (
                  <tr
                    key={c._id}
                    className={`border-b border-[#F0F2FA] dark:border-[#1E2130] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition-colors ${i === companies.length - 1 ? "border-b-0" : ""}`}
                  >
                    {/* Company */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {c.logo ? (
                          <img src={c.logo} alt={c.name} className="w-9 h-9 rounded-xl object-cover border border-[#E5E7EB] dark:border-[#262A38]" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                            <span className="text-[13px] font-bold text-blue-600 dark:text-blue-400">
                              {avatarLetter(c.name)}
                            </span>
                          </div>
                        )}
                        <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate max-w-[160px]">{c.name}</span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3.5 text-[#6B7280] dark:text-[#9DA3BB] truncate max-w-[180px]">{c.email}</td>

                    {/* Plan */}
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize ${(PLAN[c.plan] || PLAN.basic).cls}`}>
                        {(PLAN[c.plan] || PLAN.basic).label}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                        c.isActive
                          ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
                          : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? "bg-green-500" : "bg-red-500"}`} />
                        {c.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => toggleStatus(c._id)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-150 active:scale-95 ${
                          c.isActive
                            ? "border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                            : "border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10"
                        }`}
                      >
                        {c.isActive ? "Suspend" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Company Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeCreate}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#262A38] max-h-[92vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F0F2FA] dark:border-[#1E2130]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <Building2 className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F1117] dark:text-[#F0F2FA]">Create Company</h2>
                  <p className="text-[11px] text-[#9DA3BB]">Fill in the details below</p>
                </div>
              </div>
              <button
                onClick={closeCreate}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9DA3BB] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] hover:bg-[#F0F2FA] dark:hover:bg-[#262A38] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">

              {/* ── Section: Company Info ── */}
              <section>
                <SectionHeading icon={<Building2 className="w-3.5 h-3.5" />} label="Company Info" />

                <div className="mt-4 space-y-4">

                  {/* Logo Upload */}
                  <div>
                    <Label text="Company Logo" />
                    {form.logoPreview ? (
                      <div className="flex items-center gap-4 mt-2">
                        <img
                          src={form.logoPreview}
                          alt="Logo preview"
                          className="w-16 h-16 rounded-xl object-cover border-2 border-[#E5E7EB] dark:border-[#262A38] shadow-sm"
                        />
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => fileRef.current?.click()}
                            className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                          >
                            Change logo
                          </button>
                          <button
                            onClick={removeLogo}
                            className="text-xs text-red-500 font-medium hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="mt-2 w-full flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-[#D1D5DB] dark:border-[#2A2F42] hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all group"
                      >
                        <UploadCloud className="w-6 h-6 text-[#9DA3BB] group-hover:text-blue-500 transition-colors" />
                        <span className="text-xs text-[#9DA3BB] group-hover:text-blue-500 transition-colors font-medium">
                          Click to upload logo
                        </span>
                        <span className="text-[10px] text-[#C4C9DA]">PNG, JPG, SVG up to 2MB</span>
                      </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                  </div>

                  {/* Company Name */}
                  <Field
                    label="Company Name *"
                    value={form.companyName}
                    onChange={f("companyName")}
                    placeholder="Acme Corp"
                  />

                  {/* Email */}
                  <Field
                    label="Email * (used for company & super admin login)"
                    type="email"
                    value={form.email}
                    onChange={f("email")}
                    placeholder="admin@acme.com"
                  />

                  {/* Phone */}
                  <Field
                    label="Phone"
                    value={form.phone}
                    onChange={f("phone")}
                    placeholder="+91 99999 00000"
                  />

                  {/* Plan */}
                  <div>
                    <Label text="Plan" />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {Object.entries(PLAN).map(([key, { label }]) => (
                        <button
                          key={key}
                          onClick={() => setForm(p => ({ ...p, plan: key }))}
                          className={`py-2.5 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                            form.plan === key
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                              : "border-[#E5E7EB] dark:border-[#262A38] text-[#6B7280] dark:text-[#9DA3BB] hover:border-[#9DA3BB] dark:hover:border-[#3A3F52]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Divider ── */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#F0F2FA] dark:bg-[#1E2130]" />
                <span className="text-[10px] font-semibold text-[#C4C9DA] uppercase tracking-widest">Super Admin</span>
                <div className="flex-1 h-px bg-[#F0F2FA] dark:bg-[#1E2130]" />
              </div>

              {/* ── Section: Super Admin ── */}
              <section>
                <SectionHeading icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Super Admin Credentials" />
                <p className="text-[11px] text-[#9DA3BB] mt-1 mb-4">
                  This account will have full control over the company's CRM. The email above will be used to log in.
                </p>

                <div className="space-y-4">
                  <Field
                    label="Full Name *"
                    value={form.saName}
                    onChange={f("saName")}
                    placeholder="Jane Doe"
                  />

                  {/* Email (read-only mirror) */}
                  <div>
                    <Label text="Email (same as above)" />
                    <div className="mt-2 px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#9DA3BB] truncate">
                      {form.email || <span className="italic text-[#C4C9DA]">Enter email above</span>}
                    </div>
                  </div>

                  <Field
                    label="Password *"
                    type="password"
                    value={form.saPassword}
                    onChange={f("saPassword")}
                    placeholder="••••••••"
                  />
                </div>
              </section>

              {/* ── Error ── */}
              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* ── Actions ── */}
              <div className="flex gap-3 pt-1 pb-1">
                <button
                  onClick={closeCreate}
                  className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] text-sm font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !form.companyName || !form.email || !form.saName || !form.saPassword}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all active:scale-95 shadow-sm shadow-blue-500/20"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Create Company</>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ icon, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-blue-500 dark:text-blue-400">{icon}</span>
      <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] tracking-tight">{label}</span>
    </div>
  );
}

// ── Label ────────────────────────────────────────────────────────────────────
function Label({ text }) {
  return (
    <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider">
      {text}
    </label>
  );
}

// ── Input field ──────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <Label text={label} />
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9DA] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
      />
    </div>
  );
}
