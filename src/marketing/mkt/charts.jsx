// src/marketing/mkt/charts.jsx — NEW FILE
// A small chart kit for the Marketing panel: sparkline, multi-line chart (hover tooltip), ranked bars and a donut. Plain SVG + Tailwind, so it follows dark mode and needs no
// extra library.
import { useEffect, useId, useRef, useState } from "react";
import { useWidth, niceTicks, monotonePath, runs } from "./chartUtils";

// ── Sparkline ────────────────────────────────────────────────────────────────
export function Sparkline({ values, color = "#6366F1", height = 30, width = 96 }) {
  const id = `sp${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const vals = (values || []).map((v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v)));
  const nums = vals.filter((v) => v != null);
  if (nums.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const lo = Math.min(...nums), hi = Math.max(...nums), span = hi - lo || 1;
  const pts = vals.map((v, i) => (v == null ? null : { x: 2 + (i * (width - 4)) / (vals.length - 1), y: height - 3 - ((v - lo) / span) * (height - 6) }));
  const segs = runs(pts);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {segs.map((sg, i) => (
        <g key={i}>
          {sg.length > 1 && <path d={`${monotonePath(sg)}L${sg[sg.length - 1].x},${height}L${sg[0].x},${height}Z`} fill={`url(#${id})`} />}
          <path d={monotonePath(sg)} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

// ── Line chart: any number of lines ──────────────────────────────────────────
// points: [{ t: "2026-10-01", <key>: number|null }]      (null = no value that day → the line breaks)
// series: [{ key, label, color, fmt, tick }]              fmt = tooltip text, tick = short axis text
// scale:  "shared" – one axis for every line (same units, e.g. campaigns)
//         "dual"   – first series on the left axis, second on the right (two metrics, different units)
//         "own"    – each line scaled to ITS OWN peak so many different metrics can be compared by shape
//                    (no axis numbers; hover for the real values)
// highlight: series key to emphasise (others fade)
export function LineChart({ points, series, scale = "shared", height = 280, highlight = null, xLabel }) {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const [hover, setHover] = useState(null);
  const [shown, setShown] = useState(false);
  const uid = `lc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);

  const n = points.length;
  const axes = scale === "own" ? "none" : scale === "dual" && series.length > 1 ? "dual" : "left";
  const M = { l: axes === "none" ? 14 : 54, r: axes === "dual" ? 54 : 14, t: 14, b: 30 };
  const W = Math.max(width, 280), iw = W - M.l - M.r, ih = height - M.t - M.b, PAD = 10;
  if (!n || !series.length) return <div ref={wrap} className="flex h-[200px] items-center justify-center text-[13px] text-slate-500">{n ? "Pick at least one line to show." : "No data for this period."}</div>;

  const val = (p, s) => (p[s.key] == null || Number.isNaN(Number(p[s.key])) ? null : Number(p[s.key]));
  const maxOf = (list) => Math.max(0, ...list.flatMap((s) => points.map((p) => val(p, s) || 0)));
  const shared = niceTicks(maxOf(series));
  const left = axes === "dual" ? niceTicks(maxOf([series[0]])) : shared;
  const right = axes === "dual" ? niceTicks(maxOf([series[1]])) : null;
  const own = {}; if (scale === "own") series.forEach((s) => { own[s.key] = maxOf([s]) || 1; });
  const yOf = (s, v) => {
    if (scale === "own") return M.t + ih - (v / own[s.key]) * ih;
    if (axes === "dual") return M.t + ih - (v / (s === series[0] ? left.max : right.max)) * ih;
    return M.t + ih - (v / shared.max) * ih;
  };
  const x = (i) => M.l + PAD + (n === 1 ? (iw - 2 * PAD) / 2 : (i * (iw - 2 * PAD)) / (n - 1));
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));
  const dayLabel = (t) => { const s = String(t).slice(0, 10).split("-"); return s.length < 3 ? String(t) : `${Number(s[2])} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(s[1]) - 1]}`; };
  const gridTicks = scale === "own" ? [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: f, y: M.t + ih - f * ih })) : left.ticks.map((v) => ({ v, y: M.t + ih - (v / left.max) * ih }));
  const single = series.length === 1;
  const strokeW = series.length >= 5 ? 1.9 : 2.4;
  const showDots = series.length <= 3 && n <= 45;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const step = n === 1 ? 1 : (iw - 2 * PAD) / (n - 1);
    setHover(Math.min(n - 1, Math.max(0, Math.round((e.clientX - r.left - M.l - PAD) / step))));
  };
  const hp = hover == null ? null : points[hover];
  const rowsAt = hp ? series.map((s) => ({ s, v: val(hp, s) })).sort((a, b) => (scale === "shared" ? (b.v == null ? -1 : b.v) - (a.v == null ? -1 : a.v) : 0)) : [];
  const MAXROWS = 12;
  const tipLeft = hover == null ? 0 : Math.min(Math.max(x(hover) - 96, 4), W - 204);

  return (
    <div ref={wrap} data-scale={scale} className="relative w-full">
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${series.map((s) => s.label).slice(0, 4).join(", ")}${series.length > 4 ? " and more" : ""} by day`} className="block select-none">
        <defs>
          {series.map((s) => <linearGradient key={s.key} id={`${uid}${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity="0.22" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>)}
        </defs>
        {gridTicks.map((g, i) => (
          <g key={i}>
            <line x1={M.l} x2={W - M.r} y1={g.y} y2={g.y} className="stroke-slate-100 dark:stroke-[#1A2030]" strokeDasharray={g.v === 0 ? undefined : "3 4"} />
            {axes !== "none" && <text x={M.l - 8} y={g.y + 4} textAnchor="end" className="fill-slate-500 text-[11px] dark:fill-slate-400" style={axes === "dual" ? { fill: series[0].color } : undefined}>{series[0].tick ? series[0].tick(g.v) : g.v}</text>}
          </g>
        ))}
        {axes === "dual" && right.ticks.map((tv) => <text key={tv} x={W - M.r + 8} y={M.t + ih - (tv / right.max) * ih + 4} className="text-[11px]" style={{ fill: series[1].color }}>{series[1].tick ? series[1].tick(tv) : tv}</text>)}
        {points.map((p, i) => (i % every === 0 ? <text key={i} x={x(i)} y={height - 9} textAnchor="middle" className="fill-slate-500 text-[11px] dark:fill-slate-400">{xLabel ? xLabel(p.t) : dayLabel(p.t)}</text> : null))}

        {series.map((s) => {
          const segs = []; let cur = [];
          points.forEach((p, i) => { const v = val(p, s); if (v == null) { if (cur.length) { segs.push(cur); cur = []; } } else cur.push({ x: x(i), y: yOf(s, v) }); });
          if (cur.length) segs.push(cur);
          const faded = highlight && highlight !== s.key;
          return (
            <g key={s.key} opacity={faded ? 0.15 : 1} style={{ transition: "opacity 150ms" }}>
              {segs.map((sg, i) => (
                <g key={i}>
                  {single && sg.length > 1 && <path d={`${monotonePath(sg)}L${sg[sg.length - 1].x},${M.t + ih}L${sg[0].x},${M.t + ih}Z`} fill={`url(#${uid}${s.key})`} />}
                  <path data-line={s.key} d={monotonePath(sg)} fill="none" stroke={s.color} strokeWidth={highlight === s.key ? strokeW + 1 : strokeW} strokeLinecap="round" strokeLinejoin="round"
                    pathLength="1" style={{ strokeDasharray: 1, strokeDashoffset: shown ? 0 : 1, transition: "stroke-dashoffset 800ms cubic-bezier(.2,.8,.2,1)" }} />
                  {sg.length === 1 && <circle cx={sg[0].x} cy={sg[0].y} r="3.5" fill={s.color} />}
                  {showDots && sg.length > 1 && sg.map((pt, j) => <circle key={j} cx={pt.x} cy={pt.y} r="2.4" fill="white" stroke={s.color} strokeWidth="1.6" className="dark:fill-[#121620]" />)}
                </g>
              ))}
            </g>
          );
        })}

        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="3 3" />
            {series.map((s) => (val(hp, s) == null ? null : <circle key={s.key} data-dot={s.key} cx={x(hover)} cy={yOf(s, val(hp, s))} r="4.5" fill="white" stroke={s.color} strokeWidth="2.4" className="dark:fill-[#121620]" />))}
          </g>
        )}
        <rect data-hit x={M.l} y={M.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hp && (
        <div role="tooltip" className="pointer-events-none absolute top-1 z-10 w-[200px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[12px] shadow-lg backdrop-blur dark:border-[#262E40] dark:bg-[#171C28]/95" style={{ left: tipLeft }}>
          <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{xLabel ? xLabel(hp.t) : dayLabel(hp.t)}</p>
          {rowsAt.slice(0, MAXROWS).map(({ s, v }) => (
            <p key={s.key} className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
              <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} /><span className="truncate">{s.label}</span></span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">{v == null ? "—" : s.fmt(v)}</span>
            </p>
          ))}
          {rowsAt.length > MAXROWS && <p className="mt-0.5 text-[11px] text-slate-400">+{rowsAt.length - MAXROWS} more</p>}
        </div>
      )}
    </div>
  );
}

