// src/pages/developer/Companies.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, UploadCloud, X, ChevronRight,
  CheckCircle2, XCircle, ShieldCheck, Image, Loader2, Pencil, Layout, Settings,
  Receipt, CreditCard, Calendar, BadgeCheck, Clock, AlertCircle, Eye, Download, Trash2,
} from "lucide-react";
import api from "../../data/axiosConfig";
import InvoiceReceipt from "../../components/InvoiceReceipt";

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
  const navigate = useNavigate();

  const emptyForm = {
    companyName: "", email: "", phone: "", plan: "basic",
    saName: "", saPassword: "",
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

  const openCreate = () => { setForm(emptyForm); setError(""); setShowCreate(true); };
  const closeCreate = () => { setShowCreate(false); setError(""); };

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

  const handleCreate = async () => {
    const { companyName, email, saName, saPassword } = form;
    if (!companyName || !email || !saName || !saPassword) {
      setError("Please fill all required fields."); return;
    }
    setSubmitting(true); setError("");
    try {
      const fd = buildFormData(form, {
        name: companyName, email, phone: form.phone, plan: form.plan,
      });
      // No manual Content-Type — axios sets multipart/form-data with correct boundary automatically
      const companyRes = await api.post("/developer/companies", fd);
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
                          <img src={c.logo} alt={c.name} className="w-9 h-9 rounded-xl object-cover border border-[#E5E7EB] dark:border-[#262A38]" />
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
          submitLabel="Create Company"
          showSuperAdmin={true}
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

// ── Reusable Company Modal ────────────────────────────────────────────────────
function CompanyModal({
  title, subtitle, form, setForm, f,
  headerFileRef,
  handleHeaderLogo, removeHeaderLogo,
  error, submitting, onClose, onSubmit, submitLabel, showSuperAdmin,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl shadow-2xl border border-[#E5E7EB] dark:border-[#262A38] max-h-[92vh] overflow-y-auto">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#F0F2FA] dark:border-[#1E2130]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F1117] dark:text-[#F0F2FA]">{title}</h2>
              <p className="text-[11px] text-[#9DA3BB]">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
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

              {/* Company Name */}
              <Field label="Company Name *" value={form.companyName} onChange={f("companyName")} placeholder="Acme Corp" />

              {/* Email */}
              <Field
                label={showSuperAdmin ? "Email * (used for company & super admin login)" : "Email *"}
                type="email" value={form.email} onChange={f("email")} placeholder="admin@acme.com"
              />

              {/* Phone */}
              <Field label="Phone" value={form.phone} onChange={f("phone")} placeholder="+91 99999 00000" />

              {/* Plan */}
              <div>
                <Label text="Plan" />
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries({ basic: "Basic", pro: "Pro", advance: "Advance", enterprise: "Enterprise" }).map(([key, label]) => (
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

          {/* ── Section: Header Branding ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#F0F2FA] dark:bg-[#1E2130]" />
            <span className="text-[10px] font-semibold text-[#C4C9DA] uppercase tracking-widest">Header Branding</span>
            <div className="flex-1 h-px bg-[#F0F2FA] dark:bg-[#1E2130]" />
          </div>

          <section>
            <SectionHeading icon={<Layout className="w-3.5 h-3.5" />} label="Header Bar Branding" />
            <p className="text-[11px] text-[#9DA3BB] mt-1 mb-4">
              Customize the logo and name shown in the company's sticky top header bar.
            </p>

            <div className="space-y-4">
              {/* Header Name */}
              <Field
                label="Header Bar Name"
                value={form.headerName}
                onChange={f("headerName")}
                placeholder="e.g. Acme CRM"
              />

              {/* Header Logo Upload */}
              <LogoUploadField
                label="Header Bar Logo"
                hint="Shown in the top sticky header"
                preview={form.headerLogoPreview}
                fileRef={headerFileRef}
                onFile={handleHeaderLogo}
                onRemove={removeHeaderLogo}
              />
            </div>
          </section>

          {/* ── Super Admin Section (create only) ── */}
          {showSuperAdmin && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#F0F2FA] dark:bg-[#1E2130]" />
                <span className="text-[10px] font-semibold text-[#C4C9DA] uppercase tracking-widest">Super Admin</span>
                <div className="flex-1 h-px bg-[#F0F2FA] dark:bg-[#1E2130]" />
              </div>

              <section>
                <SectionHeading icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Super Admin Credentials" />
                <p className="text-[11px] text-[#9DA3BB] mt-1 mb-4">
                  This account will have full control over the company's CRM. The email above will be used to log in.
                </p>

                <div className="space-y-4">
                  <Field label="Full Name *" value={form.saName} onChange={f("saName")} placeholder="Jane Doe" />

                  <div>
                    <Label text="Email (same as above)" />
                    <div className="mt-2 px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#9DA3BB] truncate">
                      {form.email || <span className="italic text-[#C4C9DA]">Enter email above</span>}
                    </div>
                  </div>

                  <Field label="Password *" type="password" value={form.saPassword} onChange={f("saPassword")} placeholder="••••••••" />
                </div>
              </section>
            </>
          )}

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
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] text-sm font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={
                submitting ||
                !form.companyName ||
                !form.email ||
                (showSuperAdmin && (!form.saName || !form.saPassword))
              }
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all active:scale-95 shadow-sm shadow-blue-500/20"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> {submitLabel}</>
              )}
            </button>
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