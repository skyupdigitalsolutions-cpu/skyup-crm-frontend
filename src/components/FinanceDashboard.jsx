// src/components/FinanceDashboard.jsx — NEW FILE
// ─────────────────────────────────────────────────────────────────────────────
// Finance Dashboard: converted leads → invoices, part-payments, payment
// follow-ups and remarks. Used in two places:
//   • Admin / super admin page   → <FinanceDashboard />                (/api/finance)
//   • Developer → company tab    → <FinanceDashboard basePath=… />     (per company)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";
import toast from "react-hot-toast";
import {
  Search, Plus, X, Loader2, IndianRupee, CalendarClock, AlertTriangle, CheckCircle2,
  Wallet, FileText, Trash2, Pencil, Settings as SettingsIcon, RefreshCw, Ban, RotateCcw, ChevronLeft, ChevronRight,
} from "lucide-react";
import defaultApi from "../data/axiosConfig";

import { inr, fmtDay, fmtDateTime, toInputDay, todayInput, errMsg } from "../utils/financeFormat";

// The Finance Panel signs in separately from the CRM, so it passes its own axios
// client; the Developer → Company → Finance tab uses the normal CRM session.
const ApiCtx = createContext(defaultApi);

const METHODS = ["Cash", "UPI", "Bank transfer", "Cheque", "Card", "Other"];

const inputCls = "w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#0F1117] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] outline-none focus:border-blue-500";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition";
const btnGhost = "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5163] dark:text-[#B5BAD3] hover:bg-[#F6F7FB] dark:hover:bg-[#1E2130] transition";

export function StatusBadge({ inv }) {
  let label, cls;
  if (inv.status === "cancelled") { label = "Cancelled"; cls = "bg-gray-100 text-gray-600 dark:bg-[#262A38] dark:text-[#9DA3BB]"; }
  else if (inv.paymentStatus === "paid") { label = "Paid"; cls = "bg-[#ECFDF5] text-[#065F46] dark:bg-[#052E1C] dark:text-[#34D399]"; }
  else if (inv.isOverdue) { label = "Overdue"; cls = "bg-[#FEF2F2] text-[#991B1B] dark:bg-[#2D0A0A] dark:text-[#F87171]"; }
  else if (inv.paymentStatus === "partial") { label = "Partial"; cls = "bg-[#FFFBEB] text-[#92400E] dark:bg-[#2D1F00] dark:text-[#FCD34D]"; }
  else { label = "Unpaid"; cls = "bg-[#EEF3FF] text-[#1D4ED8] dark:bg-[#1A2540] dark:text-[#4F8EF7]"; }
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{label}</span>;
}

