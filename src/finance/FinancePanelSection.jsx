// src/finance/FinancePanelSection.jsx — NEW FILE
// "Finance Panel Access" card for User Management (super admin only, and only
// when the Developer has enabled the Finance Dashboard for the company).
// Creates / suspends / removes the logins used at /finance/login.
import { useState, useEffect } from "react";
import { Wallet, Plus, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff, Loader2, Copy, Check } from "lucide-react";
import api from "../data/axiosConfig";
import PasswordRules from "../components/PasswordRules";
import { validatePassword, generateStrongPassword } from "../utils/passwordPolicy";

const input = "w-full text-[12px] px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none focus:border-emerald-400 text-[#0F1117] dark:text-[#DDE1F5]";
const label = "block text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-1";

export default function FinancePanelSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [copied, setCopied] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const loginUrl = `${window.location.origin}/finance/login`;

  const load = async () => {
    setLoading(true); setError("");
    try { const { data } = await api.get("/superadmin/finance-users"); setUsers(data || []); }
    catch (e) { setError(e?.response?.data?.message || "Failed to load."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) { setError("All fields are required."); return; }
    const { valid, errors } = validatePassword(form.password, { email: form.email.trim(), name: form.name });
    if (!valid) { setError(errors[0]); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const { data } = await api.post("/superadmin/finance-users", form);
      setUsers((u) => [...u, data]);
      setForm({ name: "", email: "", password: "" });
      setShowForm(false);
      setSuccess("Finance panel user created.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) { setError(e?.response?.data?.message || "Failed to create user."); }
    finally { setSaving(false); }
  };

  const toggle = async (id) => {
    setToggling(id);
    try {
      const { data } = await api.patch(`/superadmin/finance-users/${id}/toggle`);
      setUsers((u) => u.map((m) => (m._id === id ? { ...m, financeAccess: data.financeAccess } : m)));
    } catch (e) { setError(e?.response?.data?.message || "Failed."); }
    finally { setToggling(null); }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this finance panel user?")) return;
    setDeleting(id);
    try { await api.delete(`/superadmin/finance-users/${id}`); setUsers((u) => u.filter((m) => m._id !== id)); }
    catch (e) { setError(e?.response?.data?.message || "Failed."); }
    finally { setDeleting(null); }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 2000); }).catch(() => {});
  };

  return (
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden mt-6">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0"><Wallet className="w-4 h-4 text-white" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Finance Panel Access</p>
          <p className="text-[11px] text-[#8B92A9]">Create logins for the Finance Panel · <span className="font-semibold text-emerald-600 dark:text-emerald-400">{loginUrl}</span></p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError(""); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add User
        </button>
      </div>

      <div className="p-5 space-y-4">
        {error && <p className="text-[12px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 rounded-xl px-3 py-2">{error}</p>}
        {success && <p className="text-[12px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl px-3 py-2">{success}</p>}

        {showForm && (
          <div className="border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl p-4 space-y-3">
            <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">New Finance Panel User</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div><label className={label}>Full Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Accounts Manager" className={input} /></div>
              <div><label className={label}>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="finance@company.com" className={input} /></div>
              <div>
                <label className={label}>Password</label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Create a password" autoComplete="new-password" className={`${input} pr-9`} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A9]">{showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">Password rules</span>
              <button type="button" onClick={() => { setForm({ ...form, password: generateStrongPassword(14, { email: form.email.trim(), name: form.name }) }); setShowPwd(true); }} className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">Suggest a strong password</button>
            </div>
            <PasswordRules password={form.password} context={{ email: form.email.trim(), name: form.name }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); setError(""); }} className="px-4 py-2 rounded-xl text-[12px] font-semibold text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#DDE1F5]">Cancel</button>
              <button onClick={create} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[12px] font-bold">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Create
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#8B92A9]" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <Wallet className="w-8 h-8 text-[#C4C9DA] mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">No finance panel users yet</p>
            <p className="text-[12px] text-[#8B92A9] mt-0.5">Click "Add User" to create finance panel credentials.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u._id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133]">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0 text-emerald-600 font-bold text-[12px]">{(u.name || "U").charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] truncate">{u.name}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] text-[#8B92A9] truncate">{u.email}</p>
                    <button onClick={() => copy(u.email, `e-${u._id}`)} className="text-[#C4C9DA] hover:text-emerald-500 shrink-0">{copied === `e-${u._id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}</button>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${u.financeAccess ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-white/5"}`}>{u.financeAccess ? "Active" : "Suspended"}</span>
                <button onClick={() => copy(loginUrl, `url-${u._id}`)} className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 hidden sm:block">{copied === `url-${u._id}` ? "Copied!" : "Copy login URL"}</button>
                <button onClick={() => toggle(u._id)} disabled={toggling === u._id} title={u.financeAccess ? "Suspend" : "Enable"} className="text-[#8B92A9] hover:text-emerald-600 shrink-0 disabled:opacity-50">
                  {toggling === u._id ? <Loader2 className="w-5 h-5 animate-spin" /> : u.financeAccess ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => remove(u._id)} disabled={deleting === u._id} title="Remove" className="text-[#8B92A9] hover:text-rose-500 shrink-0 disabled:opacity-50">
                  {deleting === u._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-[#8B92A9]">These users can only sign in to the <strong>Finance Panel</strong> — they cannot open the main CRM. Suspend to block sign-in immediately without deleting the account.</p>
      </div>
    </div>
  );
}
