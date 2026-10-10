// src/marketing/mkt/tabs/Overview.jsx
// Business outcome first: what was spent, what it produced, and what needs
// attention now. Every number opens the leads behind it.
import { useState } from "react";
import { AlertCircle, AlertTriangle, Info, ChevronRight } from "lucide-react";
import useReport from "../useReport";
import {
  useMkt, Panel, MetricCell, Loader, ErrorBox, Empty, TrendChart, FunnelChart, DataTable, DrillNum, Badge,
  CHANNEL_LABEL, inr, pct, num, mins, businessColumns, fmtRange,
} from "../ui";

const SEV = {
  critical: { icon: AlertCircle, cls: "border-l-red-500", tone: "bad" },
  warning: { icon: AlertTriangle, cls: "border-l-amber-500", tone: "warn" },
  info: { icon: Info, cls: "border-l-blue-500", tone: "info" },
};
const TREND_SERIES = [
  { key: "spend", label: "Spend", color: "#8B5CF6", format: "inr", kind: "bar" },
  { key: "leads", label: "Leads", color: "#2563EB" },
  { key: "qualified", label: "Qualified", color: "#D97706" },
  { key: "won", label: "Won", color: "#059669" },
  { key: "revenue", label: "Revenue", color: "#0D9488", format: "inr" },
];

