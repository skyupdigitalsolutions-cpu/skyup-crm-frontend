// src/finance/VouchersPage.jsx — Finance Dashboard → Payment vouchers.
// Fill in date, debit account head, expense lines, TDS % and payment mode; the
// software works out total, TDS, payable total and amount in words, numbers the
// voucher (PV/2026-27/0001) and prints it like the paper voucher book. The
// Particulars block (received by / prepared by / authorised) prints blank for
// names and signatures by hand.
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2, Loader2, Printer, Eye, Pencil, Ban, Search, X, FileText } from "lucide-react";
import { listVouchers, createVoucher, updateVoucher, cancelVoucher, getCompanyDetails } from "./hrApi";
import { printVoucher } from "./voucherPrint";
import { amountInWords } from "../utils/amountInWords";

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-emerald-500 dark:border-[#2A3040] dark:bg-[#141925] dark:text-slate-100";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";
const btnGhost = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#2A3040] dark:text-slate-200 dark:hover:bg-[#1A2030]";
const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const r2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
const inr = (n) => "₹" + r2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const toDay = (d) => (d ? new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 10) : "");
const fmtDay = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const errMsg = (e, f) => e?.response?.data?.message || f;

const DEFAULT_HEADS = ["Office Expenses", "Salary", "Rent", "Electricity", "Internet & Phone", "Travel & Conveyance", "Printing & Stationery",
  "Marketing & Advertising", "Vendor / Freelancer Payment", "Software & Subscriptions", "Repairs & Maintenance", "Staff Welfare", "Petty Cash", "Professional Fees"];
const MODES = [["cash", "Cash"], ["cheque", "Cheque"], ["online", "Online payment"]];

const emptyLine = (date) => ({ date: date || today(), details: "", amount: "" });
const blankForm = () => ({ voucherDate: today(), debitAccountHead: "", paidTo: "", lines: [emptyLine(), emptyLine()], tdsPercent: 0, paymentMode: "cash", paymentRef: "" });
const formFrom = (v) => ({
  voucherDate: toDay(v.voucherDate), debitAccountHead: v.debitAccountHead || "", paidTo: v.paidTo || "",
  lines: (v.lines || []).map((l) => ({ date: toDay(l.date), details: l.details, amount: l.amount })),
  tdsPercent: v.tdsPercent || 0, paymentMode: v.paymentMode || "cash", paymentRef: v.paymentRef || "",
});

// Same maths as the backend (financeVoucherController.voucherFrom).
function totalsOf(f) {
  const lines = f.lines.filter((l) => String(l.details).trim() || Number(l.amount));
  const total = r2(lines.reduce((a, l) => a + r2(Math.max(0, Number(l.amount) || 0)), 0));
  const tdsPercent = Math.min(100, Math.max(0, Number(f.tdsPercent) || 0));
  const tdsAmount = r2(total * tdsPercent / 100);
  const payableTotal = r2(total - tdsAmount);
  return { lines, total, tdsPercent, tdsAmount, payableTotal, amountInWords: amountInWords(payableTotal) };
}

