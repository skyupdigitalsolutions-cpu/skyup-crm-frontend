// src/marketing/mkt/chartUtils.js — NEW FILE
// Layout / geometry helpers shared by the chart components (charts.jsx).
import { useEffect, useState } from "react";

// Width of the element, kept up to date as the layout changes.
export function useWidth(ref, fallback = 640) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => { const r = el.getBoundingClientRect(); if (r.width > 0) setW(Math.round(r.width)); };
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

// Round axis maximum + evenly spaced ticks (1, 2, 2.5, 5, 10 × 10ⁿ).
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return { max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const rough = max / count, pow = Math.pow(10, Math.floor(Math.log10(rough))), f = rough / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const top = Math.ceil(max / step - 1e-9) * step, ticks = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Number(v.toFixed(10)));
  return { max: top, ticks };
}

// Smooth curve through points without overshooting (monotone cubic).
export function monotonePath(p) {
  const n = p.length;
  if (!n) return "";
  if (n === 1) return `M${p[0].x},${p[0].y}`;
  const dx = [], s = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x; s[i] = (p[i + 1].y - p[i].y) / (dx[i] || 1); }
  m[0] = s[0]; m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / s[i], b = m[i + 1] / s[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * s[i]; m[i + 1] = t * b * s[i]; }
  }
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < n - 1; i++) d += `C${p[i].x + dx[i] / 3},${p[i].y + (m[i] * dx[i]) / 3} ${p[i + 1].x - dx[i] / 3},${p[i + 1].y - (m[i + 1] * dx[i]) / 3} ${p[i + 1].x},${p[i + 1].y}`;
  return d;
}

// Consecutive points that have a value (a gap — e.g. a day with no leads — breaks the line).
export function runs(points) {
  const out = []; let cur = [];
  points.forEach((p) => { if (p) cur.push(p); else if (cur.length) { out.push(cur); cur = []; } });
  if (cur.length) out.push(cur);
  return out;
}

