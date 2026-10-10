// src/marketing/mkt/CreativeModal.jsx — NEW FILE
// Opens when you click an ad's creative (thumbnail / name) in Paid Media.
// This replaces the old standalone "Creatives" page: the same information —
// rating and WHY, recommendations, fatigue check, benchmark, CRM results and the
// ad copy — now sits behind the ad itself.
import { useEffect, useState } from "react";
import { ExternalLink, Image as ImageIcon, X } from "lucide-react";
import mktApi from "../mktApi";
import { useMkt, Badge, Loader, DrillNum, MetricInfo, statusTone, inr, num, pct, fmtBy } from "./ui";

const RATING_TONE = { Good: "good", Fair: "warn", "Needs Attention": "bad", Learning: "info" };

// Scoring is one report for all ads, so keep it briefly instead of re-fetching on every click.
let _cache = { key: "", at: 0, data: null };
async function loadScoredAds(params) {
  const key = JSON.stringify(params);
  if (_cache.data && _cache.key === key && Date.now() - _cache.at < 2 * 60000) return _cache.data;
  const { data } = await mktApi.get("/v2/creatives", { params, timeout: 120000 });
  _cache = { key, at: Date.now(), data };
  return data;
}

const statsFor = (platform, m) => (platform === "meta"
  ? [["Spend", inr(m.spend), "spend"], ["Link CTR", pct(m.linkCtr, 2), "linkCtr"], ["CPC", inr(m.cpc), "cpc"], ["Freq.", fmtBy("dec", m.frequency), "frequency"], ["LPV", num(m.lpv), "lpv"], ["CPM", inr(m.cpm), "cpm"]]
  : [["Spend", inr(m.spend), "spend"], ["CTR", pct(m.ctr, 2), "ctr"], ["CPC", inr(m.cpc), "cpc"], ["Impr.", num(m.impressions), "impressions"], ["Clicks", num(m.clicks), "linkClicks"], ["Conv.", fmtBy("dec", m.platformConversions), "platformLeads"]]);

const Dot = ({ cls }) => <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;

export default function CreativeModal({ platform = "meta", row, onClose }) {
  const { params } = useMkt();
  const [ad, setAd] = useState(null);          // scored version of this ad, if available
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadScoredAds(params)
      .then((d) => { if (alive) setAd((d.ads || []).find((a) => a.platform === platform && String(a.id) === String(row.id)) || null); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params, platform, row.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cr = (ad && ad.creative) || row.creative || {};
  const name = (ad && ad.name) || row.name || cr.headline || "Ad";
  const metrics = (ad && ad.metrics) || row;          // the table row carries the same metric keys
  const stats = statsFor(platform, metrics);
  const status = (ad && ad.status) || row.status;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div role="dialog" aria-label={`Creative · ${name}`} className="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-2xl dark:bg-[#121620]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3 dark:border-[#1A2030] dark:bg-[#121620]">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100" title={name}>{name}</h3>
            {ad && <p className="truncate text-[12px] text-slate-500">{platform === "meta" ? "Meta" : "Google"} · {ad.campaignName}{ad.adsetName ? ` › ${ad.adsetName}` : ""}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-5">
          {/* creative preview + badges */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex h-44 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 sm:w-44 dark:bg-white/5">
              {cr.thumbnail
                ? <img src={cr.thumbnail} alt={name} className="h-full w-full object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                : <ImageIcon className="h-8 w-8 text-slate-400" />}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-1">
                {ad && <Badge tone={RATING_TONE[ad.rating]}>{ad.rating === "Learning" ? "Learning · insufficient data" : ad.rating}</Badge>}
                {status && <Badge tone={statusTone(status)}>{String(status).toLowerCase().replace(/_/g, " ")}</Badge>}
                {cr.format && <Badge>{cr.format}</Badge>}
                {ad && ad.fatigue && <Badge tone="warn">possible fatigue</Badge>}
              </div>
              {(cr.headline || cr.body) && (
                <div className="space-y-1 text-[13px]">
                  {cr.headline && <p className="font-semibold text-slate-900 dark:text-slate-100">{cr.headline}</p>}
                  {cr.body && <p className="whitespace-pre-line text-slate-600 dark:text-slate-400">{cr.body}</p>}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {cr.cta && <Badge tone="brand">{String(cr.cta).replace(/_/g, " ").toLowerCase()}</Badge>}
                {cr.linkUrl && <a href={cr.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-violet-700 hover:underline dark:text-violet-300"><ExternalLink className="h-3 w-3" />{cr.linkUrl.replace(/^https?:\/\//, "").split("/")[0]}</a>}
              </div>
              {!cr.thumbnail && !cr.headline && !cr.body && <p className="text-[12px] text-slate-500">No creative preview is available for this ad.</p>}
            </div>
          </div>

          {/* metrics */}
          <dl className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-100 text-[12px] sm:grid-cols-6 dark:border-[#1A2030]">
            {stats.map(([l, v, k]) => (
              <div key={l} className="px-3 py-2"><dt className="flex items-center gap-1 text-slate-500">{l}<MetricInfo k={k} /></dt><dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{v}</dd></div>
            ))}
          </dl>

          {loading && <Loader label="Loading rating…" />}
          {!loading && !ad && <p className="text-[12px] text-slate-500">{failed ? "Couldn't load the rating for this ad." : "No rating for this ad in the selected period (no delivery, or it isn't tracked)."}</p>}

          {ad && (
            <>
              {ad.crm && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-600 dark:text-slate-300">
                  <span>CRM leads <DrillNum value={ad.crm.leads} drill={{ channel: "meta", metaAdId: ad.id }} title={`Leads · ${ad.name}`} /></span>
                  <span>Qualified <DrillNum value={ad.crm.qualified} drill={{ channel: "meta", metaAdId: ad.id, reached: "qualified" }} title={`Qualified · ${ad.name}`} /> ({pct(ad.crm.qualRate, 0)})</span>
                  <span>CPQL <b>{inr(ad.crm.cpql)}</b></span>
                  <span>Won <DrillNum value={ad.crm.won} drill={{ channel: "meta", metaAdId: ad.id, reached: "won" }} title={`Won · ${ad.name}`} /></span>
                </div>
              )}
              <div>
                <p className="mb-1 text-[12px] font-semibold text-slate-700 dark:text-slate-300">Why this rating</p>
                <ul className="space-y-1 text-[13px] text-slate-700 dark:text-slate-300">
                  {ad.reasons && ad.reasons.length ? ad.reasons.map((r, i) => <li key={i} className="flex gap-2"><Dot cls="bg-slate-400" />{r.text}</li>) : <li className="text-slate-500">Metrics are in line with its peers.</li>}
                </ul>
                {ad.recommendations && ad.recommendations.length > 0 && (
                  <>
                    <p className="mb-1 mt-3 text-[12px] font-semibold text-slate-700 dark:text-slate-300">Recommended</p>
                    <ul className="space-y-1 text-[13px] text-slate-700 dark:text-slate-300">{ad.recommendations.map((r, i) => <li key={i} className="flex gap-2"><Dot cls="bg-violet-500" />{r}</li>)}</ul>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
