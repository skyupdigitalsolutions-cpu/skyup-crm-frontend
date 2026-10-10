// src/marketing/mkt/tabs/DataHealth.jsx
// Is every data source working, and do the numbers reconcile? Plus dashboard
// settings (rating thresholds, fatigue, SLA, targets, default deal value) and
// the metric dictionary everyone works from.
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, Loader2, Save } from "lucide-react";
import useReport from "../useReport";
import mktApi from "../../mktApi";
import { useMkt, Panel, Loader, ErrorBox, DrillNum, Badge, ago, num } from "../ui";

const TONE_ICON = { ok: [CheckCircle2, "text-emerald-600"], warn: [AlertTriangle, "text-amber-600"], error: [XCircle, "text-red-600"], neutral: [MinusCircle, "text-slate-400"] };

const SETTINGS = [
  ["Creative rating", [["creativeMinImpressions", "Minimum impressions"], ["creativeMinSpend", "Minimum spend (₹)"], ["creativeMinClicks", "Minimum link clicks"], ["creativeMinLeads", "Minimum CRM leads (quality score)"]]],
  ["Creative fatigue", [["fatigueFrequency", "Frequency threshold"], ["fatigueCtrDropPct", "Link CTR drop (%)"], ["fatigueCpcRisePct", "CPC rise (%)"]]],
  ["Sales SLA", [["slaFirstContactMinutes", "First contact within (minutes)"], ["proposalStaleDays", "Proposal stale after (days)"]]],
  ["Revenue & targets", [["defaultDealValue", "Default deal value (₹) — estimates revenue when a won lead has none"], ["targetCpl", "Target CPL (₹)"], ["targetCpql", "Target CPQL (₹)"], ["targetCac", "Target CAC (₹)"], ["targetRoas", "Target ROAS (×)"]]],
];

function SettingsForm({ initial, onSaved }) {
  const [f, setF] = useState(initial || {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setF(initial || {}); }, [initial]);
  const save = async () => {
    setSaving(true); setMsg("");
    try { await mktApi.put("/v2/settings", f); setMsg("Settings saved"); onSaved && onSaved(); }
    catch (e) { setMsg(e?.response?.data?.message || "Couldn't save settings"); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-5 md:grid-cols-2">
        {SETTINGS.map(([group, fields]) => (
          <fieldset key={group} className="space-y-2">
            <legend className="mb-1 text-[13px] font-semibold text-slate-800 dark:text-slate-200">{group}</legend>
            {fields.map(([k, l]) => (
              <label key={k} className="flex items-center justify-between gap-3 text-[13px] text-slate-600 dark:text-slate-300">
                <span>{l}</span>
                <input type="number" min="0" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1 text-right tabular-nums dark:border-[#1F2533] dark:bg-[#0F131B] dark:text-slate-100" />
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save settings</button>
        {msg && <span className="text-[13px] text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}

export default function DataHealth() {
  const { openDrill, dict, bump } = useMkt();
  const { data, error, loading, reload } = useReport("/v2/data-health");
  if (loading && !data) return <Loader label="Checking data sources…" />;
  if (error) return <ErrorBox msg={error} onRetry={reload} />;
  if (!data) return null;
  const failed = data.checks.filter((c) => !c.ok).length;

  return (
    <div className="space-y-5">
      <Panel title="Integrations" subtitle="Whether each data source is connected, when it last synced, and what's wrong." pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="bg-slate-50 text-[12px] text-slate-600 dark:bg-[#0F131B] dark:text-slate-300">{["Integration", "Status", "Last sync", "Records", "Issue"].map((h) => <th key={h} className="px-4 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {data.integrations.map((i) => {
                const [Icon, cls] = TONE_ICON[i.tone] || TONE_ICON.neutral;
                return (
                  <tr key={i.name} className="border-t border-slate-100 align-top dark:border-[#1A2030]">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{i.name}</td>
                    <td className="whitespace-nowrap px-4 py-2"><span className="inline-flex items-center gap-1.5"><Icon className={`h-4 w-4 ${cls}`} />{i.status}</span></td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600 dark:text-slate-400">{i.lastSync ? ago(i.lastSync) : "—"}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{i.records}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{i.issue || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Reconciliation" subtitle={failed ? `${failed} check(s) don't reconcile — the dashboard shows the gap instead of hiding it.` : "All numbers reconcile."}>
        <ul className="divide-y divide-slate-100 dark:divide-[#1A2030]">
          {data.checks.map((c, i) => (
            <li key={i} className="flex flex-wrap items-start gap-3 py-2.5">
              {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{c.label}</p>
                <p className="text-[13px] tabular-nums text-slate-600 dark:text-slate-300">{c.left.label} <b>{num(c.left.value)}</b> · {c.right.label} <b>{num(c.right.value)}</b>
                  {c.diff ? <> · <span className={c.ok ? "" : "font-semibold text-amber-700 dark:text-amber-300"}>gap {num(Math.abs(c.diff))}</span></> : null}
                  {!c.ok && c.drill && <> · <button onClick={() => openDrill(c.drill, c.label)} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">see leads</button></>}
                </p>
                {c.note && <p className="text-[12px] text-slate-500">{c.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Data quality">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.quality.map((q) => (
            <li key={q.label} className="rounded-lg border border-slate-200 px-3 py-3 dark:border-[#1F2533]">
              <p className="text-[22px] font-semibold"><DrillNum value={q.count} drill={q.drill} title={q.label} className={q.count ? "text-amber-700 dark:text-amber-300" : ""} /></p>
              <p className="text-[12px] text-slate-600 dark:text-slate-300">{q.label}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Dashboard settings" subtitle="Used for creative ratings, fatigue alerts, response-time SLAs and revenue estimates.">
        <SettingsForm initial={data.settings} onSaved={bump} />
      </Panel>

      {dict && (
        <Panel title="Metric dictionary" subtitle="The single definition every page, every marketer and the AI analysis use." pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="bg-slate-50 text-[12px] text-slate-600 dark:bg-[#0F131B] dark:text-slate-300">{["Metric", "Type", "Definition", "Formula"].map((h) => <th key={h} className="px-4 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(dict.metrics).map(([k, m]) => (
                  <tr key={k} className="border-t border-slate-100 align-top dark:border-[#1A2030]">
                    <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{m.label}</td>
                    <td className="px-4 py-2"><Badge tone={m.kind === "optimization" ? "brand" : m.kind === "diagnostic" ? "info" : "neutral"}>{m.kind}</Badge></td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{m.definition}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-700 dark:text-slate-200">{m.formula}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
