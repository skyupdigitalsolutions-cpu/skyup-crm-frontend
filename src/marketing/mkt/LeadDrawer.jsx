// src/marketing/mkt/LeadDrawer.jsx
// "Where did this number come from?" — every clickable number opens this drawer
// with the exact leads behind it. Marketers can also record the commercial
// outcome (deal value, lost reason, stage) so revenue / CAC / ROAS work.
import { Fragment, useEffect, useState } from "react";
import { X, Download, Save, Loader2 } from "lucide-react";
import mktApi from "../mktApi";
import { useMkt, Badge, stageTone, STAGE_LABEL, CHANNEL_LABEL, fmtDateTime, inr, mins, num, Loader, ErrorBox, downloadCSV } from "./ui";

const STAGES = ["", "new", "contact_attempted", "contacted", "qualified", "meeting", "proposal", "negotiation", "won", "lost"];

function OutcomeEditor({ lead, lostReasons, onSaved }) {
  const [form, setForm] = useState({ dealValue: lead.dealValue ?? "", lostReason: "", lifecycleStage: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const body = {};
      if (form.dealValue !== "" && form.dealValue !== lead.dealValue) body.dealValue = form.dealValue;
      if (form.lostReason) body.lostReason = form.lostReason;
      if (form.lifecycleStage) body.lifecycleStage = form.lifecycleStage;
      if (!Object.keys(body).length) { setMsg("Nothing to save"); setSaving(false); return; }
      await mktApi.patch(`/v2/leads/${lead._id}/outcome`, body);
      setMsg("Saved");
      onSaved && onSaved();
    } catch (e) { setMsg(e?.response?.data?.message || "Couldn't save"); }
    finally { setSaving(false); }
  };
  const input = "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] dark:border-[#1F2533] dark:bg-[#0F131B] dark:text-slate-100";
  return (
    <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50 p-3 sm:grid-cols-4 dark:border-[#1A2030] dark:bg-white/[0.02]">
      <label className="text-[12px] text-slate-600 dark:text-slate-300">Deal value (₹)
        <input type="number" min="0" value={form.dealValue} onChange={(e) => setForm({ ...form, dealValue: e.target.value })} className={input} />
      </label>
      <label className="text-[12px] text-slate-600 dark:text-slate-300">Stage override
        <select value={form.lifecycleStage} onChange={(e) => setForm({ ...form, lifecycleStage: e.target.value })} className={input}>
          {STAGES.map((s) => <option key={s} value={s}>{s ? STAGE_LABEL[s] : "Keep derived stage"}</option>)}
        </select>
      </label>
      <label className="text-[12px] text-slate-600 dark:text-slate-300">Lost reason
        <select value={form.lostReason} onChange={(e) => setForm({ ...form, lostReason: e.target.value })} className={input}>
          <option value="">{lead.lostReason || "—"}</option>
          {(lostReasons || []).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save outcome
        </button>
        {msg && <span className="text-[12px] text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}

export default function LeadDrawer({ drill, onClose }) {
  const { params, dict, bump } = useMkt();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!drill) return;
    setLoading(true); setErr("");
    mktApi.get("/v2/leads", { params: { ...params, ...drill.params }, timeout: 90000 })
      .then((r) => setData(r.data))
      .catch((e) => setErr(e?.response?.data?.message || "Couldn't load leads."))
      .finally(() => setLoading(false));
  }, [drill, params, tick]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  if (!drill) return null;
  const cols = [
    { key: "name", label: "Lead" }, { key: "mobile", label: "Phone" }, { key: "channel", label: "Channel" }, { key: "campaign", label: "Campaign" },
    { key: "adSet", label: "Ad set" }, { key: "statusLabel", label: "CRM status" }, { key: "stage", label: "Stage" }, { key: "salesperson", label: "Salesperson" },
    { key: "createdAt", label: "Created", csv: (r) => fmtDateTime(r.createdAt) }, { key: "responseMin", label: "First response (min)" },
    { key: "lostReason", label: "Lost reason" }, { key: "revenue", label: "Revenue" }, { key: "attributionMethod", label: "Attribution" },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside role="dialog" aria-label={drill.title} className="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl dark:bg-[#0F131B]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 dark:border-[#1F2533]">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-semibold text-slate-900 dark:text-slate-50">{drill.title || "Leads"}</h2>
            {data && <p className="text-[12px] text-slate-500">{num(data.total)} leads · {num(data.summary.qualified)} qualified · {num(data.summary.won)} won · {inr(data.summary.revenue)} revenue{data.total > data.leads.length ? ` · showing latest ${data.leads.length}` : ""}</p>}
          </div>
          {data && data.leads.length > 0 && (
            <button onClick={() => downloadCSV(`leads_${Date.now()}.csv`, cols, data.leads)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 dark:border-[#1F2533] dark:text-slate-200 dark:hover:bg-white/5">
              <Download className="h-3.5 w-3.5" />Export CSV
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 overflow-auto">
          {loading && <Loader />}
          {err && <div className="p-4"><ErrorBox msg={err} /></div>}
          {data && !loading && (
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-slate-50 dark:bg-[#121620]">
                <tr>{["Lead", "Channel / campaign", "Status · stage", "Salesperson", "Created", "First response", "Outcome", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[12px] font-semibold text-slate-600 dark:text-slate-300">{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.leads.map((l) => (
                  <Fragment key={l._id}>
                    <tr className="border-t border-slate-100 align-top dark:border-[#1A2030]">
                      <td className="px-3 py-2"><p className="font-medium text-slate-900 dark:text-slate-100">{l.name}</p><p className="text-[12px] tabular-nums text-slate-500">{l.mobile}</p></td>
                      <td className="max-w-[240px] px-3 py-2"><p className="text-slate-700 dark:text-slate-300">{CHANNEL_LABEL[l.channel] || l.channel}</p><p className="truncate text-[12px] text-slate-500" title={l.campaign}>{l.campaign || "—"}{l.adSet ? ` › ${l.adSet}` : ""}</p>{l.attributionMethod === "name" && <Badge tone="warn">name-matched</Badge>}{l.attributionMethod === "none" && <Badge tone="bad">unattributed</Badge>}</td>
                      <td className="px-3 py-2"><p className="text-slate-700 dark:text-slate-300">{l.statusLabel}</p><Badge tone={stageTone(l.stage)}>{STAGE_LABEL[l.stage] || l.stage}</Badge></td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{l.salesperson}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400">{fmtDateTime(l.createdAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{l.responseMin == null ? <Badge tone="bad">not contacted</Badge> : mins(l.responseMin)}</td>
                      <td className="px-3 py-2 text-[12px]">{l.revenue ? <span className="text-emerald-700 dark:text-emerald-400">{inr(l.revenue)}{l.revenueType === "estimated" ? " (est.)" : ""}</span> : l.lostReason ? <span className="text-red-700 dark:text-red-400">{l.lostReason}</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="px-3 py-2"><button onClick={() => setEdit(edit === l._id ? null : l._id)} className="text-[12px] font-semibold text-violet-700 hover:underline dark:text-violet-300">{edit === l._id ? "Close" : "Record outcome"}</button></td>
                    </tr>
                    {edit === l._id && <tr><td colSpan={8} className="p-0"><OutcomeEditor lead={l} lostReasons={dict && dict.lostReasons} onSaved={() => { setTick((t) => t + 1); bump(); }} /></td></tr>}
                  </Fragment>
                ))}
                {!data.leads.length && <tr><td colSpan={8} className="py-10 text-center text-slate-500">No leads match.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </aside>
    </div>
  );
}
