// src/pages/developer/Companies.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, UploadCloud, X, ChevronRight,
  CheckCircle2, XCircle, ShieldCheck, Image, Loader2, Pencil, Layout, Settings,
  Receipt, CreditCard, Calendar, BadgeCheck, Clock, AlertCircle, Eye, EyeOff, Download, Trash2,
  Users, UserPlus, Wand2, ChevronDown, Check, Copy, RefreshCw,
} from "lucide-react";
import api from "../../data/axiosConfig";
import InvoiceReceipt from "../../components/InvoiceReceipt";
import PasswordRules, { PasswordMatch, PasswordStrength } from "../../components/PasswordRules";
import { validatePassword, generateStrongPassword } from "../../utils/passwordPolicy";

const emptySuperAdmin = () => ({ name: "", email: "", password: "", confirm: "" });

// Validates one super-admin entry. Returns an error string or null.
// `email` is the effective login email (first entry uses the company email).
function superAdminProblem(sa, email, label) {
  if (!sa.name.trim()) return `${label}: enter a full name.`;
  if (!email || !email.includes("@")) return `${label}: enter a valid email.`;
  if (!sa.password) return `${label}: enter a password.`;
  const { valid, errors } = validatePassword(sa.password, { email, name: sa.name });
  if (!valid) return `${label}: ${errors[0]}`;
  if (sa.password !== sa.confirm) return `${label}: passwords do not match.`;
  return null;
}

