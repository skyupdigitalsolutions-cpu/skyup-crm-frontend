// src/components/FinanceDashboard.jsx — NEW FILE
// ─────────────────────────────────────────────────────────────────────────────
// Finance Dashboard: converted leads → invoices, services, part-payments,
// payment follow-ups and remarks. Used in two places:
//   • Finance Panel (/finance)           → <FinanceDashboard client={financeApi} basePath="" />
//   • Developer → company → Finance tab  → <FinanceDashboard basePath=… />   (CRM session)
//
// Rules this screen follows:
//   • Invoice numbers are ALWAYS typed in by hand — never generated.
//   • One invoice can carry several services (total = sum of the services).
//   • A client can have many invoices: "Add new service" starts a fresh invoice
//     (own number, amount and payment history) for the same client.
//   • Every client has a source; a "Referral" source asks who referred them.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";
import toast from "react-hot-toast";
import {
  Search, Plus, X, Loader2, IndianRupee, CalendarClock, AlertTriangle, CheckCircle2,
  Wallet, FileText, Trash2, Pencil, RefreshCw, Ban, RotateCcw, ChevronLeft, ChevronRight, UserPlus, Users, Hash,
} from "lucide-react";
import defaultApi from "../data/axiosConfig";
import { inr, fmtDay, fmtDateTime, toInputDay, todayInput, errMsg } from "../utils/financeFormat";

// The Finance Panel signs in separately from the CRM, so it passes its own axios
// client; the Developer → Company → Finance tab uses the normal CRM session.
const ApiCtx = createContext(defaultApi);

const METHODS = ["Cash", "UPI", "Bank transfer", "Cheque", "Card", "Other"];
const isReferral = (s) => /refer/i.test(s || "");

const inputCls = "w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#0F1117] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] outline-none focus:border-blue-500";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition";
const btnGhost = "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5163] dark:text-[#B5BAD3] hover:bg-[#F6F7FB] dark:hover:bg-[#1E2130] transition disabled:opacity-50";

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

function AssigneeSelect({ value, onChange, assignees }) {
  return (
    <select className={inputCls} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Not assigned —</option>
      {assignees.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
    </select>
  );
}

// ── Several services on one invoice ──────────────────────────────────────────
function ServicesEditor({ rows, setRows, options }) {
  const total = rows.reduce((t, r) => t + (Number(r.amount) || 0), 0);
  const update = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div>
      <datalist id="fin-service-options">{options.map((o) => <option key={o} value={o} />)}</datalist>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 mb-2">
          <input list="fin-service-options" className={`${inputCls} col-span-7`} placeholder="Service (e.g. SEO)" value={r.name} onChange={(e) => update(i, "name", e.target.value)} />
          <input type="number" min="0" step="0.01" className={`${inputCls} col-span-4`} placeholder="Amount ₹" value={r.amount} onChange={(e) => update(i, "amount", e.target.value)} />
          <button type="button" disabled={rows.length === 1} title="Remove service" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="col-span-1 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setRows([...rows, { name: "", amount: "" }])} className="text-[12px] font-semibold text-blue-600 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add another service</button>
        <span className="text-[12px] text-[#6B7280]">Invoice total: <strong className="text-[#0F1117] dark:text-[#F0F2FA]">{inr(total)}</strong></span>
      </div>
    </div>
  );
}

// ── Where the client came from (+ who referred them) ─────────────────────────
function SourceFields({ source, referredBy, onChange, sources }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Client source *">
        <select className={inputCls} value={source} onChange={(e) => onChange({ clientSource: e.target.value, referredBy: isReferral(e.target.value) ? referredBy : "" })}>
          <option value="">— Select source —</option>
          {source && !sources.includes(source) && <option value={source}>{source}</option>}
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      {isReferral(source) && (
        <Field label="Referred by *" hint="Name of the person / company who referred this client">
          <input className={inputCls} value={referredBy} onChange={(e) => onChange({ clientSource: source, referredBy: e.target.value })} placeholder="e.g. Ravi Kumar" />
        </Field>
      )}
    </div>
  );
}

