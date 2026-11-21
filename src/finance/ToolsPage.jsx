// src/finance/ToolsPage.jsx — Finance Dashboard → Tools & Services (subscriptions with renewal reminders).
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, X, Loader2, Search, AlertTriangle } from "lucide-react";
import { listTools, createTool, updateTool, deleteTool } from "./hrApi";

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-emerald-500 dark:border-[#2A3040] dark:bg-[#141925] dark:text-slate-100";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";
const btnGhost = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-[13px] font-medium hover:bg-slate-50 dark:border-[#2A3040] dark:hover:bg-[#1A2030]";
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const CYCLES = ["monthly", "quarterly", "half-yearly", "yearly", "one-time"];

function Field({ label, children }) { return <label className="block"><span className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-300">{label}</span>{children}</label>; }

function ToolForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ name: "", category: "", cost: "", billingCycle: "monthly", reason: "", description: "", projects: [], takenBy: "", usedBy: "", renewalDate: "", reminderDays: 7, note: "", ...(initial || {}), projects: Array.isArray(initial?.projects) ? initial.projects : [], renewalDate: initial?.renewalDate ? String(initial.renewalDate).slice(0, 10) : "" }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setProject = (i, k, v) => setF((p) => ({ ...p, projects: p.projects.map((pr, j) => (j === i ? { ...pr, [k]: v } : pr)) }));
  const addProject = () => setF((p) => ({ ...p, projects: [...p.projects, { name: "", note: "" }] }));
  const removeProject = (i) => setF((p) => ({ ...p, projects: p.projects.filter((_, j) => j !== i) }));
  const save = async () => {
    if (!f.name.trim()) { toast.error("Tool / service name is required."); return; }
    setBusy(true);
    try { const body = { ...f, cost: Number(f.cost) || 0, reminderDays: Number(f.reminderDays) || 0, renewalDate: f.renewalDate || null, projects: f.projects.filter((pr) => pr.name && pr.name.trim()) };
      const res = initial?._id ? await updateTool(initial._id, body) : await createTool(body);
      toast.success(initial?._id ? "Updated" : "Added"); onSaved(res.tool); onClose();
    } catch (e) { toast.error(e?.response?.data?.message || "Could not save."); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl dark:bg-[#0F141E]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-semibold">{initial?._id ? "Edit tool / service" : "New tool / service"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]"><X className="h-4 w-4" /></button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name *"><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Category"><input className={inputCls} value={f.category} onChange={(e) => set("category", e.target.value)} /></Field>
          <Field label="Cost (per cycle)"><input type="number" className={inputCls} value={f.cost} onChange={(e) => set("cost", e.target.value)} /></Field>
          <Field label="Billing cycle"><select className={inputCls} value={f.billingCycle} onChange={(e) => set("billingCycle", e.target.value)}>{CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Renewal date"><input type="date" className={inputCls} value={f.renewalDate} onChange={(e) => set("renewalDate", e.target.value)} /></Field>
          <Field label="Remind days before"><input type="number" min="0" max="90" className={inputCls} value={f.reminderDays} onChange={(e) => set("reminderDays", e.target.value)} /></Field>
          <Field label="Taken by"><input className={inputCls} value={f.takenBy} onChange={(e) => set("takenBy", e.target.value)} /></Field>
          <Field label="Used / handled by"><input className={inputCls} value={f.usedBy} onChange={(e) => set("usedBy", e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Reason for requirement"><textarea className={inputCls} rows={2} value={f.reason} onChange={(e) => set("reason", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Description (specs, details)"><textarea className={inputCls} rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. AWS prod · 4 vCPU · 8GB · Mumbai region" /></Field></div>
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">Projects hosted {f.projects.length ? `(${f.projects.length})` : ""}</span>
              <button type="button" className={btnGhost} onClick={addProject}><Plus className="h-3.5 w-3.5" />Add project</button>
            </div>
            {f.projects.map((pr, i) => (
              <div key={i} className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input className={inputCls} placeholder="Project / app name" value={pr.name} onChange={(e) => setProject(i, "name", e.target.value)} />
                <input className={inputCls} placeholder="Note (optional)" value={pr.note || ""} onChange={(e) => setProject(i, "note", e.target.value)} />
                <button type="button" className={btnGhost} onClick={() => removeProject(i)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {f.projects.length === 0 ? <p className="text-[11px] text-slate-400">No projects added. Use this for a server that hosts several apps.</p> : null}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save</button></div>
      </div>
    </div>
  );
}

export default function ToolsPage() {
  const [list, setList] = useState(null); const [q, setQ] = useState(""); const [form, setForm] = useState(null);
  const load = async () => { try { const d = await listTools(); setList(d.tools || []); } catch { setList([]); toast.error("Could not load tools."); } };
  useEffect(() => { load(); }, []);
  const shown = useMemo(() => { const n = q.trim().toLowerCase(); return (list || []).filter((t) => !n || t.name.toLowerCase().includes(n) || (t.category || "").toLowerCase().includes(n)); }, [list, q]);
  const remove = async (t) => { if (!window.confirm(`Delete ${t.name}?`)) return; try { await deleteTool(t._id); toast.success("Deleted"); load(); } catch { toast.error("Could not delete."); } };
  const dueCls = (d) => d == null ? "" : d < 0 ? "text-red-600" : d <= 7 ? "text-amber-600" : "text-slate-500";
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><input className={`${inputCls} pl-8`} placeholder="Search tools / services…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className={btnPrimary} onClick={() => setForm({})}><Plus className="h-4 w-4" />Add tool / service</button>
      </div>
      {list === null ? <div className="py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        : shown.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-[13px] text-slate-500 dark:border-[#2A3040]">No tools / services yet.</div>
        : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#1F2533]">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-left text-[12px] text-slate-500 dark:bg-[#141925]"><tr>
                <th className="px-3 py-2">Name</th><th className="px-3 py-2">Cost</th><th className="px-3 py-2">Renewal</th><th className="px-3 py-2">Projects</th><th className="px-3 py-2">Taken by</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t._id} className="border-t border-slate-100 dark:border-[#1A2030]">
                    <td className="px-3 py-2"><div className="font-semibold">{t.name}</div><div className="text-[11px] text-slate-400">{t.category || t.billingCycle}</div></td>
                    <td className="px-3 py-2">{inr(t.cost)} <span className="text-[11px] text-slate-400">/{t.billingCycle.replace("-", " ")}</span></td>
                    <td className="px-3 py-2">{fmtDate(t.renewalDate)}{t.daysToRenewal != null && <div className={`text-[11px] ${dueCls(t.daysToRenewal)}`}>{t.daysToRenewal < 0 ? `${-t.daysToRenewal}d overdue` : `in ${t.daysToRenewal}d`}{t.daysToRenewal <= 7 && <AlertTriangle className="ml-1 inline h-3 w-3" />}</div>}</td>
                    <td className="px-3 py-2">{(t.projects && t.projects.length) ? `${t.projects.length}` : "—"}</td><td className="px-3 py-2">{t.takenBy || "—"}</td>
                    <td className="px-3 py-2 max-w-[220px] truncate text-slate-500" title={t.reason}>{t.reason || "—"}</td>
                    <td className="px-3 py-2 text-right"><button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]" onClick={() => setForm(t)}><Pencil className="h-3.5 w-3.5" /></button><button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]" onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {form !== null && <ToolForm initial={form} onClose={() => setForm(null)} onSaved={() => load()} />}
    </div>
  );
}
