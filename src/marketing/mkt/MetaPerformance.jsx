// src/marketing/mkt/MetaPerformance.jsx — NEW FILE
// Overview section: the Meta Ads Manager campaign numbers as charts, for ANY date range.
//   Amount spent · Leads · Cost per lead · Impressions · Reach · CPM · CTR (link) · Frequency · Results
// The date range here is independent of the dashboard's: follow the dashboard, pick a quick range,
// or choose a custom From–To. Data comes from /v2/meta-charts (Meta's own insights, same as Ads Manager).
import { createElement, useEffect, useRef, useState } from "react";
import { IndianRupee, Users, Target, Eye, Layers, Gauge, MousePointerClick, Repeat, RefreshCw, Download, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import mktApi from "../mktApi";
import { useMkt, Segmented, ErrorBox, Empty, fmtRange, ago, downloadCSV } from "./ui";
import { Sparkline, LineChart, BarRank, Donut } from "./charts";
import CampaignFilter, { FilterChips } from "./CampaignFilter";
import {
  METRICS, METRIC_ORDER, RANGE_OPTIONS, resolveRange, istToday, toggleMetric, trendScale, CAMPAIGN_COLORS, defaultVisible, campaignPoints, barTone, cellTone, rankCampaigns, sortRows, spendShare,
  fInt, fMoney0, fMoney2, fPct2, fDec2, viewRows, pluralize, LEVEL_WORD,
} from "./metaPerfUtils";

const TILES = [
  ["spend", IndianRupee, (d) => (d.viewLabel || `${fInt(d.totals.campaigns)} campaign${d.totals.campaigns === 1 ? "" : "s"}`)],
  ["leads", Users, () => "reported by Meta"],
  ["cpl", Target, () => "per lead"],
  ["impressions", Eye, () => "times ads were shown"],
  ["reach", Layers, (d) => (d.multiAccount ? "sum of accounts" : "unique people")],
  ["cpm", Gauge, () => "per 1,000 impressions"],
  ["linkCtr", MousePointerClick, () => "link click-through"],
  ["frequency", Repeat, () => "views per person"],
];

const card = "rounded-xl border border-slate-200 bg-white dark:border-[#1F2533] dark:bg-[#121620]";
const input = "rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-800 dark:border-[#1F2533] dark:bg-[#0F131B] dark:text-slate-100";

function Tile({ id, icon, metric, value, sub, spark }) {
  const m = METRICS[metric];
  return (
    <div data-tile={id} className={`${card} relative overflow-hidden p-3.5`}>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${m.color}, ${m.color}33)` }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{m.label}</p>
          <p className="mt-0.5 truncate text-[22px] font-bold leading-tight tabular-nums text-slate-900 dark:text-slate-50">{m.fmt(value)}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${m.color}1F`, color: m.color }}>{createElement(icon, { className: "h-4 w-4" })}</span>
      </div>
      <div className="mt-2 -mb-1"><Sparkline values={spark} color={m.color} width={150} height={30} /></div>
    </div>
  );
}

