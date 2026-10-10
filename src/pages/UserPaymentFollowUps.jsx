// src/pages/UserPaymentFollowUps.jsx — NEW FILE
// Employee view of the Finance Dashboard: only the invoices assigned to them.
// They can reschedule the follow-up date and add remarks (not edit amounts or
// record payments — that stays with admins).
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Loader2, CalendarClock, MessageSquarePlus, RefreshCw, AlertTriangle, Wallet } from "lucide-react";
import api from "../data/axiosConfig";
import { inr, fmtDay, fmtDateTime, toInputDay, todayInput, errMsg } from "../utils/financeFormat";
import { StatusBadge, FollowUpCell } from "../components/FinanceDashboard";

const inputCls = "w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#0F1117] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] outline-none focus:border-blue-500";
const btn = "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[12px] font-semibold transition";

function Card({ inv, onUpdated }) {
  const [date, setDate] = useState(toInputDay(inv.nextFollowUpDate));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(false);

  const act = async (key, fn, msg) => {
    setBusy(key);
    try { const { data } = await fn(); onUpdated(data.invoice); setNote(""); toast.success(msg); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(""); }
  };

  return (
    <div className={`bg-white dark:bg-[#1A1D27] border rounded-2xl p-4 ${inv.isOverdue ? "border-red-300 dark:border-red-900" : inv.isDueToday ? "border-amber-300 dark:border-amber-800" : "border-[#E4E7EF] dark:border-[#262A38]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{inv.customerName}</p>
          <p className="text-[11px] text-[#8B92A9]">{inv.invoiceNumber || "No invoice no. yet"}{inv.service ? ` · ${inv.service}` : ""}{inv.businessName ? ` · ${inv.businessName}` : ""} · converted {fmtDay(inv.conversionDate)}</p>
        </div>
        <StatusBadge inv={inv} />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div><p className="text-[10px] uppercase text-[#8B92A9] font-semibold">Total</p><p className="text-[13px] font-bold">{inr(inv.totalAmount)}</p></div>
        <div><p className="text-[10px] uppercase text-[#8B92A9] font-semibold">Paid ({inv.partsPaid}{inv.installmentsPlanned ? `/${inv.installmentsPlanned}` : ""})</p><p className="text-[13px] font-bold text-emerald-600">{inr(inv.paidAmount)}</p></div>
        <div><p className="text-[10px] uppercase text-[#8B92A9] font-semibold">Balance</p><p className="text-[13px] font-bold text-red-600">{inr(inv.balance)}</p></div>
      </div>

      <p className="text-[12px] mt-3">Follow-up: <FollowUpCell inv={inv} /></p>

      <div className="grid grid-cols-5 gap-2 mt-3 items-end">
        <input type="date" min={todayInput()} className={`${inputCls} col-span-2`} value={date} onChange={(e) => setDate(e.target.value)} />
        <input className={`${inputCls} col-span-2`} placeholder="Note (e.g. will pay Friday)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        <button className={btn} disabled={busy === "fu" || !date} onClick={() => act("fu", () => api.put(`/finance/my/${inv._id}/followup`, { nextFollowUpDate: date, remark: note }), "Follow-up saved")}>
          {busy === "fu" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}Save
        </button>
      </div>

      <button className="mt-3 text-[12px] font-semibold text-blue-600 flex items-center gap-1" onClick={() => setOpen((o) => !o)}>
        <MessageSquarePlus className="w-3.5 h-3.5" />{open ? "Hide remarks" : `Remarks (${inv.remarks.length})`}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) act("rm", () => api.post(`/finance/my/${inv._id}/remarks`, { text: note }), "Remark added"); }}>
            <input className={inputCls} placeholder="Add a remark…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
            <button className={btn} disabled={busy === "rm" || !note.trim()}>Add</button>
          </form>
          <div className="max-h-44 overflow-y-auto space-y-1.5">
            {inv.remarks.map((r) => (
              <div key={r._id} className="rounded-lg bg-[#F6F7FB] dark:bg-[#12141C] px-3 py-1.5 text-[12px] text-[#4B5163] dark:text-[#B5BAD3]">
                {r.text}<div className="text-[10px] opacity-70">{r.byName} · {fmtDateTime(r.at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserPaymentFollowUps() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("action"); // action | all

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const { data: d } = await api.get("/finance/my/followups"); setData(d); }
    catch (e) { setError(errMsg(e, "Could not load your payment follow-ups")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const replace = (inv) => setData((d) => d && ({ ...d, invoices: d.invoices.map((i) => (i._id === inv._id ? inv : i)) }));

  if (error) return <div className="p-8 text-center"><AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" /><p className="text-[14px] font-semibold">{error}</p></div>;

  const list = (data?.invoices || []).filter((i) => (tab === "action" ? i.isOverdue || i.isDueToday : true));

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] flex items-center gap-2"><Wallet className="w-5 h-5 text-blue-600" />Payment follow-ups</h1>
          <p className="text-[12px] text-[#8B92A9]">Pending payments from your converted leads.</p>
        </div>
        <button className="p-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      <div className="flex gap-2">
        {[["action", `Needs action (${(data?.counts?.overdue || 0) + (data?.counts?.dueToday || 0)})`], ["all", `All pending (${data?.counts?.total || 0})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-full text-[12px] font-semibold ${tab === k ? "bg-blue-600 text-white" : "bg-[#F0F2FA] dark:bg-[#262A38] text-[#4B5163] dark:text-[#B5BAD3]"}`}>{l}</button>
        ))}
      </div>

      {loading && !data ? <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-blue-600 inline" /></div>
        : list.length === 0 ? <p className="py-12 text-center text-[13px] text-[#8B92A9]">{tab === "action" ? "Nothing due today — you're all caught up." : "No pending payments assigned to you."}</p>
        : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{list.map((inv) => <Card key={inv._id} inv={inv} onUpdated={replace} />)}</div>}
    </div>
  );
}
