import { useState, useCallback } from "react";
import api from "../data/axiosConfig";
import { Loader2, BarChart3, RefreshCw } from "lucide-react";

// Live Google Ads breakdown (ad groups + campaigns) from the Google Ads API.
// Reads GET /google-ads-api/report. Renders nothing until loaded; shows a
// helpful note if the account isn't connected yet.
const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString());

function Table({ title, rows, cols }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (
    <div className="mb-5">
      <h3 className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-2">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-[#E4E7EF] dark:border-[#1E2133]">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#F8F9FC] dark:bg-[#0D0F14]">
              {cols.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-semibold text-[#4B5168] dark:text-[#9DA3BB] ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-[#F8F9FC]/50 dark:bg-white/[0.02]" : ""}>
                {cols.map((c) => (
                  <td key={c.key} className={`px-3 py-2 text-[#222733] dark:text-[#C9CEE0] ${c.align === "right" ? "text-right tabular-nums" : "text-left"}`}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GoogleAdsBreakdown({ from, to }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setNote("");
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get("/google-ads-api/report", { params });
      setReport(data); setLoaded(true);
    } catch (e) {
      const code = e?.response?.data?.code;
      if (code === "NOT_CONNECTED") setNote("Connect Google Ads above to see live ad-group and campaign metrics.");
      else if (code === "NO_ACCOUNT") setNote("Pick a Google Ads account above to load metrics.");
      else if (code === "NO_DEV_TOKEN") setNote("Server developer token not set — add GOOGLE_ADS_DEVELOPER_TOKEN to load metrics.");
      else setNote(e?.response?.data?.message || "Could not load Google Ads report.");
      setLoaded(true);
    } finally { setLoading(false); }
  }, [from, to]);

  const CARD = "bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl";

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-blue-600" />
        <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Live ad-group &amp; campaign metrics</p>
        <button onClick={load} disabled={loading} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-semibold">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} {loaded ? "Refresh" : "Load"}
        </button>
      </div>

      {note && <p className="text-[12px] text-[#8B92A9]">{note}</p>}

      {report && (
        <>
          {report.account?.customerName && (
            <p className="text-[11px] text-[#8B92A9] mb-3">{report.account.customerName} · {report.range?.from} → {report.range?.to}</p>
          )}

          <Table title="Ad Groups" rows={report.adGroups} cols={[
            { key: "adGroupName", label: "Ad Group", render: (r) => <span className="font-semibold">{r.adGroupName}</span> },
            { key: "campaignName", label: "Campaign" },
            { key: "impressions", label: "Impr.", align: "right", render: (r) => fmt(r.impressions) },
            { key: "clicks", label: "Clicks", align: "right", render: (r) => fmt(r.clicks) },
            { key: "cost", label: "Cost", align: "right", render: (r) => fmt(r.cost) },
            { key: "ctr", label: "CTR", align: "right", render: (r) => `${r.ctr}%` },
            { key: "avgCpc", label: "Avg CPC", align: "right", render: (r) => fmt(r.avgCpc) },
            { key: "conversions", label: "Conv.", align: "right", render: (r) => fmt(r.conversions) },
          ]} />

          <Table title="Campaigns" rows={report.campaigns} cols={[
            { key: "campaignName", label: "Campaign", render: (r) => <span className="font-semibold">{r.campaignName}</span> },
            { key: "impressions", label: "Impr.", align: "right", render: (r) => fmt(r.impressions) },
            { key: "clicks", label: "Clicks", align: "right", render: (r) => fmt(r.clicks) },
            { key: "cost", label: "Cost", align: "right", render: (r) => fmt(r.cost) },
            { key: "ctr", label: "CTR", align: "right", render: (r) => `${r.ctr}%` },
            { key: "conversions", label: "Conv.", align: "right", render: (r) => fmt(r.conversions) },
            { key: "videoViews", label: "Views", align: "right", render: (r) => fmt(r.videoViews) },
          ]} />

          {report.adGroups && report.adGroups.length === 0 && report.campaigns && report.campaigns.length === 0 && (
            <p className="text-[12px] text-[#8B92A9]">No data for this date range.</p>
          )}
        </>
      )}
    </div>
  );
}