// ── Ranked horizontal bars ───────────────────────────────────────────────────
// rows: [{ key, name, value, sub }]   tone(value, max) → bar colour (CSS gradient pair)
export function BarRank({ rows, format, tone, limit = 8 }) {
  const list = rows.slice(0, limit);
  const max = Math.max(0, ...list.map((r) => r.value || 0));
  if (!list.length) return <p className="py-10 text-center text-[13px] text-slate-500">No campaigns with delivery in this period.</p>;
  return (
    <ol className="space-y-3">
      {list.map((r, i) => {
        const w = max > 0 && r.value != null ? Math.max(3, (r.value / max) * 100) : 0;
        const [c1, c2] = tone ? tone(r.value, max) : ["#6366F1", "#8B5CF6"];
        return (
          <li key={r.key} data-rank={i + 1}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-[13px] font-medium text-slate-800 dark:text-slate-200" title={r.name}><span className="mr-1.5 text-slate-400">{i + 1}</span>{r.name}</p>
              <p className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">{r.value == null ? "—" : format(r.value)}</p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5" title={r.sub || ""}>
              <div className="h-full rounded-full" style={{ width: `${w}%`, background: `linear-gradient(90deg, ${c1}, ${c2})`, transition: "width 600ms cubic-bezier(.2,.8,.2,1)" }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Donut ────────────────────────────────────────────────────────────────────
// slices: [{ key, label, value, color }]
export function Donut({ slices, format, centerLabel = "Total", size = 184 }) {
  const [active, setActive] = useState(null);
  const total = slices.reduce((t, s) => t + (s.value || 0), 0);
  if (!(total > 0)) return <p className="py-10 text-center text-[13px] text-slate-500">No spend in this period.</p>;
  const r = size / 2 - 16, circ = 2 * Math.PI * r;
  const arcs = slices.reduce((list, s) => {
    const len = ((s.value || 0) / total) * circ;
    list.push({ len, off: list.length ? list[list.length - 1].off + list[list.length - 1].len : 0 });
    return list;
  }, []);
  const cur = active == null ? null : slices[active];
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Share of spend by campaign" className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="18" className="stroke-slate-100 dark:stroke-white/5" />
          {slices.map((s, i) => {
            const { len, off } = arcs[i];
            return <circle key={s.key} data-slice={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={active === i ? 22 : 18}
              strokeDasharray={`${Math.max(0, len - 2)} ${circ - Math.max(0, len - 2)}`} strokeDashoffset={-off} strokeLinecap="butt" opacity={active == null || active === i ? 1 : 0.35}
              style={{ transition: "stroke-width 150ms, opacity 150ms" }} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} />;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="max-w-[110px] truncate text-[11px] text-slate-500">{cur ? cur.label : centerLabel}</p>
          <p className="text-[18px] font-bold leading-tight tabular-nums text-slate-900 dark:text-slate-50">{format(cur ? cur.value : total)}</p>
          {cur && <p className="text-[11px] text-slate-500">{((cur.value / total) * 100).toFixed(1)}%</p>}
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.key} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} /><span className="truncate text-slate-700 dark:text-slate-300" title={s.label}>{s.label}</span></span>
            <span className="shrink-0 tabular-nums text-slate-500">{((s.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