export default function Overview({ onNav }) {
  const { openDrill } = useMkt();
  const { data, error, loading, reload } = useReport("/v2/overview");
  const [series, setSeries] = useState(["spend", "leads", "qualified"]);

  if (loading && !data) return <Loader label="Building your overview…" />;
  if (error) return <ErrorBox msg={error} onRetry={reload} />;
  if (!data) return null;

  const drillFor = (r, extra) => ({ channel: r.channel, ...extra });
  const campDrill = (r, extra) => ({ campaign: r.key, ...extra });

  return (
    <div className="space-y-5">
      {/* Business outcome — one connected ledger, left to right = money in → money out */}
      <section aria-label="Business outcome" className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#1F2533] dark:bg-[#121620]">
        <div className="flex items-baseline justify-between gap-2 px-4 pt-3">
          <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">Business outcome</h2>
          <span className="text-[12px] text-slate-500">{fmtRange(data.range.from, data.range.to)}{data.compareRange ? ` vs ${fmtRange(data.compareRange.from, data.compareRange.to)}` : ""}</span>
        </div>
        <div className="grid grid-cols-2 divide-slate-100 sm:grid-cols-4 lg:grid-cols-7 lg:divide-x dark:divide-[#1A2030]">
          {data.business.map((m) => (
            <MetricCell key={m.key} m={m} emphasis
              onClick={m.key === "spend" ? () => onNav("paid") : m.key === "roas" ? undefined : () => openDrill(m.drill || {}, `${m.label} · ${fmtRange(data.range.from, data.range.to)}`)} />
          ))}
        </div>
        <div className="border-t border-slate-100 px-4 pt-3 dark:border-[#1A2030]"><h2 className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Efficiency</h2></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 lg:divide-x divide-slate-100 dark:divide-[#1A2030]">
          {data.efficiency.map((m) => <MetricCell key={m.key} m={m} />)}
        </div>
      </section>

      {/* Action Center */}
      <Panel title="Needs attention" subtitle="Operational issues ranked by severity. Click to see the leads or the page.">
        {!data.actionCenter.length ? <Empty>Nothing needs attention right now.</Empty> : (
          <ul className="divide-y divide-slate-100 dark:divide-[#1A2030]">
            {data.actionCenter.map((a, i) => {
              const S = SEV[a.severity] || SEV.info;
              const clickable = a.drill || a.tab;
              return (
                <li key={i}>
                  <button disabled={!clickable} onClick={() => (a.drill ? openDrill(a.drill, a.title) : onNav(a.tab, a.sub))}
                    className={`flex w-full items-start gap-3 border-l-4 ${S.cls} py-2.5 pl-3 pr-2 text-left ${clickable ? "hover:bg-slate-50 dark:hover:bg-white/[0.03]" : ""}`}>
                    <S.icon className={`mt-0.5 h-4 w-4 shrink-0 ${a.severity === "critical" ? "text-red-600" : a.severity === "warning" ? "text-amber-600" : "text-blue-600"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100">{a.title}</span>
                      {a.detail && <span className="block truncate text-[12px] text-slate-500">{a.detail}</span>}
                    </span>
                    {clickable && <ChevronRight className="mt-0.5 h-4 w-4 text-slate-400" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Channel performance */}
      <Panel title="Channel performance" subtitle="Which channel actually produces qualified leads and customers — not just leads." pad={false}>
        <div className="p-3">
          <DataTable id="ov_channels" search={false} rows={data.channels} rowKey={(r) => r.channel}
            columns={[
              { key: "channel", label: "Channel", always: true, render: (r) => <span className="font-medium">{CHANNEL_LABEL[r.channel] || r.channel}</span> },
              { key: "platformLeads", label: "Platform leads", align: "right", metric: "platformLeads", render: (r) => (r.platformLeads == null ? "—" : num(r.platformLeads)) },
              ...businessColumns(drillFor),
            ]} />
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel className="lg:col-span-2" title="Sales funnel" subtitle="Stage-to-stage conversion shows where the process leaks.">
          <FunnelChart steps={data.funnel} onStep={(s) => openDrill(s.key === "leads" ? {} : { reached: { attempted: "contact_attempted", meeting: "meeting" }[s.key] || s.key }, `${s.label} leads`)} />
        </Panel>
        <Panel className="lg:col-span-3" title="Performance trend" subtitle={data.trend.granularity === "hour" ? "Hourly — single-day range" : "Daily"}
          action={
            <div className="flex flex-wrap gap-1">
              {TREND_SERIES.map((s) => (
                <button key={s.key} onClick={() => setSeries((v) => (v.includes(s.key) ? v.filter((x) => x !== s.key) : [...v, s.key]))}
                  aria-pressed={series.includes(s.key)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] ${series.includes(s.key) ? "border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-white/5 dark:text-slate-100" : "border-transparent text-slate-400"}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}
                </button>
              ))}
            </div>
          }>
          <TrendChart points={data.trend.points} granularity={data.trend.granularity} series={TREND_SERIES.filter((s) => series.includes(s.key))} />
          {!data.trend.spendByCampaignAvailable && <p className="mt-1 text-[12px] text-slate-500">Spend line hidden while a single campaign is selected.</p>}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {[["Best campaigns by CPQL", data.topCampaigns, "Campaigns with spend that produce qualified leads cheapest."], ["Campaigns to review", data.bottomCampaigns, "Spend with no qualified leads, or the highest CPQL."]].map(([t, rows, sub]) => (
          <Panel key={t} title={t} subtitle={sub} pad={false}>
            {!rows.length ? <Empty>No campaigns with spend in this period.</Empty> : (
              <table className="w-full text-[13px]">
                <thead><tr className="text-[12px] text-slate-500">{["Campaign", "Spend", "Leads", "Qualified", "CPQL", "Won"].map((h, i) => <th key={h} className={`px-4 py-2 font-medium ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.key} className="border-t border-slate-100 dark:border-[#1A2030]">
                      <td className="max-w-[220px] px-4 py-2"><p className="truncate font-medium text-slate-800 dark:text-slate-200" title={c.name}>{c.name}</p><p className="text-[12px] text-slate-500">{CHANNEL_LABEL[c.channel] || c.channel}</p></td>
                      <td className="px-4 py-2 text-right tabular-nums">{inr(c.spend)}</td>
                      <td className="px-4 py-2 text-right"><DrillNum value={c.leads} drill={campDrill(c, {})} title={`Leads · ${c.name}`} /></td>
                      <td className="px-4 py-2 text-right"><DrillNum value={c.qualified} drill={campDrill(c, { reached: "qualified" })} title={`Qualified · ${c.name}`} /></td>
                      <td className={`px-4 py-2 text-right font-semibold tabular-nums ${c.qualified ? "" : "text-red-600 dark:text-red-400"}`}>{c.qualified ? inr(c.cpql) : "no qualified"}</td>
                      <td className="px-4 py-2 text-right"><DrillNum value={c.won} drill={campDrill(c, { reached: "won" })} title={`Won · ${c.name}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        ))}
      </div>

      <Panel title="Sales executive performance" subtitle={`Median first response ${mins(data.response.medianMin)} · ${pct(data.response.pct60, 0)} contacted within 1 hour · ${num(data.response.uncontacted)} not contacted yet. Separates a weak campaign from weak follow-up.`} pad={false}>
        <div className="p-3">
          <DataTable id="ov_exec" rows={data.salesExec} rowKey={(r) => r.userId || "un"}
            columns={[
              { key: "name", label: "Executive", always: true, render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "leads", label: "Assigned", align: "right", render: (r) => <DrillNum value={r.leads} drill={{ user: r.userId || "unassigned" }} title={`Assigned · ${r.name}`} /> },
              { key: "newAssigned", label: "Not contacted", align: "right", render: (r) => <DrillNum value={r.newAssigned} drill={{ user: r.userId || "unassigned", uncontacted: "1" }} title={`Not contacted · ${r.name}`} className={r.newAssigned ? "text-red-600 dark:text-red-400" : ""} /> },
              { key: "contacted", label: "Contacted", align: "right", format: "num" },
              { key: "qualified", label: "Qualified", align: "right", render: (r) => <DrillNum value={r.qualified} drill={{ user: r.userId || "unassigned", reached: "qualified" }} title={`Qualified · ${r.name}`} /> },
              { key: "opportunities", label: "Meetings", align: "right", format: "num" },
              { key: "proposals", label: "Proposals", align: "right", format: "num" },
              { key: "won", label: "Won", align: "right", render: (r) => <DrillNum value={r.won} drill={{ user: r.userId || "unassigned", reached: "won" }} title={`Won · ${r.name}`} className={r.won ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""} /> },
              { key: "revenue", label: "Revenue", align: "right", format: "inr" },
              { key: "avgResponseMin", label: "Avg response", align: "right", metric: "responseTime", render: (r) => mins(r.avgResponseMin) },
              { key: "medianResponseMin", label: "Median response", align: "right", render: (r) => mins(r.medianResponseMin), default: false },
              { key: "avgFollowUps", label: "Avg follow-ups", align: "right", format: "dec" },
              { key: "leadToQual", label: "Lead → Qualified", align: "right", format: "pct" },
              { key: "qualToWon", label: "Qualified → Won", align: "right", format: "pct" },
              { key: "overdueFollowUps", label: "Overdue follow-ups", align: "right", render: (r) => <DrillNum value={r.overdueFollowUps} drill={{ user: r.userId || "unassigned", overdue: "1" }} title={`Overdue follow-ups · ${r.name}`} className={r.overdueFollowUps ? "text-amber-700 dark:text-amber-400" : ""} /> },
            ]} />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3 text-[12px] dark:border-[#1A2030]">
          <Badge tone="info">Follow-ups today: {num(data.followups.today)}</Badge>
          <Badge tone="neutral">Upcoming: {num(data.followups.upcoming)}</Badge>
          <button onClick={() => openDrill({ overdue: "1" }, "Leads with overdue follow-ups")}><Badge tone={data.followups.missed ? "bad" : "neutral"}>Overdue: {num(data.followups.missed)}</Badge></button>
        </div>
      </Panel>
    </div>
  );
}
