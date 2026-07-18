import { useState, useCallback, useEffect, useMemo } from "react";
import api from "../data/axiosConfig";
import GoogleAdsApiConnect from "./GoogleAdsApiConnect";
import GoogleAdsBreakdown from "./GoogleAdsBreakdown";
import {
  TrendingUp, TrendingDown, Minus, Sparkles, Loader2, FileDown, AlertTriangle,
  DollarSign, Users, Target, MousePointerClick, Award, Percent, ArrowUpDown,
  Filter, Lightbulb, AlertCircle, CheckCircle2, ChevronUp, ChevronDown, Wallet,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Google Ads — Business Performance Dashboard
// Revenue-focused view built from CRM data + manually-entered ad metrics.
// Data: GET /google-ads-config/dashboard
// ─────────────────────────────────────────────────────────────────────────────

const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const STATUS_OPTS = ["New", "In Progress", "Converted", "Not Interested", "Verification", "Closed"];

const money = (v) => v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const int   = (v) => v == null ? "—" : Number(v).toLocaleString("en-IN");
const pct   = (v) => v == null ? "—" : `${v}%`;
const mult  = (v) => v == null ? "—" : `${v}×`;
const fmt = (v, f) => f === "money" ? money(v) : f === "percent" ? pct(v) : f === "x" ? mult(v) : int(v);

const TL = {
  green:  { text: "text-emerald-600 dark:text-emerald-400", chip: "bg-emerald-50 dark:bg-emerald-950/30" },
  red:    { text: "text-rose-600 dark:text-rose-400",       chip: "bg-rose-50 dark:bg-rose-950/30" },
  orange: { text: "text-amber-600 dark:text-amber-400",     chip: "bg-amber-50 dark:bg-amber-950/30" },
};

const CARD = "bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl";
const TH = "text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 whitespace-nowrap";
const TD = "text-[12px] text-[#0F1117] dark:text-[#DDE1F5] px-3 py-2.5 whitespace-nowrap";
const SectionTitle = ({ children, sub }) => (
  <div className="mb-3">
    <h2 className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{children}</h2>
    {sub && <p className="text-[11px] text-[#8B92A9] mt-0.5">{sub}</p>}
  </div>
);

// KPI card with traffic-light trend
function KpiCard({ kpi }) {
  const t = kpi.trend || {};
  const tl = TL[t.color] || TL.orange;
  const TrendIcon = t.dir === "up" ? TrendingUp : t.dir === "down" ? TrendingDown : Minus;
  const ICONS = {
    spend: Wallet, revenue: DollarSign, roas: TrendingUp, roi: Percent, clicks: MousePointerClick,
    leads: Users, qualified: Target, won: Award, cpl: DollarSign, cpa: DollarSign, conversionRate: Percent,
  };
  const Icon = ICONS[kpi.key] || Target;
  return (
    <div className={`${CARD} p-4 flex flex-col gap-2.5`}>
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        {t.deltaPct != null && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tl.chip} ${tl.text}`}>
            <TrendIcon className="w-3 h-3" />{Math.abs(t.deltaPct)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{kpi.label}</p>
        <p className="text-[18px] font-bold text-[#0F1117] dark:text-[#DDE1F5] leading-none">{fmt(kpi.value, kpi.format)}</p>
      </div>
    </div>
  );
}

// Sortable table
function SortableTable({ columns, rows, initialSort }) {
  const [sort, setSort] = useState(initialSort || { key: columns[0].key, dir: "desc" });
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    const arr = [...rows];
    arr.sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key];
      if (av == null) av = -Infinity; if (bv == null) bv = -Infinity;
      if (typeof av === "string" && typeof bv === "string") {
        return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sort, columns]);
  const toggle = (key) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  return (
    <div className={`${CARD} overflow-x-auto`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
            {columns.map((c) => (
              <th key={c.key} className={`${TH} cursor-pointer select-none ${c.align === "right" ? "text-right" : "text-left"}`} onClick={() => toggle(c.key)}>
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sort.key === c.key
                    ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                    : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className="border-b border-[#F0F2FA] dark:border-[#1A1D2A] last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-[#0D0F14]">
              {columns.map((c) => (
                <td key={c.key} className={`${TD} ${c.align === "right" ? "text-right" : "text-left"}`}>
                  {c.render ? c.render(r) : r[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={columns.length} className="text-center text-[12px] text-[#8B92A9] py-8">No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function GoogleAdsDashboard() {
  const [from, setFrom]       = useState(isoDaysAgo(30));
  const [to, setTo]           = useState(isoDaysAgo(0));
  const [campaign, setCampaign]       = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [status, setStatus]           = useState("");
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError]     = useState("");

  const params = () => {
    const p = { from, to };
    if (campaign)    p.campaign = campaign;
    if (salesperson) p.salesperson = salesperson;
    if (status)      p.status = status;
    return p;
  };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/google-ads-config/dashboard", { params: { ...params(), ai: "false" } });
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load dashboard.");
    } finally { setLoading(false); }
  }, [from, to, campaign, salesperson, status]);

  const generateAI = useCallback(async () => {
    setAiLoading(true); setError("");
    try {
      const { data } = await api.get("/google-ads-config/dashboard", { params: { ...params(), ai: "true" }, timeout: 70000 });
      setData(data);
    } catch (e) {
      setError(e.code === "ECONNABORTED" ? "AI report timed out — try again." : (e?.response?.data?.message || "AI report failed."));
    } finally { setAiLoading(false); }
  }, [from, to, campaign, salesperson, status]);

  useEffect(() => { load(); }, [from, to, campaign, salesperson, status]); // eslint-disable-line

  const exportPDF = () => window.print();

  const campaignOpts = data?.campaigns?.map((c) => c.campaignName) || [];
  const salesOpts = (data?.salesTeam || []).filter((s) => s.userId).map((s) => ({ id: s.userId, name: s.salesperson }));

  const selCls = "text-[12px] font-semibold bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl px-3 py-2 text-[#0F1117] dark:text-[#DDE1F5] focus:outline-none";

  return (
    <div className="print-area">
      <style>{`@media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }
        @keyframes growbar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .funnel-bar { transform-origin: left center; animation: growbar .5s ease-out both; }`}</style>

      {/* Header + controls */}
      <div className="px-4 md:px-8 pt-6 pb-4 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] no-print">
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center">
                <MousePointerClick className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-[18px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Google Ads Performance</h1>
                <p className="text-[12px] text-[#8B92A9]">Where your ad budget becomes customers &amp; revenue</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={generateAI} disabled={aiLoading || loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[12px] font-semibold transition">
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiLoading ? "Analyzing…" : data?.aiAnalysis ? "Re-generate AI" : "Generate AI Report"}
              </button>
              <button onClick={exportPDF} disabled={!data}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] text-[#4B5168] dark:text-[#9DA3BB] text-[12px] font-semibold disabled:opacity-40">
                <FileDown className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-[#8B92A9]" />
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-[12px] font-semibold bg-transparent focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]" />
              <span className="text-[#C4C9DA]">→</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-[12px] font-semibold bg-transparent focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]" />
            </div>
            <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className={selCls}>
              <option value="">All campaigns</option>
              {campaignOpts.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className={selCls}>
              <option value="">All salespeople</option>
              {salesOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selCls}>
              <option value="">All statuses</option>
              {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {loading && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-7">
        {/* Live Google Ads API connection (impressions/clicks/cost auto-sync) */}
        <GoogleAdsApiConnect onSynced={load} />

        {/* Live ad-group & campaign metrics from the Google Ads API */}
        <GoogleAdsBreakdown from={from} to={to} />


        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 text-[13px] font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* SECTION 1 — Overview KPIs */}
        <section>
          <SectionTitle sub="Green = improving · Orange = stable · Red = needs attention (vs previous period)">Overview</SectionTitle>
          {loading && !data ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 11 }).map((_, i) => <div key={i} className={`${CARD} p-4 h-24 animate-pulse`} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(data?.kpis || []).map((k) => <KpiCard key={k.key} kpi={k} />)}
            </div>
          )}
        </section>

        {/* SECTION 12 — AI analysis */}
        {data && (
          <section className={`${CARD} overflow-hidden`}>
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/20 dark:to-sky-950/20">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center"><Sparkles className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">AI Business Analysis</span>
              {data.aiAnalysis?.priority && (
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  data.aiAnalysis.priority === "High" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                  : data.aiAnalysis.priority === "Low" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
                  {data.aiAnalysis.priority} priority
                </span>
              )}
            </div>
            <div className="p-5">
              {data.aiAnalysisError ? (
                <div className="flex items-center gap-2 text-[13px] text-amber-600 dark:text-amber-400"><AlertTriangle className="w-4 h-4" /> {data.aiAnalysisError}</div>
              ) : !data.aiAnalysis ? (
                <div className="flex flex-col items-center py-6 gap-2 text-center">
                  <Sparkles className="w-7 h-7 text-[#C4C9DA]" />
                  <p className="text-[13px] text-[#8B92A9]">Click "Generate AI Report" to analyze spend, funnel drop-offs and sales performance.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.aiAnalysis.summary && <p className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed border-l-2 border-blue-400 pl-3">{data.aiAnalysis.summary}</p>}
                  <div className="grid md:grid-cols-2 gap-4">
                    {data.aiAnalysis.problems?.length > 0 && (
                      <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-3"><AlertCircle className="w-3.5 h-3.5 text-rose-600" /><span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Problems Detected</span></div>
                        <ul className="space-y-2">{data.aiAnalysis.problems.map((p, i) => <li key={i} className="text-[12px] text-[#334155] dark:text-[#CBD5E1]">• {p}</li>)}</ul>
                      </div>
                    )}
                    {data.aiAnalysis.recommendations?.length > 0 && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-3"><Lightbulb className="w-3.5 h-3.5 text-emerald-600" /><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Recommendations</span></div>
                        <ul className="space-y-2">{data.aiAnalysis.recommendations.map((r, i) => <li key={i} className="text-[12px] text-[#334155] dark:text-[#CBD5E1]">• {r}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  {data.aiAnalysis.expectedImpact && (
                    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-4 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div><span className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] block mb-1">Expected Business Impact</span><span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{data.aiAnalysis.expectedImpact}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECTION 3 — Funnel */}
        {data?.funnel?.length > 0 && (
          <section>
            <SectionTitle sub="Where leads drop off between click and customer (red = large drop-off)">Performance Funnel</SectionTitle>
            <div className="space-y-2">
              {data.funnel.map((s, i) => {
                const width = data.funnel[0].count > 0 ? Math.max(6, (s.count / data.funnel[0].count) * 100) : 6;
                return (
                  <div key={s.name} className={`${CARD} p-3.5`}>
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <span className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{s.name}</span>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="font-bold text-[#0F1117] dark:text-[#DDE1F5]">{int(s.count)}</span>
                        {s.fromPrevPct != null && <span className="text-[#8B92A9]">{s.fromPrevPct}% of prev</span>}
                        {s.conversionPct != null && <span className="text-blue-600 dark:text-blue-400">{s.conversionPct}% overall</span>}
                        {s.dropOffPct != null && (
                          <span className={`font-semibold ${s.bigDropOff ? "text-rose-600 dark:text-rose-400" : "text-[#8B92A9]"}`}>
                            ▼ {s.dropOffPct}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#F0F2FA] dark:bg-[#1A1D2A] overflow-hidden">
                      <div className={`funnel-bar h-full rounded-full ${s.bigDropOff ? "bg-rose-500" : "bg-blue-500"}`} style={{ width: `${width}%`, animationDelay: `${i * 60}ms` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION 2 — Campaign performance table */}
        {data?.campaigns?.length > 0 && (
          <section>
            <SectionTitle sub="Sortable — click any column header">Campaign Performance</SectionTitle>
            <SortableTable
              initialSort={{ key: "revenue", dir: "desc" }}
              rows={data.campaigns}
              columns={[
                { key: "campaignName", label: "Campaign", render: (r) => <span className="font-semibold">{r.campaignName}</span> },
                { key: "status", label: "Status", render: (r) => <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.status === "Active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-[#F0F2FA] text-[#8B92A9] dark:bg-[#1A1D2A]"}`}>{r.status}</span> },
                { key: "spend", label: "Spend", align: "right", render: (r) => money(r.spend) },
                { key: "impressions", label: "Impr.", align: "right", render: (r) => int(r.impressions) },
                { key: "clicks", label: "Clicks", align: "right", render: (r) => int(r.clicks) },
                { key: "ctr", label: "CTR", align: "right", render: (r) => pct(r.ctr) },
                { key: "avgCpc", label: "Avg CPC", align: "right", render: (r) => money(r.avgCpc) },
                { key: "conversions", label: "Conv.", align: "right", render: (r) => int(r.conversions) },
                { key: "conversionRatePct", label: "Conv %", align: "right", render: (r) => pct(r.conversionRatePct) },
                { key: "costPerConversion", label: "Cost/Conv", align: "right", render: (r) => money(r.costPerConversion) },
                { key: "roas", label: "ROAS", align: "right", render: (r) => mult(r.roas) },
              ]}
            />
          </section>
        )}

        {/* SECTION 5 — CRM sales performance */}
        {data?.crmSales && (
          <section>
            <SectionTitle sub="Sales outcomes Google Ads can't see">CRM Sales Performance</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                ["Total Leads", int(data.crmSales.totalLeads)],
                ["Qualified", int(data.crmSales.qualifiedLeads)],
                ["Interested", int(data.crmSales.interestedLeads)],
                ["Lost", int(data.crmSales.lostLeads)],
                ["Won Customers", int(data.crmSales.wonCustomers)],
                ["Revenue", money(data.crmSales.revenue)],
                ["Avg Deal Size", money(data.crmSales.avgDealSize)],
                ["Revenue / Lead", money(data.crmSales.revenuePerLead)],
                ["Revenue / Customer", money(data.crmSales.revenuePerCustomer)],
              ].map(([label, val]) => (
                <div key={label} className={`${CARD} p-4`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-1">{label}</p>
                  <p className="text-[16px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{val}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 7 — Campaign ROI */}
        {data?.campaigns?.length > 0 && (
          <section>
            <SectionTitle sub="Financial return per campaign">Campaign ROI</SectionTitle>
            <SortableTable
              initialSort={{ key: "roi", dir: "desc" }}
              rows={data.campaigns}
              columns={[
                { key: "campaignName", label: "Campaign", render: (r) => <span className="font-semibold">{r.campaignName}</span> },
                { key: "spend", label: "Spend", align: "right", render: (r) => money(r.spend) },
                { key: "leads", label: "Leads", align: "right", render: (r) => int(r.leads) },
                { key: "qualified", label: "Qualified", align: "right", render: (r) => int(r.qualified) },
                { key: "conversions", label: "Customers", align: "right", render: (r) => int(r.conversions) },
                { key: "revenue", label: "Revenue", align: "right", render: (r) => money(r.revenue) },
                { key: "cpl", label: "Cost/Lead", align: "right", render: (r) => money(r.cpl) },
                { key: "costPerConversion", label: "Cost/Customer", align: "right", render: (r) => money(r.costPerConversion) },
                { key: "roas", label: "ROAS", align: "right", render: (r) => mult(r.roas) },
                { key: "roi", label: "ROI", align: "right", render: (r) => <span className={r.roi != null && r.roi < 0 ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-emerald-600 dark:text-emerald-400 font-semibold"}>{pct(r.roi)}</span> },
                { key: "profit", label: "Profit", align: "right", render: (r) => <span className={r.profit < 0 ? "text-rose-600 dark:text-rose-400" : ""}>{money(r.profit)}</span> },
              ]}
            />
          </section>
        )}

        {/* SECTION 6 — Sales team performance */}
        {data?.salesTeam?.length > 0 && (
          <section>
            <SectionTitle sub="From assigned leads, logged calls, meetings & closed deals">Sales Team Performance</SectionTitle>
            <SortableTable
              initialSort={{ key: "revenue", dir: "desc" }}
              rows={data.salesTeam}
              columns={[
                { key: "salesperson", label: "Salesperson", render: (r) => <span className="font-semibold">{r.salesperson}</span> },
                { key: "assignedLeads", label: "Assigned", align: "right", render: (r) => int(r.assignedLeads) },
                { key: "callsLogged", label: "Calls", align: "right", render: (r) => int(r.callsLogged) },
                { key: "meetings", label: "Meetings", align: "right", render: (r) => int(r.meetings) },
                { key: "followUps", label: "Follow-ups", align: "right", render: (r) => int(r.followUps) },
                { key: "closedDeals", label: "Closed", align: "right", render: (r) => int(r.closedDeals) },
                { key: "revenue", label: "Revenue", align: "right", render: (r) => money(r.revenue) },
                { key: "conversionRatePct", label: "Conv %", align: "right", render: (r) => pct(r.conversionRatePct) },
                { key: "avgResponseHours", label: "Avg Response", align: "right", render: (r) => r.avgResponseHours == null ? "—" : `${r.avgResponseHours}h` },
              ]}
            />
          </section>
        )}

        {/* Unavailable-sections note (honest) */}
        {data?.notes?.unavailable && (
          <p className="text-[11px] text-[#8B92A9] border-t border-[#E4E7EF] dark:border-[#1E2133] pt-4">
            {data.notes.unavailable} {data.notes.qualified} {data.notes.revenue}
          </p>
        )}
      </div>
    </div>
  );
}
