import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../data/axiosConfig";
import {
  Globe, Loader2, Sparkles, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Users, MousePointerClick, Timer, Target, RefreshCw, Link2, CheckCircle2,
  AlertCircle, Lightbulb, ChevronUp, ChevronDown, ArrowUpDown, Monitor, Smartphone, Tablet,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Website Performance — Google Analytics 4 dashboard
// GET /google-analytics/status | /connect-url | /properties | /dashboard
// ─────────────────────────────────────────────────────────────────────────────

const iso = (d) => d.toISOString().slice(0, 10);
const today = () => new Date();
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const PRESETS = {
  today:      () => [iso(today()), iso(today())],
  yesterday:  () => [iso(daysAgo(1)), iso(daysAgo(1))],
  last7:      () => [iso(daysAgo(6)), iso(today())],
  last30:     () => [iso(daysAgo(29)), iso(today())],
  last90:     () => [iso(daysAgo(89)), iso(today())],
  thisMonth:  () => [iso(startOfMonth(today())), iso(today())],
  prevMonth:  () => { const p = new Date(today().getFullYear(), today().getMonth() - 1, 1); return [iso(startOfMonth(p)), iso(endOfMonth(p))]; },
};
const PRESET_LABELS = [
  ["today", "Today"], ["yesterday", "Yesterday"], ["last7", "7 Days"], ["last30", "30 Days"],
  ["last90", "90 Days"], ["thisMonth", "This Month"], ["prevMonth", "Prev Month"], ["custom", "Custom"],
];

const num = (v) => v == null ? "—" : Number(v).toLocaleString("en-IN");
const CARD = "bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl";

const fmtVal = (v, f) => {
  if (v == null) return "—";
  if (f === "pct") return `${v}%`;
  if (f === "dur") { const m = Math.floor(v / 60), s = Math.round(v % 60); return m > 0 ? `${m}m ${s}s` : `${s}s`; }
  return Number(v).toLocaleString("en-IN");
};

const DONUT_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#0EA5E9", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#64748B"];

// ── Tiny SVG multi-line chart ─────────────────────────────────────────────────
function LineChart({ series, height = 160 }) {
  // series: [{ key, label, color, data: number[] }], all same length
  const n = series[0]?.data?.length || 0;
  if (!n) return <div className="text-[12px] text-[#8B92A9] py-8 text-center">No data</div>;
  const w = 560, h = height, pad = 8;
  const allMax = Math.max(1, ...series.flatMap((s) => s.data));
  const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
  const y = (v) => h - pad - (v / allMax) * (h - 2 * pad);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      {series.map((s) => (
        <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2"
          points={s.data.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      ))}
    </svg>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────────────
function Donut({ data }) {
  // data: [{ label, value }]
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 140 140" className="w-[120px] h-[120px] shrink-0">
        <g transform="translate(70,70) rotate(-90)">
          {data.slice(0, 10).map((d, i) => {
            const frac = d.value / total;
            const dash = `${frac * C} ${C}`;
            const el = <circle key={i} r={R} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="16" strokeDasharray={dash} strokeDashoffset={-acc * C} />;
            acc += frac; return el;
          })}
        </g>
      </svg>
      <div className="flex-1 min-w-0 space-y-1">
        {data.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="truncate text-[#4B5168] dark:text-[#9DA3BB]">{d.label}</span>
            <span className="ml-auto font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SortableTable({ columns, rows, initialSort }) {
  const [sort, setSort] = useState(initialSort || { key: columns[0].key, dir: "desc" });
  const sorted = useMemo(() => {
    const arr = [...(rows || [])];
    arr.sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key];
      if (typeof av === "string" && typeof bv === "string") return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      av = av ?? -Infinity; bv = bv ?? -Infinity;
      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sort]);
  const toggle = (k) => setSort((s) => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });
  return (
    <div className={`${CARD} overflow-x-auto`}>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
          {columns.map((c) => (
            <th key={c.key} onClick={() => toggle(c.key)}
              className={`text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 cursor-pointer whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>
              <span className="inline-flex items-center gap-1">{c.label}{sort.key === c.key ? (sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}</span>
            </th>
          ))}
        </tr></thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className="border-b border-[#F0F2FA] dark:border-[#1A1D2A] last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-[#0D0F14]">
              {columns.map((c) => <td key={c.key} className={`text-[12px] text-[#0F1117] dark:text-[#DDE1F5] px-3 py-2.5 whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>{c.render ? c.render(r) : (r[c.key] ?? "—")}</td>)}
            </tr>
          ))}
          {sorted.length === 0 && <tr><td colSpan={columns.length} className="text-center text-[12px] text-[#8B92A9] py-8">No data</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const DeviceIcon = ({ d }) => {
  const k = (d || "").toLowerCase();
  if (k.includes("mobile")) return <Smartphone className="w-4 h-4" />;
  if (k.includes("tablet")) return <Tablet className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
};

export default function WebsiteAnalyticsDashboard() {
  const [status, setStatus] = useState(null);   // connection status
  const [statusLoading, setStatusLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [properties, setProperties] = useState(null);
  const [savingProp, setSavingProp] = useState(false);

  const [preset, setPreset] = useState("last30");
  const [from, setFrom] = useState(PRESETS.last30()[0]);
  const [to, setTo]     = useState(PRESETS.last30()[1]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try { const { data } = await api.get("/google-analytics/status"); setStatus(data); }
    catch { setStatus({ connected: false, oauthConfigured: true }); }
    finally { setStatusLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Detect return from OAuth (?ga=connected) and refresh status
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("ga")) {
      loadStatus();
      // clean the URL
      p.delete("ga"); const q = p.toString();
      window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
    }
  }, [loadStatus]);

  const connect = async () => {
    setConnecting(true); setError("");
    try { const { data } = await api.get("/google-analytics/connect-url"); window.location.href = data.url; }
    catch (e) { setError(e?.response?.data?.message || "Could not start Google connect."); setConnecting(false); }
  };

  const loadProperties = useCallback(async () => {
    try { const { data } = await api.get("/google-analytics/properties"); setProperties(data.properties || []); }
    catch (e) { setError(e?.response?.data?.message || "Could not load GA4 properties."); }
  }, []);

  useEffect(() => { if (status?.connected && status?.needsProperty) loadProperties(); }, [status, loadProperties]);

  const chooseProperty = async (p) => {
    setSavingProp(true); setError("");
    try {
      await api.post("/google-analytics/property", { propertyId: p.propertyId, propertyName: p.propertyName });
      await loadStatus();
    } catch (e) { setError(e?.response?.data?.message || "Could not save property."); }
    finally { setSavingProp(false); }
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect Google Analytics?")) return;
    try { await api.delete("/google-analytics"); setData(null); await loadStatus(); } catch { /* */ }
  };

  const applyPreset = (key) => {
    setPreset(key);
    if (key !== "custom" && PRESETS[key]) { const [f, t] = PRESETS[key](); setFrom(f); setTo(t); }
  };

  const loadDashboard = useCallback(async (withAI = false) => {
    if (!status?.connected || status?.needsProperty) return;
    withAI ? setAiLoading(true) : setLoading(true); setError("");
    try {
      const { data } = await api.get("/google-analytics/dashboard", { params: { from, to, ai: withAI ? "true" : "false" }, timeout: withAI ? 70000 : 40000 });
      setData(data);
    } catch (e) { setError(e?.response?.data?.message || "Failed to load analytics."); }
    finally { withAI ? setAiLoading(false) : setLoading(false); }
  }, [from, to, status]);

  useEffect(() => { if (status?.connected && !status?.needsProperty) loadDashboard(false); }, [from, to, status]); // eslint-disable-line

  // ── Render states ───────────────────────────────────────────────────────────
  if (statusLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#8B92A9]" /></div>;
  }

  // Server OAuth not configured
  if (status && status.oauthConfigured === false) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Globe className="w-10 h-10 text-[#C4C9DA] mx-auto mb-3" strokeWidth={1.5} />
        <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Google Analytics not set up</h2>
        <p className="text-[13px] text-[#8B92A9] mt-2">The server's Google OAuth credentials aren't configured yet. Ask your developer to set <code className="bg-black/5 dark:bg-white/10 px-1 rounded">GOOGLE_OAUTH_CLIENT_ID</code>, <code className="bg-black/5 dark:bg-white/10 px-1 rounded">GOOGLE_OAUTH_CLIENT_SECRET</code> and <code className="bg-black/5 dark:bg-white/10 px-1 rounded">GOOGLE_OAUTH_REDIRECT_URI</code>.</p>
      </div>
    );
  }

  // Not connected
  if (!status?.connected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
          <Globe className="w-7 h-7 text-emerald-600" />
        </div>
        <h2 className="text-[18px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Connect Google Analytics</h2>
        <p className="text-[13px] text-[#8B92A9] mt-2 mb-5">Connect your Google Analytics 4 account to see website users, traffic sources, landing pages, conversions and AI insights — right inside the CRM.</p>
        {error && <p className="text-[12px] text-rose-600 mb-3">{error}</p>}
        <button onClick={connect} disabled={connecting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[13px] font-semibold">
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Connect Google Analytics
        </button>
      </div>
    );
  }

  // Connected but no property selected
  if (status?.needsProperty) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-14">
        <div className="text-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Connected as {status.connectedEmail || "your account"}</h2>
          <p className="text-[13px] text-[#8B92A9] mt-1">Choose the GA4 property to track:</p>
        </div>
        {error && <p className="text-[12px] text-rose-600 mb-3 text-center">{error}</p>}
        {properties == null ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#8B92A9]" /></div>
        ) : properties.length === 0 ? (
          <p className="text-[13px] text-[#8B92A9] text-center">No GA4 properties found on this account.</p>
        ) : (
          <div className="space-y-2">
            {properties.map((p) => (
              <button key={p.propertyId} onClick={() => chooseProperty(p)} disabled={savingProp}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border ${CARD} hover:border-emerald-400 text-left disabled:opacity-50`}>
                <div><p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{p.propertyName}</p><p className="text-[11px] text-[#8B92A9]">{p.account} · ID {p.propertyId}</p></div>
                {savingProp ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4 -rotate-90 text-[#8B92A9]" />}
              </button>
            ))}
          </div>
        )}
        <button onClick={disconnect} className="mt-5 mx-auto block text-[12px] text-[#8B92A9] hover:text-rose-600">Disconnect</button>
      </div>
    );
  }

  // ── Full dashboard ────────────────────────────────────────────────────────
  const ov = Array.isArray(data?.overview) ? data.overview : [];
  const ts = data?.timeseries && !data.timeseries.__error ? data.timeseries : [];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center"><Globe className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-[18px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Website Performance</h1>
            <p className="text-[12px] text-[#8B92A9]">{data?.property?.name || status.propertyName} · {status.connectedEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadDashboard(true)} disabled={aiLoading || loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[12px] font-semibold">
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}{aiLoading ? "Analyzing…" : "Generate AI Report"}
          </button>
          <button onClick={() => loadDashboard(false)} disabled={loading} title="Refresh" className="p-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] text-[#4B5168] dark:text-[#9DA3BB]"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
          <button onClick={disconnect} className="px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] text-[11px] text-[#8B92A9] hover:text-rose-600">Disconnect</button>
        </div>
      </div>

      {/* Date presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESET_LABELS.map(([k, l]) => (
          <button key={k} onClick={() => applyPreset(k)} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${preset === k ? "bg-emerald-600 text-white border-emerald-600" : "border-[#E4E7EF] dark:border-[#1E2133] text-[#4B5168] dark:text-[#9DA3BB] bg-white dark:bg-[#11131C]"}`}>{l}</button>
        ))}
        {preset === "custom" && (
          <span className="flex items-center gap-1.5 ml-1">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] text-[12px]" />
            <span className="text-[#C4C9DA]">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] text-[12px]" />
          </span>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-emerald-500 ml-1" />}
      </div>

      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-rose-600 text-[13px] font-semibold"><AlertTriangle className="w-4 h-4" /> {error}</div>}

      {/* SECTION 1 — Overview KPIs */}
      {ov.__error ? <p className="text-[12px] text-amber-600">Overview unavailable: {ov.__error}</p> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ov.map((k) => {
            const Icon = /rate|bounce|engage/i.test(k.label) ? Target : /user/i.test(k.label) ? Users : /session/i.test(k.label) ? MousePointerClick : /time|duration/i.test(k.label) ? Timer : TrendingUp;
            const TrendIcon = k.deltaPct > 0 ? TrendingUp : k.deltaPct < 0 ? TrendingDown : Minus;
            const col = k.color === "green" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : k.color === "red" ? "text-rose-600 bg-rose-50 dark:bg-rose-950/30" : "text-amber-600 bg-amber-50 dark:bg-amber-950/30";
            return (
              <div key={k.label} className={`${CARD} p-4 flex flex-col gap-2.5`}>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center"><Icon className="w-4 h-4 text-emerald-600" /></div>
                  {k.deltaPct != null && <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col}`}><TrendIcon className="w-3 h-3" />{Math.abs(k.deltaPct)}%</span>}
                </div>
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{k.label}</p><p className="text-[17px] font-bold text-[#0F1117] dark:text-[#DDE1F5] leading-none">{fmtVal(k.value, k.format)}</p></div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI panel */}
      {(data?.aiAnalysis || data?.aiAnalysisError || aiLoading) && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center"><Sparkles className="w-3.5 h-3.5 text-white" /></div>
            <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">AI Website Analysis</span>
            {data?.aiAnalysis?.priority && <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${data.aiAnalysis.priority === "High" ? "bg-rose-100 text-rose-700" : data.aiAnalysis.priority === "Low" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{data.aiAnalysis.priority} priority</span>}
          </div>
          <div className="p-5">
            {aiLoading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>
              : data?.aiAnalysisError ? <p className="text-[13px] text-amber-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{data.aiAnalysisError}</p>
              : data?.aiAnalysis ? (
                <div className="space-y-4">
                  {data.aiAnalysis.summary && <p className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed border-l-2 border-emerald-400 pl-3">{data.aiAnalysis.summary}</p>}
                  <div className="grid md:grid-cols-2 gap-4">
                    {data.aiAnalysis.problems?.length > 0 && <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl p-4"><div className="flex items-center gap-1.5 mb-2"><AlertCircle className="w-3.5 h-3.5 text-rose-600" /><span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Problems</span></div><ul className="space-y-1.5">{data.aiAnalysis.problems.map((p, i) => <li key={i} className="text-[12px] text-[#334155] dark:text-[#CBD5E1]">• {p}</li>)}</ul></div>}
                    {data.aiAnalysis.recommendations?.length > 0 && <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4"><div className="flex items-center gap-1.5 mb-2"><Lightbulb className="w-3.5 h-3.5 text-emerald-600" /><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Recommendations</span></div><ul className="space-y-1.5">{data.aiAnalysis.recommendations.map((r, i) => <li key={i} className="text-[12px] text-[#334155] dark:text-[#CBD5E1]">• {r}</li>)}</ul></div>}
                  </div>
                  {data.aiAnalysis.expectedImpact && <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-4 flex items-start gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /><div><span className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] block mb-1">Expected Impact</span><span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{data.aiAnalysis.expectedImpact}</span></div></div>}
                </div>
              ) : null}
          </div>
        </div>
      )}

      {/* SECTION 11 — Trend charts */}
      {ts.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className={`${CARD} p-4`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8B92A9] mb-2">Users &amp; Sessions</p>
            <LineChart series={[
              { key: "users", label: "Users", color: "#6366F1", data: ts.map((d) => d.users) },
              { key: "sessions", label: "Sessions", color: "#10B981", data: ts.map((d) => d.sessions) },
            ]} />
            <div className="flex gap-4 mt-1 text-[10px] text-[#8B92A9]"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#6366F1" }} />Users</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#10B981" }} />Sessions</span></div>
          </div>
          <div className={`${CARD} p-4`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8B92A9] mb-2">Conversions Over Time</p>
            <LineChart series={[{ key: "conv", label: "Conversions", color: "#F59E0B", data: ts.map((d) => d.conversions) }]} />
          </div>
        </div>
      )}

      {/* SECTION 2 + 5 — Traffic sources donut + device donut */}
      <div className="grid md:grid-cols-2 gap-4">
        {Array.isArray(data?.trafficSources) && data.trafficSources.length > 0 && (
          <div className={`${CARD} p-4`}><p className="text-[11px] font-bold uppercase tracking-wider text-[#8B92A9] mb-3">Traffic Sources</p>
            <Donut data={data.trafficSources.map((s) => ({ label: `${s.source}/${s.medium}`, value: s.sessions }))} /></div>
        )}
        {Array.isArray(data?.devices) && data.devices.length > 0 && (
          <div className={`${CARD} p-4`}><p className="text-[11px] font-bold uppercase tracking-wider text-[#8B92A9] mb-3">Device Distribution</p>
            <Donut data={data.devices.map((d) => ({ label: d.device, value: d.users }))} /></div>
        )}
      </div>

      {/* SECTION 2 table */}
      {Array.isArray(data?.trafficSources) && (
        <div><h2 className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-3">Traffic Sources</h2>
          <SortableTable initialSort={{ key: "sessions", dir: "desc" }} rows={data.trafficSources} columns={[
            { key: "source", label: "Source", render: (r) => <span className="font-semibold">{r.source}</span> },
            { key: "medium", label: "Medium" },
            { key: "users", label: "Users", align: "right", render: (r) => num(r.users) },
            { key: "sessions", label: "Sessions", align: "right", render: (r) => num(r.sessions) },
            { key: "engagementRate", label: "Engagement", align: "right", render: (r) => `${r.engagementRate}%` },
            { key: "bounceRate", label: "Bounce", align: "right", render: (r) => `${r.bounceRate}%` },
            { key: "conversions", label: "Conv.", align: "right", render: (r) => num(r.conversions) },
          ]} /></div>
      )}

      {/* SECTION 3 — Landing pages */}
      {Array.isArray(data?.landingPages) && (
        <div><h2 className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-3">Landing Page Performance</h2>
          <SortableTable initialSort={{ key: "sessions", dir: "desc" }} rows={data.landingPages} columns={[
            { key: "page", label: "Landing Page", render: (r) => <span className="font-mono text-[11px] truncate inline-block max-w-[220px] align-middle">{r.page}</span> },
            { key: "views", label: "Views", align: "right", render: (r) => num(r.views) },
            { key: "users", label: "Users", align: "right", render: (r) => num(r.users) },
            { key: "sessions", label: "Sessions", align: "right", render: (r) => num(r.sessions) },
            { key: "avgEngagementTime", label: "Avg Eng.", align: "right", render: (r) => `${r.avgEngagementTime}s` },
            { key: "bounceRate", label: "Bounce", align: "right", render: (r) => <span className={r.bounceRate >= 70 ? "text-rose-600 font-semibold" : ""}>{r.bounceRate}%</span> },
            { key: "conversionRate", label: "Conv %", align: "right", render: (r) => <span className={r.conversionRate > 0 ? "text-emerald-600 font-semibold" : ""}>{r.conversionRate}%</span> },
          ]} /></div>
      )}

      {/* SECTION 4 — Events */}
      {Array.isArray(data?.events) && (
        <div><h2 className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-3">Event Tracking</h2>
          <SortableTable initialSort={{ key: "count", dir: "desc" }} rows={data.events} columns={[
            { key: "event", label: "Event", render: (r) => <span className="font-semibold">{r.event}</span> },
            { key: "count", label: "Count", align: "right", render: (r) => num(r.count) },
            { key: "users", label: "Users", align: "right", render: (r) => num(r.users) },
            { key: "conversions", label: "Conversions", align: "right", render: (r) => num(r.conversions) },
          ]} /></div>
      )}

      {/* SECTION 5 — Device cards */}
      {Array.isArray(data?.devices) && data.devices.length > 0 && (
        <div><h2 className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-3">Device Performance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.devices.map((d) => (
              <div key={d.device} className={`${CARD} p-4`}>
                <div className="flex items-center gap-2 mb-3 text-emerald-600"><DeviceIcon d={d.device} /><span className="text-[13px] font-bold capitalize text-[#0F1117] dark:text-[#DDE1F5]">{d.device}</span></div>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div><p className="text-[#8B92A9] text-[10px] uppercase">Users</p><p className="font-bold">{num(d.users)}</p></div>
                  <div><p className="text-[#8B92A9] text-[10px] uppercase">Sessions</p><p className="font-bold">{num(d.sessions)}</p></div>
                  <div><p className="text-[#8B92A9] text-[10px] uppercase">Bounce</p><p className="font-bold">{d.bounceRate}%</p></div>
                  <div><p className="text-[#8B92A9] text-[10px] uppercase">Conv.</p><p className="font-bold">{num(d.conversions)}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 6 — Geo */}
      {Array.isArray(data?.geo) && (
        <div><h2 className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-3">Geographic Performance</h2>
          <SortableTable initialSort={{ key: "users", dir: "desc" }} rows={data.geo} columns={[
            { key: "country", label: "Country" }, { key: "state", label: "State" }, { key: "city", label: "City", render: (r) => <span className="font-semibold">{r.city || "—"}</span> },
            { key: "users", label: "Users", align: "right", render: (r) => num(r.users) },
            { key: "sessions", label: "Sessions", align: "right", render: (r) => num(r.sessions) },
            { key: "conversions", label: "Conv.", align: "right", render: (r) => num(r.conversions) },
            { key: "engagementRate", label: "Engagement", align: "right", render: (r) => `${r.engagementRate}%` },
          ]} /></div>
      )}

      {/* SECTION 7 — Browser & Platform */}
      {Array.isArray(data?.browserOs) && (
        <div><h2 className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-3">Browser &amp; Platform</h2>
          <SortableTable initialSort={{ key: "users", dir: "desc" }} rows={data.browserOs} columns={[
            { key: "browser", label: "Browser", render: (r) => <span className="font-semibold">{r.browser}</span> },
            { key: "os", label: "OS" }, { key: "device", label: "Device" },
            { key: "users", label: "Users", align: "right", render: (r) => num(r.users) },
            { key: "sessions", label: "Sessions", align: "right", render: (r) => num(r.sessions) },
            { key: "conversions", label: "Conv.", align: "right", render: (r) => num(r.conversions) },
          ]} /></div>
      )}

      <p className="text-[11px] text-[#8B92A9] border-t border-[#E4E7EF] dark:border-[#1E2133] pt-4">Data from Google Analytics 4 · {data?.range?.from} → {data?.range?.to}. Trends compare against the previous period.</p>
    </div>
  );
}