// ── Plan badge styles ─────────────────────────────────────────────────────────
const PLAN = {
  basic:      { label: "Basic",      cls: "bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  pro:        { label: "Pro",        cls: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" },
  advance:    { label: "Advance",    cls: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  enterprise: { label: "Enterprise", cls: "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400" },
};

export default function Companies() {
  const [companies,  setCompanies]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit,   setShowEdit]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [paymentsCompany, setPaymentsCompany] = useState(null); // { _id, name }
  const [superAdminsCompany, setSuperAdminsCompany] = useState(null); // { _id, name, email }
  // If company creation succeeded but a super admin failed, remember the
  // company + which super admins already exist so "retry" only sends the rest.
  const [pendingCreate, setPendingCreate] = useState(null); // { company, doneEmails: [] }
  const navigate = useNavigate();

  const emptyForm = {
    companyName: "", email: "", phone: "", plan: "basic",
    superAdmins: [emptySuperAdmin()],
    headerName: "", headerLogoFile: null, headerLogoPreview: null,
  };
  const [form, setForm] = useState(emptyForm);

  const emptyEditForm = {
    companyName: "", email: "", phone: "", plan: "basic",
    headerName: "", headerLogoFile: null, headerLogoPreview: null,
  };
  const [editForm, setEditForm] = useState(emptyEditForm);

  const headerFileRef     = useRef();
  const editHeaderFileRef = useRef();

  useEffect(() => {
    api.get("/developer/companies")
      .then(r => setCompanies(r.data))
      .catch(() => setError("Failed to load companies"))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => { setForm(emptyForm); setPendingCreate(null); setError(""); setShowCreate(true); };
  const closeCreate = () => {
    // Company was created but not every super admin — keep it in the list.
    if (pendingCreate?.company) {
      const company = pendingCreate.company;
      setCompanies(prev => prev.some(c => c._id === company._id) ? prev : [...prev, company]);
    }
    setPendingCreate(null); setShowCreate(false); setError("");
  };

  const openEdit = (company) => {
    setEditTarget(company);
    setEditForm({
      companyName:        company.name          || "",
      email:              company.email         || "",
      phone:              company.phone         || "",
      plan:               company.plan          || "basic",
      headerName:         company.headerName    || "",
      headerLogoFile:     null,
      headerLogoPreview:  company.headerLogoUrl || null,
    });
    setError("");
    setShowEdit(true);
  };
  const closeEdit = () => { setShowEdit(false); setEditTarget(null); setError(""); };

  // ── Header logo handlers ─────────────────────────────────────────────────────
  const handleHeaderLogo = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setForm(p => ({ ...p, headerLogoFile: file, headerLogoPreview: URL.createObjectURL(file) }));
  };
  const handleEditHeaderLogo = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setEditForm(p => ({ ...p, headerLogoFile: file, headerLogoPreview: URL.createObjectURL(file) }));
  };
  const removeHeaderLogo = () => {
    setForm(p => ({ ...p, headerLogoFile: null, headerLogoPreview: null }));
    if (headerFileRef.current) headerFileRef.current.value = "";
  };
  const removeEditHeaderLogo = () => {
    setEditForm(p => ({ ...p, headerLogoFile: null, headerLogoPreview: null }));
    if (editHeaderFileRef.current) editHeaderFileRef.current.value = "";
  };

  const f  = (key) => (v) => setForm(p => ({ ...p, [key]: v }));
  const ef = (key) => (v) => setEditForm(p => ({ ...p, [key]: v }));

  // ── Build FormData (always multipart so both logo fields work) ───────────────
  const buildFormData = (src, extraFields = {}) => {
    const fd = new FormData();
    Object.entries(extraFields).forEach(([k, v]) => { if (v !== undefined) fd.append(k, v); });
    if (src.headerLogoFile) fd.append("headerLogo",  src.headerLogoFile);
    if (src.headerName !== undefined) fd.append("headerName", src.headerName);
    return fd;
  };

  // The first super admin logs in with the company email; extra ones use their own.
  const superAdminEmail = (sa, idx, companyEmail) => (idx === 0 ? companyEmail : sa.email).trim();

  const handleCreate = async () => {
    const { companyName, email, superAdmins } = form;
    if (!companyName.trim() || !email.trim()) {
      setError("Enter the company name and email."); return;
    }

    // Validate every super admin BEFORE creating the company, so a rejected
    // password never leaves a half-made company behind.
    const seen = new Set();
    for (let i = 0; i < superAdmins.length; i++) {
      const sa = superAdmins[i];
      const saEmail = superAdminEmail(sa, i, email);
      const problem = superAdminProblem(sa, saEmail, `Super admin ${i + 1}`);
      if (problem) { setError(problem); return; }
      const key = saEmail.toLowerCase();
      if (seen.has(key)) { setError(`Super admin ${i + 1}: each super admin needs a different email.`); return; }
      seen.add(key);
    }

    setSubmitting(true); setError("");
    let company = pendingCreate?.company || null;
    const doneEmails = new Set(pendingCreate?.doneEmails || []);
    try {
      if (!company) {
        const fd = buildFormData(form, {
          name: companyName, email, phone: form.phone, plan: form.plan,
        });
        // No manual Content-Type — axios sets multipart/form-data with correct boundary automatically
        const companyRes = await api.post("/developer/companies", fd);
        company = { ...companyRes.data, name: companyName };
      }

      for (let i = 0; i < superAdmins.length; i++) {
        const sa = superAdmins[i];
        const saEmail = superAdminEmail(sa, i, email);
        if (doneEmails.has(saEmail.toLowerCase())) continue;
        try {
          await api.post(`/developer/companies/${company._id}/super-admins`, {
            name: sa.name.trim(), email: saEmail, password: sa.password,
          });
          doneEmails.add(saEmail.toLowerCase());
        } catch (err) {
          setPendingCreate({ company, doneEmails: [...doneEmails] });
          const msg = err.response?.data?.message || "Could not create this super admin.";
          setError(`Company created, but super admin ${i + 1} (${saEmail}) failed: ${msg} Fix it and click Create again — completed accounts won't be duplicated.`);
          return;
        }
      }

      setCompanies(prev => prev.some(c => c._id === company._id) ? prev : [...prev, company]);
      setPendingCreate(null);
      setShowCreate(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create company.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    const { companyName, email } = editForm;
    if (!companyName || !email) {
      setError("Company name and email are required."); return;
    }
    setSubmitting(true); setError("");
    try {
      const fd = buildFormData(editForm, {
        name: companyName, email, phone: editForm.phone, plan: editForm.plan,
      });
      // No manual Content-Type — axios sets multipart/form-data with correct boundary automatically
      const res = await api.put(`/developer/companies/${editTarget._id}`, fd);
      const updated = res.data;
      setCompanies(prev =>
        prev.map(c => c._id === editTarget._id ? { ...c, ...updated, name: companyName } : c)
      );
      closeEdit();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update company.");
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

  // Cascade-delete a company (removes the company AND all its related data:
  // admins, users, leads, configs, etc.). Use this instead of deleting in
  // MongoDB — it prevents orphaned admin/user rows that cause duplicate-key
  // errors when a company is later recreated with the same email.
  const [deletingId, setDeletingId] = useState(null);
  const deleteCompany = async (company) => {
    const confirmText = `Delete "${company.name}" and ALL its data (admins, users, leads, campaigns, messages)?\n\nThis cannot be undone.`;
    if (!window.confirm(confirmText)) return;
    setDeletingId(company._id);
    setError("");
    try {
      await api.delete(`/developer/companies/${company._id}`);
      setCompanies(prev => prev.filter(c => c._id !== company._id));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete company.");
    } finally {
      setDeletingId(null);
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
      {error && !showCreate && !showEdit && (
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
                  {["Company", "Email", "Plan", "Status", "Payment Details", "Actions"].map(h => (
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
                          <img src={c.logo} alt={c.name} loading="lazy" decoding="async" className="w-9 h-9 rounded-xl object-cover border border-[#E5E7EB] dark:border-[#262A38]" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                            <span className="text-[13px] font-bold text-blue-600 dark:text-blue-400">
                              {avatarLetter(c.name)}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate max-w-[160px] block">{c.name}</span>
                          {c.headerName && (
                            <span className="text-[10px] text-[#9DA3BB] truncate max-w-[160px] block">
                              Header: {c.headerName}
                            </span>
                          )}
                        </div>
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

                    {/* Payment Details */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setPaymentsCompany(c)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all duration-150 active:scale-95"
                        title="View payment invoices"
                      >
                        <Receipt className="w-3 h-3" />
                        Invoices
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/developer/companies/${c._id}`)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all duration-150 active:scale-95"
                        >
                          <Settings className="w-3 h-3" />
                          Manage
                        </button>
                        <button
                          onClick={() => setSuperAdminsCompany(c)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all duration-150 active:scale-95"
                          title="View, add or remove super admins"
                        >
                          <Users className="w-3 h-3" />
                          Super admins
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all duration-150 active:scale-95"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
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
                        <button
                          onClick={() => deleteCompany(c)}
                          disabled={deletingId === c._id}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete company and all related data"
                        >
                          {deletingId === c._id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />}
                          Delete
                        </button>
                      </div>
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
        <CompanyModal
          title="Create Company"
          subtitle="Fill in the details below"
          form={form}
          setForm={setForm}
          f={f}
          headerFileRef={headerFileRef}
          handleHeaderLogo={handleHeaderLogo}
          removeHeaderLogo={removeHeaderLogo}
          error={error}
          submitting={submitting}
          onClose={closeCreate}
          onSubmit={handleCreate}
          submitLabel={pendingCreate ? "Finish creating" : "Create Company"}
          showSuperAdmin={true}
          companyLocked={!!pendingCreate}
        />
      )}

      {/* ── Super Admins Modal ── */}
      {superAdminsCompany && (
        <SuperAdminsModal
          company={superAdminsCompany}
          onClose={() => setSuperAdminsCompany(null)}
        />
      )}

      {/* ── Payment Invoices Modal ── */}
      {paymentsCompany && (
        <PaymentInvoicesModal
          company={paymentsCompany}
          onClose={() => setPaymentsCompany(null)}
        />
      )}

      {/* ── Edit Company Modal ── */}
      {showEdit && (
        <CompanyModal
          title="Edit Company"
          subtitle={`Editing: ${editTarget?.name}`}
          form={editForm}
          setForm={setEditForm}
          f={ef}
          headerFileRef={editHeaderFileRef}
          handleHeaderLogo={handleEditHeaderLogo}
          removeHeaderLogo={removeEditHeaderLogo}
          error={error}
          submitting={submitting}
          onClose={closeEdit}
          onSubmit={handleEdit}
          submitLabel="Save Changes"
          showSuperAdmin={false}
        />
      )}
    </div>
  );
}


// ── Payment Invoices Modal ────────────────────────────────────────────────────
function PaymentInvoicesModal({ company, onClose }) {
  const [invoices,     setInvoices]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [viewInvoice,  setViewInvoice]  = useState(null); // invoice being previewed

  useEffect(() => {
    setLoading(true); setError("");
    api.get(`/developer/companies/${company._id}/payments`)
      .then(r => setInvoices(r.data?.invoices || []))
      .catch(e => setError(e.response?.data?.message || "Failed to load invoices."))
      .finally(() => setLoading(false));
  }, [company._id]);

  const totalPaid = invoices
    .filter(inv => inv.status === "Paid")
    .reduce((sum, inv) => sum + (inv.baseAmount || 0), 0);

  const STATUS_STYLE = {
    Paid:    { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", icon: BadgeCheck },
    Pending: { bg: "bg-amber-50 dark:bg-amber-500/10",     text: "text-amber-700 dark:text-amber-400",     dot: "bg-amber-400",   icon: Clock },
    Failed:  { bg: "bg-red-50 dark:bg-red-500/10",         text: "text-red-600 dark:text-red-400",         dot: "bg-red-500",     icon: AlertCircle },
  };

  const BILLING_LABEL = { monthly: "Monthly", yearly: "Yearly" };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <div className="relative w-full max-w-2xl bg-white dark:bg-[#1A1D27] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#262A38] max-h-[88vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F0F2FA] dark:border-[#1E2130] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F1117] dark:text-[#F0F2FA]">Payment Invoices</h2>
                <p className="text-[11px] text-[#9DA3BB] mt-0.5">{company.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9DA3BB] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] hover:bg-[#F0F2FA] dark:hover:bg-[#262A38] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Summary strip */}
          {!loading && !error && invoices.length > 0 && (
            <div className="px-6 py-3 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#F0F2FA] dark:border-[#1E2130] shrink-0">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#6B7280] dark:text-[#9DA3BB]" />
                  <span className="text-[11px] text-[#6B7280] dark:text-[#9DA3BB]">Total invoices:</span>
                  <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{invoices.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] text-[#6B7280] dark:text-[#9DA3BB]">Total paid:</span>
                  <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{totalPaid.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">

            {loading && (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-[#9DA3BB]">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Loading invoices…</span>
              </div>
            )}

            {!loading && error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                <XCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {!loading && !error && invoices.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#F0F2FA] dark:bg-[#13161E] flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-[#C4C9DA]" />
                </div>
                <p className="text-sm text-[#9DA3BB] text-center">
                  No payment records found.<br />
                  <span className="text-[11px] text-[#C4C9DA]">Invoices appear here after a successful payment.</span>
                </p>
              </div>
            )}

            {!loading && !error && invoices.length > 0 && (
              <div className="space-y-3">
                {invoices.map((inv) => {
                  const s = STATUS_STYLE[inv.status] || STATUS_STYLE.Pending;
                  const StatusIcon = s.icon;
                  return (
                    <div
                      key={inv.invoiceId}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] hover:border-[#D1D5DB] dark:hover:border-[#3A3F52] transition-colors"
                    >
                      {/* Left: icon + invoice id + date */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.bg}`}>
                          <StatusIcon className={`w-4 h-4 ${s.text}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] font-mono truncate">
                            {inv.invoiceId}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3 h-3 text-[#9DA3BB]" />
                            <span className="text-[11px] text-[#9DA3BB]">{inv.date}</span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: plan + billing */}
                      <div className="flex items-center gap-2 sm:flex-col sm:items-end shrink-0">
                        <span className="text-[11px] font-semibold text-[#4B5563] dark:text-[#9DA3BB] bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] px-2 py-0.5 rounded-lg">
                          {inv.planName}
                        </span>
                        <span className="text-[10px] text-[#9DA3BB] capitalize">
                          {BILLING_LABEL[inv.billingCycle] || inv.billingCycle}
                        </span>
                      </div>

                      {/* Right: amount + status + actions */}
                      <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                        <span className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                          {inv.amount}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold ${s.bg} ${s.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {inv.status}
                        </span>

                        {/* ── View & Download buttons ── */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            onClick={() => setViewInvoice(inv)}
                            title="View invoice"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all active:scale-95"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                          <button
                            onClick={() => setViewInvoice({ ...inv, _autoDownload: true })}
                            title="Download PDF"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95"
                          >
                            <Download className="w-3 h-3" />
                            PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#F0F2FA] dark:border-[#1E2130] shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] text-sm font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* ── InvoiceReceipt overlay (View / auto-download) ── */}
      {viewInvoice && (
        <InvoiceReceiptWrapper
          invoice={viewInvoice}
          onClose={() => setViewInvoice(null)}
        />
      )}
    </>
  );
}

// ── Thin wrapper: triggers auto-download then shows receipt ──────────────────
function InvoiceReceiptWrapper({ invoice, onClose }) {
  const autoDownloadFired = useRef(false);

  useEffect(() => {
    if (invoice._autoDownload && !autoDownloadFired.current) {
      autoDownloadFired.current = true;
      // Small delay so the component mounts and the download fires naturally
      // via InvoiceReceipt's own handleDownload function triggered below
    }
  }, [invoice._autoDownload]);

  // Strip internal flags before passing to InvoiceReceipt
  const cleanInvoice = { ...invoice };
  delete cleanInvoice._autoDownload;

  return (
    <InvoiceReceipt
      invoice={cleanInvoice}
      onClose={onClose}
      // If _autoDownload was set, tell InvoiceReceipt to immediately download
      autoDownload={!!invoice._autoDownload}
    />
  );
}

// ── Reusable Company Modal (stepped) ──────────────────────────────────────────
// Create: Company details → Header branding → Super admins (Next validates).
// Edit:   Company details → Header branding (switch freely, save any time).
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

function saIsReady(sa, email) {
  return !!(sa.name.trim() && isEmail(email) && sa.password && sa.password === sa.confirm &&
    validatePassword(sa.password, { email, name: sa.name }).valid);
}

function CompanyModal({
  title, subtitle, form, setForm, f,
  headerFileRef,
  handleHeaderLogo, removeHeaderLogo,
  error, submitting, onClose, onSubmit, submitLabel, showSuperAdmin, companyLocked = false,
}) {
  const superAdmins = form.superAdmins || [];
  const steps = [
    { key: "company",  title: "Company details", hint: "Name, email and plan" },
    { key: "branding", title: "Header branding", hint: "Optional logo and name" },
    ...(showSuperAdmin ? [{ key: "admins", title: "Super admins", hint: "Who gets full access" }] : []),
  ];
  const lastStep = steps.length - 1;

  const [step, setStep]         = useState(companyLocked ? lastStep : 0);
  const [stepError, setStepError] = useState("");
  const [openIdx, setOpenIdx]   = useState(0);

  // Company got created but a super admin failed → jump to the super admin step.
  useEffect(() => { if (companyLocked) setStep(lastStep); }, [companyLocked, lastStep]);

  const companyValid = form.companyName.trim() && isEmail(form.email);
  const saEmail      = (sa, i) => (i === 0 ? form.email : sa.email).trim();
  const saReady      = superAdmins.length > 0 && superAdmins.every((sa, i) => saIsReady(sa, saEmail(sa, i)));

  const updateSA = (idx, patch) =>
    setForm(p => ({ ...p, superAdmins: p.superAdmins.map((sa, i) => (i === idx ? { ...sa, ...patch } : sa)) }));
  const addSA = () => {
    setForm(p => ({ ...p, superAdmins: [...p.superAdmins, emptySuperAdmin()] }));
    setOpenIdx(superAdmins.length);
  };
  const removeSA = (idx) => {
    setForm(p => ({ ...p, superAdmins: p.superAdmins.filter((_, i) => i !== idx) }));
    setOpenIdx(0);
  };

  // In create mode a step can only be reached once the steps before it are valid.
  const canReach = (target) => !showSuperAdmin || target === 0 || companyValid;
  const goTo = (target) => {
    if (companyLocked && target < lastStep) return;
    if (!canReach(target)) { setStepError("Enter the company name and a valid email first."); return; }
    setStepError(""); setStep(target);
  };
  const next = () => {
    if (step === 0 && !companyValid) { setStepError("Enter the company name and a valid email to continue."); return; }
    setStepError(""); setStep(s => Math.min(s + 1, lastStep));
  };

  const isCreate   = showSuperAdmin;
  const onLastStep = step === lastStep;
  const submitDisabled = submitting || !companyValid || (isCreate && !saReady);
  const shownError = stepError || error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-white dark:bg-[#1A1D27] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#262A38] max-h-[94vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#F0F2FA] dark:border-[#1E2130] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#0F1117] dark:text-[#F0F2FA]">{title}</h2>
              <p className="text-[11px] text-[#9DA3BB] truncate">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9DA3BB] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] hover:bg-[#F0F2FA] dark:hover:bg-[#262A38] transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0">

          {/* Step rail — vertical on desktop, horizontal on mobile */}
          <nav aria-label="Steps" className="shrink-0 md:w-56 border-b md:border-b-0 md:border-r border-[#F0F2FA] dark:border-[#1E2130] bg-[#FAFBFD] dark:bg-[#151821]">
            <ol className="flex md:flex-col gap-1 p-3 md:p-4 overflow-x-auto">
              {steps.map((s, i) => {
                const done    = i < step;
                const current = i === step;
                const locked  = companyLocked && i < lastStep;
                return (
                  <li key={s.key} className="shrink-0 md:shrink">
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      disabled={locked}
                      aria-current={current ? "step" : undefined}
                      aria-label={`Step ${i + 1}: ${s.title}`}
                      className={`w-full flex items-center gap-3 text-left px-2.5 py-2 rounded-xl transition ${
                        current ? "bg-white dark:bg-[#1A1D27] shadow-sm ring-1 ring-blue-200 dark:ring-blue-500/30"
                        : "hover:bg-white/70 dark:hover:bg-[#1A1D27]/60"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        done ? "bg-green-600 text-white"
                        : current ? "bg-blue-600 text-white"
                        : "bg-[#E5E7EB] dark:bg-[#262A38] text-[#6B7280] dark:text-[#9DA3BB]"
                      }`}>
                        {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </span>
                      <span className={`min-w-0 ${current ? "block" : "hidden md:block"}`}>
                        <span className={`block text-[12px] font-semibold whitespace-nowrap ${current ? "text-blue-700 dark:text-blue-400" : "text-[#0F1117] dark:text-[#F0F2FA]"}`}>
                          {s.title}
                        </span>
                        <span className="hidden md:block text-[10px] text-[#9DA3BB]">{s.hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Step content */}
          <div className="flex-1 min-w-0 overflow-y-auto px-5 sm:px-6 py-5">

            {steps[step].key === "company" && (
              <section className="space-y-4 max-w-xl">
                <SectionHeading icon={<Building2 className="w-3.5 h-3.5" />} label="Company details" />
                {companyLocked && (
                  <p className="text-[11px] px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    The company is already created. Only the super admin details can be changed now.
                  </p>
                )}
                <Field label="Company name *" value={form.companyName} onChange={f("companyName")} placeholder="Acme Corp" disabled={companyLocked} />
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field
                    label={isCreate ? "Company email *" : "Email *"}
                    type="email" value={form.email} onChange={f("email")} placeholder="admin@acme.com"
                    disabled={companyLocked}
                  />
                  <Field label="Phone" value={form.phone} onChange={f("phone")} placeholder="+91 99999 00000" />
                </div>
                {isCreate && (
                  <p className="text-[11px] text-[#9DA3BB] -mt-2">The company email is also the first super admin's login.</p>
                )}
                <div>
                  <Label text="Plan" />
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries({ basic: "Basic", pro: "Pro", advance: "Advance", enterprise: "Enterprise" }).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
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
              </section>
            )}

            {steps[step].key === "branding" && (
              <section className="space-y-4 max-w-xl">
                <SectionHeading icon={<Layout className="w-3.5 h-3.5" />} label="Header branding" />
                <p className="text-[11px] text-[#9DA3BB] -mt-2">
                  The logo and name shown in the company's top header bar. You can skip this and add it later.
                </p>
                <Field label="Header bar name" value={form.headerName} onChange={f("headerName")} placeholder="e.g. Acme CRM" />
                <LogoUploadField
                  label="Header bar logo"
                  hint="Shown in the top sticky header"
                  preview={form.headerLogoPreview}
                  fileRef={headerFileRef}
                  onFile={handleHeaderLogo}
                  onRemove={removeHeaderLogo}
                />
              </section>
            )}

            {steps[step].key === "admins" && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <SectionHeading icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Super admins" />
                    <p className="text-[11px] text-[#9DA3BB] mt-1">
                      Super admins have full control of this company's CRM. Add one for each person who needs it.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#9DA3BB]">
                    {superAdmins.filter((sa, i) => saIsReady(sa, saEmail(sa, i))).length} of {superAdmins.length} ready
                  </span>
                </div>

                <div className="space-y-3">
                  {superAdmins.map((sa, idx) => {
                    const ready = saIsReady(sa, saEmail(sa, idx));
                    const open  = openIdx === idx;
                    return (
                      <div key={idx} className={`rounded-xl border transition ${open ? "border-blue-300 dark:border-blue-500/40" : "border-[#E5E7EB] dark:border-[#262A38]"}`}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setOpenIdx(open ? -1 : idx)}
                            aria-expanded={open}
                            className="flex flex-1 min-w-0 items-center gap-3 text-left"
                          >
                            <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-[12px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                              {(sa.name.trim().charAt(0) || String(idx + 1)).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">
                                  {sa.name.trim() || `Super admin ${idx + 1}`}
                                </span>
                                {idx === 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
                                    Company login
                                  </span>
                                )}
                              </span>
                              <span className="block text-[11px] text-[#9DA3BB] truncate">
                                {saEmail(sa, idx) || "No email yet"}
                              </span>
                            </span>
                          </button>
                          <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            ready ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
                                  : "bg-[#F0F2FA] dark:bg-[#262A38] text-[#6B7280] dark:text-[#9DA3BB]"
                          }`}>
                            {ready ? <><Check className="w-3 h-3" /> Ready</> : "Incomplete"}
                          </span>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => removeSA(idx)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                              aria-label={`Remove super admin ${idx + 1}`}
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setOpenIdx(open ? -1 : idx)}
                            className="p-1.5 rounded-lg text-[#9DA3BB] hover:bg-[#F0F2FA] dark:hover:bg-[#262A38] transition"
                            aria-label={open ? "Collapse" : "Expand"}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                        {open && (
                          <div className="px-4 pb-4 pt-1 border-t border-[#F0F2FA] dark:border-[#1E2130]">
                            <SuperAdminFields
                              value={sa}
                              onChange={(patch) => updateSA(idx, patch)}
                              lockedEmail={idx === 0 ? (form.email || "") : null}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addSA}
                  disabled={superAdmins.length >= 10}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#D1D5DB] dark:border-[#2A2F42] text-xs font-semibold text-blue-600 dark:text-blue-400 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-4 h-4" /> Add another super admin
                </button>
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#F0F2FA] dark:border-[#1E2130] px-5 sm:px-6 py-3.5 space-y-3 bg-white dark:bg-[#1A1D27]">
          {shownError && (
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[13px]">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {shownError}
            </div>
          )}
          <div className="flex items-center gap-3">
            {step > 0 && !(companyLocked && step <= lastStep) ? (
              <button
                type="button"
                onClick={() => { setStepError(""); setStep(s => s - 1); }}
                className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] text-sm font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
              >
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] text-sm font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
              >
                Cancel
              </button>
            )}
            <span className="flex-1 text-[11px] text-[#9DA3BB] text-right hidden sm:block">
              Step {step + 1} of {steps.length}
            </span>
            {isCreate && !onLastStep ? (
              <button
                type="button"
                onClick={next}
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition active:scale-95"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitDisabled}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition active:scale-95 shadow-sm shadow-blue-500/20"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><CheckCircle2 className="w-4 h-4" /> {submitLabel}</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Logo upload sub-component ─────────────────────────────────────────────────
function LogoUploadField({ label, hint, preview, fileRef, onFile, onRemove }) {
  return (
    <div>
      <Label text={label} />
      {hint && <p className="text-[10px] text-[#9DA3BB] mt-0.5 mb-2">{hint}</p>}
      {preview ? (
        <div className="flex items-center gap-4 mt-1">
          <img
            src={preview} alt="Logo preview"
            className="w-16 h-16 rounded-xl object-cover border-2 border-[#E5E7EB] dark:border-[#262A38] shadow-sm"
          />
          <div className="flex flex-col gap-2">
            <button onClick={() => fileRef.current?.click()} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">
              Change logo
            </button>
            <button onClick={onRemove} className="text-xs text-red-500 font-medium hover:underline">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-1 w-full flex flex-col items-center justify-center gap-2 h-20 rounded-xl border-2 border-dashed border-[#D1D5DB] dark:border-[#2A2F42] hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all group"
        >
          <UploadCloud className="w-5 h-5 text-[#9DA3BB] group-hover:text-blue-500 transition-colors" />
          <span className="text-xs text-[#9DA3BB] group-hover:text-blue-500 transition-colors font-medium">
            Click to upload
          </span>
          <span className="text-[10px] text-[#C4C9DA]">PNG, JPG, SVG up to 2 MB</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
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

// ── Label ─────────────────────────────────────────────────────────────────────
function Label({ text }) {
  return (
    <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider">
      {text}
    </label>
  );
}

// ── Input field ───────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text", placeholder = "", disabled = false }) {
  return (
    <div>
      <Label text={label} />
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-2 w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9DA] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ── Password input with show/hide ─────────────────────────────────────────────
function PasswordInput({ id, label, value, onChange, placeholder = "", invalid = false, valid = false, describedBy }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider">{label}</label>
      <div className="relative mt-2">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`w-full px-3 py-2.5 pr-10 rounded-xl border bg-[#F8F9FC] dark:bg-[#13161E] text-sm font-mono text-[#0F1117] dark:text-[#F0F2FA] placeholder:font-sans placeholder:text-[#C4C9DA] focus:outline-none focus:ring-2 transition ${
            invalid ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
            : valid ? "border-green-500 focus:border-green-600 focus:ring-green-500/20"
            : "border-[#E5E7EB] dark:border-[#262A38] focus:border-blue-500 focus:ring-blue-500/20"
          }`}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#9DA3BB] hover:text-[#4B5168] dark:hover:text-[#F0F2FA] transition"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Name / email / password / confirm for one super admin ─────────────────────
// Layout (desktop): name | email on top; below, the password + confirm column
// on the left and the rules panel on the right, pointing at the field.
// On mobile everything stacks and the panel points up.
// lockedEmail: when a string, the email is fixed (first super admin uses the
// company email) and shown read-only.
let saFieldSeq = 0;
function SuperAdminFields({ value, onChange, lockedEmail = null }) {
  const [uid] = useState(() => `sa${++saFieldSeq}`);
  const email   = lockedEmail !== null ? lockedEmail : value.email;
  const context = { email, name: value.name };
  const pwValid = !!value.password && validatePassword(value.password, context).valid;

  const generate = () => {
    const pw = generateStrongPassword(14, context);
    onChange({ password: pw, confirm: pw });
  };

  return (
    <div className="space-y-4 pt-3">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Full name *" value={value.name} onChange={v => onChange({ name: v })} placeholder="Jane Doe" />
        {lockedEmail !== null ? (
          <div>
            <Label text="Login email" />
            <div className="mt-2 px-3 py-2.5 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#262A38] text-sm text-[#6B7280] dark:text-[#9DA3BB] truncate" title="Uses the company email">
              {lockedEmail || <span className="italic text-[#C4C9DA]">Uses the company email</span>}
            </div>
          </div>
        ) : (
          <Field label="Login email *" type="email" value={value.email} onChange={v => onChange({ email: v })} placeholder="jane@acme.com" />
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-5 items-start">
        <div className="space-y-3">
          <div>
            <PasswordInput
              id={`${uid}-pw`}
              label="New password *"
              value={value.password}
              onChange={v => onChange({ password: v })}
              placeholder="Create a password"
              invalid={!!value.password && !pwValid}
              valid={pwValid}
              describedBy={`${uid}-rules`}
            />
            <PasswordStrength password={value.password} context={context} className="mt-2" />
            <button
              type="button"
              onClick={generate}
              className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Wand2 className="w-3 h-3" /> Suggest a strong password
            </button>
          </div>
          <div>
            <PasswordInput
              id={`${uid}-confirm`}
              label="Confirm new password *"
              value={value.confirm}
              onChange={v => onChange({ confirm: v })}
              placeholder="Re-enter the password"
              invalid={!!value.confirm && value.confirm !== value.password}
              valid={!!value.confirm && value.confirm === value.password}
            />
            <PasswordMatch password={value.password} confirm={value.confirm} />
          </div>
        </div>

        <div id={`${uid}-rules`} className="md:pt-[26px]">
          <PasswordRules password={value.password} context={context} variant="side" showStrength={false} />
        </div>
      </div>
    </div>
  );
}

// Turns an axios error into a message the developer can act on. A 404 with
// no JSON body means the route itself is missing — the backend is older than
// this frontend (new files not deployed, or the server not restarted).
function apiErrorMessage(err, fallback) {
  const status = err?.response?.status;
  const data   = err?.response?.data;
  const msg    = data && typeof data === "object" ? (data.message || data.error) : null;
  if (msg) return msg;
  if (status === 404) return "The server doesn't have this feature yet. Deploy the latest backend files (developerRoutes.js and developerController.js) and restart the server.";
  if (!err?.response) return "Couldn't reach the server. Check your connection and try again.";
  return `${fallback} (error ${status})`;
}

// ── Manage a company's super admins (list / add / remove) ─────────────────────
function SuperAdminsModal({ company, onClose }) {
  const [list, setList]       = useState([]);
  const [max, setMax]         = useState(10);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(""); // list couldn't be loaded — don't pretend it's empty
  const [error, setError]     = useState("");
  const [added, setAdded]     = useState(null);  // { name, email, password } — shown once
  const [notice, setNotice]   = useState("");
  const [adding, setAdding]   = useState(false);
  const [draft, setDraft]     = useState(emptySuperAdmin());
  const [saving, setSaving]   = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [copied, setCopied]   = useState(false);
  const formRef = useRef(null);

  const load = async () => {
    setLoading(true); setError(""); setLoadError("");
    try {
      const { data } = await api.get(`/developer/companies/${company._id}/super-admins`);
      setList(data.superAdmins || []);
      if (data.max) setMax(data.max);
    } catch (err) {
      setLoadError(apiErrorMessage(err, "Couldn't load super admins."));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [company._id]);

  useEffect(() => {
    if (adding) formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [adding]);

  const startAdding = () => { setAdding(true); setAdded(null); setNotice(""); setError(""); };
  const cancelAdding = () => { setAdding(false); setDraft(emptySuperAdmin()); setError(""); };

  const handleAdd = async () => {
    const email = draft.email.trim();
    const problem = superAdminProblem(draft, email, "New super admin");
    if (problem) { setError(problem); return; }
    if (list.some(sa => sa.email.toLowerCase() === email.toLowerCase())) {
      setError("This email is already a super admin for this company."); return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const { data } = await api.post(`/developer/companies/${company._id}/super-admins`, {
        name: draft.name.trim(), email, password: draft.password,
      });
      setList(prev => [...prev, data]);
      setAdded({ name: data.name, email: data.email, password: draft.password });
      setCopied(false);
      setDraft(emptySuperAdmin());
      setAdding(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't add the super admin."));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (sa) => {
    if (!window.confirm(`Remove ${sa.name} (${sa.email}) as super admin of ${company.name}? They will lose access immediately.`)) return;
    setRemovingId(sa._id); setError(""); setNotice(""); setAdded(null);
    try {
      await api.delete(`/developer/companies/${company._id}/super-admins/${sa._id}`);
      setList(prev => prev.filter(x => x._id !== sa._id));
      setNotice(`${sa.name} removed.`);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't remove the super admin."));
    } finally {
      setRemovingId(null);
    }
  };

  const copyCredentials = () => {
    if (!added) return;
    navigator.clipboard
      .writeText(`Login email: ${added.email}\nPassword: ${added.password}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {});
  };

  const draftValid = saIsReady(draft, draft.email.trim());
  const full = list.length >= max;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#1A1D27] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#262A38] max-h-[94vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#F0F2FA] dark:border-[#1E2130] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[#0F1117] dark:text-[#F0F2FA]">Super admins</h2>
                <p className="text-[11px] text-[#9DA3BB] truncate">{company.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9DA3BB] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] hover:bg-[#F0F2FA] dark:hover:bg-[#262A38] transition shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {!loading && !loadError && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-[#F0F2FA] dark:bg-[#262A38] overflow-hidden">
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.min(100, (list.length / max) * 100)}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#9DA3BB] whitespace-nowrap">
                {list.length} of {max} used
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 h-28 text-sm text-[#9DA3BB]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading super admins…
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-4" role="alert">
              <div className="flex items-start gap-2.5">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-red-700 dark:text-red-300">Couldn't load this company's super admins</p>
                  <p className="text-[12px] text-red-600 dark:text-red-400 mt-0.5">{loadError}</p>
                </div>
              </div>
              <button
                onClick={load}
                className="mt-3 ml-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#13161E] border border-red-200 dark:border-red-500/30 text-[12px] font-semibold text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#262A38] px-4 py-6 text-center">
              <p className="text-sm font-semibold text-[#0F1117] dark:text-[#F0F2FA]">No super admin yet</p>
              <p className="text-[12px] text-[#6B7280] dark:text-[#9DA3BB] mt-1">Add one so someone can log in and manage this company.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E5E7EB] dark:border-[#262A38] overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-[#F8F9FC] dark:bg-[#13161E] text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#565C75]">
                <span>Name and login</span><span className="w-24">Added</span><span className="w-[84px]" />
              </div>
              <ul className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                {list.map(sa => {
                  const isCompanyLogin = sa.email?.toLowerCase() === company.email?.toLowerCase();
                  const lastOne = list.length <= 1;
                  return (
                    <li key={sa._id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto] items-center gap-3 sm:gap-4 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-[12px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                          {(sa.name || "?").trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
                            <span className="truncate">{sa.name}</span>
                            {isCompanyLogin && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
                                Company login
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-[#6B7280] dark:text-[#9DA3BB] truncate">{sa.email}</p>
                        </div>
                      </div>
                      <span className="hidden sm:block w-24 text-[11px] text-[#6B7280] dark:text-[#9DA3BB]">{fmtDate(sa.createdAt)}</span>
                      <button
                        onClick={() => handleRemove(sa)}
                        disabled={lastOne || removingId === sa._id}
                        title={lastOne ? "A company needs at least one super admin" : `Remove ${sa.name}`}
                        className="w-[84px] flex items-center justify-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {removingId === sa._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {added && (
            <div className="rounded-xl border border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/10 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-green-800 dark:text-green-300">{added.name} can now log in</p>
                  <p className="text-[12px] text-green-700 dark:text-green-400 mt-0.5">
                    Share the login details securely. The password won't be shown again after you close this window.
                  </p>
                </div>
                <button
                  onClick={copyCredentials}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#13161E] border border-green-200 dark:border-green-500/30 text-[11px] font-semibold text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/10 transition"
                >
                  {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy login details</>}
                </button>
              </div>
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400 text-[13px]">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {notice}
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[13px]">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {!loading && !loadError && adding && (
            <div ref={formRef} className="rounded-xl border border-blue-200 dark:border-blue-500/30 px-4 pt-4 pb-5">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Add a super admin</p>
              </div>
              <SuperAdminFields value={draft} onChange={patch => setDraft(d => ({ ...d, ...patch }))} />
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="shrink-0 border-t border-[#F0F2FA] dark:border-[#1E2130] px-5 sm:px-6 py-3.5 flex items-center justify-end gap-3 bg-white dark:bg-[#1A1D27]">
            {adding ? (
              <>
                <button
                  onClick={cancelAdding}
                  className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] text-sm font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !draftValid}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition active:scale-95"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <><UserPlus className="w-4 h-4" /> Add super admin</>}
                </button>
              </>
            ) : (
              <>
                {full && <span className="flex-1 text-[11px] text-[#9DA3BB]">Limit of {max} super admins reached. Remove one to add another.</span>}
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] text-sm font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
                >
                  Done
                </button>
                <button
                  onClick={startAdding}
                  disabled={full || !!loadError}
                  title={loadError ? "Load the current super admins first" : undefined}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition active:scale-95"
                >
                  <UserPlus className="w-4 h-4" /> Add super admin
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
// Also used by the company Manage page (CompanyDetails.jsx).
export { SuperAdminsModal };