// ── Create invoice (new client, or a new service for an existing client) ─────
function CreateInvoiceModal({ base, assignees, meta, initialClient, onClose, onCreated }) {
  const api = useContext(ApiCtx);
  const [mode, setMode] = useState(initialClient ? "existing" : "new");
  const [client, setClient] = useState(initialClient || null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [f, setF] = useState({
    customerName: "", businessName: "", clientSource: "", referredBy: "", invoiceNumber: "", installmentsPlanned: "",
    conversionDate: todayInput(), assignedTo: "", nextFollowUpDate: "", remark: "", description: "", payNow: "", payMethod: "UPI",
  });
  const [rows, setRows] = useState([{ name: "", amount: "" }]);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  // existing-client search
  useEffect(() => {
    if (mode !== "existing" || client) return undefined;
    setSearching(true);
    const t = setTimeout(async () => {
      try { const { data } = await api.get(`${base}/clients`, { params: { q } }); setResults(data.clients || []); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [api, base, mode, client, q]);

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "existing" && !client) { toast.error("Select the client first."); return; }
    setBusy(true);
    try {
      const body = {
        invoiceNumber: f.invoiceNumber,
        services: rows.map((r) => ({ name: r.name, amount: Number(r.amount) })),
        conversionDate: f.conversionDate, description: f.description,
        installmentsPlanned: f.installmentsPlanned || undefined,
        assignedTo: f.assignedTo || undefined,
        nextFollowUpDate: f.nextFollowUpDate || undefined, remark: f.remark || undefined,
      };
      if (mode === "existing") body.clientId = client.clientId;
      else Object.assign(body, { customerName: f.customerName, businessName: f.businessName, clientSource: f.clientSource, referredBy: f.referredBy });
      if (Number(f.payNow) > 0) body.initialPayment = { amount: Number(f.payNow), method: f.payMethod };
      const { data } = await api.post(base, body);
      toast.success(`Invoice ${data.invoice.invoiceNumber} created`);
      onCreated(data.invoice);
    } catch (err) { toast.error(errMsg(err, "Could not create invoice")); }
    finally { setBusy(false); }
  };

  const tab = (k, label, Icon) => (
    <button type="button" onClick={() => { setMode(k); if (k === "new") setClient(null); }} className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition ${mode === k ? "bg-blue-600 text-white" : "bg-[#F0F2FA] dark:bg-[#262A38] text-[#4B5163] dark:text-[#B5BAD3]"}`}>
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );

  return (
    <Modal title={mode === "existing" && client ? `New service for ${client.customerName}` : "New invoice"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        {/* 1 · client */}
        <section className="space-y-3">
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#6B7280]">1 · Client</h4>
          <div className="flex gap-2">{tab("new", "New client", UserPlus)}{tab("existing", "Existing client — add a new service", Users)}</div>

          {mode === "new" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Customer name *"><input required className={inputCls} value={f.customerName} onChange={set("customerName")} /></Field>
              <Field label="Business name"><input className={inputCls} value={f.businessName} onChange={set("businessName")} /></Field>
              <div className="sm:col-span-2">
                <SourceFields source={f.clientSource} referredBy={f.referredBy} sources={meta.sources} onChange={(v) => setF((p) => ({ ...p, ...v }))} />
              </div>
            </div>
          )}

          {mode === "existing" && !client && (
            <div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9DA3BB]" />
                <input autoFocus className={`${inputCls} pl-8`} placeholder="Search client by name or business…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="mt-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] max-h-48 overflow-y-auto divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                {searching && <p className="px-3 py-3 text-[12px] text-[#8B92A9]">Searching…</p>}
                {!searching && results.length === 0 && <p className="px-3 py-3 text-[12px] text-[#8B92A9]">No clients found. Clients appear here once they have an invoice.</p>}
                {results.map((c) => (
                  <button type="button" key={c.clientId} onClick={() => setClient(c)} className="w-full text-left px-3 py-2 hover:bg-[#F6F7FB] dark:hover:bg-[#1E2130]">
                    <span className="block text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{c.customerName}</span>
                    <span className="block text-[11px] text-[#8B92A9]">{[c.businessName, c.clientSource ? `Source: ${c.clientSource}${c.referredBy ? ` (${c.referredBy})` : ""}` : "", `${c.invoices} invoice${c.invoices === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "existing" && client && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-[#1A2540] px-4 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{client.customerName}</p>
                <p className="text-[11px] text-[#6B7280]">{[client.businessName, client.clientSource ? `Source: ${client.clientSource}${client.referredBy ? ` (referred by ${client.referredBy})` : ""}` : ""].filter(Boolean).join(" · ") || "—"}</p>
                <p className="text-[11px] text-[#6B7280] mt-1">This starts a <strong>new invoice</strong> for them — its own invoice number, services, amount and payment history.</p>
              </div>
              {!initialClient && <button type="button" className={btnGhost} onClick={() => setClient(null)}>Change</button>}
            </div>
          )}
        </section>

        {/* 2 · invoice */}
        <section className="space-y-3">
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#6B7280]">2 · Invoice</h4>
          <Field label="Invoice number *" hint="Type the invoice number exactly as issued — it is not generated automatically.">
            <input required className={inputCls} value={f.invoiceNumber} onChange={set("invoiceNumber")} placeholder="e.g. SDS/26-27/041" />
          </Field>
          <Field label="Services *"><ServicesEditor rows={rows} setRows={setRows} options={meta.services} /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Date of conversion"><input type="date" className={inputCls} value={f.conversionDate} onChange={set("conversionDate")} /></Field>
            <Field label="Planned installments" hint="Optional, e.g. 4 → shows “1 of 4 paid”"><input type="number" min="1" max="120" className={inputCls} value={f.installmentsPlanned} onChange={set("installmentsPlanned")} /></Field>
          </div>
        </section>

        {/* 3 · payment + follow-up */}
        <section className="space-y-3">
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#6B7280]">3 · Payment & follow-up</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Amount received now (₹)" hint="Optional first payment"><input type="number" min="0" step="0.01" className={inputCls} value={f.payNow} onChange={set("payNow")} /></Field>
            <Field label="Payment method"><select className={inputCls} value={f.payMethod} onChange={set("payMethod")}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
            <Field label="Next follow-up date"><input type="date" min={todayInput()} className={inputCls} value={f.nextFollowUpDate} onChange={set("nextFollowUpDate")} /></Field>
            <Field label="Follow-up owner" hint={mode === "existing" ? "Leave blank to keep the client's current owner" : ""}><AssigneeSelect assignees={assignees} value={f.assignedTo} onChange={(v) => setF((p) => ({ ...p, assignedTo: v }))} /></Field>
            <div className="sm:col-span-2"><Field label="Remark"><input className={inputCls} value={f.remark} onChange={set("remark")} /></Field></div>
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={busy} className={btnPrimary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Create invoice</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Invoice detail drawer ────────────────────────────────────────────────────
function InvoiceDrawer({ id, base, assignees, meta, onClose, onChanged, onAddService, onOpen }) {
  const api = useContext(ApiCtx);
  const [inv, setInv] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [busy, setBusy] = useState("");
  const [edit, setEdit] = useState(null);                 // null | draft object
  const [numDraft, setNumDraft] = useState("");
  const [pay, setPay] = useState({ amount: "", paidOn: todayInput(), method: "UPI", reference: "", next: "" });
  const [fu, setFu] = useState({ date: "", remark: "" });
  const [remark, setRemark] = useState("");

  const load = useCallback(async () => {
    try { const { data } = await api.get(`${base}/${id}`); setInv(data.invoice); setFu({ date: toInputDay(data.invoice.nextFollowUpDate), remark: "" }); }
    catch (e) { toast.error(errMsg(e, "Could not load invoice")); onClose(); }
  }, [api, base, id, onClose]);
  useEffect(() => { load(); }, [load]);

  // the client's other invoices (other services)
  const clientId = inv?.clientId;
  const invId = inv?._id;
  useEffect(() => {
    if (!clientId) return;
    api.get(`${base}/clients/${clientId}/invoices`).then(({ data }) => setSiblings((data.invoices || []).filter((x) => x._id !== invId))).catch(() => setSiblings([]));
  }, [api, base, clientId, invId]);

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
  const sourceLine = inv.clientSource ? `Source: ${inv.clientSource}${inv.referredBy ? ` · referred by ${inv.referredBy}` : ""}` : "";

  const addPayment = async (e) => {
    e.preventDefault();
    const body = { amount: Number(pay.amount), paidOn: pay.paidOn, method: pay.method, reference: pay.reference };
    if (pay.next) body.nextFollowUpDate = pay.next;
    const ok = await run("pay", () => api.post(`${base}/${id}/payments`, body), "Payment recorded");
    if (ok) setPay({ amount: "", paidOn: todayInput(), method: "UPI", reference: "", next: "" });
  };

  const openEdit = () => setEdit({
    invoiceNumber: inv.invoiceNumber || "", customerName: inv.customerName, businessName: inv.businessName || "",
    clientSource: inv.clientSource || "", referredBy: inv.referredBy || "",
    installmentsPlanned: inv.installmentsPlanned || "", conversionDate: toInputDay(inv.conversionDate), assignedTo: inv.assignedTo || "",
    rows: inv.services && inv.services.length ? inv.services.map((s) => ({ name: s.name, amount: s.amount || "" })) : [{ name: inv.service || "", amount: inv.totalAmount || "" }],
  });

  const saveEdit = async (e) => {
    e.preventDefault();
    const body = {
      customerName: edit.customerName, businessName: edit.businessName,
      clientSource: edit.clientSource, referredBy: edit.referredBy,
      installmentsPlanned: edit.installmentsPlanned === "" ? null : Number(edit.installmentsPlanned),
      conversionDate: edit.conversionDate, assignedTo: edit.assignedTo || null,
      services: edit.rows.map((r) => ({ name: r.name, amount: Number(r.amount) })),
    };
    if (edit.invoiceNumber.trim()) body.invoiceNumber = edit.invoiceNumber;
    const ok = await run("edit", () => api.put(`${base}/${id}`, body), "Invoice updated");
    if (ok) setEdit(null);
  };

  return (
    <Modal title={inv.invoiceNumber ? `Invoice ${inv.invoiceNumber}` : "Invoice (number not added yet)"} onClose={onClose} wide>
      <div className="space-y-5">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{inv.customerName}</p>
            <p className="text-[12px] text-[#8B92A9]">{inv.businessName || "—"}{sourceLine ? ` · ${sourceLine}` : ""}</p>
            <p className="text-[12px] text-[#8B92A9] mt-0.5">Converted {fmtDay(inv.conversionDate)} · {inv.source === "lead" ? "from lead" : "manual"} · Follow-up: {inv.assignedToName || "unassigned"}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge inv={inv} />
            <button className={btnGhost} onClick={openEdit}><Pencil className="w-3.5 h-3.5" />Edit</button>
          </div>
        </div>

        {/* invoice number — typed in by hand */}
        {!inv.invoiceNumber && !cancelled && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-[#2D1F00] px-4 py-3">
            <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" />Add the invoice number</p>
            <div className="flex gap-2">
              <input className={inputCls} value={numDraft} onChange={(e) => setNumDraft(e.target.value)} placeholder="Type the invoice number as issued" />
              <button className={btnPrimary} disabled={!numDraft.trim() || busy === "num"} onClick={async () => { if (await run("num", () => api.put(`${base}/${id}`, { invoiceNumber: numDraft }), "Invoice number saved")) setNumDraft(""); }}>
                {busy === "num" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* services */}
        <section>
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#6B7280] mb-2">Services</h4>
          {inv.services && inv.services.length ? (
            <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
              {inv.services.map((s) => (
                <div key={s._id} className="px-3 py-2 flex items-center justify-between text-[13px]">
                  <span>{s.name}</span><span className="font-semibold">{s.amount > 0 ? inr(s.amount) : <span className="text-amber-600 text-[12px]">amount needed</span>}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-[12px] text-[#9DA3BB]">No services listed — click Edit to add them.</p>}
        </section>

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
          {inv.totalAmount === 0 && !cancelled && <p className="text-[12px] text-amber-600 mt-2 text-center">Amounts aren't set yet — click Edit and enter each service's amount before recording payments.</p>}
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
            <p className="text-[11px] text-[#9DA3BB] mt-1">{inv.assignedToName ? `${inv.assignedToName} gets a reminder at 9:30 AM on this date.` : "No employee assigned — assign one via Edit so they get the reminder."}</p>
          </section>
        )}

        {/* this client's other services */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#6B7280]">This client's other services</h4>
            <button className={btnGhost} onClick={() => onAddService({ clientId: inv.clientId, customerName: inv.customerName, businessName: inv.businessName, clientSource: inv.clientSource, referredBy: inv.referredBy, assignedTo: inv.assignedTo, assignedToName: inv.assignedToName })}>
              <Plus className="w-3.5 h-3.5" />Add new service
            </button>
          </div>
          {siblings.length === 0 ? <p className="text-[12px] text-[#9DA3BB]">No other invoices for this client yet. Use “Add new service” when they ask for something new — it starts a fresh invoice with its own payments.</p> : (
            <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
              {siblings.map((s) => (
                <button key={s._id} onClick={() => onOpen(s._id)} className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#F6F7FB] dark:hover:bg-[#1E2130] text-[13px]">
                  <span><span className="font-semibold">{s.invoiceNumber || "No number yet"}</span><span className="text-[#8B92A9]"> · {s.service || "—"}</span></span>
                  <span className="flex items-center gap-2"><span className="text-[12px]">{inr(s.balance)} due</span><StatusBadge inv={s} /></span>
                </button>
              ))}
            </div>
          )}
        </section>

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
        <Modal title="Edit invoice" onClose={() => setEdit(null)} wide>
          <form onSubmit={saveEdit} className="space-y-4">
            <Field label="Invoice number" hint="Typed by hand — must be unique."><input className={inputCls} value={edit.invoiceNumber} onChange={(e) => setEdit({ ...edit, invoiceNumber: e.target.value })} placeholder="Not added yet" /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Customer name"><input required className={inputCls} value={edit.customerName} onChange={(e) => setEdit({ ...edit, customerName: e.target.value })} /></Field>
              <Field label="Business name"><input className={inputCls} value={edit.businessName} onChange={(e) => setEdit({ ...edit, businessName: e.target.value })} /></Field>
            </div>
            <SourceFields source={edit.clientSource} referredBy={edit.referredBy} sources={meta.sources} onChange={(v) => setEdit((p) => ({ ...p, ...v }))} />
            <p className="text-[11px] text-[#9DA3BB] -mt-2">Name, business and source apply to all of this client's invoices.</p>
            <Field label="Services" hint={inv.paidAmount ? `Total can't be lower than the ${inr(inv.paidAmount)} already paid.` : ""}>
              <ServicesEditor rows={edit.rows} setRows={(rows) => setEdit((p) => ({ ...p, rows }))} options={meta.services} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Date of conversion"><input type="date" className={inputCls} value={edit.conversionDate} onChange={(e) => setEdit({ ...edit, conversionDate: e.target.value })} /></Field>
              <Field label="Planned installments"><input type="number" min="1" max="120" className={inputCls} value={edit.installmentsPlanned} onChange={(e) => setEdit({ ...edit, installmentsPlanned: e.target.value })} /></Field>
              <Field label="Follow-up owner"><AssigneeSelect assignees={assignees} value={edit.assignedTo} onChange={(v) => setEdit({ ...edit, assignedTo: v })} /></Field>
            </div>
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

// ── Main page ────────────────────────────────────────────────────────────────
const STATUS_TABS = [
  ["all", "All"], ["no_number", "Needs invoice no."], ["pending", "Pending"], ["partial", "Partial"], ["paid", "Paid"],
  ["overdue", "Overdue"], ["due_today", "Due today"], ["cancelled", "Cancelled"],
];

export default function FinanceDashboard({ basePath = "/finance", embedded = false, client = null }) {
  const api = client || defaultApi;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [meta, setMeta] = useState({ sources: [], services: [] });
  const [q, setQ] = useState("");
  const [f, setF] = useState({ status: "all", assignedTo: "", clientSource: "", from: "", to: "", sort: "conversion_desc", page: 1 });
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(null);   // null | { client?: existing client }

  // debounce search
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => { setDq(q); setF((p) => ({ ...p, page: 1 })); }, 350); return () => clearTimeout(t); }, [q]);

  const params = useMemo(() => {
    const p = { limit: 25, page: f.page, sort: f.sort, status: f.status };
    if (dq) p.q = dq; if (f.assignedTo) p.assignedTo = f.assignedTo; if (f.clientSource) p.clientSource = f.clientSource;
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
  useEffect(() => {
    api.get(`${basePath}/assignees`).then(({ data: d }) => setAssignees(d.assignees || [])).catch(() => {});
    api.get(`${basePath}/meta`).then(({ data: d }) => setMeta({ sources: d.sources || [], services: d.services || [] })).catch(() => {});
  }, [api, basePath]);

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
          <p className="text-[12px] text-[#8B92A9]">Converted leads, invoices, services, part-payments and payment follow-ups.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={btnGhost} onClick={load} title="Refresh"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></button>
          <button className={btnPrimary} onClick={() => setCreating({})}><Plus className="w-4 h-4" />New invoice</button>
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
                {label}{k === "no_number" && s?.needsNumber ? ` (${s.needsNumber})` : k === "overdue" && s?.overdue ? ` (${s.overdue})` : k === "due_today" && s?.dueToday ? ` (${s.dueToday})` : ""}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
            <div className="relative col-span-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9DA3BB]" />
              <input className={`${inputCls} pl-8`} placeholder="Search invoice #, client, service, referrer…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className={inputCls} value={f.assignedTo} onChange={(e) => setFilter("assignedTo", e.target.value)}>
              <option value="">All employees</option><option value="none">Unassigned</option>
              {assignees.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
            <select className={inputCls} value={f.clientSource} onChange={(e) => setFilter("clientSource", e.target.value)}>
              <option value="">All sources</option>
              {meta.sources.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <input type="date" className={inputCls} value={f.from} onChange={(e) => setFilter("from", e.target.value)} title="Converted from" />
            <input type="date" className={inputCls} value={f.to} onChange={(e) => setFilter("to", e.target.value)} title="Converted to" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[1100px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[#8B92A9] border-b border-[#E4E7EF] dark:border-[#262A38]">
                {["Invoice #", "Client", "Services", "Converted", "Total", "Paid", "Balance", "Status", "Next follow-up", "Owner"].map((h) => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
              {loading && !data && <tr><td colSpan={10} className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-blue-600 inline" /></td></tr>}
              {data && data.invoices.length === 0 && <tr><td colSpan={10} className="py-12 text-center text-[#8B92A9]">No invoices match. Leads appear here automatically once they reach a converted status.</td></tr>}
              {data?.invoices.map((inv) => (
                <tr key={inv._id} onClick={() => setOpenId(inv._id)} className="cursor-pointer hover:bg-[#F6F7FB] dark:hover:bg-[#1E2130] transition">
                  <td className="px-4 py-3 whitespace-nowrap">{inv.invoiceNumber ? <span className="font-semibold text-blue-600">{inv.invoiceNumber}</span> : <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-[#2D1F00] text-amber-700 dark:text-amber-300 text-[11px] font-semibold">Add number</span>}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{inv.customerName}</div>
                    <div className="text-[11px] text-[#8B92A9]">{[inv.businessName, inv.clientSource ? `${inv.clientSource}${inv.referredBy ? `: ${inv.referredBy}` : ""}` : ""].filter(Boolean).join(" · ") || (inv.source === "manual" ? "Manual" : "")}</div>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]"><div className="truncate text-[#4B5163] dark:text-[#B5BAD3]" title={inv.service}>{inv.service || <span className="text-[#9DA3BB]">—</span>}</div></td>
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

      {openId && (
        <InvoiceDrawer key={openId} id={openId} base={basePath} assignees={assignees} meta={meta}
          onClose={() => setOpenId(null)} onChanged={load} onOpen={(id) => setOpenId(id)}
          onAddService={(c) => { setOpenId(null); setCreating({ client: c }); }} />
      )}
      {creating && (
        <CreateInvoiceModal base={basePath} assignees={assignees} meta={meta} initialClient={creating.client || null}
          onClose={() => setCreating(null)} onCreated={(inv) => { setCreating(null); load(); setOpenId(inv._id); }} />
      )}
    </div>
    </ApiCtx.Provider>
  );
}
