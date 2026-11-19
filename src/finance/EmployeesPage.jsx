// src/finance/EmployeesPage.jsx — Finance Dashboard → Employees.
// Staff records with HR info (DOB, bank), assets assigned, and tools handled. Each row can generate a salary slip.
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, X, Loader2, Search, Receipt, Laptop, Wrench } from "lucide-react";
import { listEmployees, createEmployee, updateEmployee, deleteEmployee } from "./hrApi";

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-emerald-500 dark:border-[#2A3040] dark:bg-[#141925] dark:text-slate-100";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";
const btnGhost = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-[13px] font-medium hover:bg-slate-50 dark:border-[#2A3040] dark:hover:bg-[#1A2030]";
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-300">{label}</span>{children}</label>;
}

function EmployeeForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    name: "", employeeCode: "", designation: "", department: "", email: "", phone: "",
    dob: "", dateOfJoining: "", bankName: "", bankAcNo: "",
    assets: [], tools: [], ...(initial || {}),
    dob: initial?.dob ? String(initial.dob).slice(0, 10) : "",
    dateOfJoining: initial?.dateOfJoining ? String(initial.dateOfJoining).slice(0, 10) : "",
  }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setAsset = (i, k, v) => setF((p) => ({ ...p, assets: p.assets.map((a, j) => (j === i ? { ...a, [k]: v } : a)) }));
  const setTool = (i, k, v) => setF((p) => ({ ...p, tools: p.tools.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));

  const save = async () => {
    if (!f.name.trim()) { toast.error("Employee name is required."); return; }
    setBusy(true);
    try {
      const body = { ...f, dob: f.dob || null, dateOfJoining: f.dateOfJoining || null,
        assets: f.assets.filter((a) => a.name && a.name.trim()), tools: f.tools.filter((t) => t.name && t.name.trim()) };
      const res = initial?._id ? await updateEmployee(initial._id, body) : await createEmployee(body);
      toast.success(initial?._id ? "Employee updated" : "Employee added");
      onSaved(res.employee); onClose();
    } catch (e) { toast.error(e?.response?.data?.message || "Could not save."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl dark:bg-[#0F141E]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">{initial?._id ? "Edit employee" : "New employee"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name *"><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Employee code"><input className={inputCls} value={f.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} /></Field>
          <Field label="Designation"><input className={inputCls} value={f.designation} onChange={(e) => set("designation", e.target.value)} /></Field>
          <Field label="Department"><input className={inputCls} value={f.department} onChange={(e) => set("department", e.target.value)} /></Field>
          <Field label="Email"><input type="email" className={inputCls} value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Phone"><input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Date of birth"><input type="date" className={inputCls} value={f.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
          <Field label="Date of joining"><input type="date" className={inputCls} value={f.dateOfJoining} onChange={(e) => set("dateOfJoining", e.target.value)} /></Field>
          <Field label="Bank name"><input className={inputCls} value={f.bankName} onChange={(e) => set("bankName", e.target.value)} /></Field>
          <Field label="Bank A/C no."><input className={inputCls} value={f.bankAcNo} onChange={(e) => set("bankAcNo", e.target.value)} /></Field>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between"><span className="flex items-center gap-1.5 text-[13px] font-semibold"><Laptop className="h-4 w-4" />Assets assigned</span>
            <button className={btnGhost} onClick={() => set("assets", [...f.assets, { name: "", identifier: "", assignedOn: "" }])}><Plus className="h-3.5 w-3.5" />Add asset</button></div>
          {f.assets.map((a, i) => (
            <div key={i} className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
              <input className={inputCls} placeholder="Asset (e.g. Dell laptop)" value={a.name} onChange={(e) => setAsset(i, "name", e.target.value)} />
              <input className={inputCls} placeholder="Serial / ID" value={a.identifier || ""} onChange={(e) => setAsset(i, "identifier", e.target.value)} />
              <input type="date" className={inputCls} value={a.assignedOn ? String(a.assignedOn).slice(0, 10) : ""} onChange={(e) => setAsset(i, "assignedOn", e.target.value)} />
              <button className={btnGhost} onClick={() => set("assets", f.assets.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between"><span className="flex items-center gap-1.5 text-[13px] font-semibold"><Wrench className="h-4 w-4" />Tools handled</span>
            <button className={btnGhost} onClick={() => set("tools", [...f.tools, { name: "", role: "" }])}><Plus className="h-3.5 w-3.5" />Add tool</button></div>
          {f.tools.map((t, i) => (
            <div key={i} className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input className={inputCls} placeholder="Tool / software" value={t.name} onChange={(e) => setTool(i, "name", e.target.value)} />
              <input className={inputCls} placeholder="Role (e.g. admin, editor)" value={t.role || ""} onChange={(e) => setTool(i, "role", e.target.value)} />
              <button className={btnGhost} onClick={() => set("tools", f.tools.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save employee</button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage({ onGenerateSalary }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);   // null | {} (new) | employee (edit)

  const load = async () => { try { const d = await listEmployees(); setList(d.employees || []); } catch { setList([]); toast.error("Could not load employees."); } };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (list || []).filter((e) => !n || e.name.toLowerCase().includes(n) || (e.designation || "").toLowerCase().includes(n) || (e.department || "").toLowerCase().includes(n));
  }, [list, q]);

  const remove = async (e) => {
    if (!window.confirm(`Delete ${e.name}?`)) return;
    try { const r = await deleteEmployee(e._id); toast.success(r.deactivated ? "Marked inactive (has salary slips)" : "Deleted"); load(); }
    catch (err) { toast.error(err?.response?.data?.message || "Could not delete."); }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} pl-8`} placeholder="Search employees…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className={btnPrimary} onClick={() => setForm({})}><Plus className="h-4 w-4" />Add employee</button>
      </div>

      {list === null ? <div className="py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        : shown.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-[13px] text-slate-500 dark:border-[#2A3040]">No employees yet. Add your first one.</div>
        : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((e) => (
              <div key={e._id} className={`rounded-xl border p-3.5 ${e.active === false ? "opacity-60" : ""} border-slate-200 bg-white dark:border-[#1F2533] dark:bg-[#0F141E]`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">{e.name}{e.active === false ? " (inactive)" : ""}</p>
                    <p className="truncate text-[12px] text-slate-500">{[e.designation, e.department].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="flex gap-1">
                    <button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]" title="Edit" onClick={() => setForm(e)}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]" title="Delete" onClick={() => remove(e)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <div className="flex justify-between"><dt className="text-slate-400">DOB</dt><dd>{fmtDate(e.dob)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Joined</dt><dd>{fmtDate(e.dateOfJoining)}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Assets</dt><dd>{(e.assets || []).length}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-400">Tools</dt><dd>{(e.tools || []).length}</dd></div>
                </dl>
                <div className="mt-3 flex gap-2">
                  <button className={`${btnGhost} flex-1`} onClick={() => setForm(e)}>Details</button>
                  <button className={`${btnPrimary} flex-1`} onClick={() => onGenerateSalary?.(e)}><Receipt className="h-3.5 w-3.5" />Salary slip</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {form !== null && <EmployeeForm initial={form} onClose={() => setForm(null)} onSaved={() => load()} />}
    </div>
  );
}