export function FollowUpCell({ inv }) {
  if (!inv.followUpDay) return <span className="text-[#9DA3BB]">—</span>;
  const cls = inv.isOverdue ? "text-red-600 dark:text-red-400 font-semibold" : inv.isDueToday ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-[#0F1117] dark:text-[#F0F2FA]";
  return <span className={cls}>{fmtDay(inv.nextFollowUpDate)}{inv.isOverdue ? " · overdue" : inv.isDueToday ? " · today" : ""}</span>;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white dark:bg-[#1A1D27] rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto border border-[#E4E7EF] dark:border-[#262A38]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] sticky top-0 bg-white dark:bg-[#1A1D27] z-10">
          <h3 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#262A38]"><X className="w-4 h-4 text-[#8B92A9]" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#8B92A9] mb-1 uppercase tracking-wide">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-[#9DA3BB] mt-1">{hint}</span>}
  </label>
);

function StatCard({ label, value, sub, icon: Icon, tone }) {
  const tones = { blue: "bg-blue-600", green: "bg-emerald-600", amber: "bg-amber-500", red: "bg-red-600" };
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${tones[tone] || tones.blue}`}><Icon className="w-3.5 h-3.5" /></span>
      </div>
      <div className="text-[22px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-[#8B92A9] mt-1">{sub}</div>}
    </div>
  );
}

// ── Assignee select (shared) ─────────────────────────────────────────────────
function AssigneeSelect({ value, onChange, assignees }) {
  return (
    <select className={inputCls} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Not assigned —</option>
      {assignees.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
    </select>
  );
}

// ── Create invoice ───────────────────────────────────────────────────────────
function CreateInvoiceModal({ base, assignees, onClose, onCreated }) {
  const api = useContext(ApiCtx);
  const [f, setF] = useState({
    customerName: "", businessName: "", service: "", description: "", totalAmount: "", installmentsPlanned: "",
    conversionDate: todayInput(), invoiceNumber: "", assignedTo: "", nextFollowUpDate: "", remark: "",
    payNow: "", payMethod: "UPI",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        customerName: f.customerName, businessName: f.businessName, service: f.service, description: f.description,
        totalAmount: Number(f.totalAmount), conversionDate: f.conversionDate,
        invoiceNumber: f.invoiceNumber || undefined, assignedTo: f.assignedTo || undefined,
        installmentsPlanned: f.installmentsPlanned || undefined,
        nextFollowUpDate: f.nextFollowUpDate || undefined, remark: f.remark || undefined,
      };
      if (Number(f.payNow) > 0) body.initialPayment = { amount: Number(f.payNow), method: f.payMethod };
      const { data } = await api.post(base, body);
      toast.success(`Invoice ${data.invoice.invoiceNumber} created`);
      onCreated(data.invoice);
    } catch (err) { toast.error(errMsg(err, "Could not create invoice")); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="New invoice" onClose={onClose} wide>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Customer name *"><input required className={inputCls} value={f.customerName} onChange={set("customerName")} /></Field>
        <Field label="Business name"><input className={inputCls} value={f.businessName} onChange={set("businessName")} /></Field>
        <Field label="Service / product"><input className={inputCls} value={f.service} onChange={set("service")} /></Field>
        <Field label="Invoice number" hint="Leave blank to auto-generate"><input className={inputCls} value={f.invoiceNumber} onChange={set("invoiceNumber")} placeholder="Auto" /></Field>
        <Field label="Total amount (₹) *"><input required type="number" min="1" step="0.01" className={inputCls} value={f.totalAmount} onChange={set("totalAmount")} /></Field>
        <Field label="Planned installments" hint="Optional, e.g. 4 → shows “1 of 4 paid”"><input type="number" min="1" max="120" className={inputCls} value={f.installmentsPlanned} onChange={set("installmentsPlanned")} /></Field>
        <Field label="Date of conversion"><input type="date" className={inputCls} value={f.conversionDate} onChange={set("conversionDate")} /></Field>
        <Field label="Follow-up owner"><AssigneeSelect assignees={assignees} value={f.assignedTo} onChange={(v) => setF((p) => ({ ...p, assignedTo: v }))} /></Field>
        <Field label="Amount received now (₹)" hint="Optional first payment"><input type="number" min="0" step="0.01" className={inputCls} value={f.payNow} onChange={set("payNow")} /></Field>
        <Field label="Payment method">
          <select className={inputCls} value={f.payMethod} onChange={set("payMethod")}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
        </Field>
        <Field label="Next follow-up date"><input type="date" min={todayInput()} className={inputCls} value={f.nextFollowUpDate} onChange={set("nextFollowUpDate")} /></Field>
        <Field label="Remark"><input className={inputCls} value={f.remark} onChange={set("remark")} /></Field>
        <div className="sm:col-span-2"><Field label="Description"><textarea rows={2} className={inputCls} value={f.description} onChange={set("description")} /></Field></div>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={busy} className={btnPrimary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Create invoice</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Invoice detail drawer ────────────────────────────────────────────────────
function InvoiceDrawer({ id, base, assignees, onClose, onChanged }) {
  const api = useContext(ApiCtx);
  const [inv, setInv] = useState(null);
  const [busy, setBusy] = useState("");
  const [edit, setEdit] = useState(null);                 // null | draft object
  const [pay, setPay] = useState({ amount: "", paidOn: todayInput(), method: "UPI", reference: "", next: "" });
  const [fu, setFu] = useState({ date: "", remark: "" });
  const [remark, setRemark] = useState("");

  const load = useCallback(async () => {
    try { const { data } = await api.get(`${base}/${id}`); setInv(data.invoice); setFu({ date: toInputDay(data.invoice.nextFollowUpDate), remark: "" }); }
    catch (e) { toast.error(errMsg(e, "Could not load invoice")); onClose(); }
  }, [api, base, id, onClose]);
  useEffect(() => { load(); }, [load]);

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try { const { data } = await fn(); setInv(data.invoice); setFu({ date: toInputDay(data.invoice.nextFollowUpDate), remark: "" }); onChanged(); if (okMsg) toast.success(okMsg); return true; }
    catch (e) { toast.error(errMsg(e)); return false; }
    finally { setBusy(""); }
  };

  if (!inv) return <Modal title="Invoice" onClose={onClose} wide><div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div></Modal>;

  const cancelled = inv.status === "cancelled";
  const paid = inv.paymentStatus === "paid";
  const progress = inv.totalAmount > 0 ? Math.min(100, Math.round((inv.paidAmount / inv.totalAmount) * 100)) : 0;

  const addPayment = async (e) => {
    e.preventDefault();
    const body = { amount: Number(pay.amount), paidOn: pay.paidOn, method: pay.method, reference: pay.reference };
    if (pay.next) body.nextFollowUpDate = pay.next;
    const ok = await run("pay", () => api.post(`${base}/${id}/payments`, body), "Payment recorded");
    if (ok) setPay({ amount: "", paidOn: todayInput(), method: "UPI", reference: "", next: "" });
  };
  const saveEdit = async (e) => {
    e.preventDefault();
    const ok = await run("edit", () => api.put(`${base}/${id}`, {
      customerName: edit.customerName, businessName: edit.businessName, service: edit.service,
      invoiceNumber: edit.invoiceNumber, totalAmount: Number(edit.totalAmount),
      installmentsPlanned: edit.installmentsPlanned === "" ? null : Number(edit.installmentsPlanned),
      conversionDate: edit.conversionDate, assignedTo: edit.assignedTo || null,
    }), "Invoice updated");
    if (ok) setEdit(null);
  };

  return (
    <Modal title={`Invoice ${inv.invoiceNumber}`} onClose={onClose} wide>
      <div className="space-y-5">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{inv.customerName}</p>
            <p className="text-[12px] text-[#8B92A9]">{[inv.businessName, inv.service].filter(Boolean).join(" · ") || "—"}</p>
            <p className="text-[12px] text-[#8B92A9] mt-0.5">Converted {fmtDay(inv.conversionDate)} · {inv.source === "lead" ? "from lead" : "manual"} · Follow-up: {inv.assignedToName || "unassigned"}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge inv={inv} />
            <button className={btnGhost} onClick={() => setEdit({ ...inv, conversionDate: toInputDay(inv.conversionDate), installmentsPlanned: inv.installmentsPlanned || "", assignedTo: inv.assignedTo || "" })}><Pencil className="w-3.5 h-3.5" />Edit</button>
          </div>
        </div>

        {/* money */}
        <div className="rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-[11px] text-[#8B92A9] uppercase font-semibold">Total</p><p className="text-[16px] font-bold">{inr(inv.totalAmount)}</p></div>
            <div><p className="text-[11px] text-[#8B92A9] uppercase font-semibold">Paid</p><p className="text-[16px] font-bold text-emerald-600">{inr(inv.paidAmount)}</p></div>
            <div><p className="text-[11px] text-[#8B92A9] uppercase font-semibold">Balance</p><p className="text-[16px] font-bold text-red-600">{inr(inv.balance)}</p></div>
          </div>
          <div className="h-2 rounded-full bg-[#F0F2FA] dark:bg-[#262A38] mt-3 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
          <p className="text-[12px] text-[#8B92A9] mt-2 text-center">
            {inv.partsPaid} payment{inv.partsPaid === 1 ? "" : "s"} made{inv.installmentsPlanned ? ` of ${inv.installmentsPlanned} planned` : ""}
          </p>
          {inv.totalAmount === 0 && !cancelled && <p className="text-[12px] text-amber-600 mt-2 text-center">Total amount isn't set yet — click Edit to add it before recording payments.</p>}
        </div>

        {/* payments */}
        <section>
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#6B7280] mb-2">Payments</h4>
          {inv.payments.length === 0 ? <p className="text-[12px] text-[#9DA3BB]">No payments recorded yet.</p> : (
            <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
              {inv.payments.map((p) => (
                <div key={p._id} className="px-3 py-2 flex items-center justify-between gap-2 text-[13px]">
                  <div>
                    <span className="font-semibold">{inr(p.amount)}</span>
                    <span className="text-[#8B92A9]"> · {fmtDay(p.paidOn)}{p.method ? ` · ${p.method}` : ""}{p.reference ? ` · ${p.reference}` : ""}</span>
                  </div>
                  <button title="Remove payment" className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => { if (window.confirm(`Remove this ${inr(p.amount)} payment?`)) run("del", () => api.delete(`${base}/${id}/payments/${p._id}`), "Payment removed"); }}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {!cancelled && !paid && inv.totalAmount > 0 && (
            <form onSubmit={addPayment} className="mt-3 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
              <div className="sm:col-span-2"><Field label="Amount received (₹)"><input required type="number" min="0.01" step="0.01" max={inv.balance} className={inputCls} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder={`up to ${inv.balance}`} /></Field></div>
              <div className="sm:col-span-2"><Field label="Date"><input type="date" className={inputCls} value={pay.paidOn} onChange={(e) => setPay({ ...pay, paidOn: e.target.value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Method"><select className={inputCls} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field></div>
              <div className="sm:col-span-2"><Field label="Reference"><input className={inputCls} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="Txn / cheque no." /></Field></div>
              <div className="sm:col-span-2"><Field label="Next follow-up"><input type="date" min={todayInput()} className={inputCls} value={pay.next} onChange={(e) => setPay({ ...pay, next: e.target.value })} /></Field></div>
              <div className="sm:col-span-2"><button disabled={busy === "pay"} className={`${btnPrimary} w-full`}>{busy === "pay" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Add payment</button></div>
            </form>
          )}
        </section>

        {/* follow-up */}
        {!cancelled && !paid && (
          <section>
            <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#6B7280] mb-2">Payment follow-up</h4>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
              <div className="sm:col-span-2"><Field label="Follow-up date"><input type="date" className={inputCls} value={fu.date} onChange={(e) => setFu({ ...fu, date: e.target.value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Note (optional)"><input className={inputCls} value={fu.remark} onChange={(e) => setFu({ ...fu, remark: e.target.value })} placeholder="e.g. client will pay after the 15th" /></Field></div>
              <button disabled={busy === "fu"} className={btnPrimary} onClick={() => run("fu", () => api.put(`${base}/${id}/followup`, { nextFollowUpDate: fu.date || null, remark: fu.remark }), "Follow-up saved")}>
                {busy === "fu" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}Save
              </button>
            </div>
            <p className="text-[11px] text-[#9DA3BB] mt-1">{inv.assignedToName ? `${inv.assignedToName} gets a reminder at 9:30 AM on this date.` : "No employee assigned — the reminder goes to the admin. Assign one via Edit."}</p>
          </section>
        )}

        {/* remarks */}
        <section>
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#6B7280] mb-2">Remarks & history</h4>
          <form className="flex gap-2 mb-3" onSubmit={async (e) => { e.preventDefault(); if (!remark.trim()) return; if (await run("rm", () => api.post(`${base}/${id}/remarks`, { text: remark }))) setRemark(""); }}>
            <input className={inputCls} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Add a remark…" maxLength={1000} />
            <button disabled={busy === "rm"} className={btnPrimary}>Add</button>
          </form>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {inv.remarks.map((r) => (
              <div key={r._id} className={`rounded-xl px-3 py-2 text-[12.5px] ${r.kind === "system" ? "bg-[#F6F7FB] dark:bg-[#12141C] text-[#6B7280]" : r.kind === "followup" ? "bg-amber-50 dark:bg-[#2D1F00] text-[#92400E] dark:text-[#FCD34D]" : "bg-blue-50 dark:bg-[#1A2540] text-[#0F1117] dark:text-[#DDE1F5]"}`}>
                <p>{r.text}</p>
                <p className="text-[10.5px] opacity-70 mt-0.5">{r.byName || "—"} · {fmtDateTime(r.at)}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          {cancelled
            ? <button className={btnGhost} onClick={() => run("re", () => api.post(`${base}/${id}/reopen`), "Invoice reopened")}><RotateCcw className="w-3.5 h-3.5" />Reopen invoice</button>
            : <button className={`${btnGhost} text-red-600`} onClick={() => { const reason = window.prompt("Reason for cancelling this invoice? (optional)"); if (reason !== null) run("cx", () => api.post(`${base}/${id}/cancel`, { reason }), "Invoice cancelled"); }}><Ban className="w-3.5 h-3.5" />Cancel invoice</button>}
        </div>
      </div>

      {edit && (
        <Modal title="Edit invoice" onClose={() => setEdit(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            <Field label="Invoice number"><input required className={inputCls} value={edit.invoiceNumber} onChange={(e) => setEdit({ ...edit, invoiceNumber: e.target.value })} /></Field>
            <Field label="Customer name"><input required className={inputCls} value={edit.customerName} onChange={(e) => setEdit({ ...edit, customerName: e.target.value })} /></Field>
            <Field label="Business name"><input className={inputCls} value={edit.businessName || ""} onChange={(e) => setEdit({ ...edit, businessName: e.target.value })} /></Field>
            <Field label="Service"><input className={inputCls} value={edit.service || ""} onChange={(e) => setEdit({ ...edit, service: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total amount (₹)" hint={inv.paidAmount ? `Can't be below ${inr(inv.paidAmount)} paid` : ""}><input required type="number" min="0" step="0.01" className={inputCls} value={edit.totalAmount} onChange={(e) => setEdit({ ...edit, totalAmount: e.target.value })} /></Field>
              <Field label="Planned installments"><input type="number" min="1" max="120" className={inputCls} value={edit.installmentsPlanned} onChange={(e) => setEdit({ ...edit, installmentsPlanned: e.target.value })} /></Field>
            </div>
            <Field label="Date of conversion"><input type="date" className={inputCls} value={edit.conversionDate} onChange={(e) => setEdit({ ...edit, conversionDate: e.target.value })} /></Field>
            <Field label="Follow-up owner"><AssigneeSelect assignees={assignees} value={edit.assignedTo} onChange={(v) => setEdit({ ...edit, assignedTo: v })} /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={btnGhost} onClick={() => setEdit(null)}>Cancel</button>
              <button disabled={busy === "edit"} className={btnPrimary}>{busy === "edit" && <Loader2 className="w-4 h-4 animate-spin" />}Save changes</button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
}

// ── Settings (invoice prefix) ────────────────────────────────────────────────
function SettingsModal({ base, onClose }) {
  const api = useContext(ApiCtx);
  const [prefix, setPrefix] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`${base}/settings`).then(({ data }) => setPrefix(data.settings.invoicePrefix)).catch(() => {}); }, [api, base]);
  return (
    <Modal title="Finance settings" onClose={onClose}>
      <Field label="Invoice number prefix" hint="New invoices are numbered PREFIX-0001, PREFIX-0002… Existing invoice numbers don't change.">
        <input className={inputCls} value={prefix} maxLength={10} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <button className={btnGhost} onClick={onClose}>Close</button>
        <button disabled={busy} className={btnPrimary} onClick={async () => { setBusy(true); try { await api.put(`${base}/settings`, { invoicePrefix: prefix }); toast.success("Saved"); onClose(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } }}>Save</button>
      </div>
    </Modal>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
const STATUS_TABS = [
  ["all", "All"], ["pending", "Pending"], ["partial", "Partial"], ["paid", "Paid"],
  ["overdue", "Overdue"], ["due_today", "Due today"], ["cancelled", "Cancelled"],
];

export default function FinanceDashboard({ basePath = "/finance", embedded = false, client = null }) {
  const api = client || defaultApi;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ status: "all", assignedTo: "", source: "", from: "", to: "", sort: "conversion_desc", page: 1 });
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState(false);

  // debounce search
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => { setDq(q); setF((p) => ({ ...p, page: 1 })); }, 350); return () => clearTimeout(t); }, [q]);

  const params = useMemo(() => {
    const p = { limit: 25, page: f.page, sort: f.sort, status: f.status };
    if (dq) p.q = dq; if (f.assignedTo) p.assignedTo = f.assignedTo; if (f.source) p.source = f.source;
    if (f.from) p.from = f.from; if (f.to) p.to = f.to;
    return p;
  }, [f, dq]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const { data: d } = await api.get(basePath, { params }); setData(d); }
    catch (e) { setError(errMsg(e, "Could not load the Finance Dashboard")); }
    finally { setLoading(false); }
  }, [api, basePath, params]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get(`${basePath}/assignees`).then(({ data: d }) => setAssignees(d.assignees || [])).catch(() => {}); }, [api, basePath]);

  const s = data?.summary;
  const setFilter = (k, v) => setF((p) => ({ ...p, [k]: v, page: 1 }));

  if (error && !data) {
    return <div className="p-8 text-center"><AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" /><p className="text-[14px] text-[#0F1117] dark:text-[#F0F2FA] font-semibold">{error}</p><button className={`${btnGhost} mt-4`} onClick={load}><RefreshCw className="w-3.5 h-3.5" />Try again</button></div>;
  }

  return (
    <ApiCtx.Provider value={api}>
    <div className={embedded ? "space-y-4" : "p-4 sm:p-6 space-y-4 max-w-[1400px] mx-auto"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] flex items-center gap-2"><Wallet className="w-5 h-5 text-blue-600" />Finance Dashboard</h1>
          <p className="text-[12px] text-[#8B92A9]">Converted leads, invoices, part-payments and payment follow-ups.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={btnGhost} onClick={load} title="Refresh"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></button>
          <button className={btnGhost} onClick={() => setSettings(true)}><SettingsIcon className="w-3.5 h-3.5" />Settings</button>
          <button className={btnPrimary} onClick={() => setCreating(true)}><Plus className="w-4 h-4" />New invoice</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Invoiced" value={inr(s?.invoiced)} sub={`${s?.count ?? 0} invoices${s?.needsAmount ? ` · ${s.needsAmount} need an amount` : ""}`} icon={FileText} tone="blue" />
        <StatCard label="Collected" value={inr(s?.collected)} sub={`${s?.paid ?? 0} fully paid · ${s?.partial ?? 0} partial`} icon={CheckCircle2} tone="green" />
        <StatCard label="Outstanding" value={inr(s?.outstanding)} sub={`${s?.unpaid ?? 0} unpaid`} icon={IndianRupee} tone="amber" />
        <StatCard label="Follow-ups" value={`${s?.dueToday ?? 0} today`} sub={`${s?.overdue ?? 0} overdue`} icon={CalendarClock} tone="red" />
      </div>

      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl">
        <div className="p-3 border-b border-[#E4E7EF] dark:border-[#262A38] space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map(([k, label]) => (
              <button key={k} onClick={() => setFilter("status", k)} className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition ${f.status === k ? "bg-blue-600 text-white" : "bg-[#F0F2FA] dark:bg-[#262A38] text-[#4B5163] dark:text-[#B5BAD3] hover:bg-[#E4E7EF]"}`}>
                {label}{k === "overdue" && s?.overdue ? ` (${s.overdue})` : k === "due_today" && s?.dueToday ? ` (${s.dueToday})` : ""}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
            <div className="relative col-span-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9DA3BB]" />
              <input className={`${inputCls} pl-8`} placeholder="Search invoice #, customer, business…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className={inputCls} value={f.assignedTo} onChange={(e) => setFilter("assignedTo", e.target.value)}>
              <option value="">All employees</option><option value="none">Unassigned</option>
              {assignees.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
            <select className={inputCls} value={f.source} onChange={(e) => setFilter("source", e.target.value)}>
              <option value="">All sources</option><option value="lead">From leads</option><option value="manual">Manual</option>
            </select>
            <input type="date" className={inputCls} value={f.from} onChange={(e) => setFilter("from", e.target.value)} title="Converted from" />
            <input type="date" className={inputCls} value={f.to} onChange={(e) => setFilter("to", e.target.value)} title="Converted to" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[980px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[#8B92A9] border-b border-[#E4E7EF] dark:border-[#262A38]">
                {["Invoice #", "Lead / customer", "Converted", "Total", "Paid", "Balance", "Status", "Next follow-up", "Owner"].map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
              {loading && !data && <tr><td colSpan={9} className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-blue-600 inline" /></td></tr>}
              {data && data.invoices.length === 0 && <tr><td colSpan={9} className="py-12 text-center text-[#8B92A9]">No invoices match. Leads appear here automatically once they reach a converted status.</td></tr>}
              {data?.invoices.map((inv) => (
                <tr key={inv._id} onClick={() => setOpenId(inv._id)} className="cursor-pointer hover:bg-[#F6F7FB] dark:hover:bg-[#1E2130] transition">
                  <td className="px-4 py-3 font-semibold text-blue-600 whitespace-nowrap">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3"><div className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{inv.customerName}</div><div className="text-[11px] text-[#8B92A9]">{inv.businessName || (inv.source === "manual" ? "Manual" : "")}</div></td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDay(inv.conversionDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{inv.totalAmount > 0 ? inr(inv.totalAmount) : <span className="text-amber-600 text-[12px]">Set amount</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><div>{inr(inv.paidAmount)}</div><div className="text-[11px] text-[#8B92A9]">{inv.partsPaid} part{inv.partsPaid === 1 ? "" : "s"}{inv.installmentsPlanned ? ` of ${inv.installmentsPlanned}` : ""}</div></td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold">{inr(inv.balance)}</td>
                  <td className="px-4 py-3"><StatusBadge inv={inv} /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><FollowUpCell inv={inv} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-[#4B5163] dark:text-[#B5BAD3]">{inv.assignedToName || <span className="text-[#9DA3BB]">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] text-[12px] text-[#8B92A9]">
            <span>{data.total} invoices · page {data.page} of {data.pages}</span>
            <div className="flex gap-2">
              <button className={btnGhost} disabled={f.page <= 1} onClick={() => setF((p) => ({ ...p, page: p.page - 1 }))}><ChevronLeft className="w-3.5 h-3.5" />Prev</button>
              <button className={btnGhost} disabled={f.page >= data.pages} onClick={() => setF((p) => ({ ...p, page: p.page + 1 }))}>Next<ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {openId && <InvoiceDrawer id={openId} base={basePath} assignees={assignees} onClose={() => setOpenId(null)} onChanged={load} />}
      {creating && <CreateInvoiceModal base={basePath} assignees={assignees} onClose={() => setCreating(false)} onCreated={(inv) => { setCreating(false); load(); setOpenId(inv._id); }} />}
      {settings && <SettingsModal base={basePath} onClose={() => setSettings(false)} />}
    </div>
    </ApiCtx.Provider>
  );
}
