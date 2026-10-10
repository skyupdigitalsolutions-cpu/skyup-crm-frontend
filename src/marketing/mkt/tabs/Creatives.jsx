// src/marketing/mkt/tabs/Creatives.jsx
// Creative intelligence: every rating explains WHY (with the benchmark it was
// compared against), ads below the minimum-data thresholds stay "Learning",
// and fatigue is detected from the trend, not from frequency alone.
import { useMemo, useState } from "react";
import { ExternalLink, Image as ImageIcon } from "lucide-react";
import useReport from "../useReport";
import { Panel, Loader, ErrorBox, Empty, Badge, Segmented, DrillNum, MetricInfo, SyncNote, statusTone, inr, num, pct, fmtBy } from "../ui";

const RATING_TONE = { Good: "good", Fair: "warn", "Needs Attention": "bad", Learning: "info" };

function CreativeCard({ ad }) {
  const [open, setOpen] = useState(false);
  const m = ad.metrics, cr = ad.creative || {};
  const stats = ad.platform === "meta"
    ? [["Spend", inr(m.spend), "spend"], ["Link CTR", pct(m.linkCtr, 2), "linkCtr"], ["CPC", inr(m.cpc), "cpc"], ["Freq.", fmtBy("dec", m.frequency), "frequency"], ["LPV", num(m.lpv), "lpv"], ["CPM", inr(m.cpm), "cpm"]]
    : [["Spend", inr(m.spend), "spend"], ["CTR", pct(m.ctr, 2), "ctr"], ["CPC", inr(m.cpc), "cpc"], ["Impr.", num(m.impressions), "impressions"], ["Clicks", num(m.clicks), "linkClicks"], ["Conv.", fmtBy("dec", m.platformConversions), "platformLeads"]];
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white dark:border-[#1F2533] dark:bg-[#121620]">
      <div className="flex gap-3 p-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/5">
          {cr.thumbnail ? <img src={cr.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div className="flex h-full items-center justify-center text-slate-400"><ImageIcon className="h-5 w-5" /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="truncate text-[14px] font-semibold text-slate-900 dark:text-slate-100" title={ad.name}>{ad.name}</h4>
            <Badge tone={RATING_TONE[ad.rating]}>{ad.rating === "Learning" ? "Learning · insufficient data" : ad.rating}</Badge>
          </div>
          <p className="truncate text-[12px] text-slate-500">{ad.platform === "meta" ? "Meta" : "Google"} · {ad.campaignName}{ad.adsetName ? ` › ${ad.adsetName}` : ""}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {ad.status && <Badge tone={statusTone(ad.status)}>{ad.status.toLowerCase().replace(/_/g, " ")}</Badge>}
            {cr.format && <Badge>{cr.format}</Badge>}
            {ad.fatigue && <Badge tone="warn">possible fatigue</Badge>}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-3 border-y border-slate-100 text-[12px] sm:grid-cols-6 dark:border-[#1A2030]">
        {stats.map(([l, v, k]) => <div key={l} className="px-3 py-2"><dt className="flex items-center gap-1 text-slate-500">{l}<MetricInfo k={k} /></dt><dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{v}</dd></div>)}
      </dl>
      {ad.crm && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-[12px] text-slate-600 dark:text-slate-300">
          <span>CRM leads <DrillNum value={ad.crm.leads} drill={{ channel: "meta", metaAdId: ad.id }} title={`Leads · ${ad.name}`} /></span>
          <span>Qualified <DrillNum value={ad.crm.qualified} drill={{ channel: "meta", metaAdId: ad.id, reached: "qualified" }} title={`Qualified · ${ad.name}`} /> ({pct(ad.crm.qualRate, 0)})</span>
          <span>CPQL <b>{inr(ad.crm.cpql)}</b></span>
          <span>Won <DrillNum value={ad.crm.won} drill={{ channel: "meta", metaAdId: ad.id, reached: "won" }} title={`Won · ${ad.name}`} /></span>
        </div>
      )}
      <div className="flex-1 px-4 py-3">
        <p className="mb-1 text-[12px] font-semibold text-slate-700 dark:text-slate-300">Why this rating</p>
        <ul className="space-y-1 text-[13px] text-slate-700 dark:text-slate-300">
          {ad.reasons.length ? ad.reasons.map((r, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />{r.text}</li>) : <li className="text-slate-500">Metrics are in line with its peers.</li>}
        </ul>
        {ad.recommendations.length > 0 && (
          <>
            <p className="mb-1 mt-3 text-[12px] font-semibold text-slate-700 dark:text-slate-300">Recommended</p>
            <ul className="space-y-1 text-[13px] text-slate-700 dark:text-slate-300">{ad.recommendations.map((r, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />{r}</li>)}</ul>
          </>
        )}
        {ad.fatigue && (
          <table className="mt-3 w-full text-[12px]">
            <thead><tr className="text-slate-500"><th className="text-left font-medium">Fatigue check</th><th className="text-right font-medium">1st half</th><th className="text-right font-medium">2nd half</th></tr></thead>
            <tbody className="tabular-nums">
              <tr><td>Frequency</td><td className="text-right">{fmtBy("dec", ad.fatigue.firstHalf.frequency)}</td><td className="text-right">{fmtBy("dec", ad.fatigue.secondHalf.frequency)}</td></tr>
              <tr><td>Link CTR</td><td className="text-right">{pct(ad.fatigue.firstHalf.linkCtr, 2)}</td><td className="text-right">{pct(ad.fatigue.secondHalf.linkCtr, 2)}</td></tr>
              <tr><td>CPC</td><td className="text-right">{inr(ad.fatigue.firstHalf.cpc)}</td><td className="text-right">{inr(ad.fatigue.secondHalf.cpc)}</td></tr>
            </tbody>
          </table>
        )}
        {ad.benchmark && ad.benchmark.linkCtr != null && <p className="mt-2 text-[12px] text-slate-500">Compared with the {ad.benchmark.label}: Link CTR {pct(ad.benchmark.linkCtr, 2)}, CPC {inr(ad.benchmark.cpc)}.</p>}
      </div>
      {(cr.headline || cr.body) && (
        <div className="border-t border-slate-100 px-4 py-2 dark:border-[#1A2030]">
          <button onClick={() => setOpen(!open)} className="text-[12px] font-semibold text-violet-700 hover:underline dark:text-violet-300">{open ? "Hide ad copy" : "Show ad copy"}</button>
          {open && (
            <div className="mt-2 space-y-1 text-[13px]">
              {cr.headline && <p className="font-semibold text-slate-900 dark:text-slate-100">{cr.headline}</p>}
              {cr.body && <p className="whitespace-pre-line text-slate-600 dark:text-slate-400">{cr.body}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {cr.cta && <Badge tone="brand">{String(cr.cta).replace(/_/g, " ").toLowerCase()}</Badge>}
                {cr.linkUrl && <a href={cr.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-violet-700 hover:underline dark:text-violet-300"><ExternalLink className="h-3 w-3" />{cr.linkUrl.replace(/^https?:\/\//, "").split("/")[0]}</a>}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function Creatives() {
  const { data, error, loading, reload } = useReport("/v2/creatives");
  const [rating, setRating] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState("spend");
  const ads = useMemo(() => {
    let a = data ? data.ads : [];
    if (rating === "fatigue") a = a.filter((x) => x.fatigue);
    else if (rating !== "all") a = a.filter((x) => x.rating === rating);
    if (platform !== "all") a = a.filter((x) => x.platform === platform);
    const val = { spend: (x) => x.metrics.spend, cpql: (x) => (x.crm && x.crm.cpql != null ? -x.crm.cpql : -Infinity), score: (x) => x.score, ctr: (x) => x.metrics.linkCtr || 0 }[sort];
    return [...a].sort((p, q) => val(q) - val(p));
  }, [data, rating, platform, sort]);

  if (loading && !data) return <Loader label="Scoring creatives…" />;
  if (error) return <ErrorBox msg={error} onRetry={reload} />;
  if (!data) return null;
  const th = data.thresholds, al = data.adLevelAttribution;

  return (
    <div className="space-y-4">
      <Panel title="How creatives are rated" subtitle={`Ads need ≥${num(th.minImpressions)} impressions, ≥${inr(th.minSpend)} spend and ≥${num(th.minClicks)} link clicks before they're rated; business quality needs ≥${th.minLeads} CRM leads. Each ad is compared with its own ad set, not a fixed CTR cut-off. Change thresholds in Data Health → Settings.`}>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {[["all", `All (${data.ads.length})`], ["Good", `Good (${data.counts.Good || 0})`], ["Fair", `Fair (${data.counts.Fair || 0})`], ["Needs Attention", `Needs attention (${data.counts["Needs Attention"] || 0})`], ["Learning", `Learning (${data.counts.Learning || 0})`], ["fatigue", `Fatigue (${data.fatigued})`]].map(([v, l]) => (
            <button key={v} onClick={() => setRating(v)} className={`rounded-full border px-3 py-1 ${rating === v ? "border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[#1F2533] dark:text-slate-300"}`}>{l}</button>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <Segmented size="sm" value={platform} onChange={setPlatform} options={[["all", "All"], ["meta", "Meta"], ["google", "Google"]]} />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] dark:border-[#1F2533] dark:bg-[#0F131B] dark:text-slate-200" aria-label="Sort creatives">
              <option value="spend">Sort: spend</option><option value="cpql">Sort: best CPQL</option><option value="score">Sort: score</option><option value="ctr">Sort: Link CTR</option>
            </select>
          </span>
        </div>
        {al.metaLeads > 0 && al.pct < 50 && <p className="mt-3 text-[12px] text-amber-700 dark:text-amber-300">Only {pct(al.pct, 0)} of Meta CRM leads carry an ad ID, so most ads are rated on platform metrics. New leads capture ad IDs automatically from now on.</p>}
      </Panel>
      {!ads.length ? <Empty>No creatives match.</Empty> : <div className="grid gap-4 lg:grid-cols-2">{ads.map((a) => <CreativeCard key={a.platform + a.id} ad={a} />)}</div>}
      <SyncNote sync={data.sync} />
    </div>
  );
}
