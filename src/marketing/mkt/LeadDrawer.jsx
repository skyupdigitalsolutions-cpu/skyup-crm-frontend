// src/marketing/mkt/LeadDrawer.jsx
// "Where did this number come from?" — every clickable number opens this drawer
// with the exact leads behind it. Each lead shows its channel and campaign and, where the
// platform recorded it, the AD SET and the exact AD it came from. Click the ad to see its creative.
import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import mktApi from "../mktApi";
import CreativeModal from "./CreativeModal";
import { useMkt, Badge, stageTone, STAGE_LABEL, CHANNEL_LABEL, fmtDateTime, inr, mins, num, Loader, ErrorBox, downloadCSV } from "./ui";

// Ad set + ad under a lead's campaign. Meta leads can carry the exact ad; Google leads carry the
// ad group and keyword (Google doesn't pass a single ad).
function AdTrail({ l, onOpenAd }) {
  const google = l.channel === "google";
  const lbl = "text-slate-400 dark:text-slate-500";
  if (l.channel !== "meta" && !google) return null;                 // website / WhatsApp / organic: no ad to show

  if (google) {
    if (!l.adSet && !l.keyword) return <p className="text-[12px] text-slate-400">Ad group not recorded</p>;
    return (
      <>
        {l.adSet && <p className="truncate text-[12px] text-slate-500" title={l.adSet}><span className={lbl}>Ad group</span> {l.adSet}</p>}
        {l.keyword && <p className="truncate text-[12px] text-slate-500" title={l.keyword}><span className={lbl}>Keyword</span> {l.keyword}</p>}
      </>
    );
  }
  return (
    <>
      {l.adSet
        ? <p className="truncate text-[12px] text-slate-500" title={l.adSet}><span className={lbl}>Ad set</span> {l.adSet}</p>
        : l.adSetId ? <p className="truncate text-[12px] text-slate-500"><span className={lbl}>Ad set</span> #{l.adSetId}</p> : null}
      {l.metaAdId
        ? <p className="truncate text-[12px]"><span className={lbl}>Ad</span>{" "}
            <button type="button" onClick={() => onOpenAd(l)} title="View this ad's creative" className="max-w-[210px] truncate align-bottom font-medium text-violet-700 hover:underline dark:text-violet-300">{l.adName || `Ad #${l.metaAdId}`}</button></p>
        : <p className="text-[12px] text-slate-400" title="This lead has no Meta ad ID on record — it didn't arrive through an ad lead form, or it was added before ad details were captured.">
            {l.adSet ? "Exact ad not recorded" : "Ad not recorded"}
          </p>}
    </>
  );
}

export default function LeadDrawer({ drill, onClose }) {
  const { params } = useMkt();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [adOpen, setAdOpen] = useState(null);       // lead whose ad creative is open

  useEffect(() => {
    if (!drill) return;
    setLoading(true); setErr("");
    mktApi.get("/v2/leads", { params: { ...params, ...drill.params }, timeout: 90000 })
      .then((r) => setData(r.data))
      .catch((e) => setErr(e?.response?.data?.message || "Couldn't load leads."))
      .finally(() => setLoading(false));
  }, [drill, params]);

  useEffect(() => {
    // Esc closes the ad creative first, then the drawer
    const h = (e) => { if (e.key === "Escape" && !adOpen) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, adOpen]);

  if (!drill) return null;
  const cols = [
    { key: "name", label: "Lead" }, { key: "mobile", label: "Phone" }, { key: "channel", label: "Channel" }, { key: "campaign", label: "Campaign" },
    { key: "adSet", label: "Ad set / ad group" }, { key: "adSetId", label: "Ad set ID" }, { key: "adName", label: "Ad" }, { key: "metaAdId", label: "Ad ID" }, { key: "keyword", label: "Keyword" },
    { key: "statusLabel", label: "CRM status" }, { key: "stage", label: "Stage" }, { key: "salesperson", label: "Salesperson" },
    { key: "createdAt", label: "Created", csv: (r) => fmtDateTime(r.createdAt) }, { key: "responseMin", label: "First response (min)" },
    { key: "lostReason", label: "Lost reason" }, { key: "revenue", label: "Revenue" }, { key: "attributionMethod", label: "Attribution" },
  ];
  const cov = data && data.adCoverage;
  return (
    <>
      <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/40" onClick={onClose}>
        <aside role="dialog" aria-label={drill.title} className="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl dark:bg-[#0F131B]" onClick={(e) => e.stopPropagation()}>
          <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 dark:border-[#1F2533]">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[16px] font-semibold text-slate-900 dark:text-slate-50">{drill.title || "Leads"}</h2>
              {data && <p className="text-[12px] text-slate-500">{num(data.total)} leads · {num(data.summary.qualified)} qualified · {num(data.summary.won)} won · {inr(data.summary.revenue)} revenue{data.total > data.leads.length ? ` · showing latest ${data.leads.length}` : ""}{cov && cov.metaLeads > 0 ? ` · exact ad known for ${num(cov.withAd)} of ${num(cov.metaLeads)} Meta leads` : ""}</p>}
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
                  <tr>{["Lead", "Channel / campaign / ad", "Status · stage", "Salesperson", "Created", "First response", "Outcome"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[12px] font-semibold text-slate-600 dark:text-slate-300">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data.leads.map((l) => (
                    <tr key={l._id} className="border-t border-slate-100 align-top dark:border-[#1A2030]">
                      <td className="px-3 py-2"><p className="font-medium text-slate-900 dark:text-slate-100">{l.name}</p><p className="text-[12px] tabular-nums text-slate-500">{l.mobile}</p></td>
                      <td className="max-w-[280px] px-3 py-2">
                        <p className="text-slate-700 dark:text-slate-300">{CHANNEL_LABEL[l.channel] || l.channel}</p>
                        <p className="truncate text-[12px] text-slate-500" title={l.campaign}>{l.campaign || "—"}</p>
                        <AdTrail l={l} onOpenAd={setAdOpen} />
                        {l.attributionMethod === "name" && <Badge tone="warn">name-matched</Badge>}{l.attributionMethod === "none" && <Badge tone="bad">unattributed</Badge>}
                      </td>
                      <td className="px-3 py-2"><p className="text-slate-700 dark:text-slate-300">{l.statusLabel}</p><Badge tone={stageTone(l.stage)}>{STAGE_LABEL[l.stage] || l.stage}</Badge></td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{l.salesperson}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400">{fmtDateTime(l.createdAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{l.responseMin == null ? <Badge tone="bad">not contacted</Badge> : mins(l.responseMin)}</td>
                      <td className="px-3 py-2 text-[12px]">{l.revenue ? <span className="text-emerald-700 dark:text-emerald-400">{inr(l.revenue)}{l.revenueType === "estimated" ? " (est.)" : ""}</span> : l.lostReason ? <span className="text-red-700 dark:text-red-400">{l.lostReason}</span> : <span className="text-slate-400">—</span>}</td>
                    </tr>
                  ))}
                  {!data.leads.length && <tr><td colSpan={7} className="py-10 text-center text-slate-500">No leads match.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </aside>
      </div>
      {/* Outside the drawer so a click inside the creative doesn't close the drawer, and above it */}
      {adOpen && <CreativeModal platform="meta" row={{ id: adOpen.metaAdId, name: adOpen.adName }} zClass="z-[70]" onClose={() => setAdOpen(null)} />}
    </>
  );
}
