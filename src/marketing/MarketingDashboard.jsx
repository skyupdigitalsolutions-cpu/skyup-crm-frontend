// src/marketing/MarketingDashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Performance Marketing — business-outcome dashboard (v2).
//
//   Overview · Paid Media (Meta | Google — click an ad to see its creative) · Leads & Pipeline ·
//   Reports · Data Health
//
// One persistent global filter bar (Date · Compare · Channel · Campaign ·
// Salesperson), automatic background sync ("Last updated …", every 15 min), and a
// lead drill-down drawer behind every number. All tabs read the same backend
// dataset (/api/marketing-panel/v2/*) so their numbers reconcile.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, Megaphone, Users, FileText, Activity, Sun, Moon, LogOut, Sparkles,
  SlidersHorizontal, X, Loader2,
} from "lucide-react";
import mktApi from "./mktApi";
import { getMktToken, getMktUser, clearMktSession } from "./mktSessionStore";
import { MktCtx, ago, fmtRange, Badge, ErrorBox, CHANNEL_LABEL } from "./mkt/ui";
import LeadDrawer from "./mkt/LeadDrawer";
import Overview from "./mkt/tabs/Overview";
import PaidMedia from "./mkt/tabs/PaidMedia";
import Pipeline from "./mkt/tabs/Pipeline";
import Reports from "./mkt/tabs/Reports";
import DataHealth from "./mkt/tabs/DataHealth";

