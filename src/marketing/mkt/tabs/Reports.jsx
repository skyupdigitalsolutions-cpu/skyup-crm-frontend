// src/marketing/mkt/tabs/Reports.jsx
// Cross-channel performance report with drill-down:
//   Meta:   Source → Campaign → Ad Set → Ad → Leads
//   Google: Source → Campaign → Ad Group → Keyword → Leads
import { useState } from "react";
import { ChevronRight, Download } from "lucide-react";
import useReport from "../useReport";
import { useMkt, Panel, Loader, ErrorBox, DataTable, SyncNote, CHANNEL_LABEL, businessColumns, downloadCSV, statusTone, Badge, fmtRange, inr, num, pct, fmtBy } from "../ui";

const LEVEL_LABEL = { channel: "Source", campaign: "Campaign", adset: "Ad set", ad: "Ad", adGroup: "Ad group", keyword: "Keyword" };

export default function Reports() {
  const { openDrill } = useMkt();
  const [path, setPath] = useState([{ level: "channel", label: "All sources", q: {} }]);
  const cur = path[path.length - 1];
  const { data, error, loading, reload } = useReport("/v2/report", { level: cur.level, ...cur.q });

  const leadDrill = (r, extra) => {
    const base = { ...cur.q };
    if (cur.level === "channel") base.channel = r.key;
    if (cur.level === "campaign") base.campaign = r.key;
    if (cur.level === "adset") base.metaAdsetId = r.key;
    if (cur.level === "ad") base.metaAdId = r.key;
    if (cur.level === "adGroup") base.googleAdGroupId = r.key;
    if (cur.level === "keyword") { base.keyword = r.key; base.googleAdGroupId = cur.q.adGroup; }
    delete base.adset; delete base.adGroup;
    if (cur.level === "adset" || cur.level === "ad") delete base.campaign;
    return { ...base, ...extra };
  };
  const go = (r) => {
    if (!r.next || r.next === "leads") { openDrill(leadDrill(r, {}), `Leads · ${r.name}`); return; }
    const q = { ...cur.q };
    if (r.next === "campaign") q.channel = r.key;
    if (r.next === "adset" || r.next === "adGroup") q.campaign = r.key;
    if (r.next === "ad") q.adset = r.key;
    if (r.next === "keyword") q.adGroup = r.key;
    setPath([...path, { level: r.next, label: cur.level === "channel" ? CHANNEL_LABEL[r.key] || r.key : r.name, q }]);
  };

  const cols = [
    { key: "name", label: LEVEL_LABEL[cur.level], always: true, render: (r) => (
      <span className="flex items-center gap-2">
        <span className="font-medium">{cur.level === "channel" ? CHANNEL_LABEL[r.name] || r.name : r.name}</span>
        {r.status && <Badge tone={statusTone(r.status)}>{String(r.status).toLowerCase().replace(/_/g, " ")}</Badge>}
        {r.nameMatched && <Badge tone="warn">name-matched</Badge>}
        {r.next && r.next !== "leads" && <ChevronRight className="h-4 w-4 text-slate-400" />}
      </span>) },
    ...businessColumns(leadDrill),
  ];

  return (
    <div className="space-y-4">
      <nav aria-label="Report level" className="flex flex-wrap items-center gap-1 text-[13px]">
        {path.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
            <button onClick={() => setPath(path.slice(0, i + 1))} disabled={i === path.length - 1} className={i === path.length - 1 ? "font-semibold text-slate-900 dark:text-slate-100" : "text-violet-700 hover:underline dark:text-violet-300"}>{p.label}</button>
          </span>
        ))}
      </nav>
      {loading && !data && <Loader />}
      {error && <ErrorBox msg={error} onRetry={reload} />}
      {data && (
        <Panel title={`Performance by ${LEVEL_LABEL[cur.level].toLowerCase()}`} subtitle={`${fmtRange(data.range.from, data.range.to)} · click a row to drill down; click a number to see its leads.`} pad={false}
          action={<button onClick={() => downloadCSV(`report_${cur.level}_${data.range.from}_${data.range.to}.csv`, [{ key: "name", label: LEVEL_LABEL[cur.level] }, ...businessColumns().map((c) => ({ key: c.key, label: c.label }))], data.rows)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 dark:border-[#1F2533] dark:text-slate-200"><Download className="h-3.5 w-3.5" />Export CSV</button>}>
          <div className="p-3">
            <DataTable id={`rep_${cur.level}`} rows={data.rows} rowKey={(r) => r.key} onRowClick={go} columns={cols} initialSort={{ key: "spend", dir: "desc" }} />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 text-[12px] text-slate-600 dark:border-[#1A2030] dark:text-slate-300">
              <span>Total spend <b>{inr(data.totals.spend)}</b></span><span>Leads <b>{num(data.totals.leads)}</b></span><span>Qualified <b>{num(data.totals.qualified)}</b> ({pct(data.totals.qualRate, 0)})</span>
              <span>CPQL <b>{inr(data.totals.cpql)}</b></span><span>Won <b>{num(data.totals.won)}</b></span><span>Revenue <b>{inr(data.totals.revenue)}</b></span><span>ROAS <b>{fmtBy("x", data.totals.roas)}</b></span>
            </div>
          </div>
        </Panel>
      )}
      {data && <SyncNote sync={data.sync} />}
    </div>
  );
}
