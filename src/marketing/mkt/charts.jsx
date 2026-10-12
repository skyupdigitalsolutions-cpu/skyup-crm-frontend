// src/marketing/mkt/charts.jsx — NEW FILE
// A small chart kit for the Marketing panel: sparkline, dual-axis combo chart (bars + line with
// hover tooltip), ranked bars and a donut. Plain SVG + Tailwind, so it follows dark mode and needs no
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

// ── Combo chart: first series as bars (left axis), second as a line (right axis) ──
// points: [{ t: "2026-10-01", <key>: number|null }]
// series: [{ key, label, color, fmt, tick }]   fmt = tooltip text, tick = short axis text
export function ComboChart({ points, series, height = 270, xLabel }) {
  const wrap = useRef(null);
  const width = useWidth(wrap);
  const [hover, setHover] = useState(null);
  const [shown, setShown] = useState(false);
  const uid = `cc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);

  const bars = series[0], line = series[1];
  const M = { l: 54, r: line ? 54 : 14, t: 14, b: 30 };
  const W = Math.max(width, 280), iw = W - M.l - M.r, ih = height - M.t - M.b;
  const n = points.length;
  if (!n) return <div ref={wrap} className="flex h-[200px] items-center justify-center text-[13px] text-slate-500">No data for this period.</div>;

  const val = (p, s) => (p[s.key] == null || Number.isNaN(Number(p[s.key])) ? null : Number(p[s.key]));
  const maxOf = (s) => Math.max(0, ...points.map((p) => val(p, s) || 0));
  const L = niceTicks(maxOf(bars)), R = line ? niceTicks(maxOf(line)) : null;
  const bw = iw / n, cx = (i) => M.l + bw * (i + 0.5);
  const yL = (v) => M.t + ih - (v / L.max) * ih, yR = (v) => M.t + ih - (v / R.max) * ih;
  const barW = Math.max(3, Math.min(34, bw * 0.62));
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));
  const lineSegs = line ? runs(points.map((p, i) => (val(p, line) == null ? null : { x: cx(i), y: yR(val(p, line)) }))) : [];
  const dayLabel = (t) => { const s = String(t).slice(0, 10).split("-"); return s.length < 3 ? String(t) : `${Number(s[2])} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(s[1]) - 1]}`; };

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.min(n - 1, Math.max(0, Math.floor((e.clientX - r.left - M.l) / bw)));
    setHover(i);
  };
  const hp = hover == null ? null : points[hover];
  const tipLeft = hover == null ? 0 : Math.min(Math.max(cx(hover) - 80, 4), W - 172);

  return (
    <div ref={wrap} className="relative w-full">
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${bars.label}${line ? ` and ${line.label}` : ""} by day`} className="block select-none">
        <defs>
          <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={bars.color} stopOpacity="0.95" /><stop offset="1" stopColor={bars.color} stopOpacity="0.45" /></linearGradient>
          {line && <linearGradient id={`${uid}l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={line.color} stopOpacity="0.22" /><stop offset="1" stopColor={line.color} stopOpacity="0" /></linearGradient>}
        </defs>
        {/* grid + left axis */}
        {L.ticks.map((tv) => (
          <g key={tv}>
            <line x1={M.l} x2={W - M.r} y1={yL(tv)} y2={yL(tv)} className="stroke-slate-100 dark:stroke-[#1A2030]" strokeDasharray={tv === 0 ? undefined : "3 4"} />
            <text x={M.l - 8} y={yL(tv) + 4} textAnchor="end" className="fill-slate-500 text-[11px] dark:fill-slate-400">{bars.tick ? bars.tick(tv) : tv}</text>
          </g>
        ))}
        {R && R.ticks.map((tv) => <text key={tv} x={W - M.r + 8} y={yR(tv) + 4} className="text-[11px]" style={{ fill: line.color }}>{line.tick ? line.tick(tv) : tv}</text>)}
        {/* x labels */}
        {points.map((p, i) => (i % every === 0 ? <text key={i} x={cx(i)} y={height - 9} textAnchor="middle" className="fill-slate-500 text-[11px] dark:fill-slate-400">{xLabel ? xLabel(p.t) : dayLabel(p.t)}</text> : null))}
        {/* bars */}
        <g style={{ transformBox: "fill-box", transformOrigin: "50% 100%", transform: shown ? "scaleY(1)" : "scaleY(0.02)", transition: "transform 650ms cubic-bezier(.2,.8,.2,1)" }}>
          {points.map((p, i) => {
            const v = val(p, bars) || 0, h = Math.max(v > 0 ? 2 : 0, (v / L.max) * ih);
            return <rect key={i} data-bar={i} x={cx(i) - barW / 2} y={M.t + ih - h} width={barW} height={h} rx={Math.min(5, barW / 2)} fill={`url(#${uid}b)`} opacity={hover == null || hover === i ? 1 : 0.55} />;
          })}
        </g>
        {/* line */}
        {lineSegs.map((sg, i) => (
          <g key={i}>
            {sg.length > 1 && <path d={`${monotonePath(sg)}L${sg[sg.length - 1].x},${M.t + ih}L${sg[0].x},${M.t + ih}Z`} fill={`url(#${uid}l)`} />}
            <path d={monotonePath(sg)} fill="none" stroke={line.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            {sg.length === 1 && <circle cx={sg[0].x} cy={sg[0].y} r="3.5" fill={line.color} />}
          </g>
        ))}
        {/* hover guide + dots */}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={cx(hover)} x2={cx(hover)} y1={M.t} y2={M.t + ih} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="3 3" />
            {line && val(hp, line) != null && <circle cx={cx(hover)} cy={yR(val(hp, line))} r="5" fill="white" stroke={line.color} strokeWidth="2.5" />}
          </g>
        )}
        <rect data-hit x={M.l} y={M.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hp && (
        <div role="tooltip" className="pointer-events-none absolute top-1 z-10 w-[168px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[12px] shadow-lg backdrop-blur dark:border-[#262E40] dark:bg-[#171C28]/95" style={{ left: tipLeft }}>
          <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{xLabel ? xLabel(hp.t) : dayLabel(hp.t)}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{val(hp, s) == null ? "—" : s.fmt(val(hp, s))}</span>
            </p>
          ))}
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
