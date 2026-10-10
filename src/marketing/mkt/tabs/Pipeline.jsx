// src/marketing/mkt/tabs/Pipeline.jsx
// Leads & Pipeline: which campaigns produce GOOD leads, why leads are lost,
// how fast sales responds, and which follow-ups are slipping.
import { useState } from "react";
import useReport from "../useReport";
import { useMkt, Panel, Loader, ErrorBox, Empty, FunnelChart, DataTable, DrillNum, HBars, Badge, CHANNEL_LABEL, num, pct, mins, inr } from "../ui";

export default function Pipeline() {
  const { openDrill } = useMkt();
  const { data, error, loading, reload } = useReport("/v2/pipeline");
  const [lostCamp, setLostCamp] = useState(null);
  if (loading && !data) return <Loader label="Loading pipeline…" />;
  if (error) return <ErrorBox msg={error} onRetry={reload} />;
  if (!data) return null;
  const r = data.response;
  const campDrill = (row, x) => ({ campaign: row.key, ...x });
  const lc = lostCamp ? data.lostByCampaign.find((c) => c.key === lostCamp) : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Sales funnel" subtitle={`Lead → Contacted → Qualified → Meeting → Proposal → Won${data.stageSkips ? ` · ${data.stageSkips} won lead(s) skipped qualification` : ""}`}>
          <FunnelChart steps={data.funnel} onStep={(s) => openDrill(s.key === "leads" ? {} : { reached: { attempted: "contact_attempted" }[s.key] || s.key }, `${s.label} leads`)} />
          {data.stageSkips > 0 && <button onClick={() => openDrill({ stageSkip: "1" }, "Won without qualification evidence")} className="mt-2 text-[12px] font-semibold text-amber-700 hover:underline dark:text-amber-300">See won leads that skipped qualification</button>}
        </Panel>
        <Panel title="CRM status breakdown" subtitle="Every status, including ones not mapped in Customize CRM — so totals always add up.">
          <ul className="divide-y divide-slate-100 text-[13px] dark:divide-[#1A2030]">
            {data.statuses.map((s) => (
              <li key={s.status}>
                <button onClick={() => openDrill({ status: s.status }, `Status: ${s.label}`)} className="flex w-full items-center justify-between gap-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">{s.label}{s.category === "unmapped" ? <Badge tone="bad">unmapped</Badge> : <Badge>{s.category}</Badge>}</span>
                  <span className="tabular-nums font-semibold">{num(s.count)} <span className="font-normal text-slate-400">{pct((s.count / Math.max(1, data.totals.leads)) * 100, 0)}</span></span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-slate-100 pt-2 text-right text-[12px] text-slate-500 dark:border-[#1A2030]">Total {num(data.totals.leads)} leads</p>
        </Panel>
      </div>

      <Panel title="Lead quality by campaign" subtitle="Which campaigns generate leads that become customers — not just leads." pad={false}>
        <div className="p-3">
          <DataTable id="pl_quality" rows={data.campaignQuality} rowKey={(x) => x.key} initialSort={{ key: "leads", dir: "desc" }}
            columns={[
              { key: "name", label: "Campaign", always: true, render: (x) => <div className="max-w-[260px]"><p className="truncate font-medium" title={x.name}>{x.name}</p><p className="text-[12px] text-slate-500">{CHANNEL_LABEL[x.channel] || x.channel}{x.nameMatched ? " · matched by name" : ""}</p></div> },
              { key: "leads", label: "Leads", align: "right", metric: "leads", render: (x) => <DrillNum value={x.leads} drill={campDrill(x, {})} title={`Leads · ${x.name}`} /> },
              { key: "qualified", label: "Qualified", align: "right", metric: "qualified", render: (x) => <DrillNum value={x.qualified} drill={campDrill(x, { reached: "qualified" })} title={`Qualified · ${x.name}`} /> },
              { key: "qualRate", label: "Qual. %", align: "right", format: "pct", metric: "qualRate" },
              { key: "opportunities", label: "Opportunities", align: "right", metric: "opportunities", render: (x) => <DrillNum value={x.opportunities} drill={campDrill(x, { reached: "meeting" })} title={`Opportunities · ${x.name}`} /> },
              { key: "won", label: "Won", align: "right", metric: "won", render: (x) => <DrillNum value={x.won} drill={campDrill(x, { reached: "won" })} title={`Won · ${x.name}`} className={x.won ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""} /> },
              { key: "winRate", label: "Win %", align: "right", format: "pct" },
              { key: "uncontacted", label: "Not contacted", align: "right", render: (x) => <DrillNum value={x.uncontacted} drill={campDrill(x, { uncontacted: "1" })} title={`Not contacted · ${x.name}`} className={x.uncontacted ? "text-red-600 dark:text-red-400" : ""} /> },
              { key: "lost", label: "Lost", align: "right", render: (x) => <DrillNum value={x.lost} drill={campDrill(x, { lost: "1" })} title={`Lost · ${x.name}`} /> },
              { key: "revenue", label: "Revenue", align: "right", format: "inr", metric: "revenue" },
              { key: "spend", label: "Spend", align: "right", format: "inr" },
              { key: "cpl", label: "CPL", align: "right", format: "inr", metric: "cpl" },
              { key: "cpql", label: "CPQL", align: "right", metric: "cpql", render: (x) => <b>{inr(x.cpql)}</b> },
              { key: "cac", label: "CAC", align: "right", format: "inr", metric: "cac" },
            ]} />
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Why leads are lost" subtitle={lc ? `Campaign: ${lc.name}` : "All lost leads. Pick a campaign to compare."}
          action={<select value={lostCamp || ""} onChange={(e) => setLostCamp(e.target.value || null)} className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] dark:border-[#1F2533] dark:bg-[#0F131B] dark:text-slate-200" aria-label="Campaign for lost reasons">
            <option value="">All campaigns</option>
            {data.lostByCampaign.map((c) => <option key={c.key} value={c.key}>{c.name} ({c.lost})</option>)}
          </select>}>
          {(lc ? lc.reasons : data.lostReasons).length ? (
            <HBars tone="bad" rows={lc ? lc.reasons : data.lostReasons} labelKey="reason" valueKey="count" onClick={(x) => openDrill({ lost: "1", lostReason: x.reason, ...(lc ? { campaign: lc.key } : {}) }, `Lost: ${x.reason}`)} />
          ) : <Empty>No lost leads in this period.</Empty>}
          <p className="mt-3 text-[12px] text-slate-500">Reasons come from the recorded lost reason, the close reason, or the last call remark. “Not specified” means the salesperson left no reason — open the leads to record one.</p>
        </Panel>
        <Panel title="Lead response time" subtitle={`Lead created → first contact attempt. Target: ${mins(r.slaMinutes)}.`}>
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            {[["Median", mins(r.medianMin)], ["Average", mins(r.avgMin)], ["Within target", pct(r.withinSla, 0)]].map(([l, v]) => <div key={l} className="rounded-lg bg-slate-50 py-2 dark:bg-white/5"><p className="text-[12px] text-slate-500">{l}</p><p className="text-[18px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{v}</p></div>)}
          </div>
          <dl className="mb-3 grid grid-cols-4 gap-2 text-center text-[12px]">
            {[["≤5 min", r.pct5], ["≤15 min", r.pct15], ["≤1 hour", r.pct60]].map(([l, v]) => <div key={l}><dt className="text-slate-500">{l}</dt><dd className="font-semibold tabular-nums">{pct(v, 0)}</dd></div>)}
            <div><dt className="text-slate-500">Uncontacted</dt><dd><DrillNum value={r.uncontacted} drill={{ uncontacted: "1" }} title="Uncontacted leads" className="font-semibold text-red-600 dark:text-red-400" /></dd></div>
          </dl>
          <HBars rows={r.buckets} labelKey="label" valueKey="count" tone="info" />
          {r.byChannel.length > 1 && (
            <table className="mt-4 w-full text-[12px]">
              <thead><tr className="text-slate-500"><th className="text-left font-medium">Channel</th><th className="text-right font-medium">Median</th><th className="text-right font-medium">≤1 h</th><th className="text-right font-medium">Uncontacted</th></tr></thead>
              <tbody>{r.byChannel.map((c) => <tr key={c.channel} className="border-t border-slate-100 dark:border-[#1A2030]"><td className="py-1">{CHANNEL_LABEL[c.channel] || c.channel}</td><td className="text-right tabular-nums">{mins(c.medianMin)}</td><td className="text-right tabular-nums">{pct(c.pct60, 0)}</td><td className="text-right tabular-nums">{num(c.uncontacted)}</td></tr>)}</tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel title="Follow-up alerts" subtitle={`Follow-ups due today ${num(data.followups.today)} · upcoming ${num(data.followups.upcoming)} · overdue ${num(data.followups.missed)}`}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.slaAlerts.map((a) => (
            <li key={a.key}>
              <button onClick={() => openDrill(a.drill, a.label)} disabled={!a.count} className={`w-full rounded-lg border px-3 py-3 text-left ${a.count ? "border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10" : "border-slate-200 dark:border-[#1F2533]"}`}>
                <p className="text-[22px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{num(a.count)}</p>
                <p className="text-[12px] text-slate-600 dark:text-slate-300">{a.label}</p>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Sales executive performance" pad={false}>
        <div className="p-3">
          <DataTable id="pl_exec" rows={data.salesExec} rowKey={(x) => x.userId || "un"}
            columns={[
              { key: "name", label: "Executive", always: true, render: (x) => <span className="font-medium">{x.name}</span> },
              { key: "leads", label: "Assigned", align: "right", render: (x) => <DrillNum value={x.leads} drill={{ user: x.userId || "unassigned" }} title={`Assigned · ${x.name}`} /> },
              { key: "newAssigned", label: "Not contacted", align: "right", format: "num" },
              { key: "contacted", label: "Contacted", align: "right", format: "num" },
              { key: "qualified", label: "Qualified", align: "right", format: "num" },
              { key: "opportunities", label: "Meetings", align: "right", format: "num" },
              { key: "proposals", label: "Proposals", align: "right", format: "num" },
              { key: "won", label: "Won", align: "right", format: "num" },
              { key: "revenue", label: "Revenue", align: "right", format: "inr" },
              { key: "avgResponseMin", label: "Avg response", align: "right", render: (x) => mins(x.avgResponseMin) },
              { key: "avgFollowUps", label: "Avg follow-ups", align: "right", format: "dec" },
              { key: "leadToQual", label: "Lead → Qual.", align: "right", format: "pct" },
              { key: "qualToWon", label: "Qual. → Won", align: "right", format: "pct" },
              { key: "overdueFollowUps", label: "Overdue", align: "right", format: "num" },
            ]} />
        </div>
      </Panel>
    </div>
  );
}