// ── Dates (IST) ──────────────────────────────────────────────────────────────
const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const shift = (day, k) => { const d = new Date(day + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const PRESETS = () => {
  const t = istToday();
  const mStart = t.slice(0, 8) + "01";
  const lmEnd = shift(mStart, -1);
  return [
    ["today", "Today", t, t], ["yesterday", "Yesterday", shift(t, -1), shift(t, -1)],
    ["7d", "Last 7 days", shift(t, -6), t], ["30d", "Last 30 days", shift(t, -29), t], ["90d", "Last 90 days", shift(t, -89), t],
    ["mtd", "This month", mStart, t], ["lm", "Last month", lmEnd.slice(0, 8) + "01", lmEnd],
  ];
};
const COMPARE = [["previous", "vs previous period"], ["prev_7", "vs previous 7 days"], ["prev_30", "vs previous 30 days"], ["prev_90", "vs previous 90 days"], ["prev_month", "vs same period last month"], ["custom", "vs custom range…"], ["none", "No comparison"]];

const TABS = [
  ["overview", "Overview", BarChart3],
  ["paid", "Paid Media", Megaphone],
  ["pipeline", "Leads & Pipeline", Users],
  ["reports", "Reports", FileText],
  ["health", "Data Health", Activity],
];

const AUTO_SYNC_MIN = 15;   // minutes between automatic syncs

const sel = "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-800 focus:border-violet-400 focus:outline-none dark:border-[#1F2533] dark:bg-[#0F131B] dark:text-slate-100";

// ── AI analysis panel ────────────────────────────────────────────────────────
const PRIO = { High: "bad", Medium: "warn", Low: "info" };
function AiPanel({ params, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const run = useCallback((refresh) => {
    setLoading(true); setErr("");
    mktApi.post("/v2/ai-analysis", { ...params, ...(refresh ? { refresh: "1" } : {}) }, { timeout: 150000 })
      .then((r) => setData(r.data)).catch((e) => setErr(e?.response?.data?.message || "AI analysis failed.")).finally(() => setLoading(false));
  }, [params]);
  useEffect(() => { run(false); }, [run]);
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside role="dialog" aria-label="AI analysis" className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-[#0F131B]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-[#1F2533]">
          <Sparkles className="h-5 w-5 text-violet-600" />
          <div className="flex-1"><h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-50">AI analysis</h2><p className="text-[12px] text-slate-500">Built only from this dashboard's numbers: observation, evidence, likely cause, action.</p></div>
          <button onClick={() => run(true)} disabled={loading} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1F2533] dark:text-slate-200">Re-run</button>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-slate-500" /></button>
        </header>
        <div className="flex-1 space-y-3 overflow-auto p-5">
          {loading && <div className="flex items-center gap-2 py-10 text-[13px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Analysing campaigns, creatives and pipeline…</div>}
          {err && <ErrorBox msg={err} />}
          {data && !loading && (
            <>
              {data.summary && <p className="text-[14px] leading-relaxed text-slate-800 dark:text-slate-200">{data.summary}</p>}
              {data.items.map((it, i) => (
                <article key={i} className="rounded-xl border border-slate-200 p-4 dark:border-[#1F2533]">
                  <div className="mb-2 flex items-center gap-2"><Badge tone={PRIO[it.priority] || "neutral"}>{it.priority || "—"} priority</Badge>{it.area && <Badge>{it.area}</Badge>}</div>
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{it.observation}</h3>
                  <dl className="mt-2 space-y-1.5 text-[13px]">
                    <div><dt className="inline font-semibold text-slate-600 dark:text-slate-300">Evidence: </dt><dd className="inline text-slate-700 dark:text-slate-300">{it.evidence}</dd></div>
                    <div><dt className="inline font-semibold text-slate-600 dark:text-slate-300">Likely cause: </dt><dd className="inline text-slate-700 dark:text-slate-300">{it.likelyCause}</dd></div>
                    <div><dt className="inline font-semibold text-violet-700 dark:text-violet-300">Action: </dt><dd className="inline text-slate-900 dark:text-slate-100">{it.action}</dd></div>
                  </dl>
                </article>
              ))}
              {!data.items.length && !data.summary && <p className="text-[13px] text-slate-500">The AI returned no findings for this selection.</p>}
              {data.generatedAt && <p className="text-[12px] text-slate-500">Generated {ago(data.generatedAt)}{data.cached ? " (cached)" : ""} for {fmtRange(data.range.from, data.range.to)}.</p>}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function MarketingDashboard() {
  const nav = useNavigate();
  const user = getMktUser() || {};
  const [dark, setDark] = useState(() => localStorage.getItem("mkt_dark") === "true");
  const [tab, setTab] = useState("overview");
  const [paidSub, setPaidSub] = useState("meta");

  const presets = useMemo(() => PRESETS(), []);
  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState(presets[3][2]);
  const [to, setTo] = useState(presets[3][3]);
  const [compare, setCompare] = useState("previous");
  const [cmpFrom, setCmpFrom] = useState("");
  const [cmpTo, setCmpTo] = useState("");
  const [channel, setChannel] = useState("");
  const [campaign, setCampaign] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [status, setStatus] = useState("");
  const [qualification, setQualification] = useState("");
  const [advanced, setAdvanced] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const [lastSync, setLastSync] = useState(() => new Date());
  const lastSyncAt = useRef(0);   // when data was last (re)loaded — drives auto-sync (stamped on mount / filter change / sync)
  const [, setTick] = useState(0);
  const forceRefresh = useRef(false);

  const [drill, setDrill] = useState(null);
  const [dict, setDict] = useState(null);
  const [opts, setOpts] = useState({ channels: [], campaigns: [], salespeople: [], statuses: [] });
  const [ai, setAi] = useState(false);

  useEffect(() => {
    if (!getMktToken()) { nav("/marketing/login"); return; }
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("mkt_dark", String(dark));
  }, [dark, nav]);

  useEffect(() => { mktApi.get("/v2/dictionary").then((r) => setDict(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    mktApi.get("/v2/filters", { params: { from, to }, timeout: 120000 }).then((r) => setOpts(r.data)).catch(() => {});
  }, [from, to, refreshKey]);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  const params = useMemo(() => {
    const p = { from, to, compare };
    if (compare === "custom" && cmpFrom && cmpTo) { p.cmpFrom = cmpFrom; p.cmpTo = cmpTo; }
    if (compare === "custom" && !(cmpFrom && cmpTo)) p.compare = "previous";
    if (channel) p.channel = channel;
    if (campaign) p.campaign = campaign;
    if (salesperson) p.salesperson = salesperson;
    if (status) p.status = status;
    if (qualification) p.qualification = qualification;
    return p;
  }, [from, to, compare, cmpFrom, cmpTo, channel, campaign, salesperson, status, qualification]);

  const refresh = useCallback((force = true) => {
    forceRefresh.current = force;
    setRefreshKey((k) => k + 1);
    setLastSync(new Date());
    lastSyncAt.current = Date.now();
    setTimeout(() => { forceRefresh.current = false; }, 3000);
  }, []);
  // ── Automatic sync ─────────────────────────────────────────────────────────
  // There is no manual sync button: every AUTO_SYNC_MIN minutes the dashboard
  // re-pulls fresh platform data (bypassing the server cache). It only runs while
  // the tab is visible, and catches up as soon as you come back to a stale tab.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastSyncAt.current >= AUTO_SYNC_MIN * 60000) refresh(true);
    };
    const t = setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", check); };
  }, [refresh]);
  // Changing a filter reloads the data too, so that counts as a fresh sync.
  useEffect(() => { setLastSync(new Date()); lastSyncAt.current = Date.now(); }, [params]);

  const openDrill = useCallback((p, title) => setDrill({ params: p || {}, title: title || "Leads" }), []);
  const bump = useCallback(() => refresh(false), [refresh]);
  const ctx = useMemo(() => ({ params, refreshKey, forceRefresh, openDrill, dict, bump, range: { from, to } }), [params, refreshKey, openDrill, dict, bump, from, to]);

  const onNav = useCallback((t, sub) => {
    // The standalone Creatives page is gone — creatives now open from the ad itself
    // in Paid Media → Meta. (The "creative fatigue" alert still links here.)
    if (t === "creatives") { t = "paid"; sub = sub || "meta"; }
    setTab(t); if (sub) setPaidSub(sub); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);
  const logout = () => { clearMktSession(); nav("/marketing/login"); };
  const campaignsForChannel = opts.campaigns.filter((c) => !channel || channel === "paid" || c.channel === channel);
  const activeFilters = [channel, campaign, salesperson, status, qualification].filter(Boolean).length;

  return (
    <MktCtx.Provider value={ctx}>
      <div className="min-h-screen bg-[#F6F7F9] text-slate-900 dark:bg-[#0B0E14] dark:text-slate-100">
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-[#1F2533] dark:bg-[#0F131B]/95">
          <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 md:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white"><BarChart3 className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="truncate text-[14px] font-semibold leading-tight">Performance Marketing</p><p className="truncate text-[12px] text-slate-500">{user.companyName || ""}</p></div>
            </div>
            <nav aria-label="Dashboard sections" className="mx-4 hidden gap-0.5 xl:flex">
              {TABS.map(([v, l, Icon]) => (
                <button key={v} onClick={() => onNav(v)} aria-current={tab === v ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ${tab === v ? "bg-violet-50 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"}`}>
                  <Icon className="h-4 w-4" />{l}
                </button>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setAi(true)} className="hidden items-center gap-1.5 rounded-lg border border-violet-200 px-2.5 py-1.5 text-[13px] font-medium text-violet-700 hover:bg-violet-50 sm:inline-flex dark:border-violet-500/30 dark:text-violet-300 dark:hover:bg-violet-500/10"><Sparkles className="h-4 w-4" />AI analysis</button>
              <button onClick={() => setDark(!dark)} aria-label="Toggle dark mode" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-slate-900 dark:border-[#1F2533] dark:hover:text-white">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
              <span className="hidden items-center gap-1.5 text-[13px] text-slate-600 md:flex dark:text-slate-300"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[12px] font-semibold dark:bg-white/10">{(user.name || "A").charAt(0).toUpperCase()}</span>{user.name || "Admin"}</span>
              <button onClick={logout} aria-label="Log out" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-red-600 dark:border-[#1F2533]"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
          <nav aria-label="Dashboard sections" className="flex gap-1 overflow-x-auto px-4 pb-2 xl:hidden">
            {TABS.map(([v, l, Icon]) => (
              <button key={v} onClick={() => onNav(v)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium ${tab === v ? "bg-violet-600 text-white" : "text-slate-600 dark:text-slate-400"}`}><Icon className="h-4 w-4" />{l}</button>
            ))}
            <button onClick={() => setAi(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-violet-700 sm:hidden dark:text-violet-300"><Sparkles className="h-4 w-4" />AI</button>
          </nav>

          {/* Global filter bar — persistent across every page */}
          <div className="border-t border-slate-100 dark:border-[#1A2030]">
            <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2 px-4 py-2 md:px-6">
              <select aria-label="Date range" value={preset} className={sel} onChange={(e) => {
                const v = e.target.value; setPreset(v);
                const p = presets.find((x) => x[0] === v); if (p) { setFrom(p[2]); setTo(p[3]); }
              }}>
                {presets.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                <option value="custom">Custom range</option>
              </select>
              {preset === "custom" && (
                <span className="flex items-center gap-1">
                  <input type="date" aria-label="From" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={sel} />
                  <span className="text-slate-400">–</span>
                  <input type="date" aria-label="To" value={to} min={from} max={istToday()} onChange={(e) => setTo(e.target.value)} className={sel} />
                </span>
              )}
              <span className="hidden text-[13px] text-slate-500 lg:inline">{fmtRange(from, to)}</span>
              <select aria-label="Compare with" value={compare} onChange={(e) => setCompare(e.target.value)} className={sel}>
                {COMPARE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {compare === "custom" && (
                <span className="flex items-center gap-1">
                  <input type="date" aria-label="Compare from" value={cmpFrom} onChange={(e) => setCmpFrom(e.target.value)} className={sel} />
                  <span className="text-slate-400">–</span>
                  <input type="date" aria-label="Compare to" value={cmpTo} onChange={(e) => setCmpTo(e.target.value)} className={sel} />
                </span>
              )}
              <select aria-label="Channel" value={channel} onChange={(e) => { setChannel(e.target.value); setCampaign(""); }} className={sel}>
                <option value="">All channels</option>
                <option value="paid">Paid channels</option>
                {opts.channels.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c] || c}</option>)}
              </select>
              <select aria-label="Campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} className={`${sel} max-w-[220px]`}>
                <option value="">All campaigns</option>
                {campaignsForChannel.map((c) => <option key={c.key} value={c.key}>{c.label}{!channel ? ` (${CHANNEL_LABEL[c.channel] || c.channel})` : ""}</option>)}
              </select>
              <select aria-label="Salesperson" value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className={`${sel} max-w-[180px]`}>
                <option value="">All salespeople</option>
                {opts.salespeople.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button onClick={() => setAdvanced(!advanced)} aria-expanded={advanced} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50 dark:border-[#1F2533] dark:text-slate-200 dark:hover:bg-white/5">
                <SlidersHorizontal className="h-4 w-4" />More filters{(status || qualification) ? ` (${[status, qualification].filter(Boolean).length})` : ""}
              </button>
              {activeFilters > 0 && <button onClick={() => { setChannel(""); setCampaign(""); setSalesperson(""); setStatus(""); setQualification(""); }} className="text-[13px] font-medium text-violet-700 hover:underline dark:text-violet-300">Clear filters</button>}

              <div className="ml-auto flex items-center gap-2">
                <span className="hidden text-[12px] text-slate-500 md:inline" title={`Data refreshes automatically every ${AUTO_SYNC_MIN} minutes`}>Auto-sync · Last updated {ago(lastSync)}</span>
              </div>
            </div>
            {advanced && (
              <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2 px-4 pb-2 md:px-6">
                <select aria-label="Lead status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
                  <option value="">Any lead status</option>
                  {opts.statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  <option value="unmapped">Unmapped status</option>
                </select>
                <select aria-label="Qualification" value={qualification} onChange={(e) => setQualification(e.target.value)} className={sel}>
                  <option value="">Any qualification</option>
                  <option value="qualified">Qualified only</option>
                  <option value="unqualified">Not qualified</option>
                </select>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-5 md:px-6">
          {tab === "overview" && <Overview onNav={onNav} />}
          {tab === "paid" && <PaidMedia sub={paidSub} setSub={setPaidSub} />}
          {tab === "pipeline" && <Pipeline />}
          {tab === "reports" && <Reports />}
          {tab === "health" && <DataHealth />}
        </main>

        {drill && <LeadDrawer drill={drill} onClose={() => setDrill(null)} />}
        {ai && <AiPanel params={params} onClose={() => setAi(false)} />}
      </div>
    </MktCtx.Provider>
  );
}