function SortTh({ label, k, sort, setSort, left }) {
  const on = sort.key === k;
  return (
    <th aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`whitespace-nowrap px-3 py-2 font-medium ${left ? "text-left" : "text-right"}`}>
      <button type="button" onClick={() => setSort(on ? { key: k, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: k, dir: left ? "asc" : "desc" })}
        className={`inline-flex items-center gap-0.5 ${on ? "text-violet-700 dark:text-violet-300" : "hover:text-slate-800 dark:hover:text-slate-200"}`}>
        {label}{on && (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

const STATUS_DOT = { ACTIVE: "bg-emerald-500", PAUSED: "bg-amber-500", ARCHIVED: "bg-slate-400", DELETED: "bg-slate-400" };

export default function MetaPerformance() {
  const { params, refreshKey } = useMkt();
  const [mode, setMode] = useState("dash");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [metrics, setMetrics] = useState(["spend", "leads"]);       // Overall trend: any number of metrics at once
  const [trendView, setTrendView] = useState("overall");              // "overall" | "campaign" (one line per campaign)
  const [cmetric, setCmetric] = useState("spend");                    // Campaign-wise trend: the metric every line shows
  const [shownPick, setShownPick] = useState(null);                   // campaigns you switched on/off: { key: filter, ids }
  const [hoverKey, setHoverKey] = useState(null);                     // legend item being hovered → its line is emphasised
  const [ct, setCt] = useState({ key: "", data: null, error: "" });   // campaign-wise daily data
  const [cmp, setCmp] = useState("spend");
  const [sort, setSort] = useState({ key: "spend", dir: "desc" });
  const [sel, setSel] = useState({ ids: [], names: {} });          // campaign filter (empty = all campaigns)
  const [res, setRes] = useState({ key: "", data: null, error: "" });
  const [nonce, setNonce] = useState(0);
  const forceNext = useRef(false);
  const lastRefreshKey = useRef(refreshKey);

  const range = resolveRange(mode, custom, params);
  const { from, to, days, error: rangeError } = range;
  const selKey = sel.ids.join(",");
  const reqKey = `${from}|${to}|${selKey}|${nonce}|${refreshKey}`;

  useEffect(() => {
    if (rangeError || !from || !to) return undefined;
    let alive = true;
    const p = { from, to };
    if (selKey) p.campaigns = selKey;
    // The dashboard's own sync (auto every 15 min / manual) also pulls fresh numbers for these charts.
    if (forceNext.current || lastRefreshKey.current !== refreshKey) { p.refresh = "1"; forceNext.current = false; lastRefreshKey.current = refreshKey; }
    mktApi.get("/v2/meta-charts", { params: p, timeout: 120000 })
      .then((r) => { if (alive) setRes({ key: reqKey, data: r.data, error: "" }); })
      .catch((e) => { if (alive) setRes((s) => ({ key: reqKey, data: s.data, error: e?.response?.data?.message || "Couldn't load Meta Ads data." })); });
    return () => { alive = false; };
  }, [from, to, selKey, rangeError, reqKey, refreshKey]);

  const loading = !rangeError && res.key !== reqKey;

  // Campaign-wise daily data is heavier (campaigns × days), so it is only fetched when that view is open.
  const ctKey = `${from}|${to}|${selKey}|${nonce}|${refreshKey}`;
  const ctSeen = useRef({ nonce, refreshKey });
  useEffect(() => {
    if (trendView !== "campaign" || rangeError || !from || !to) return undefined;
    let alive = true;
    const p = { from, to };
    if (selKey) p.campaigns = selKey;
    if (ctSeen.current.nonce !== nonce || ctSeen.current.refreshKey !== refreshKey) { p.refresh = "1"; ctSeen.current = { nonce, refreshKey }; }
    mktApi.get("/v2/meta-campaign-trend", { params: p, timeout: 120000 })
      .then((r) => { if (alive) setCt({ key: ctKey, data: r.data, error: "" }); })
      .catch((e) => { if (alive) setCt((v) => ({ key: ctKey, data: v.data, error: e?.response?.data?.message || "Couldn't load the campaign trend." })); });
    return () => { alive = false; };
  }, [trendView, from, to, selKey, rangeError, ctKey, nonce, refreshKey]);
  const ctLoading = trendView === "campaign" && !rangeError && ct.key !== ctKey;
  const d = res.data;
  // Whatever the server sends, this section must never break the Overview — missing pieces become empty.
  const campaigns = (d && Array.isArray(d.campaigns)) ? d.campaigns : [];
  const trend = (d && Array.isArray(d.trend)) ? d.trend : [];
  const totals = (d && d.totals) || {};
  const refresh = () => { forceNext.current = true; setNonce((n) => n + 1); };
  // ── trend chart inputs ──
  const cd = ct.data;
  const ccamps = cd && Array.isArray(cd.campaigns) ? cd.campaigns : [];
  const cdays = cd && Array.isArray(cd.days) ? cd.days : [];
  const defaultIds = defaultVisible(ccamps, sel.ids);
  const visibleIds = shownPick && shownPick.key === selKey ? shownPick.ids.filter((id) => ccamps.some((c) => c.id === id)) : defaultIds;
  const colorOf = (id) => CAMPAIGN_COLORS[Math.max(0, ccamps.findIndex((c) => c.id === id)) % CAMPAIGN_COLORS.length];
  const campView = trendView === "campaign";
  const lineSeries = campView
    ? ccamps.filter((c) => visibleIds.includes(c.id)).map((c) => ({ key: c.id, label: c.name, color: colorOf(c.id), fmt: METRICS[cmetric].fmt, tick: METRICS[cmetric].tick }))
    : metrics.map((k) => ({ key: k, label: METRICS[k].label, color: METRICS[k].color, fmt: METRICS[k].fmt, tick: METRICS[k].tick }));
  const linePoints = campView ? campaignPoints(cdays, ccamps, visibleIds, cmetric) : trend;
  const lineScale = campView ? "shared" : trendScale(metrics.length);
  const chooseMode = (m) => {
    if (m === "custom" && !custom.from && !custom.to) setCustom({ from: from || "", to: to || istToday() });
    setMode(m);
  };

  // ── derived views ──
  const view = viewRows(d, sel.ids);
  const level = view.level, rowsAll = view.rows;
  const word = LEVEL_WORD[level];
  const ranked = rankCampaigns(rowsAll, cmp).map((c) => ({ key: c.id, name: c.name, value: c[cmp], sub: `${c.name} · ${METRICS[cmp].fmt(c[cmp])}` }));
  const maxCmp = Math.max(0, ...ranked.map((r) => r.value || 0));
  const rows = sortRows(rowsAll, sort.key, sort.dir);
  const maxSpend = Math.max(0, ...rowsAll.map((c) => c.spend || 0));
  const viewLabel = sel.ids.length ? (level === "adset" ? `${pluralize("adset", rowsAll.length)} of this campaign` : `${pluralize("campaign", sel.ids.length)} selected`) : "";
  const csvCols = [
    { key: "name", label: word[2] }, { key: "status", label: "Status" }, { key: "results", label: "Results" }, { key: "resultType", label: "Result type" },
    { key: "leads", label: "Leads" }, { key: "cpl", label: "Cost per lead" }, { key: "costPerResult", label: "Cost per result" }, { key: "frequency", label: "Frequency" },
    { key: "spend", label: "Amount spent" }, { key: "impressions", label: "Impressions" }, { key: "reach", label: "Reach" }, { key: "cpm", label: "CPM" }, { key: "linkCtr", label: "CTR (link click-through rate)" },
  ];

  return (
    <section aria-label="Meta Ads performance" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">Meta Ads performance</h2>
          <p className="text-[12px] text-slate-500">
            {rangeError ? "Choose a valid date range" : `${fmtRange(from, to)} · ${days} day${days === 1 ? "" : "s"}`}
            {d && d.fetchedAt ? ` · updated ${ago(d.fetchedAt)}` : ""} · numbers straight from Meta, same as Ads Manager
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CampaignFilter options={campaigns} selected={sel.ids} names={sel.names} disabled={!d || !d.configured}
            onApply={(ids, names) => setSel({ ids, names })} />
          <Segmented size="sm" value={mode} onChange={chooseMode} options={RANGE_OPTIONS} />
          <button type="button" onClick={refresh} disabled={loading} title="Pull fresh numbers from Meta" aria-label="Refresh Meta data"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1F2533] dark:text-slate-200 dark:hover:bg-white/5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
        </div>
      </div>

      {mode === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-600 dark:text-slate-300">
          <label className="flex items-center gap-1.5">From <input type="date" aria-label="Graph start date" value={custom.from} max={custom.to || istToday()} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className={input} /></label>
          <label className="flex items-center gap-1.5">To <input type="date" aria-label="Graph end date" value={custom.to} min={custom.from || undefined} max={istToday()} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className={input} /></label>
          {rangeError && <span role="alert" className="text-rose-600 dark:text-rose-400">{rangeError}</span>}
        </div>
      )}

      <FilterChips ids={sel.ids} names={sel.names} onRemove={(id) => setSel((v) => ({ ids: v.ids.filter((x) => x !== id), names: v.names }))} onClear={() => setSel({ ids: [], names: {} })} />

      {res.error && !loading && <ErrorBox msg={res.error} onRetry={refresh} />}
      {loading && !d && (
        <div aria-busy="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className={`${card} h-[112px] animate-pulse`} />)}
        </div>
      )}

      {d && !d.configured && <div className={card}><Empty>No Meta Ads account is connected yet — connect one to see campaign charts here.</Empty></div>}
      {d && d.configured && d.tokenExpired && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Your Meta Ads access has expired. Reconnect the account to see fresh numbers.{d.error ? ` (${d.error})` : ""}
        </div>
      )}
      {d && d.configured && !d.tokenExpired && d.error && !res.error && <ErrorBox msg={d.error} onRetry={refresh} />}

      {d && d.configured && !d.tokenExpired && !d.error && !campaigns.length && <div className={card}><Empty>No Meta campaigns had delivery in this period. Try a wider date range.</Empty></div>}

      {d && d.configured && !d.tokenExpired && !d.error && campaigns.length > 0 && sel.ids.length > 0 && !rowsAll.length && !loading && (
        <div className={card}><Empty>{sel.ids.length === 1 ? "That campaign" : "Those campaigns"} had no delivery in this period. Try a wider date range or pick another campaign.</Empty></div>
      )}

      {d && d.configured && campaigns.length > 0 && (!sel.ids.length || rowsAll.length > 0) && (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {/* KPI tiles */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TILES.map(([k, icon, sub]) => <Tile key={k} id={k} icon={icon} metric={k} value={totals[k]} sub={sub({ ...d, totals, viewLabel })} spark={trend.map((p) => p[k])} />)}
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {/* Trend */}
            <div className={`${card} p-4 lg:col-span-3`}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">Daily trend</h3>
                  <p className="text-[12px] text-slate-500">{campView ? "One line per campaign — pick the metric, switch campaigns on or off." : "Switch on as many metrics as you like."}</p>
                </div>
                <Segmented size="sm" value={trendView} onChange={setTrendView} options={[["overall", "Overall"], ["campaign", "Campaign wise"]]} />
              </div>

              {/* what the lines show */}
              <div className="mb-2 flex flex-wrap items-center gap-1" role="group" aria-label={campView ? "Trend metric" : "Trend metrics"}>
                {METRIC_ORDER.map((k) => {
                  const on = campView ? cmetric === k : metrics.includes(k);
                  return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => (campView ? setCmetric(k) : setMetrics((v) => toggleMetric(v, k)))}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${on ? "border-transparent text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-[#1F2533] dark:bg-transparent dark:text-slate-300"}`}
                      style={on ? { background: METRICS[k].color } : undefined}>
                      {!on && <span className="h-2 w-2 rounded-full" style={{ background: METRICS[k].color }} />}{METRICS[k].short}
                    </button>
                  );
                })}
                {!campView && (
                  <>
                    <button type="button" onClick={() => setMetrics(METRIC_ORDER)} className="ml-1 text-[12px] font-medium text-violet-700 hover:underline dark:text-violet-300">All</button>
                    <button type="button" onClick={() => setMetrics(["spend", "leads"])} className="text-[12px] font-medium text-slate-500 hover:underline">Reset</button>
                  </>
                )}
              </div>

              {/* campaign legend (campaign-wise only) */}
              {campView && ccamps.length > 0 && (
                <div className="mb-2">
                  <div className="mb-1 flex items-center gap-3 text-[12px]">
                    <span className="text-slate-500">{visibleIds.length} of {ccamps.length} campaigns shown</span>
                    <button type="button" onClick={() => setShownPick({ key: selKey, ids: ccamps.slice(0, 5).map((c) => c.id) })} className="font-medium text-violet-700 hover:underline dark:text-violet-300">Top 5</button>
                    <button type="button" onClick={() => setShownPick({ key: selKey, ids: ccamps.map((c) => c.id) })} className="font-medium text-violet-700 hover:underline dark:text-violet-300">All</button>
                    <button type="button" onClick={() => setShownPick({ key: selKey, ids: [] })} className="font-medium text-slate-500 hover:underline">None</button>
                  </div>
                  <div className="flex max-h-[88px] flex-wrap gap-1 overflow-auto pr-1" role="group" aria-label="Campaigns on the chart">
                    {ccamps.map((c) => {
                      const on = visibleIds.includes(c.id);
                      return (
                        <button key={c.id} type="button" data-legend={c.id} aria-pressed={on} title={c.name}
                          onClick={() => setShownPick({ key: selKey, ids: on ? visibleIds.filter((x) => x !== c.id) : [...visibleIds, c.id] })}
                          onMouseEnter={() => setHoverKey(c.id)} onMouseLeave={() => setHoverKey(null)} onFocus={() => setHoverKey(c.id)} onBlur={() => setHoverKey(null)}
                          className={`inline-flex max-w-[220px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition ${on ? "border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-white/5 dark:text-slate-100" : "border-slate-200 text-slate-400 dark:border-[#1F2533]"}`}>
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: on ? colorOf(c.id) : "#CBD5E1" }} /><span className="truncate">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {campView && ct.error && !ctLoading && <ErrorBox msg={ct.error} onRetry={refresh} />}
              {campView && ctLoading && !cd ? <p aria-busy="true" className="py-16 text-center text-[13px] text-slate-500">Loading each campaign's daily numbers…</p>
                : campView && cd && cd.tokenExpired ? <p role="alert" className="py-10 text-center text-[13px] text-amber-700 dark:text-amber-300">Your Meta Ads access has expired. Reconnect the account to see this.</p>
                : campView && cd && !ccamps.length ? <p className="py-12 text-center text-[13px] text-slate-500">No campaign had delivery in this period.</p>
                : (
                  <div className={`transition-opacity ${campView && ctLoading ? "opacity-60" : ""}`}>
                    <LineChart points={linePoints} series={lineSeries} scale={lineScale} highlight={campView ? hoverKey : null} />
                  </div>
                )}

              {!campView && lineScale === "own" && <p className="mt-2 text-[11.5px] text-slate-500">With three or more metrics, each line is scaled to its own highest point so the shapes can be compared — hover a day for the exact numbers.</p>}
              {!campView && lineScale === "dual" && <p className="mt-2 text-[11.5px] text-slate-500"><span style={{ color: METRICS[metrics[0]].color }}>●</span> {METRICS[metrics[0]].label} (left axis) · <span style={{ color: METRICS[metrics[1]].color }}>●</span> {METRICS[metrics[1]].label} (right axis)</p>}
              {campView && <p className="mt-2 text-[11.5px] text-slate-500">{METRICS[cmetric].label} by campaign{sel.ids.length ? " — for the campaigns you filtered to" : " — the biggest spenders are shown first; use the chips to add more"}. A campaign’s line appears only on the days it was running.</p>}
            </div>

            {/* Spend share */}
            <div className={`${card} p-4 lg:col-span-2`}>
              <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">Where the money went{level === "adset" ? " — by ad set" : ""}</h3>
              <p className="mb-3 text-[12px] text-slate-500">Share of amount spent by {word[0]}. Hover a slice.</p>
              <Donut slices={spendShare(rowsAll)} format={fMoney0} centerLabel="Total spent" />
            </div>
          </div>

          {/* Campaign comparison */}
          <div className={`${card} p-4`}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{word[2]} comparison</h3>
                <p className="text-[12px] text-slate-500">{METRICS[cmp].better === "lower" ? "Lowest first — green is cheapest, red is priciest." : "Highest first."}</p>
              </div>
              <Segmented size="sm" value={cmp} onChange={setCmp} options={METRIC_ORDER.map((k) => [k, METRICS[k].short])} />
            </div>
            <BarRank rows={ranked} format={METRICS[cmp].fmt} tone={(v, max) => barTone(cmp, v, max || maxCmp)} limit={10} />
          </div>

          {/* Ads-Manager-style scorecard */}
          <div className={`${card} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-[#1A2030]">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{word[2]} scorecard</h3>
                <p className="text-[12px] text-slate-500">{level === "adset" ? "The ad sets inside this campaign" : sel.ids.length ? "The campaigns you picked" : "Every campaign with delivery in this period"}. Click a column to sort.</p>
              </div>
              <button type="button" onClick={() => downloadCSV(`meta_${level === "adset" ? "adsets" : "campaigns"}_${from}_to_${to}.csv`, csvCols, rows)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 dark:border-[#1F2533] dark:text-slate-200 dark:hover:bg-white/5">
                <Download className="h-3.5 w-3.5" />Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-[13px]">
                <thead className="bg-slate-50 text-[12px] text-slate-500 dark:bg-[#0F131B]">
                  <tr>
                    <SortTh label={word[2]} k="name" sort={sort} setSort={setSort} left />
                    <SortTh label="Results" k="results" sort={sort} setSort={setSort} />
                    <SortTh label="Leads" k="leads" sort={sort} setSort={setSort} />
                    <SortTh label="Cost per lead" k="cpl" sort={sort} setSort={setSort} />
                    <SortTh label="Cost per result" k="costPerResult" sort={sort} setSort={setSort} />
                    <SortTh label="Frequency" k="frequency" sort={sort} setSort={setSort} />
                    <SortTh label="Amount spent" k="spend" sort={sort} setSort={setSort} />
                    <SortTh label="Impressions" k="impressions" sort={sort} setSort={setSort} />
                    <SortTh label="Reach" k="reach" sort={sort} setSort={setSort} />
                    <SortTh label="CPM" k="cpm" sort={sort} setSort={setSort} />
                    <SortTh label="CTR (link)" k="linkCtr" sort={sort} setSort={setSort} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} data-campaign={c.id} className="border-t border-slate-100 dark:border-[#1A2030]">
                      <td className="max-w-[260px] px-3 py-2">
                        <p className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200"><span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[c.status] || "bg-slate-300"}`} title={c.status || "Status unknown"} /><span className="truncate" title={c.name}>{c.name}</span></p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums"><p>{c.results ? fInt(c.results) : "—"}</p><p className="text-[11px] text-slate-400">{c.resultType}</p></td>
                      <td className="px-3 py-2 text-right tabular-nums">{fInt(c.leads)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${cellTone("cpl", c.cpl, totals.cpl)}`}>{fMoney2(c.cpl)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${cellTone("costPerResult", c.costPerResult, totals.cpl)}`}>{fMoney2(c.costPerResult)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${cellTone("frequency", c.frequency)}`}>{fDec2(c.frequency)}</td>
                      <td className="relative min-w-[130px] px-3 py-2 text-right tabular-nums">
                        <span className="absolute inset-y-1.5 right-0 rounded-l bg-indigo-500/10" style={{ width: `${maxSpend > 0 ? (c.spend / maxSpend) * 100 : 0}%` }} />
                        <span className="relative font-medium">{fMoney2(c.spend)}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fInt(c.impressions)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fInt(c.reach)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fMoney2(c.cpm)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fPct2(c.linkCtr)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr data-total className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-[#262E40] dark:bg-[#0F131B]">
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">Results from {pluralize(level, rowsAll.length)}</td>
                    <td className="px-3 py-2 text-right text-[11px] font-normal text-slate-400">multiple types</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fInt(totals.leads)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fMoney2(totals.cpl)}</td>
                    <td className="px-3 py-2 text-right text-slate-400">—</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fDec2(totals.frequency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fMoney2(totals.spend)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fInt(totals.impressions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fInt(totals.reach)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fMoney2(totals.cpm)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fPct2(totals.linkCtr)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] leading-relaxed text-slate-500 dark:border-[#1A2030]">
              <b>Results</b> = leads, or messaging conversations for click-to-message campaigns (whichever is larger). Custom conversions such as “Qualified lead” aren’t included.
              Total reach and frequency are de-duplicated across campaigns{d.multiAccount ? " (summed across your ad accounts)" : ""}, so they won’t equal the sum of the rows.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
