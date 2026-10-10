// src/marketing/mkt/tabs/PaidMedia.jsx
// Paid Media = one page for every ad platform (Meta | Google Ads today,
// LinkedIn later) so new channels don't need a new top-level tab.
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Users, X } from "lucide-react";
import useReport from "../useReport";
import CreativeModal from "../CreativeModal";
import mktApi from "../../mktApi";
import {
  useMkt, Panel, Loader, ErrorBox, Empty, DataTable, DrillNum, Badge, Segmented, MetricInfo, SyncNote, HBars,
  statusTone, inr, num, pct, fmtBy, downloadCSV, businessColumns,
} from "../ui";

// ── Column catalogue for the Meta hierarchy (user can customise) ─────────────
const META_COLS = [
  { key: "spend", label: "Spend", metric: "spend", format: "inr" },
  { key: "reach", label: "Reach", metric: "reach", format: "num" },
  { key: "impressions", label: "Impressions", metric: "impressions", format: "num" },
  { key: "frequency", label: "Frequency", metric: "frequency", format: "dec" },
  { key: "cpm", label: "CPM", metric: "cpm", format: "inr" },
  { key: "linkClicks", label: "Link clicks", metric: "linkClicks", format: "num" },
  { key: "linkCtr", label: "Link CTR", metric: "linkCtr", format: "pct" },
  { key: "cpc", label: "CPC", metric: "cpc", format: "inr" },
  { key: "lpv", label: "LPV", metric: "lpv", format: "num" },
  { key: "lpvRate", label: "Click → LP", metric: "lpvRate", format: "pct", default: false },
  { key: "platformLeads", label: "Platform leads", metric: "platformLeads", format: "num", default: false },
  { key: "leads", label: "CRM leads", metric: "leads", drill: {} },
  { key: "cpl", label: "CPL", metric: "cpl", format: "inr" },
  { key: "qualified", label: "Qualified", metric: "qualified", drill: { reached: "qualified" } },
  { key: "qualRate", label: "Qual. %", metric: "qualRate", format: "pct", default: false },
  { key: "cpql", label: "CPQL", metric: "cpql", format: "inr" },
  { key: "won", label: "Won", metric: "won", drill: { reached: "won" } },
  { key: "cac", label: "CAC", metric: "cac", format: "inr" },
  { key: "revenue", label: "Revenue", metric: "revenue", format: "inr" },
  { key: "roas", label: "ROAS", metric: "roas", format: "x" },
  { key: "ctr", label: "CTR (all)", metric: "ctr", format: "pct", default: false },
  { key: "lpvToLead", label: "LP → Lead", metric: "lpvToLead", format: "pct", default: false },
];

function useColumns(id, catalogue) {
  const key = `mkt_cols_${id}`;
  const [visible, setVisible] = useState(() => {
    try { const s = localStorage.getItem(key); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return catalogue.filter((c) => c.default !== false).map((c) => c.key);
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(visible)); } catch { /* ignore */ } }, [visible, key]);
  return [catalogue.filter((c) => visible.includes(c.key)), visible, setVisible];
}

function ColumnPicker({ catalogue, visible, setVisible }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-[#1F2533] dark:text-slate-300 dark:hover:bg-white/5">Columns</button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 max-h-80 w-56 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-[#1F2533] dark:bg-[#121620]" onMouseLeave={() => setOpen(false)}>
          {catalogue.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[13px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">
              <input type="checkbox" className="accent-violet-600" checked={visible.includes(c.key)} onChange={() => setVisible((v) => (v.includes(c.key) ? v.filter((x) => x !== c.key) : [...v, c.key]))} />{c.label}
            </label>
          ))}
          <button onClick={() => setVisible(catalogue.filter((c) => c.default !== false).map((c) => c.key))} className="mt-1 w-full rounded px-2 py-1 text-left text-[12px] text-violet-700 hover:bg-violet-50 dark:text-violet-300">Reset to default</button>
        </div>
      )}
    </div>
  );
}

