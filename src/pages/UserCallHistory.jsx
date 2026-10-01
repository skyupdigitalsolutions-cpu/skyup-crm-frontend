// src/pages/UserCallHistory.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Employee web → "My Calls": the complete call log of the signed-in employee,
// synced from their phone by the mobile app, with talk time.
//   • Range: Today / Yesterday / 7 days / 30 days / custom
//   • Totals: calls, talk time, average call, in / out / missed, connected,
//     unique numbers, recorded
//   • Day-wise breakdown
//   • Full call list (type / leads-only / search filters, recordings)
// Data: GET /call-logs/my-history (scoped to the caller on the server).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../data/axiosConfig";
import RecordingAudio from "../components/RecordingAudio";
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Timer, Users, Mic,
  RefreshCw, Search, ChevronLeft, ChevronRight, CheckCircle2, PhoneOff,
} from "lucide-react";

const CARD = "bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl";
const INP = "px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB]";
const TH = "text-left text-[11px] font-bold text-[#8B92A9] uppercase tracking-wider px-3 py-2.5 whitespace-nowrap";
const TD = "px-3 py-2.5 text-[13px] text-[#0F1117] dark:text-[#E5E7EB] whitespace-nowrap";

const TYPE = {
  outgoing: { label: "Outgoing", Icon: PhoneOutgoing, cls: "text-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540]" },
  incoming: { label: "Incoming", Icon: PhoneIncoming, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
  missed:   { label: "Missed",   Icon: PhoneMissed,   cls: "text-red-600 bg-red-50 dark:bg-red-500/10" },
  rejected: { label: "Rejected", Icon: PhoneOff,      cls: "text-amber-600 bg-amber-50 dark:bg-amber-500/10" },
};

function fmtTalk(secs) {
  const s = Math.max(0, Math.round(Number(secs) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${r}s`;
  return `${r}s`;
}
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayEnd = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

const PRESETS = [
  { k: "today", l: "Today" },
  { k: "yesterday", l: "Yesterday" },
  { k: "7d", l: "Last 7 days" },
  { k: "30d", l: "Last 30 days" },
  { k: "custom", l: "Custom" },
];
function rangeFor(k, cFrom, cTo) {
  const now = new Date();
  if (k === "today") return { from: dayStart(now), to: now };
  if (k === "yesterday") { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: dayStart(y), to: dayEnd(y) }; }
  if (k === "30d") { const f = new Date(now); f.setDate(f.getDate() - 29); return { from: dayStart(f), to: now }; }
  if (k === "custom" && cFrom) return { from: dayStart(cFrom), to: cTo ? dayEnd(cTo) : now };
  const f = new Date(now); f.setDate(f.getDate() - 6); return { from: dayStart(f), to: now };
}

function Tile({ icon, label, value, sub, tone = "blue", active, onClick }) {
  const tones = {
    blue: "text-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540]", green: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    red: "text-red-600 bg-red-50 dark:bg-red-500/10", purple: "text-purple-600 bg-purple-50 dark:bg-purple-500/10",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-500/10", slate: "text-slate-600 bg-slate-100 dark:bg-slate-500/10",
  };
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`${CARD} p-4 text-left transition ${onClick ? "hover:border-[#2563EB]" : "cursor-default"} ${active ? "!border-[#2563EB] ring-2 ring-[#2563EB]/15" : ""}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${tones[tone]}`}>{icon}</div>
      <p className="text-[22px] font-bold text-[#0F1117] dark:text-white tabular-nums leading-none">{value}</p>
      <p className="text-[12px] text-[#8B92A9] mt-1">{label}</p>
      {sub ? <p className="text-[11px] text-[#8B92A9] mt-0.5">{sub}</p> : null}
    </button>
  );
}

export default function UserCallHistory() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState("7d");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const [type, setType] = useState("");
  const [leadsOnly, setLeadsOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // debounce search
  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  const range = useMemo(() => rangeFor(preset, cFrom ? new Date(cFrom) : null, cTo ? new Date(cTo) : null), [preset, cFrom, cTo]);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const params = {
        from: range.from.toISOString(), to: range.to.toISOString(), page, limit: 50,
        tzOffset: -new Date().getTimezoneOffset(),
      };
      if (type) params.type = type;
      if (leadsOnly) params.leadsOnly = "1";
      if (q) params.search = q;
      const { data: d } = await api.get("/call-logs/my-history", { params });
      setData(d);
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not load your calls.");
    } finally {
      setLoading(false);
    }
  }, [range, page, type, leadsOnly, q]);
  useEffect(() => { load(); }, [load]);

  const sm = data?.summary || {};
  const maxDay = Math.max(1, ...((data?.byDay || []).map((d) => d.talkSecs)));
  const pickType = (t) => { setType((cur) => (cur === t ? "" : t)); setPage(1); };
  const clearFilters = () => { setType(""); setLeadsOnly(false); setSearch(""); setQ(""); setPage(1); };
  const hasFilters = type || leadsOnly || q;

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F1117] dark:text-[#F0F2FA] flex items-center gap-2"><Phone className="w-6 h-6 text-[#2563EB]" /> My Calls</h1>
          <p className="text-[13px] text-[#8B92A9]">Every call from your phone, synced automatically by the SkyUp mobile app — with talk time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p.k} onClick={() => { setPreset(p.k); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${preset === p.k ? "border-[#2563EB] text-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540]" : "border-[#E5E7EB] dark:border-[#262A38] text-[#6B7280]"}`}>{p.l}</button>
          ))}
          {preset === "custom" && (
            <>
              <input type="date" value={cFrom} max={ymd(new Date())} onChange={(e) => { setCFrom(e.target.value); setPage(1); }} className={INP} />
              <input type="date" value={cTo} max={ymd(new Date())} onChange={(e) => { setCTo(e.target.value); setPage(1); }} className={INP} />
            </>
          )}
          <button onClick={load} title="Refresh" className="p-2 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] text-[#6B7280]">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {err && <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-[13px] text-red-600">{err}</div>}

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-5">
        <Tile icon={<Phone className="w-[18px] h-[18px]" />} label="Total calls" value={sm.total ?? "—"} active={!type} onClick={() => { setType(""); setPage(1); }} />
        <Tile icon={<Clock className="w-[18px] h-[18px]" />} label="Talk time" value={fmtTalk(sm.talkSecs)} tone="purple" />
        <Tile icon={<Timer className="w-[18px] h-[18px]" />} label="Avg call" value={fmtTalk(sm.avgSecs)} sub={sm.longest ? `Longest ${fmtTalk(sm.longest)}` : ""} tone="slate" />
        <Tile icon={<PhoneOutgoing className="w-[18px] h-[18px]" />} label="Outgoing" value={sm.outgoing ?? "—"} sub={sm.outSecs ? fmtTalk(sm.outSecs) : ""} active={type === "outgoing"} onClick={() => pickType("outgoing")} />
        <Tile icon={<PhoneIncoming className="w-[18px] h-[18px]" />} label="Incoming" value={sm.incoming ?? "—"} sub={sm.inSecs ? fmtTalk(sm.inSecs) : ""} tone="green" active={type === "incoming"} onClick={() => pickType("incoming")} />
        <Tile icon={<PhoneMissed className="w-[18px] h-[18px]" />} label="Missed" value={sm.missed ?? "—"} tone="red" active={type === "missed"} onClick={() => pickType("missed")} />
        <Tile icon={<CheckCircle2 className="w-[18px] h-[18px]" />} label="Connected" value={sm.connected ?? "—"} sub={sm.total ? `${Math.round(((sm.connected || 0) / sm.total) * 100)}% of calls` : ""} tone="green" />
        <Tile icon={<Users className="w-[18px] h-[18px]" />} label="Numbers / leads" value={sm.uniqueNumbers ?? "—"} sub={`${sm.leads || 0} lead calls · ${sm.recorded || 0} recorded`} tone="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        {/* Day-wise */}
        <div className={`${CARD} p-4 h-fit`}>
          <p className="text-[14px] font-bold text-[#0F1117] dark:text-white mb-3">Day-wise talk time</p>
          {(data?.byDay || []).length === 0 ? (
            <p className="text-[13px] text-[#8B92A9]">{loading ? "Loading…" : "No calls in this period."}</p>
          ) : (
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {data.byDay.map((d) => (
                <div key={d.date}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="font-semibold text-[#4B5168] dark:text-[#9DA3BB]">
                      {new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}
                    </span>
                    <span className="text-[#8B92A9] tabular-nums">{d.calls} calls · <b className="text-[#0F1117] dark:text-white">{fmtTalk(d.talkSecs)}</b>{d.missed ? ` · ${d.missed} missed` : ""}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F1F4FF] dark:bg-[#262A38] overflow-hidden">
                    <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.max(3, Math.round((d.talkSecs / maxDay) * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Call list */}
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#8B92A9] absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or number" className={`${INP} w-full pl-9`} />
            </div>
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className={INP}>
              <option value="">All call types</option>
              <option value="outgoing">Outgoing</option>
              <option value="incoming">Incoming</option>
              <option value="missed">Missed</option>
              <option value="rejected">Rejected</option>
            </select>
            <label className={`${INP} flex items-center gap-2 cursor-pointer select-none`}>
              <input type="checkbox" checked={leadsOnly} onChange={(e) => { setLeadsOnly(e.target.checked); setPage(1); }} className="accent-[#2563EB]" />
              CRM leads only
            </label>
            {hasFilters && <button onClick={clearFilters} className="px-3 py-2 rounded-xl text-[13px] font-semibold text-[#2563EB]">Clear</button>}
          </div>

          <div className={`${CARD} overflow-x-auto`}>
            <table className="w-full">
              <thead className="border-b border-[#F1F2F6] dark:border-[#262A38]">
                <tr>
                  <th className={TH}>When</th><th className={TH}>Contact</th><th className={TH}>Type</th>
                  <th className={TH}>Talk time</th><th className={TH}>Lead</th><th className={TH}>Recording</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F6] dark:divide-[#262A38]">
                {(data?.logs || []).map((c) => {
                  const t = TYPE[c.callType] || TYPE.outgoing;
                  const rec = Array.isArray(c.recordings) ? c.recordings.find((r) => r?.url) : null;
                  return (
                    <tr key={c._id} className="hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02]">
                      <td className={TD}>
                        <p className="font-semibold">{new Date(c.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                        <p className="text-[11px] text-[#8B92A9]">{new Date(c.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                      </td>
                      <td className={TD}>
                        <p className="font-semibold">{c.matchedLead?.name || c.name || c.phoneNumber}</p>
                        {(c.matchedLead?.name || c.name) && <p className="text-[11px] text-[#8B92A9]">{c.phoneNumber}</p>}
                      </td>
                      <td className={TD}>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${t.cls}`}><t.Icon className="w-3 h-3" />{t.label}</span>
                      </td>
                      <td className={`${TD} tabular-nums font-semibold`}>{c.duration ? fmtTalk(c.duration) : <span className="text-[#8B92A9] font-normal">—</span>}</td>
                      <td className={TD}>
                        {c.matchedLead ? (
                          <button onClick={() => navigate("/leads")} title="Open My Leads" className="text-[12px] font-semibold text-[#2563EB] hover:underline">
                            {c.matchedLead.status || "Lead"}
                          </button>
                        ) : <span className="text-[12px] text-[#8B92A9]">Not a lead</span>}
                      </td>
                      <td className={TD}>
                        {rec ? <RecordingAudio src={rec.url} className="h-8 w-[220px]" /> : (
                          <span className="inline-flex items-center gap-1 text-[12px] text-[#8B92A9]"><Mic className="w-3 h-3" /> —</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && !(data?.logs || []).length && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-[13px] text-[#8B92A9]">
                    {hasFilters ? "No calls match these filters." : "No calls in this period. Calls appear here automatically once the mobile app syncs them."}
                  </td></tr>
                )}
                {loading && !(data?.logs || []).length && <tr><td colSpan={6} className="px-3 py-10 text-center text-[13px] text-[#8B92A9]">Loading…</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3 text-[12px] text-[#8B92A9]">
            <span>{data?.total ?? 0} call{data?.total === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <span>{page} / {Math.max(1, data?.pages || 1)}</span>
              <button disabled={page >= (data?.pages || 1)} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