export default function VouchersPage() {
  const [data, setData] = useState(null);
  const [company, setCompany] = useState({});
  const [filters, setFilters] = useState({ search: "", from: "", to: "" });
  const [editing, setEditing] = useState(null);   // null | "new" | voucher
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [copies, setCopies] = useState("one");    // "one" | "two" (Original + Duplicate)

  const load = async () => {
    try { setData(await listVouchers(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))); }
    catch (e) { setData({ vouchers: [], heads: [], summary: { count: 0, payable: 0 } }); toast.error(errMsg(e, "Could not load vouchers.")); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters.from, filters.to]);
  useEffect(() => { getCompanyDetails().then(setCompany).catch(() => {}); }, []);

  const t = useMemo(() => totalsOf(form), [form]);
  const heads = useMemo(() => [...new Set([...(data?.heads || []), ...DEFAULT_HEADS])], [data]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const copyList = copies === "two" ? ["", ""] : [""];

  const startNew = () => { setForm(blankForm()); setEditing("new"); };
  const startEdit = (v) => { setForm(formFrom(v)); setEditing(v); };
  const close = () => setEditing(null);

  const check = () => {
    if (!form.debitAccountHead.trim()) return "Enter the debit account head.";
    if (!t.lines.length) return "Add at least one expense line.";
    if (t.lines.some((l) => !String(l.details).trim())) return "Every line with an amount needs its details.";
    if (!(t.total > 0)) return "The total must be more than zero.";
    if (form.paymentMode === "cheque" && !form.paymentRef.trim()) return "Enter the cheque number.";
    if (form.paymentMode === "online" && !form.paymentRef.trim()) return "Enter the online payment reference (UTR / UPI ref).";
    return "";
  };

  const preview = () => {
    const msg = check(); if (msg) { toast.error(msg); return; }
    printVoucher({ ...form, ...t, voucherNo: editing && editing !== "new" ? editing.voucherNo : "— on save —" }, company, { copies: copyList, preview: true });
  };

  const save = async (andPrint) => {
    const msg = check(); if (msg) { toast.error(msg); return; }
    const win = andPrint ? window.open("", "_blank") : null;
    setBusy(true);
    try {
      const body = { ...form, lines: t.lines.map((l) => ({ date: l.date || form.voucherDate, details: String(l.details).trim(), amount: Number(l.amount) || 0 })) };
      const { voucher } = editing === "new" ? await createVoucher(body) : await updateVoucher(editing._id, body);
      toast.success(editing === "new" ? `Voucher ${voucher.voucherNo} saved` : `Voucher ${voucher.voucherNo} updated`);
      if (andPrint) printVoucher(voucher, company, { copies: copyList }, win);
      close(); load();
    } catch (e) { win?.close(); toast.error(errMsg(e, "Could not save the voucher.")); }
    finally { setBusy(false); }
  };

  const cancel = async (v) => {
    const reason = window.prompt(`Cancel voucher ${v.voucherNo}? It stays in the register marked CANCELLED.\nReason (optional):`, "");
    if (reason === null) return;
    try { await cancelVoucher(v._id, reason); toast.success(`Voucher ${v.voucherNo} cancelled`); load(); }
    catch (e) { toast.error(errMsg(e, "Could not cancel.")); }
  };

  // ── form ──
  if (editing) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5 text-emerald-600" />
          <h2 className="flex-1 text-[16px] font-bold">{editing === "new" ? "New payment voucher" : `Edit ${editing.voucherNo}`}</h2>
          <button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]" onClick={close} title="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-[#1F2533] dark:bg-[#0F141E]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr_1fr]">
            <div><label className={lbl}>Date</label><input type="date" className={inputCls} value={form.voucherDate}
              onChange={(e) => { const d = e.target.value; setForm((f) => ({ ...f, voucherDate: d, lines: f.lines.map((l) => (l.date === f.voucherDate ? { ...l, date: d } : l)) })); }} /></div>
            <div><label className={lbl}>Debit account head *</label>
              <input className={inputCls} list="pv-heads" value={form.debitAccountHead} maxLength={120} onChange={(e) => set("debitAccountHead", e.target.value)} placeholder="Office Expenses" />
              <datalist id="pv-heads">{heads.map((h) => <option key={h} value={h} />)}</datalist></div>
            <div><label className={lbl}>Paid to <span className="font-normal normal-case">(for your records — not printed)</span></label>
              <input className={inputCls} value={form.paidTo} maxLength={120} onChange={(e) => set("paidTo", e.target.value)} placeholder="Vendor / person" /></div>
          </div>

          <div>
            <label className={lbl}>Details of expenditure</label>
            <div className="space-y-2">
              {form.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <input type="date" className={`${inputCls} col-span-4 sm:col-span-3`} value={l.date} onChange={(e) => setLine(i, { date: e.target.value })} />
                  <input className={`${inputCls} col-span-8 sm:col-span-6`} value={l.details} maxLength={300} onChange={(e) => setLine(i, { details: e.target.value })} placeholder="e.g. Printer cartridges" />
                  <input type="number" min="0" step="0.01" className={`${inputCls} col-span-9 text-right sm:col-span-2`} value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} placeholder="0.00" />
                  <button className="col-span-3 flex justify-center rounded-lg p-2 hover:bg-red-50 disabled:opacity-30 sm:col-span-1 dark:hover:bg-[#2D0A0A]" disabled={form.lines.length === 1}
                          onClick={() => set("lines", form.lines.filter((_, j) => j !== i))} title="Remove line"><Trash2 className="h-4 w-4 text-red-600" /></button>
                </div>
              ))}
            </div>
            <button className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline disabled:opacity-40" disabled={form.lines.length >= 30}
                    onClick={() => set("lines", [...form.lines, emptyLine(form.voucherDate)])}><Plus className="h-3.5 w-3.5" /> Add line</button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div><label className={lbl}>Less TDS %</label>
                <input type="number" min="0" max="100" step="0.01" list="pv-tds" className={inputCls} value={form.tdsPercent} onChange={(e) => set("tdsPercent", e.target.value)} />
                <datalist id="pv-tds">{[0, 1, 2, 5, 10].map((x) => <option key={x} value={x} />)}</datalist></div>
              <div><label className={lbl}>Paid by</label>
                <div className="flex gap-1.5">
                  {MODES.map(([k, l]) => (
                    <button key={k} onClick={() => set("paymentMode", k)}
                            className={`flex-1 rounded-lg border px-2 py-2 text-[12px] font-semibold ${form.paymentMode === k ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-slate-600 dark:border-[#2A3040] dark:text-slate-300"}`}>{l}</button>
                  ))}
                </div></div>
              {form.paymentMode !== "cash" && (
                <div><label className={lbl}>{form.paymentMode === "cheque" ? "Cheque number *" : "Payment reference (UTR / UPI ref) *"}</label>
                  <input className={inputCls} value={form.paymentRef} maxLength={120} onChange={(e) => set("paymentRef", e.target.value)} /></div>
              )}
            </div>
            <div className="self-start rounded-xl bg-slate-50 p-3 text-[13px] dark:bg-[#141925]">
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span>{inr(t.total)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Less TDS {t.tdsPercent ? `${t.tdsPercent}%` : ""}</span><span className="text-red-600">− {inr(t.tdsAmount)}</span></div>
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-1.5 text-[15px] font-bold dark:border-[#2A3040]"><span>Payable total</span><span>{inr(t.payableTotal)}</span></div>
              <p className="mt-2 text-[12px] italic text-slate-500">{t.amountInWords}</p>
            </div>
          </div>

          <p className="text-[12px] text-slate-500">"Amount received by", "Voucher prepared by" and "Authorised person" are left blank on the printed voucher for names and signatures.</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className={`${inputCls} w-auto`} value={copies} onChange={(e) => setCopies(e.target.value)} title="Copies to print">
            <option value="one">Print 1 copy</option><option value="two">Print 2 copies</option>
          </select>
          <div className="ml-auto flex gap-2">
            <button className={btnGhost} onClick={preview} disabled={busy}><Eye className="h-4 w-4" />Preview</button>
            <button className={btnGhost} onClick={() => save(false)} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save</button>
            <button className={btnPrimary} onClick={() => save(true)} disabled={busy}><Printer className="h-4 w-4" />Save &amp; print</button>
          </div>
        </div>
      </div>
    );
  }

  // ── list ──
  const list = data?.vouchers;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} w-60 pl-8`} placeholder="Search no., head, details, ref…" value={filters.search}
                 onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") load(); }} />
        </div>
        <input type="date" className={`${inputCls} w-auto`} value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} title="From" />
        <input type="date" className={`${inputCls} w-auto`} value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} title="To" />
        <select className={`${inputCls} w-auto`} value={copies} onChange={(e) => setCopies(e.target.value)} title="Copies to print">
          <option value="one">1 copy</option><option value="two">2 copies</option>
        </select>
        <button className={`${btnPrimary} ml-auto`} onClick={startNew}><Plus className="h-4 w-4" />New voucher</button>
      </div>
      {data?.summary && (
        <p className="mb-2 text-[12px] text-slate-500">{data.summary.count} voucher{data.summary.count === 1 ? "" : "s"} · paid out {inr(data.summary.payable)} (cancelled not counted)</p>
      )}
      {!list ? <div className="py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        : list.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-[13px] text-slate-500 dark:border-[#2A3040]">No vouchers yet. Click "New voucher" to make one.</div>
        : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#1F2533]">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-[#141925]">
                <tr><th className="px-3 py-2">Voucher</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Debit account head</th><th className="px-3 py-2">Details</th><th className="px-3 py-2">Paid by</th><th className="px-3 py-2 text-right">Payable</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v._id} className={`border-t border-slate-100 dark:border-[#1F2533] ${v.status === "cancelled" ? "opacity-50" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">{v.voucherNo}{v.status === "cancelled" && <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">CANCELLED</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2">{fmtDay(v.voucherDate)}</td>
                    <td className="px-3 py-2">{v.debitAccountHead}{v.paidTo && <div className="text-[11px] text-slate-500">to {v.paidTo}</div>}</td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-slate-600 dark:text-slate-300">{(v.lines || []).map((l) => l.details).join(", ")}</td>
                    <td className="whitespace-nowrap px-3 py-2 capitalize">{v.paymentMode}{v.paymentRef && <div className="text-[11px] text-slate-500">{v.paymentRef}</div>}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{inr(v.payableTotal)}{v.tdsAmount > 0 && <div className="text-[11px] font-normal text-slate-500">TDS {inr(v.tdsAmount)}</div>}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]" title="Print" onClick={() => printVoucher(v, company, { copies: copyList })}><Printer className="h-4 w-4" /></button>
                      {v.status !== "cancelled" && <>
                        <button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]" title="Edit" onClick={() => startEdit(v)}><Pencil className="h-4 w-4" /></button>
                        <button className="rounded-lg p-1.5 hover:bg-red-50 dark:hover:bg-[#2D0A0A]" title="Cancel voucher" onClick={() => cancel(v)}><Ban className="h-4 w-4 text-red-600" /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