// ── Audience breakdown (reuses the existing per-config endpoint) ─────────────
function AudienceModal({ configId, title, onClose }) {
  const { params } = useMkt();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    mktApi.get(`/meta-campaign/${configId}`, { params: { from: params.from, to: params.to } }).then((r) => setD(r.data)).catch((e) => setErr(e?.response?.data?.message || "Couldn't load audience data."));
  }, [configId, params.from, params.to]);
  const bd = (d && d.breakdowns) || {};
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5 shadow-2xl dark:bg-[#121620]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">Audience · {title}</h3><button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-slate-500" /></button></div>
        {err && <ErrorBox msg={err} />}
        {!d && !err && <Loader />}
        {d && (
          <div className="grid gap-5 md:grid-cols-3">
            <div><p className="mb-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300">Age / gender (spend)</p><HBars rows={(bd.ageGender || []).map((r) => ({ label: `${r.age} · ${r.gender}`, v: r.spend }))} labelKey="label" valueKey="v" format="inr" /></div>
            <div><p className="mb-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300">Placement (spend)</p><HBars rows={(bd.placement || []).map((r) => ({ label: `${r.platform} · ${r.position}`, v: r.spend }))} labelKey="label" valueKey="v" format="inr" /></div>
            <div><p className="mb-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300">Device (spend)</p><HBars rows={(bd.device || []).map((r) => ({ label: r.device, v: r.spend }))} labelKey="label" valueKey="v" format="inr" /></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── META ─────────────────────────────────────────────────────────────────────
function MetaPanel() {
  const [showIdle, setShowIdle] = useState(false);
  const { data, error, loading, reload } = useReport("/v2/meta", showIdle ? { showIdle: "1" } : null);
  const [cols, visible, setVisible] = useColumns("meta_hier", META_COLS);
  const [open, setOpen] = useState({});
  const [aud, setAud] = useState(null);
  const [creative, setCreative] = useState(null);   // ad row whose creative is open

  if (loading && !data) return <Loader label="Fetching Meta campaigns…" />;
  if (error) return <ErrorBox msg={error} onRetry={reload} />;
  if (!data) return null;
  if (!data.configured) return <Panel title="Meta Ads not connected"><Empty>Add an Ad Account ID and an ads_read token to a Meta campaign config in the CRM to see spend, ad sets and ads.</Empty></Panel>;

  const t = data.totals, c = data.counts, rec = data.leadReconciliation;
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const cell = (r, col, drillBase, title) => {
    if (col.drill) return <DrillNum value={r[col.key]} drill={{ channel: "meta", ...drillBase, ...col.drill }} title={`${col.label} · ${title}`} className={col.key === "won" && r.won ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""} />;
    return fmtBy(col.format, r[col.key]);
  };
  const exportRows = [];
  data.campaigns.forEach((cp) => { exportRows.push({ level: "Campaign", name: cp.name, ...cp }); cp.adsets.forEach((a) => { exportRows.push({ level: "Ad set", name: `${cp.name} › ${a.name}`, ...a }); a.ads.forEach((ad) => exportRows.push({ level: "Ad", name: `${cp.name} › ${a.name} › ${ad.name}`, ...ad })); }); });

  const Row = ({ r, depth, k, drillBase, title, hasChildren, extra }) => {
    const isAd = depth === 2;   // ad rows: the creative (thumbnail + name) opens the creative detail
    return (
    <tr className={`border-t border-slate-100 dark:border-[#1A2030] ${depth === 0 ? "bg-white dark:bg-[#121620]" : depth === 1 ? "bg-slate-50/60 dark:bg-white/[0.015]" : "bg-slate-50 dark:bg-white/[0.03]"}`}>
      <td className="sticky left-0 z-[1] min-w-[260px] max-w-[340px] bg-inherit px-3 py-2">
        <div className="flex items-start gap-1.5" style={{ paddingLeft: depth * 18 }}>
          {hasChildren ? <button onClick={() => toggle(k)} aria-expanded={!!open[k]} className="mt-0.5 text-slate-400 hover:text-slate-700">{open[k] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button> : <span className="w-4" />}
          {r.creative && r.creative.thumbnail && (isAd
            ? <button type="button" onClick={() => setCreative(r)} aria-label={`View creative · ${r.name}`} title="View creative" className="shrink-0 rounded ring-violet-400 hover:ring-2 focus:outline-none focus-visible:ring-2"><img src={r.creative.thumbnail} alt="" loading="lazy" className="h-8 w-8 rounded object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /></button>
            : <img src={r.creative.thumbnail} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />)}
          <div className="min-w-0">
            {isAd
              ? <button type="button" onClick={() => setCreative(r)} title="View creative" className="block max-w-full truncate text-left font-medium text-slate-900 hover:text-violet-700 hover:underline dark:text-slate-100 dark:hover:text-violet-300">{r.name}</button>
              : <p className={`truncate ${depth === 0 ? "font-semibold" : "font-medium"} text-slate-900 dark:text-slate-100`} title={r.name}>{r.name}</p>}
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {r.status && <Badge tone={statusTone(r.status)}>{r.status.toLowerCase().replace(/_/g, " ")}</Badge>}
              {r.notInPlatform && <Badge tone="warn">no delivery in range</Badge>}
              {extra}
            </div>
          </div>
        </div>
      </td>
      {cols.map((col) => <td key={col.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-800 dark:text-slate-200">{cell(r, col, drillBase, title)}</td>)}
    </tr>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="What Meta delivered" subtitle="One canonical status: Meta's effective status.">
          <dl className="grid grid-cols-2 gap-y-1 text-[13px]">
            <dt className="text-slate-500">Campaigns with delivery</dt><dd className="text-right font-semibold tabular-nums">{num(c.campaignsWithDelivery)}</dd>
            <dt className="text-slate-500">Campaigns on account</dt><dd className="text-right tabular-nums">{num(c.campaignsOnAccount)}</dd>
            <dt className="text-slate-500">Active on Meta now</dt><dd className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{num(c.campaignsActive)}</dd>
            <dt className="text-slate-500">Ad sets · ads with delivery</dt><dd className="text-right tabular-nums">{num(c.adsetsWithDelivery)} · {num(c.adsWithDelivery)}</dd>
            <dt className="text-slate-500">Ads active now</dt><dd className="text-right tabular-nums">{num(c.adsActive)}</dd>
          </dl>
        </Panel>
        <Panel title="Platform vs CRM leads" subtitle="Meta's count and the CRM's count are shown separately on purpose.">
          <dl className="grid grid-cols-2 gap-y-1 text-[13px]">
            <dt className="flex items-center gap-1 text-slate-500">Meta platform leads<MetricInfo k="platformLeads" /></dt><dd className="text-right font-semibold tabular-nums">{num(rec.platformLeads)}</dd>
            <dt className="text-slate-500">CRM Meta leads</dt><dd className="text-right font-semibold tabular-nums"><DrillNum value={rec.crmLeads} drill={{ channel: "meta" }} title="CRM Meta leads" /></dd>
            <dt className="text-slate-500">Mapped by ID</dt><dd className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{num(rec.attributedById)}</dd>
            <dt className="text-slate-500">Mapped by name only</dt><dd className="text-right tabular-nums"><DrillNum value={rec.attributedByName} drill={{ channel: "meta", nameMatched: "1" }} title="Meta leads matched by name" className={rec.attributedByName ? "text-amber-700 dark:text-amber-400" : ""} /></dd>
            <dt className="text-slate-500">Not mapped to a campaign</dt><dd className="text-right tabular-nums"><DrillNum value={rec.unattributed} drill={{ channel: "meta", unattributed: "1" }} title="Unattributed Meta leads" className={rec.unattributed ? "text-red-600 dark:text-red-400" : ""} /></dd>
          </dl>
        </Panel>
        <Panel title="Totals">
          <dl className="grid grid-cols-2 gap-y-1 text-[13px]">
            <dt className="text-slate-500">Spend</dt><dd className="text-right font-semibold tabular-nums">{inr(t.spend)}</dd>
            <dt className="text-slate-500">Link CTR · CPC</dt><dd className="text-right tabular-nums">{pct(t.linkCtr, 2)} · {inr(t.cpc)}</dd>
            <dt className="text-slate-500">CPL · CPQL</dt><dd className="text-right tabular-nums">{inr(t.cpl)} · <b>{inr(t.cpql)}</b></dd>
            <dt className="text-slate-500">Qualified · Won</dt><dd className="text-right tabular-nums">{num(t.qualified)} · {num(t.won)}</dd>
            <dt className="text-slate-500">CAC · ROAS</dt><dd className="text-right tabular-nums">{inr(t.cac)} · {fmtBy("x", t.roas)}</dd>
          </dl>
        </Panel>
      </div>

      <Panel title="Campaign → Ad set → Ad" subtitle="Joined to CRM leads by Meta IDs. Click a row arrow to expand; click any lead count to see the leads." pad={false}
        action={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-300"><input type="checkbox" className="accent-violet-600" checked={showIdle} onChange={(e) => setShowIdle(e.target.checked)} />Show campaigns with no delivery</label>
            <button onClick={() => downloadCSV(`meta_${Date.now()}.csv`, [{ key: "level", label: "Level" }, { key: "name", label: "Name" }, { key: "status", label: "Status" }, ...META_COLS], exportRows)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-[#1F2533] dark:text-slate-300">Export CSV</button>
            <ColumnPicker catalogue={META_COLS} visible={visible} setVisible={setVisible} />
          </div>
        }>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr className="bg-slate-50 dark:bg-[#0F131B]">
              <th className="sticky left-0 z-[2] bg-slate-50 px-3 py-2 text-left text-[12px] font-semibold text-slate-600 dark:bg-[#0F131B] dark:text-slate-300">Campaign / ad set / ad</th>
              {cols.map((col) => <th key={col.key} className="whitespace-nowrap px-3 py-2 text-right text-[12px] font-semibold text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-1">{col.label}<MetricInfo k={col.metric} /></span></th>)}
            </tr></thead>
            <tbody>
              {data.campaigns.map((cp) => (
                <FragmentRows key={cp.id}>
                  <Row r={cp} depth={0} k={cp.id} drillBase={{ metaCampaignId: cp.id }} title={cp.name} hasChildren={cp.adsets.length > 0}
                    extra={cp.leadsWithoutAdsetId > 0 ? <Badge tone="warn">{cp.leadsWithoutAdsetId} lead{cp.leadsWithoutAdsetId > 1 ? "s" : ""} without ad-set ID</Badge> : null} />
                  {open[cp.id] && cp.adsets.map((a) => (
                    <FragmentRows key={a.id}>
                      <Row r={a} depth={1} k={a.id} drillBase={{ metaAdsetId: a.id }} title={a.name} hasChildren={a.ads.length > 0}
                        extra={<>
                          {a.leadsWithoutAdId > 0 && <Badge tone="neutral">{a.leadsWithoutAdId} lead{a.leadsWithoutAdId > 1 ? "s" : ""} at ad-set level</Badge>}
                          {a.configId && <button onClick={() => setAud({ id: a.configId, title: a.name })} className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline dark:text-violet-300"><Users className="h-3 w-3" />Audience</button>}
                        </>} />
                      {open[a.id] && a.ads.map((ad) => <Row key={ad.id} r={ad} depth={2} k={ad.id} drillBase={{ metaAdId: ad.id }} title={ad.name} hasChildren={false} />)}
                    </FragmentRows>
                  ))}
                </FragmentRows>
              ))}
              {!data.campaigns.length && <tr><td colSpan={cols.length + 1}><Empty>No Meta campaigns with spend or leads in this period.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      <SyncNote sync={data.sync} />
      {aud && <AudienceModal configId={aud.id} title={aud.title} onClose={() => setAud(null)} />}
      {creative && <CreativeModal platform="meta" row={creative} onClose={() => setCreative(null)} />}
    </div>
  );
}
function FragmentRows({ children }) { return <>{children}</>; }

// ── GOOGLE ───────────────────────────────────────────────────────────────────
const plat = [
  { key: "impressions", label: "Impr.", align: "right", format: "num", metric: "impressions" },
  { key: "clicks", label: "Clicks", align: "right", format: "num" },
  { key: "ctr", label: "CTR", align: "right", format: "pct", metric: "ctr" },
  { key: "cpc", label: "CPC", align: "right", format: "inr", metric: "cpc" },
  { key: "platformConversions", label: "Google conv.", align: "right", format: "dec", metric: "platformLeads" },
];
const FLAG = { "negative-candidate": ["bad", "Add as negative"], "high-intent": ["good", "High intent — scale"], investigate: ["warn", "Spend, no conversions"] };

function GooglePanel() {
  const [view, setView] = useState("campaigns");
  const { data, error, loading, reload } = useReport("/v2/google");
  const camp = useMemo(() => {
    const m = {}; (data ? data.campaigns : []).forEach((c) => { m[c.id] = c.name; }); return m;
  }, [data]);
  const ag = useMemo(() => {
    const m = {}; (data ? data.adGroups : []).forEach((c) => { m[c.id] = c.name; }); return m;
  }, [data]);

  const [creative, setCreative] = useState(null);   // Google ad row whose creative is open

  if (loading && !data) return <Loader label="Fetching Google Ads…" />;
  if (error) return <ErrorBox msg={error} onRetry={reload} />;
  if (!data) return null;
  const t = data.totals;
  const api = data.source === "api";

  return (
    <div className="space-y-4">
      {data.source === "manual" && <ErrorBox msg="Google spend, impressions and clicks are manually-entered lifetime totals — they are NOT filtered by the selected dates. Connect the Google Ads API (CRM → Integrations) for accurate CPL / CPQL and keyword / search-term data." />}
      {data.reauth && <ErrorBox msg="Google Ads session expired — reconnect your Google Ads account in CRM → Integrations." />}
      {data.source === "none" && <Panel title="Google Ads not connected"><Empty>Connect Google Ads in CRM → Integrations to see campaigns, keywords and search terms.</Empty></Panel>}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4 lg:grid-cols-8 dark:border-[#1F2533] dark:bg-[#1F2533]">
        {[["Spend", inr(t.spend), "spend"], ["CRM leads", num(t.leads), "leads"], ["Qualified", num(t.qualified), "qualified"], ["Qualification %", pct(t.qualRate), "qualRate"], ["CPL", inr(t.cpl), "cpl"], ["CPQL", inr(t.cpql), "cpql"], ["Won", num(t.won), "won"], ["CAC", inr(t.cac), "cac"]].map(([l, v, k]) => (
          <div key={l} className="bg-white px-4 py-3 dark:bg-[#121620]"><p className="flex items-center gap-1 text-[12px] text-slate-500">{l}<MetricInfo k={k} /></p><p className="text-[18px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{v}</p></div>
        ))}
      </div>
      <p className="text-[12px] text-slate-500">Attribution: {num(data.attribution.crmLeads)} Google CRM leads · {num(data.attribution.withGclid)} with GCLID · {num(data.attribution.gclidResolved)} resolved to keyword by click ID · {num(data.attribution.unattributed)} without a campaign mapping.</p>

      <Segmented value={view} onChange={setView} size="sm" options={[["campaigns", "Campaigns"], ["adGroups", "Ad groups"], ["keywords", "Keywords"], ["searchTerms", "Search terms"], ["ads", "Ads"], ["devices", "Devices"], ["locations", "Locations"], ["landing", "Landing pages"]]} />

      {view === "campaigns" && <DataTable id="g_camp" rows={data.campaigns} rowKey={(r) => r.id || r.name}
        columns={[{ key: "name", label: "Campaign", always: true, render: (r) => <div><p className="font-medium">{r.name}</p><div className="flex gap-1">{r.status && <Badge tone={statusTone(r.status)}>{r.status.toLowerCase()}</Badge>}{r.type && <Badge>{r.type.toLowerCase().replace(/_/g, " ")}</Badge>}</div></div> }, ...plat, ...businessColumns((r, x) => ({ channel: "google", googleCampaignId: r.id, ...x }))]} />}

      {view === "adGroups" && (api ? <DataTable id="g_ag" rows={data.adGroups} rowKey={(r) => r.id}
        columns={[{ key: "name", label: "Ad group", always: true, render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-[12px] text-slate-500">{camp[r.campaignId] || ""}</p></div> }, ...plat, ...businessColumns((r, x) => ({ channel: "google", googleAdGroupId: r.id, ...x }))]} /> : <Empty>Ad-group data needs the Google Ads API connection.</Empty>)}

      {view === "keywords" && (api ? <DataTable id="g_kw" rows={data.keywords} rowKey={(r) => r.adGroupId + r.id}
        columns={[{ key: "text", label: "Keyword", always: true, render: (r) => <div><p className="font-medium">{r.text}</p><p className="text-[12px] text-slate-500">{String(r.matchType || "").toLowerCase()} · {ag[r.adGroupId] || ""}</p></div> }, ...plat, ...businessColumns((r, x) => ({ channel: "google", googleAdGroupId: r.adGroupId, keyword: r.text, ...x }))]} /> : <Empty>Keyword data needs the Google Ads API connection.</Empty>)}

      {view === "searchTerms" && (api ? (
        <Panel title="Search terms" subtitle="What people actually searched. Flags: spend with no conversions → negative-keyword candidate; conversions below average cost → high intent." pad={false}>
          <div className="p-3"><DataTable id="g_st" rows={data.searchTerms} rowKey={(r, i) => r.term + i} initialSort={{ key: "spend", dir: "desc" }}
            columns={[
              { key: "term", label: "Search term", always: true, render: (r) => <div><p className="font-medium">{r.term}</p><p className="text-[12px] text-slate-500">keyword: {r.keyword || "—"}</p></div> },
              { key: "flag", label: "Signal", render: (r) => (r.flag ? <Badge tone={FLAG[r.flag][0]}>{FLAG[r.flag][1]}</Badge> : "—") },
              { key: "clicks", label: "Clicks", align: "right", format: "num" },
              { key: "spend", label: "Spend", align: "right", format: "inr" },
              { key: "platformConversions", label: "Google conv.", align: "right", format: "dec" },
              { key: "leads", label: "CRM leads", align: "right", render: (r) => (r.crmJoined ? num(r.leads) : <span className="text-slate-400" title="Search term isn't captured on CRM leads — keyword-level quality is on the Keywords view">n/a</span>) },
              { key: "qualified", label: "Qualified", align: "right", render: (r) => (r.crmJoined ? num(r.qualified) : "—") },
              { key: "cpql", label: "CPQL", align: "right", format: "inr" },
              { key: "won", label: "Customers", align: "right", render: (r) => (r.crmJoined ? num(r.won) : "—") },
              { key: "ctr", label: "CTR", align: "right", format: "pct", default: false },
              { key: "impressions", label: "Impr.", align: "right", format: "num", default: false },
            ]} /></div>
        </Panel>) : <Empty>Search-term data needs the Google Ads API connection.</Empty>)}

      {view === "ads" && (api ? <DataTable id="g_ads" rows={data.ads} rowKey={(r) => r.id}
        columns={[{ key: "name", label: "Ad", always: true, render: (r) => <div className="max-w-md"><button type="button" onClick={() => setCreative(r)} title="View creative" className="block max-w-full text-left font-medium hover:text-violet-700 hover:underline dark:hover:text-violet-300">{r.creative.headline || r.name}</button><p className="line-clamp-2 text-[12px] text-slate-500">{r.creative.body}</p><p className="text-[12px] text-slate-400">{ag[r.adGroupId] || ""}</p></div> }, { key: "spend", label: "Spend", align: "right", format: "inr" }, ...plat]} /> : <Empty>Ad data needs the Google Ads API connection.</Empty>)}

      {view === "devices" && (api ? <DataTable id="g_dev" search={false} rows={data.devices} rowKey={(r) => r.device}
        columns={[{ key: "device", label: "Device", always: true, render: (r) => String(r.device).toLowerCase().replace(/_/g, " ") }, { key: "spend", label: "Spend", align: "right", format: "inr" }, { key: "impressions", label: "Impr.", align: "right", format: "num" }, { key: "clicks", label: "Clicks", align: "right", format: "num" }, { key: "ctr", label: "CTR", align: "right", format: "pct" }, { key: "platformConversions", label: "Google conv.", align: "right", format: "dec" }]} /> : <Empty>Device data needs the Google Ads API connection.</Empty>)}

      {view === "locations" && (api ? <DataTable id="g_loc" rows={data.locations} rowKey={(r) => r.resource}
        columns={[{ key: "name", label: "Location", always: true }, { key: "spend", label: "Spend", align: "right", format: "inr" }, { key: "impressions", label: "Impr.", align: "right", format: "num" }, { key: "clicks", label: "Clicks", align: "right", format: "num" }, { key: "platformConversions", label: "Google conv.", align: "right", format: "dec" }]} /> : <Empty>Location data needs the Google Ads API connection.</Empty>)}

      {view === "landing" && (api ? (
        <Panel title="Landing pages" subtitle="If clicks are high but leads are low here, the landing page — not the ad — is the problem." pad={false}>
          <div className="p-3"><DataTable id="g_lp" rows={data.landingPages} rowKey={(r) => r.url}
            columns={[{ key: "url", label: "Landing page", always: true, render: (r) => <a href={r.url} target="_blank" rel="noopener noreferrer" className="break-all text-violet-700 hover:underline dark:text-violet-300">{r.url}</a> }, { key: "spend", label: "Spend", align: "right", format: "inr" }, { key: "clicks", label: "Clicks", align: "right", format: "num" }, { key: "platformConversions", label: "Google conv.", align: "right", format: "dec" }, { key: "cvr", label: "Click → conv.", align: "right", render: (r) => pct(r.clicks ? (r.platformConversions / r.clicks) * 100 : null) }]} /></div>
        </Panel>) : <Empty>Landing-page data needs the Google Ads API connection.</Empty>)}

      {Object.keys(data.apiErrors || {}).length > 0 && <p className="text-[12px] text-amber-700 dark:text-amber-300">Some Google sections couldn't load: {Object.entries(data.apiErrors).map(([k, v]) => `${k} (${v})`).join("; ")}</p>}
      <SyncNote sync={data.sync} />
      {creative && <CreativeModal platform="google" row={creative} onClose={() => setCreative(null)} />}
    </div>
  );
}

export default function PaidMedia({ sub, setSub }) {
  return (
    <div className="space-y-4">
      <Segmented value={sub || "meta"} onChange={setSub} options={[["meta", "Meta"], ["google", "Google Ads"]]} />
      {(sub || "meta") === "meta" ? <MetaPanel /> : <GooglePanel />}
    </div>
  );
}
