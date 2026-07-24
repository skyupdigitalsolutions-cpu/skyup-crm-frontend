// src/marketing/MarketingDashboard.jsx  — full rebuild with PRD features
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import mktApi from "./mktApi";
import {
  BarChart3, Users, Target, CheckCircle2, XCircle, Activity, Clock,
  Calendar, AlertTriangle, AlertCircle, TrendingUp, TrendingDown, Minus, RefreshCw,
  Loader2, LogOut, Sun, Moon, ChevronUp, ChevronDown, ArrowUpDown,
  Search, Layers, Award, Zap, PieChart, Bell, X, Star, Filter,
  Eye, MousePointerClick, IndianRupee, Percent, Image, ExternalLink,
  Info, ChevronLeft, FileText, TrendingUp as TUp, Play, Download,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────
const num  = (v) => (v == null ? "—" : Number(v).toLocaleString("en-IN"));
const pct  = (v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
const inr  = (v) => (v == null || v === 0 ? "—" : `₹${Number(v).toLocaleString("en-IN",{maximumFractionDigits:0})}`);
const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0,10); };
const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#0EA5E9","#8B5CF6","#EC4899","#14B8A6","#F97316","#64748B"];
const DATE_PRESETS = [
  { label:"Today",        from:isoDaysAgo(0),  to:isoDaysAgo(0)  },
  { label:"Yesterday",    from:isoDaysAgo(1),  to:isoDaysAgo(1)  },
  { label:"Last 7 days",  from:isoDaysAgo(7),  to:isoDaysAgo(0)  },
  { label:"Last 30 days", from:isoDaysAgo(30), to:isoDaysAgo(0)  },
  { label:"Last 90 days", from:isoDaysAgo(90), to:isoDaysAgo(0)  },
];

// ── Shared UI atoms ───────────────────────────────────────────────────────────
function Spark({ data, color }) {
  if (!data || data.length < 2) return null;
  const w=60,h=22,max=Math.max(1,...data);
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-(v/max)*h}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-14 h-5 shrink-0"><polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" points={pts}/></svg>;
}

function KpiCard({ icon:Icon, label, value, tint, trend, spark, sub }) {
  const up=trend!=null&&trend>0, dn=trend!=null&&trend<0;
  return (
    <div className="relative overflow-hidden bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-[0.06]" style={{background:tint}}/>
      <div className="flex items-center justify-between mb-2">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:`${tint}22`}}>
          <Icon className="w-4 h-4" style={{color:tint}}/>
        </span>
        {trend!=null&&<span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up?"bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30":dn?"bg-rose-50 text-rose-600 dark:bg-rose-950/30":"bg-slate-100 text-slate-400 dark:bg-white/5"}`}>
          {up?<TrendingUp className="w-2.5 h-2.5"/>:dn?<TrendingDown className="w-2.5 h-2.5"/>:<Minus className="w-2.5 h-2.5"/>}{Math.abs(trend)}%
        </span>}
      </div>
      <p className="text-[22px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-none mb-1">{value}</p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">{label}</p>
          {sub&&<p className="text-[10px] text-[#8B92A9]">{sub}</p>}
        </div>
        <Spark data={spark} color={tint}/>
      </div>
    </div>
  );
}

function Panel({ title, icon:Icon, children, className="", action }) {
  return (
    <div className={`bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-[#8B92A9]"/><p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{title}</p></div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Loader() { return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#8B92A9]"/></div>; }
function Err({ msg }) { return <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 text-rose-600 text-[12px]"><AlertTriangle className="w-4 h-4 shrink-0"/>{msg}</div>; }

// ── Date filter bar ───────────────────────────────────────────────────────────
function DateFilterBar({ from, to, setFrom, setTo, preset, setPreset }) {
  return (
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] shrink-0">Period</span>
        <div className="flex gap-1 flex-wrap">
          {DATE_PRESETS.map(p=>(
            <button key={p.label} onClick={()=>{setPreset(p.label);setFrom(p.from);setTo(p.to);}}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${preset===p.label?"bg-indigo-600 text-white":"bg-[#F1F3F9] dark:bg-white/5 text-[#4B5168] dark:text-[#9DA3BB] hover:bg-indigo-50"}`}>{p.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPreset("Custom");}} className="text-[11px] px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]"/>
          <span className="text-[#8B92A9] text-[11px]">→</span>
          <input type="date" value={to} onChange={e=>{setTo(e.target.value);setPreset("Custom");}} className="text-[11px] px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]"/>
        </div>
      </div>
    </div>
  );
}

// ── Area chart ────────────────────────────────────────────────────────────────
function AreaChart({ series, points, height=180 }) {
  const [hov,setHov]=useState(null);
  const ref=useRef(null);
  const n=points.length;
  if(!n) return <p className="text-center text-[12px] text-[#8B92A9] py-8">No daily data</p>;
  const w=640,h=height,pL=36,pR=8,pT=10,pB=22;
  const mx=Math.max(1,...series.flatMap(s=>s.data));
  const x=i=>pL+(i/Math.max(1,n-1))*(w-pL-pR);
  const y=v=>h-pB-((v||0)/mx)*(h-pT-pB);
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${w} ${h}`} className="w-full" style={{height}}
        onMouseMove={e=>{const br=ref.current.getBoundingClientRect();setHov(Math.round(Math.min(1,Math.max(0,(e.clientX-br.left)/br.width))*(n-1)));}}
        onMouseLeave={()=>setHov(null)}>
        <defs>{series.map(s=><linearGradient key={s.key} id={`ag${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity="0.18"/><stop offset="100%" stopColor={s.color} stopOpacity="0"/></linearGradient>)}</defs>
        {[0,1,2,3,4].map(t=>{const gy=pT+(t/4)*(h-pT-pB);return<line key={t} x1={pL} y1={gy} x2={w-pR} y2={gy} stroke="currentColor" className="text-[#EEF0F6] dark:text-[#1A1D2A]" strokeWidth="1"/>;})  }
        {series.map(s=>{const line=s.data.map((v,i)=>`${x(i)},${y(v)}`).join(" ");return<g key={s.key}><polygon points={`${x(0)},${h-pB} ${line} ${x(n-1)},${h-pB}`} fill={`url(#ag${s.key})`}/><polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={line}/></g>;})}
        {points.map((p,i)=>(i%Math.ceil(n/7)===0||i===n-1)?<text key={i} x={x(i)} y={h-5} textAnchor="middle" className="fill-[#B4B9C9]" style={{fontSize:8}}>{p.slice(5)}</text>:null)}
        {hov!=null&&<g><line x1={x(hov)} y1={pT} x2={x(hov)} y2={h-pB} stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 2"/>{series.map(s=><circle key={s.key} cx={x(hov)} cy={y(s.data[hov]||0)} r="3" fill="#fff" stroke={s.color} strokeWidth="2"/>)}</g>}
      </svg>
      {hov!=null&&<div className="absolute top-1 px-2 py-1.5 rounded-lg bg-[#0F1117] text-white text-[10px] shadow-xl pointer-events-none z-10" style={{left:`${(x(hov)/w)*100}%`,transform:hov>n/2?"translateX(-110%)":"translateX(8%)"}}>
        <p className="font-bold mb-0.5">{points[hov]}</p>
        {series.map(s=><p key={s.key} className="flex items-center gap-1.5 whitespace-nowrap"><span className="w-2 h-2 rounded-full" style={{background:s.color}}/>{s.label}:<b className="ml-1">{num(s.data[hov]||0)}</b></p>)}
      </div>}
      <div className="flex flex-wrap gap-3 justify-center mt-1.5">
        {series.map(s=><span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-[#4B5168] dark:text-[#9DA3BB]"><span className="w-2.5 h-2.5 rounded-full" style={{background:s.color}}/>{s.label}</span>)}
      </div>
    </div>
  );
}

function Donut({ data }) {
  const rows=(data||[]).filter(d=>(d.count||0)>0);
  const total=rows.reduce((s,d)=>s+d.count,0)||1;
  let acc=0; const R=52,C=2*Math.PI*R;
  if(!rows.length) return <p className="text-center text-[12px] text-[#8B92A9] py-8">No data</p>;
  return(
    <div className="flex items-center gap-4">
      <div className="relative w-[110px] h-[110px] shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full">
          <g transform="translate(70,70) rotate(-90)">
            <circle r={R} fill="none" stroke="currentColor" className="text-[#F1F3F9] dark:text-white/5" strokeWidth="14"/>
            {rows.map((d)=>{const frac=d.count/total;const el=<circle key={d.stage} r={R} fill="none" stroke={d.color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.max(0,frac*C-2)} ${C}`} strokeDashoffset={-acc*C}/>;acc+=frac;return el;})}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] text-[#8B92A9]">Total</span>
          <span className="text-[14px] font-extrabold text-[#0F1117] dark:text-[#DDE1F5]">{num(total)}</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {rows.map(d=><div key={d.stage} className="flex items-center gap-2 text-[11px]">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{background:d.color}}/>
          <span className="flex-1 text-[#4B5168] dark:text-[#9DA3BB]">{d.stage}</span>
          <span className="font-bold text-[#0F1117] dark:text-[#DDE1F5]">{num(d.count)}</span>
          <span className="text-[#8B92A9] w-9 text-right">{Math.round((d.count/total)*100)}%</span>
        </div>)}
      </div>
    </div>
  );
}

function RankBars({ rows, valueKey, labelKey, format }) {
  const data=(rows||[]).slice(0,8);
  const max=Math.max(1,...data.map(d=>Number(d[valueKey])||0));
  if(!data.length) return <p className="text-center text-[12px] text-[#8B92A9] py-6">No data</p>;
  return(
    <div className="space-y-2.5">
      {data.map((d,i)=>(
        <div key={i} className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-lg text-[10px] font-bold text-white flex items-center justify-center shrink-0" style={{background:COLORS[i%COLORS.length]}}>{i+1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-medium text-[#4B5168] dark:text-[#9DA3BB] truncate">{d[labelKey]||"—"}</span>
              <span className="text-[11px] font-bold text-[#0F1117] dark:text-[#DDE1F5] ml-2">{format?format(d[valueKey]):num(d[valueKey])}</span>
            </div>
            <div className="h-2 rounded-full bg-[#F1F3F9] dark:bg-white/5 overflow-hidden">
              <div className="h-full rounded-full" style={{width:`${((Number(d[valueKey])||0)/max)*100}%`,background:`linear-gradient(90deg,${COLORS[i%COLORS.length]}CC,${COLORS[i%COLORS.length]})`}}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SortTable({ columns, rows, perPage=10 }) {
  const [sort,setSort]=useState({key:columns[0].key,dir:"desc"});
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1);
  const toggle=k=>setSort(s=>s.key===k?{key:k,dir:s.dir==="asc"?"desc":"asc"}:{key:k,dir:"desc"});
  const filtered=useMemo(()=>{const q=search.toLowerCase();return(rows||[]).filter(r=>!q||columns.some(c=>String(r[c.key]||"").toLowerCase().includes(q)));},[rows,search,columns]);
  const sorted=useMemo(()=>{const arr=[...filtered];arr.sort((a,b)=>{let av=a[sort.key],bv=b[sort.key];if(typeof av==="string")return sort.dir==="asc"?av.localeCompare(bv):bv.localeCompare(av);av=av??-Infinity;bv=bv??-Infinity;return sort.dir==="asc"?av-bv:bv-av;});return arr;},[filtered,sort]);
  const pages=Math.ceil(sorted.length/perPage);
  const paged=sorted.slice((page-1)*perPage,page*perPage);
  return(
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs"><Search className="w-3.5 h-3.5 text-[#8B92A9] absolute left-2.5 top-1/2 -translate-y-1/2"/>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search…" className="w-full text-[12px] pl-7 pr-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]"/>
        </div>
        <span className="text-[11px] text-[#8B92A9] ml-auto">{sorted.length} rows</span>
      </div>
      <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
            {columns.map(c=><th key={c.key} onClick={()=>toggle(c.key)} className={`text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 cursor-pointer whitespace-nowrap select-none hover:text-[#4B5168] ${c.align==="right"?"text-right":"text-left"}`}>
              <span className="inline-flex items-center gap-1">{c.label}{sort.key===c.key?(sort.dir==="asc"?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>):<ArrowUpDown className="w-3 h-3 opacity-30"/>}</span>
            </th>)}
          </tr></thead>
          <tbody>{paged.map((r,i)=><tr key={i} className="border-b border-[#F1F3F9] dark:border-white/5 last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02] transition-colors">
            {columns.map(c=><td key={c.key} className={`px-3 py-2.5 text-[12px] text-[#222733] dark:text-[#C9CEE0] whitespace-nowrap ${c.align==="right"?"text-right tabular-nums":""}`}>{c.render?c.render(r):r[c.key]}</td>)}
          </tr>)}
          {!paged.length&&<tr><td colSpan={columns.length} className="px-3 py-8 text-center text-[12px] text-[#8B92A9]">No rows</td></tr>}
          </tbody>
        </table>
      </div>
      {pages>1&&<div className="flex justify-center gap-1">{Array.from({length:Math.min(pages,7)},(_,i)=>i+1).map(p=><button key={p} onClick={()=>setPage(p)} className={`w-7 h-7 rounded-lg text-[11px] font-semibold ${page===p?"bg-indigo-600 text-white":"bg-[#F1F3F9] dark:bg-white/5 text-[#4B5168] hover:bg-indigo-50"}`}>{p}</button>)}</div>}
    </div>
  );
}

// ── Ad scoring ────────────────────────────────────────────────────────────────
function scoreAd(m){const ctr=Number(m.ctr)||0,freq=Number(m.frequency)||0,cpc=Number(m.cpc)||0;if(ctr>=2&&freq<=4)return{label:"Good",color:"#10B981",bg:"bg-emerald-50 dark:bg-emerald-950/20",icon:CheckCircle2};if(ctr>=1||(cpc>0&&freq<=6))return{label:"Fair",color:"#F59E0B",bg:"bg-amber-50 dark:bg-amber-950/20",icon:Info};return{label:"Needs Attention",color:"#EF4444",bg:"bg-rose-50 dark:bg-rose-950/20",icon:AlertCircle};}

// ── Status badge ──────────────────────────────────────────────────────────────
const SB_MAP={"New":"bg-blue-50 text-blue-700 dark:bg-blue-950/30","In Progress":"bg-amber-50 text-amber-700 dark:bg-amber-950/30","Converted":"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30","Not Interested":"bg-rose-50 text-rose-700 dark:bg-rose-950/30","Verification":"bg-purple-50 text-purple-700 dark:bg-purple-950/30"};
function StatusBadge({status}){return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SB_MAP[status]||"bg-slate-100 text-slate-500"}`}>{status||"—"}</span>;}

// ── Funnel ────────────────────────────────────────────────────────────────────
function Funnel({ stages }) {
  const data=(stages||[]).filter(s=>s.count>0);
  if(!data.length) return <p className="text-center text-[12px] text-[#8B92A9] py-8">No data</p>;
  const max=data[0].count;
  return <div className="space-y-2">{data.map((s,i)=>{const w=Math.max(20,(s.count/max)*100);const drop=i>0&&data[i-1].count>0?Math.round((1-s.count/data[i-1].count)*100):null;return(<div key={s.stage} className="flex items-center gap-3"><div className="flex-1 flex justify-center"><div className="h-9 rounded-xl flex items-center justify-center transition-all" style={{width:`${w}%`,background:s.color,minWidth:60}}><span className="text-white text-[11px] font-bold">{num(s.count)}</span></div></div><div className="w-36 shrink-0"><p className="text-[11px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{s.stage}</p>{drop!=null&&<p className="text-[10px] text-rose-500">▼ {drop}% drop-off</p>}</div></div>);})}</div>;
}

// ── ConvBar ───────────────────────────────────────────────────────────────────
function ConvBar({total,converted,inProgress,notInt}){
  if(!total)return null;
  const p=v=>Math.round((v/total)*100);
  const segs=[{v:converted,color:"#10B981",label:"Converted"},{v:inProgress,color:"#F59E0B",label:"In Progress"},{v:notInt,color:"#EF4444",label:"Not Int."}];
  return(<div><div className="flex h-2 rounded-full overflow-hidden gap-px bg-[#F1F3F9] dark:bg-white/5">{segs.map(s=>s.v>0&&<div key={s.label} style={{width:`${p(s.v)}%`,background:s.color}} className="rounded-full"/>)}</div><div className="flex items-center gap-2 mt-1 flex-wrap">{segs.map(s=><span key={s.label} className="inline-flex items-center gap-1 text-[9px] text-[#8B92A9]"><span className="w-1.5 h-1.5 rounded-full" style={{background:s.color}}/>{s.label}: <b className="text-[#4B5168] dark:text-[#9DA3BB]">{s.v}</b> ({p(s.v)}%)</span>)}</div></div>);
}

// ── Back button ───────────────────────────────────────────────────────────────
function BackBtn({ label, onClick }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#8B92A9] hover:text-indigo-600 transition-colors mb-4"><ChevronLeft className="w-4 h-4"/>{label}</button>;
}

// ── Breakdown bar chart ───────────────────────────────────────────────────────
function BarBreakdown({ data, keyField, valueField, label, format }) {
  if(!data||!data.length) return <p className="text-[12px] text-[#8B92A9] text-center py-4">No data</p>;
  const max=Math.max(1,...data.map(d=>Number(d[valueField])||0));
  return <div className="space-y-2">{data.slice(0,10).map((d,i)=><div key={i} className="flex items-center gap-2"><span className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] w-24 shrink-0 truncate">{d[keyField]||"—"}</span><div className="flex-1 h-5 rounded-full bg-[#F1F3F9] dark:bg-white/5 overflow-hidden"><div className="h-full rounded-full flex items-center justify-end pr-1.5" style={{width:`${Math.max(4,(Number(d[valueField])||0)/max*100)}%`,background:`linear-gradient(90deg,${COLORS[i%COLORS.length]}99,${COLORS[i%COLORS.length]})`}}><span className="text-[9px] font-bold text-white">{format?format(Number(d[valueField])||0):num(d[valueField])}</span></div></div></div>)}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── OVERVIEW TAB ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ from, to, refreshKey, onNav }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{const{data:d}=await mktApi.get("/dashboard",{params:{from,to}});setData(d);}
    catch(e){setError(e?.response?.data?.message||"Failed to load overview.");}
    finally{setLoading(false);}
  },[from,to]);

  useEffect(()=>{load();},[load,refreshKey]);

  const k=data?.kpis||{};
  const daily=data?.daily||[];
  const sparkTotal=daily.slice(-14).map(d=>d.total||0);
  const sparkConv=daily.slice(-14).map(d=>d.converted||0);

  // Alerts: follow-ups overdue + missing leads
  const alerts=[];
  if(data?.followups?.missed>0) alerts.push({level:"error",msg:`${data.followups.missed} follow-ups are overdue and not actioned.`});
  if(data?.followups?.today>5) alerts.push({level:"warn",msg:`${data.followups.today} follow-ups due today — review your schedule.`});
  if(k.conversionRate!=null&&k.conversionRate<5) alerts.push({level:"warn",msg:`Conversion rate is low (${pct(k.conversionRate)}) — review lead quality and follow-up cadence.`});

  const statusDonut=[
    {stage:"New",count:k.newLeads||0,color:"#3B82F6"},
    {stage:"In Progress",count:k.inProgress||0,color:"#F59E0B"},
    {stage:"Verification",count:k.verification||0,color:"#8B5CF6"},
    {stage:"Converted",count:k.converted||0,color:"#10B981"},
    {stage:"Not Interested",count:k.notInterested||0,color:"#EF4444"},
  ];

  if(loading&&!data) return <Loader/>;
  if(error) return <Err msg={error}/>;

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {alerts.length>0&&(
        <div className="space-y-2">
          {alerts.map((a,i)=>(
            <div key={i} className={`flex items-start gap-2.5 px-4 py-2.5 rounded-xl text-[12px] font-medium ${a.level==="error"?"bg-rose-50 dark:bg-rose-950/20 text-rose-700 border border-rose-200":"bg-amber-50 dark:bg-amber-950/10 text-amber-700 border border-amber-200"}`}>
              {a.level==="error"?<AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>:<AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>}{a.msg}
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <KpiCard icon={Users}        label="Total Leads"     value={num(k.totalLeads)}      tint="#6366F1" trend={k.trends?.totalLeads} spark={sparkTotal}/>
        <KpiCard icon={Star}         label="New"             value={num(k.newLeads)}         tint="#3B82F6"/>
        <KpiCard icon={Activity}     label="In Progress"     value={num(k.inProgress)}       tint="#F59E0B"/>
        <KpiCard icon={CheckCircle2} label="Converted"       value={num(k.converted)}        tint="#10B981" trend={k.trends?.converted} spark={sparkConv}/>
        <KpiCard icon={XCircle}      label="Not Interested"  value={num(k.notInterested)}    tint="#EF4444"/>
        <KpiCard icon={Target}       label="Conv. Rate"      value={pct(k.conversionRate)}   tint="#8B5CF6"/>
        <KpiCard icon={Star}         label="Qualified (Hot)" value={num(k.verification)}     tint="#A855F7" sub="Hot leads"/>
        <KpiCard icon={Bell}         label="Today Follow-ups" value={num(data?.followups?.today)}    tint="#F97316"/>
        <KpiCard icon={Clock}        label="Upcoming"        value={num(data?.followups?.upcoming)} tint="#0EA5E9"/>
        <KpiCard icon={AlertCircle}  label="Missed"          value={num(data?.followups?.missed)}   tint="#EF4444"/>
      </div>

      {/* Summary strip */}
      {data&&<div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white shadow-lg">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">{data.range?.from} → {data.range?.to}</p>
        <p className="text-[13px] leading-relaxed"><b>{num(k.totalLeads)}</b> leads — <b>{num(k.converted)}</b> converted (<b>{pct(k.conversionRate)}</b>), <b>{num(k.inProgress)}</b> in progress. <b>{num(data.followups?.today)}</b> follow-ups due today, <b>{num(data.followups?.missed)}</b> missed.</p>
      </div>}

      {/* Charts */}
      {data&&<div className="grid md:grid-cols-2 gap-3">
        <Panel title="Lead Funnel" icon={Layers}><Funnel stages={data.funnel}/></Panel>
        <Panel title="Lead Status" icon={PieChart}><Donut data={statusDonut}/></Panel>
      </div>}

      {data&&daily.length>0&&<Panel title="Daily Lead Trend" icon={TrendingUp}>
        <AreaChart points={daily.map(d=>d.date)} series={[
          {key:"total",label:"Total",color:"#6366F1",data:daily.map(d=>d.total)},
          {key:"inProgress",label:"In Progress",color:"#F59E0B",data:daily.map(d=>d.inProgress)},
          {key:"converted",label:"Converted",color:"#10B981",data:daily.map(d=>d.converted)},
          {key:"new",label:"New",color:"#3B82F6",data:daily.map(d=>d.newLeads)},
        ]}/>
      </Panel>}

      {/* Quick-nav */}
      {data&&<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:"Meta Ads",icon:BarChart3,tint:"#6366F1",tab:"meta",desc:"Campaigns & ad performance"},
          {label:"Google Ads",icon:Target,tint:"#10B981",tab:"google",desc:"Keywords & search terms"},
          {label:"Leads",icon:Users,tint:"#F59E0B",tab:"leads",desc:"Pipeline & attribution"},
          {label:"Reports",icon:FileText,tint:"#8B5CF6",tab:"reports",desc:"Export & schedule"},
        ].map(q=>(
          <button key={q.tab} onClick={()=>onNav(q.tab)}
            className="flex flex-col items-start gap-2 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all text-left">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:`${q.tint}22`}}>
              <q.icon className="w-4 h-4" style={{color:q.tint}}/>
            </span>
            <div>
              <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{q.label}</p>
              <p className="text-[10px] text-[#8B92A9]">{q.desc}</p>
            </div>
          </button>
        ))}
      </div>}

      {data&&<div className="grid md:grid-cols-2 gap-3">
        <Panel title="Top Campaigns" icon={BarChart3}><RankBars rows={data.campaigns} valueKey="total" labelKey="campaign"/></Panel>
        <Panel title="Lead Sources" icon={PieChart}><Donut data={(data.sources||[]).map((s,i)=>({stage:s.source,count:s.count,color:COLORS[i%COLORS.length]}))}/></Panel>
      </div>}

      {data&&<Panel title="Sales Executive Performance" icon={Award}>
        <SortTable rows={data.employees||[]} columns={[
          {key:"name",label:"Executive",render:r=><span className="font-semibold">{r.name}</span>},
          {key:"total",label:"Assigned",align:"right",render:r=>num(r.total)},
          {key:"inProgress",label:"In Progress",align:"right",render:r=>num(r.inProgress)},
          {key:"converted",label:"Converted",align:"right",render:r=><span className="text-emerald-600 font-semibold">{num(r.converted)}</span>},
          {key:"notInt",label:"Not Int.",align:"right",render:r=><span className="text-rose-500">{num(r.notInt)}</span>},
          {key:"convRate",label:"Conv %",align:"right",render:r=><span className="font-bold" style={{color:r.convRate>=20?"#059669":r.convRate>=10?"#D97706":"#EF4444"}}>{pct(r.convRate)}</span>},
        ]}/>
      </Panel>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── META CAMPAIGN DETAIL ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function MetaCampaignDetail({ configId, from, to, onBack }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    setLoading(true);setError("");
    mktApi.get("/meta-campaign/"+configId,{params:{from,to}})
      .then(r=>{setData(r.data);setLoading(false);})
      .catch(e=>{setError(e?.response?.data?.message||"Failed to load.");setLoading(false);});
  },[configId,from,to]);

  if(loading) return <><BackBtn label="Back to Meta Ads" onClick={onBack}/><Loader/></>;
  if(error) return <><BackBtn label="Back to Meta Ads" onClick={onBack}/><Err msg={error}/></>;
  if(!data) return null;

  const cfg=data.config||{};
  const daily=data.daily||[];
  const spend=daily.reduce((s,d)=>s+(d.spend||0),0);
  const avgDeal=Number(cfg.avgDealValue)||0;

  const kpis=[
    {icon:IndianRupee,label:"Total Spend",value:inr(spend),tint:"#EF4444"},
    {icon:Eye,label:"Impressions",value:num(daily.reduce((s,d)=>s+(d.impressions||0),0)),tint:"#6366F1"},
    {icon:Users,label:"Reach",value:num(daily.reduce((s,d)=>s+(d.reach||0),0)),tint:"#10B981"},
    {icon:MousePointerClick,label:"Clicks",value:num(daily.reduce((s,d)=>s+(d.clicks||0),0)),tint:"#0EA5E9"},
    {icon:Target,label:"Leads (CRM)",value:num(data.crmLeads),tint:"#F59E0B"},
    {icon:Star,label:"Qualified",value:num(data.crmQualified),tint:"#A855F7",sub:"Hot leads"},
    {icon:CheckCircle2,label:"Converted",value:num(data.crmConverted),tint:"#10B981"},
    {icon:IndianRupee,label:"Revenue",value:inr(data.revenue),tint:"#14B8A6",sub:avgDeal?`₹${num(avgDeal)}/deal`:"Set avg deal value"},
    {icon:TrendingUp,label:"ROAS",value:data.roas!=null?`${data.roas}x`:"—",tint:data.roas>=2?"#10B981":data.roas>0?"#F59E0B":"#EF4444",sub:"Return on ad spend"},
    {icon:IndianRupee,label:"Cost per Lead",value:data.crmLeads>0?inr(Math.round(spend/data.crmLeads)):"—",tint:"#8B5CF6"},
  ];

  const bd=data.breakdowns||{};

  return (
    <div className="space-y-4">
      <BackBtn label="Back to Meta Ads" onClick={onBack}/>

      {/* Header */}
      <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[16px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">{cfg.parentCampaignName||cfg.campaignName}</p>
            {cfg.adSetName&&<p className="text-[12px] text-[#8B92A9] mt-0.5">Ad Set: {cfg.adSetName}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {cfg.category&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30">{cfg.category}</span>}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.isActive?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{cfg.isActive?"Active":"Paused"}</span>
              {!avgDeal&&<span className="text-[10px] text-amber-600 font-semibold">⚠ Set avg deal value in campaign edit to enable ROAS</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#8B92A9]">Page ID: {cfg.pageId}</p>
            {cfg.metaAdsetStatus&&<p className="text-[10px] text-[#8B92A9]">Meta status: {cfg.metaAdsetStatus}</p>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {kpis.map(c=>(
          <div key={c.label} className="relative overflow-hidden bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-3.5" style={{background:`linear-gradient(135deg,${c.tint}12 0%,transparent 70%)`}}>
            <div className="flex items-center gap-2 mb-2"><span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background:`${c.tint}22`}}><c.icon className="w-3.5 h-3.5" style={{color:c.tint}}/></span><span className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9]">{c.label}</span></div>
            <p className="text-[17px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{c.value}</p>
            {c.sub&&<p className="text-[10px] text-[#8B92A9] mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Daily charts */}
      {daily.length>0&&<div className="grid md:grid-cols-2 gap-3">
        <Panel title="Daily Spend" icon={IndianRupee}>
          <AreaChart points={daily.map(d=>d.date)} series={[{key:"spend",label:"Spend (₹)",color:"#EF4444",data:daily.map(d=>d.spend||0)}]}/>
        </Panel>
        <Panel title="CTR Trend" icon={Percent}>
          <AreaChart points={daily.map(d=>d.date)} series={[{key:"ctr",label:"CTR %",color:"#6366F1",data:daily.map(d=>d.ctr||0)}]}/>
        </Panel>
      </div>}

      {/* Audience breakdowns */}
      {(bd.ageGender&&bd.ageGender.length>0)&&(
        <Panel title="Audience Breakdown" icon={Users}>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] font-bold text-[#4B5168] dark:text-[#9DA3BB] mb-2">By Age + Gender</p>
              <BarBreakdown data={bd.ageGender.map(r=>({...r,label:`${r.age}/${r.gender}`}))} keyField="label" valueField="spend" format={v=>`₹${Math.round(v)}`}/>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#4B5168] dark:text-[#9DA3BB] mb-2">By Placement</p>
              <BarBreakdown data={(bd.placement||[]).map(r=>({...r,label:`${r.platform}/${r.position}`}))} keyField="label" valueField="spend" format={v=>`₹${Math.round(v)}`}/>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#4B5168] dark:text-[#9DA3BB] mb-2">By Device</p>
              <BarBreakdown data={bd.device||[]} keyField="device" valueField="spend" format={v=>`₹${Math.round(v)}`}/>
            </div>
          </div>
        </Panel>
      )}

      {!data.configured&&<div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-200 rounded-2xl p-4 text-center text-[12px] text-amber-700">
        No Ad Account ID or ads_read token configured — add them in the CRM Campaigns page (Edit campaign → Ad Performance) to see spend and audience breakdown.
      </div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── META ADS TAB ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function MetaAdsTab({ from, to, refreshKey }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [detailId,setDetailId]=useState(null);
  const [catFilter,setCatFilter]=useState("");
  const [aiLoading,setAiLoad]=useState(false);

  const load=useCallback(async(withAI=false)=>{
    withAI?setAiLoad(true):setLoading(true);setError("");
    try{const{data:d}=await mktApi.get("/meta-insights",{params:{from,to,ai:withAI?"true":"false"},timeout:withAI?70000:30000});setData(d);}
    catch(e){setError(e?.response?.data?.message||"Failed to load Meta campaigns.");}
    finally{withAI?setAiLoad(false):setLoading(false);}
  },[from,to]);

  useEffect(()=>{load(false);},[load,refreshKey]);

  if(detailId) return <MetaCampaignDetail configId={detailId} from={from} to={to} onBack={()=>setDetailId(null)}/>;

  const allCamps=data?.campaigns||[];
  const categories=useMemo(()=>Array.from(new Set(allCamps.map(c=>c.category||"").filter(Boolean))).sort(),[allCamps]);
  const camps=useMemo(()=>catFilter?allCamps.filter(c=>(c.category||"")===catFilter):allCamps,[allCamps,catFilter]);
  const t=data?.totals||{};
  const ai=data?.aiAnalysis;

  if(loading&&!data) return <Loader/>;
  if(error) return <Err msg={error}/>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0"><BarChart3 className="w-4 h-4 text-white"/></div>
        <div><p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">Meta Campaign Performance</p><p className="text-[11px] text-[#8B92A9]">Click any campaign to drill down into daily trends, audience & creative</p></div>
        <div className="ml-auto flex items-center gap-2">
          {loading&&<Loader2 className="w-4 h-4 animate-spin text-[#8B92A9]"/>}
          <button onClick={()=>load(true)} disabled={loading||aiLoading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold">
            {aiLoading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Zap className="w-3.5 h-3.5"/>} AI Analysis
          </button>
        </div>
      </div>

      {/* Totals summary */}
      {data&&(t.spend>0||t.leads>0)&&(
        <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white shadow-md">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1.5">{camps.length} campaigns · {from} → {to}</p>
          <p className="text-[13px] leading-relaxed">
            Spent <b>₹{Number(t.spend||0).toLocaleString("en-IN",{maximumFractionDigits:0})}</b> → <b>{t.leads||0} leads</b> · <b>{t.qualified||0} qualified</b> · <b>{t.converted||0} converted</b>
            {t.revenue>0&&<> · Revenue <b>₹{Number(t.revenue).toLocaleString("en-IN",{maximumFractionDigits:0})}</b></>}
            {t.roas!=null&&<> · ROAS <b>{t.roas}x</b></>}
          </p>
        </div>
      )}

      {/* KPI strip */}
      {data&&(t.spend>0||t.leads>0)&&(
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {[
            {icon:IndianRupee,label:"Spend",value:inr(t.spend),tint:"#EF4444"},
            {icon:Eye,label:"Impressions",value:num(t.impressions),tint:"#6366F1"},
            {icon:MousePointerClick,label:"Clicks",value:num(t.clicks),tint:"#0EA5E9"},
            {icon:Target,label:"Leads",value:t.leads||0,tint:"#F59E0B"},
            {icon:Star,label:"Qualified",value:t.qualified||0,tint:"#A855F7",sub:"Hot leads"},
            {icon:CheckCircle2,label:"Converted",value:t.converted||0,tint:"#10B981"},
            {icon:IndianRupee,label:"Revenue",value:inr(t.revenue),tint:"#14B8A6"},
            {icon:TrendingUp,label:"ROAS",value:t.roas!=null?`${t.roas}x`:"—",tint:"#10B981"},
            {icon:IndianRupee,label:"CPL",value:t.costPerLead?inr(t.costPerLead):"—",tint:"#8B5CF6"},
            {icon:Percent,label:"Conv. Rate",value:t.conversionRatePct!=null?`${t.conversionRatePct}%`:"—",tint:"#EC4899"},
          ].map(c=>(
            <div key={c.label} className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-3" style={{background:`linear-gradient(135deg,${c.tint}12 0%,transparent 70%)`}}>
              <div className="flex items-center gap-1.5 mb-1"><c.icon className="w-3.5 h-3.5" style={{color:c.tint}}/><span className="text-[9px] font-bold uppercase text-[#8B92A9]">{c.label}</span></div>
              <p className="text-[16px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">{c.value}</p>
              {c.sub&&<p className="text-[9px] text-[#8B92A9]">{c.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* AI analysis */}
      {data&&ai&&(
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0"><Zap className="w-3.5 h-3.5 text-white"/></div>
            <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">AI Analysis</p>
          </div>
          <div className="p-4 space-y-3">
            {ai.summary&&<p className="text-[13px] text-[#334155] dark:text-[#CBD5E1] leading-relaxed">{ai.summary}</p>}
            <div className="grid md:grid-cols-2 gap-3">
              {ai.topPerformers?.length>0&&<div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 p-3"><p className="text-[10px] font-bold uppercase text-emerald-700 mb-1.5 flex items-center gap-1"><TrendingUp className="w-3 h-3"/>Top Performers</p><ul className="space-y-1">{ai.topPerformers.map((p,i)=><li key={i} className="text-[12px] text-[#334155] dark:text-[#CBD5E1]"><b>{p.campaign}:</b> {p.why}</li>)}</ul></div>}
              {ai.underperformers?.length>0&&<div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 p-3"><p className="text-[10px] font-bold uppercase text-rose-700 mb-1.5 flex items-center gap-1"><TrendingDown className="w-3 h-3"/>Needs Attention</p><ul className="space-y-1">{ai.underperformers.map((p,i)=><li key={i} className="text-[12px] text-[#334155] dark:text-[#CBD5E1]"><b>{p.campaign}:</b> {p.issue}</li>)}</ul></div>}
            </div>
            {ai.suggestions?.length>0&&<div className="rounded-xl bg-amber-50 dark:bg-amber-950/10 border border-amber-200 p-3"><p className="text-[10px] font-bold uppercase text-amber-700 mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3"/>Suggestions</p><ul className="space-y-1">{ai.suggestions.map((s,i)=><li key={i} className="flex items-start gap-2 text-[12px] text-[#4B5168] dark:text-[#9DA3BB]"><span className="w-4 h-4 rounded-full bg-amber-200 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>{s}</li>)}</ul></div>}
          </div>
        </div>
      )}

      {/* Campaign table */}
      {data&&<div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{camps.length} campaigns</p>
          {categories.length>0&&<div className="flex gap-1 flex-wrap ml-auto">
            <button onClick={()=>setCatFilter("")} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${!catFilter?"bg-indigo-600 text-white":"bg-[#F1F3F9] dark:bg-white/5 text-[#4B5168]"}`}>All</button>
            {categories.map(cat=><button key={cat} onClick={()=>setCatFilter(cat)} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${catFilter===cat?"bg-indigo-600 text-white":"bg-[#F1F3F9] dark:bg-white/5 text-[#4B5168]"}`}>{cat}</button>)}
          </div>}
          <p className="text-[11px] text-[#8B92A9]">Click name to drill down</p>
        </div>

        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
              {["Campaign","Spend","CTR","CPC","CPL","Leads","Qualified","Converted","Revenue","ROAS","Status"].map(h=><th key={h} className={`text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 whitespace-nowrap ${h==="Campaign"?"text-left":"text-right"}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {camps.map((c,i)=>{
                const m=c.metrics||{};const hasSpend=(m.spend||0)>0;
                const statusActive=c.metaActive!==false&&c.isActive!==false;
                return(
                  <tr key={c.configId||i} className="border-b border-[#F1F3F9] dark:border-white/5 last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-3 min-w-[180px]">
                      <button onClick={()=>setDetailId(c.configId)} className="text-left hover:text-indigo-600 transition-colors group">
                        <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] group-hover:text-indigo-600 truncate max-w-[200px]">{c.campaignName}</p>
                        {c.adSetName&&<p className="text-[10px] text-[#8B92A9] truncate">{c.adSetName}</p>}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right text-[12px] tabular-nums font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{hasSpend?inr(m.spend):"—"}</td>
                    <td className="px-3 py-3 text-right text-[12px] tabular-nums font-bold" style={{color:Number(m.ctr)>=2?"#10B981":Number(m.ctr)>=1?"#F59E0B":"#EF4444"}}>{hasSpend?`${Number(m.ctr||0).toFixed(2)}%`:"—"}</td>
                    <td className="px-3 py-3 text-right text-[11px] tabular-nums text-[#8B92A9]">{hasSpend?inr(m.cpc):"—"}</td>
                    <td className="px-3 py-3 text-right text-[11px] tabular-nums text-[#8B92A9]">{c.costPerLead?inr(c.costPerLead):"—"}</td>
                    <td className="px-3 py-3 text-right text-[12px] tabular-nums font-bold text-[#0F1117] dark:text-[#DDE1F5]">{c.leads||0}</td>
                    <td className="px-3 py-3 text-right text-[12px] tabular-nums font-bold text-purple-600">{c.qualified||0}</td>
                    <td className="px-3 py-3 text-right text-[12px] tabular-nums font-bold text-emerald-600">{c.converted||0}</td>
                    <td className="px-3 py-3 text-right text-[12px] tabular-nums font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{c.revenue>0?inr(c.revenue):"—"}</td>
                    <td className="px-3 py-3 text-right text-[12px] tabular-nums font-bold" style={{color:c.roas>=3?"#10B981":c.roas>=1?"#F59E0B":"#EF4444"}}>{c.roas>0?`${c.roas}x`:"—"}</td>
                    <td className="px-3 py-3 text-right"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusActive?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{statusActive?"Active":"Paused"}</span></td>
                  </tr>
                );
              })}
              {!camps.length&&<tr><td colSpan={11} className="px-3 py-8 text-center text-[12px] text-[#8B92A9]">No campaigns configured.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── GOOGLE ADS TAB ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function GoogleCampaignDetail({ configId, from, to, onBack }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    setLoading(true);
    mktApi.get("/google-campaign/"+configId,{params:{from,to}})
      .then(r=>{setData(r.data);setLoading(false);})
      .catch(e=>{setError(e?.response?.data?.message||"Failed to load.");setLoading(false);});
  },[configId,from,to]);
  if(loading) return <><BackBtn label="Back to Google Ads" onClick={onBack}/><Loader/></>;
  if(error) return <><BackBtn label="Back to Google Ads" onClick={onBack}/><Err msg={error}/></>;
  if(!data) return null;
  const cfg=data.config||{};
  const avgDeal=Number(cfg.avgDealValue)||0;
  return (
    <div className="space-y-4">
      <BackBtn label="Back to Google Ads" onClick={onBack}/>
      <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4">
        <p className="text-[16px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">{cfg.campaignName}</p>
        {!avgDeal&&<p className="text-[11px] text-amber-600 font-semibold mt-1">⚠ Set avg deal value in CRM Google Ads config to enable ROAS</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          {icon:IndianRupee,label:"Spend",value:inr(data.spend),tint:"#EF4444"},
          {icon:Eye,label:"Impressions",value:num(cfg.impressions),tint:"#6366F1"},
          {icon:MousePointerClick,label:"Clicks",value:num(cfg.clicks),tint:"#0EA5E9"},
          {icon:Target,label:"Leads (CRM)",value:num(data.crmLeads),tint:"#F59E0B"},
          {icon:Star,label:"Qualified",value:num(data.crmQualified),tint:"#A855F7",sub:"Hot leads"},
          {icon:CheckCircle2,label:"Converted",value:num(data.crmConverted),tint:"#10B981"},
          {icon:IndianRupee,label:"Revenue",value:inr(data.revenue),tint:"#14B8A6"},
          {icon:TrendingUp,label:"ROAS",value:data.roas!=null?`${data.roas}x`:"—",tint:data.roas>=2?"#10B981":"#F59E0B"},
          {icon:IndianRupee,label:"CPL",value:data.cpl?inr(data.cpl):"—",tint:"#8B5CF6"},
          {icon:Percent,label:"CTR",value:cfg.ctr!=null?`${Number(cfg.ctr).toFixed(2)}%`:"—",tint:"#EC4899"},
        ].map(c=>(
          <div key={c.label} className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-3" style={{background:`linear-gradient(135deg,${c.tint}12 0%,transparent 70%)`}}>
            <div className="flex items-center gap-1.5 mb-1"><c.icon className="w-3.5 h-3.5" style={{color:c.tint}}/><span className="text-[9px] font-bold uppercase text-[#8B92A9]">{c.label}</span></div>
            <p className="text-[16px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">{c.value}</p>
            {c.sub&&<p className="text-[9px] text-[#8B92A9]">{c.sub}</p>}
          </div>
        ))}
      </div>
      <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-200 rounded-2xl p-4 text-[12px] text-amber-700">
        Full Google Ads API drill-down (ad groups, keywords, search terms) requires Google Ads API credentials. Currently showing CRM-level data. Connect the Google Ads API in settings to unlock keyword-level analysis.
      </div>
    </div>
  );
}

function GoogleAdsTab({ from, to, refreshKey }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [detailId,setDetailId]=useState(null);

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{const{data:d}=await mktApi.get("/google-campaigns",{params:{from,to}});setData(d);}
    catch(e){setError(e?.response?.data?.message||"Failed to load Google Ads data.");}
    finally{setLoading(false);}
  },[from,to]);

  useEffect(()=>{load();},[load,refreshKey]);

  if(detailId) return <GoogleCampaignDetail configId={detailId} from={from} to={to} onBack={()=>setDetailId(null)}/>;
  if(loading&&!data) return <Loader/>;
  if(error) return <Err msg={error}/>;

  const t=data?.totals||{};
  const camps=data?.campaigns||[];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0"><Target className="w-4 h-4 text-white"/></div>
        <div><p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">Google Ads Performance</p><p className="text-[11px] text-[#8B92A9]">Campaign-level CRM stats · Click to drill down</p></div>
        {loading&&<Loader2 className="w-4 h-4 animate-spin text-[#8B92A9] ml-auto"/>}
      </div>

      {data&&(t.leads>0||t.spend>0)&&(
        <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md">
          <p className="text-[13px] leading-relaxed">
            Spent <b>{inr(t.spend)}</b> · <b>{t.leads} leads</b> · <b>{t.qualified} qualified</b> · <b>{t.converted} converted</b>
            {t.revenue>0&&<> · Revenue <b>{inr(t.revenue)}</b></>}
            {t.roas!=null&&<> · ROAS <b>{t.roas}x</b></>}
          </p>
        </div>
      )}

      {data&&(
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            {icon:IndianRupee,label:"Spend",value:inr(t.spend),tint:"#EF4444"},
            {icon:Eye,label:"Impressions",value:num(t.impressions),tint:"#6366F1"},
            {icon:Target,label:"Leads",value:num(t.leads),tint:"#F59E0B"},
            {icon:Star,label:"Qualified",value:num(t.qualified),tint:"#A855F7",sub:"Hot leads"},
            {icon:CheckCircle2,label:"Converted",value:num(t.converted),tint:"#10B981"},
            {icon:IndianRupee,label:"Revenue",value:inr(t.revenue),tint:"#14B8A6"},
            {icon:TrendingUp,label:"ROAS",value:t.roas!=null?`${t.roas}x`:"—",tint:"#10B981"},
            {icon:MousePointerClick,label:"Clicks",value:num(t.clicks),tint:"#0EA5E9"},
          ].map(c=>(
            <div key={c.label} className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-3" style={{background:`linear-gradient(135deg,${c.tint}12 0%,transparent 70%)`}}>
              <div className="flex items-center gap-1.5 mb-1"><c.icon className="w-3.5 h-3.5" style={{color:c.tint}}/><span className="text-[9px] font-bold uppercase text-[#8B92A9]">{c.label}</span></div>
              <p className="text-[16px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">{c.value}</p>
              {c.sub&&<p className="text-[9px] text-[#8B92A9]">{c.sub}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
            {["Campaign","Spend","Impressions","Clicks","CTR","Leads","Qualified","Converted","Conv%","Revenue","ROAS","CPL"].map(h=><th key={h} className={`text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 whitespace-nowrap ${h==="Campaign"?"text-left":"text-right"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {camps.map((c,i)=>{
              const ctr=c.clicks>0&&c.impressions>0?((c.clicks/c.impressions)*100).toFixed(2):"—";
              return(
                <tr key={c._id||i} className="border-b border-[#F1F3F9] dark:border-white/5 last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-3">
                    <button onClick={()=>setDetailId(String(c._id))} className="text-left hover:text-indigo-600 group">
                      <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] group-hover:text-indigo-600 truncate max-w-[180px]">{c.campaignName}</p>
                      <p className="text-[10px] text-[#8B92A9]">{c.isActive?"Active":"Paused"}</p>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right text-[12px] tabular-nums font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{inr(c.cost)}</td>
                  <td className="px-3 py-3 text-right text-[11px] tabular-nums text-[#8B92A9]">{num(c.impressions)}</td>
                  <td className="px-3 py-3 text-right text-[11px] tabular-nums text-[#8B92A9]">{num(c.clicks)}</td>
                  <td className="px-3 py-3 text-right text-[12px] tabular-nums font-bold" style={{color:Number(ctr)>=2?"#10B981":Number(ctr)>=1?"#F59E0B":"#EF4444"}}>{ctr!=="—"?`${ctr}%`:"—"}</td>
                  <td className="px-3 py-3 text-right text-[12px] tabular-nums font-bold text-[#0F1117] dark:text-[#DDE1F5]">{c.crmLeads}</td>
                  <td className="px-3 py-3 text-right text-[12px] tabular-nums font-bold text-purple-600">{c.crmQualified}</td>
                  <td className="px-3 py-3 text-right text-[12px] tabular-nums font-bold text-emerald-600">{c.crmConverted}</td>
                  <td className="px-3 py-3 text-right text-[12px] tabular-nums font-bold" style={{color:c.convRate>=20?"#10B981":c.convRate>=10?"#F59E0B":"#EF4444"}}>{pct(c.convRate)}</td>
                  <td className="px-3 py-3 text-right text-[12px] tabular-nums font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{c.revenue>0?inr(c.revenue):"—"}</td>
                  <td className="px-3 py-3 text-right text-[12px] tabular-nums font-bold" style={{color:c.roas>=3?"#10B981":c.roas>0?"#F59E0B":"#8B92A9"}}>{c.roas?`${c.roas}x`:"—"}</td>
                  <td className="px-3 py-3 text-right text-[11px] tabular-nums text-[#8B92A9]">{c.cpl?inr(c.cpl):"—"}</td>
                </tr>
              );
            })}
            {!camps.length&&<tr><td colSpan={12} className="px-3 py-8 text-center text-[12px] text-[#8B92A9]">No Google Ads campaigns configured. Add campaigns in the CRM → Campaigns page.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Ad-level campaign card (must be a component — useState cannot be in .map) ─
function AdLevelCampCard({ camp, ci }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02]" onClick={()=>setOpen(!open)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[13px] shrink-0" style={{background:COLORS[ci%COLORS.length]}}>{ci+1}</div>
        <div className="flex-1 min-w-0"><p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] truncate">{camp.campaign}</p><p className="text-[10px] text-[#8B92A9]">{camp.adSets.length} ad sets · {camp.total} leads</p></div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right"><p className="text-[15px] font-extrabold text-emerald-600">{camp.converted}</p><p className="text-[9px] text-[#8B92A9]">Converted</p></div>
          <div className="text-right"><p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#DDE1F5]">{camp.convRate}%</p><p className="text-[9px] text-[#8B92A9]">Conv. Rate</p></div>
          {open?<ChevronUp className="w-4 h-4 text-[#8B92A9]"/>:<ChevronDown className="w-4 h-4 text-[#8B92A9]"/>}
        </div>
      </div>
      <div className="px-4 pb-3"><ConvBar total={camp.total} converted={camp.converted} inProgress={camp.adSets.reduce((s,a)=>s+(a.inProgress||0),0)} notInt={camp.adSets.reduce((s,a)=>s+(a.notInt||0),0)}/></div>
      {open&&<div className="border-t border-[#E4E7EF] dark:border-[#1E2133]">
        {camp.adSets.map((adSet,ai)=>(
          <div key={ai} className="border-b border-[#F1F3F9] dark:border-white/5 last:border-0">
            <div className="grid grid-cols-8 px-4 py-3 gap-2">
              <div className="col-span-2"><p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] truncate">{adSet.adSet||"—"}</p><p className="text-[10px] text-[#8B92A9]">{adSet.source}</p></div>
              <div className="text-center"><p className="text-[14px] font-extrabold text-[#0F1117] dark:text-[#DDE1F5]">{adSet.total}</p><p className="text-[9px] text-[#8B92A9]">{adSet.convRate}% conv</p></div>
              <div className="text-center"><p className="text-[14px] font-bold text-blue-600">{adSet.newLeads}</p><p className="text-[9px] text-[#8B92A9]">New</p></div>
              <div className="text-center"><p className="text-[14px] font-bold text-amber-600">{adSet.inProgress}</p><p className="text-[9px] text-[#8B92A9]">In Prog</p></div>
              <div className="text-center"><p className="text-[14px] font-bold text-purple-600">{adSet.verif}</p><p className="text-[9px] text-[#8B92A9]">Verif</p></div>
              <div className="text-center"><p className="text-[16px] font-extrabold text-emerald-600">{adSet.converted}</p><p className="text-[9px] text-[#8B92A9]">Conv.</p></div>
              <div className="text-center"><p className="text-[14px] font-bold text-rose-500">{adSet.notInt}</p><p className="text-[9px] text-[#8B92A9]">Not Int.</p></div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── LEADS TAB ────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function LeadsTab({ from, to, refreshKey }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [view,setView]=useState("adlevel");
  const [campFilter,setCampFilter]=useState("");
  const [search,setSearch]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const p={};if(from)p.from=from;if(to)p.to=to;if(campFilter)p.campaign=campFilter;
      const{data:d}=await mktApi.get("/leads-intelligence",{params:p});setData(d);
    }catch(e){setError(e?.response?.data?.message||"Failed to load leads.");}
    finally{setLoading(false);}
  },[from,to,campFilter]);

  useEffect(()=>{load();},[load,refreshKey]);

  const leads=data?.allLeads||[];
  const filteredLeads=useMemo(()=>{if(!search)return leads;const q=search.toLowerCase();return leads.filter(l=>l.name.toLowerCase().includes(q)||l.mobile.includes(q)||(l.campaign||"").toLowerCase().includes(q));},[leads,search]);

  const pipeline=[
    {label:"New",count:leads.filter(l=>l.status==="New").length,color:"#3B82F6"},
    {label:"In Progress",count:leads.filter(l=>l.status==="In Progress").length,color:"#F59E0B"},
    {label:"Verification",count:leads.filter(l=>l.status==="Verification").length,color:"#8B5CF6"},
    {label:"Converted",count:leads.filter(l=>l.status==="Converted").length,color:"#10B981"},
    {label:"Not Interested",count:leads.filter(l=>l.status==="Not Interested").length,color:"#EF4444"},
  ];

  if(loading&&!data) return <Loader/>;
  if(error) return <Err msg={error}/>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0"><Users className="w-4 h-4 text-white"/></div>
        <div><p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">Leads Intelligence</p><p className="text-[11px] text-[#8B92A9]">Ad-level attribution · pipeline · lead table</p></div>
        <div className="ml-auto flex items-center gap-2">
          <select value={campFilter} onChange={e=>setCampFilter(e.target.value)} className="text-[11px] bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2 py-1.5 focus:outline-none text-[#4B5168] dark:text-[#9DA3BB]">
            <option value="">All campaigns</option>
            {(data?.filters?.campaigns||[]).map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          {loading&&<Loader2 className="w-4 h-4 animate-spin text-[#8B92A9]"/>}
        </div>
      </div>

      {/* Pipeline cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {pipeline.map(p=>(
          <div key={p.label} className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-3" style={{background:`linear-gradient(135deg,${p.color}12 0%,transparent 70%)`}}>
            <div className="flex items-center justify-between"><p className="text-[20px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">{p.count}</p><span className="w-2 h-2 rounded-full" style={{background:p.color}}/></div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mt-0.5">{p.label}</p>
          </div>
        ))}
      </div>

      {/* Summary banner */}
      {data&&leads.length>0&&<div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md">
        <p className="text-[13px] leading-relaxed"><b>{leads.length}</b> leads — <b className="text-emerald-200">{pipeline[3].count} converted</b> ({leads.length>0?Math.round((pipeline[3].count/leads.length)*100):0}% rate), <b>{pipeline[1].count}</b> in progress, <b className="text-rose-300">{pipeline[4].count}</b> not interested.</p>
      </div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-1">
        {[["adlevel","Ad-Level Breakdown"],["converting","Converting Leads"],["all","All Leads"]].map(([v,l])=>(
          <button key={v} onClick={()=>{setView(v);setSearch("");}} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${view===v?"bg-indigo-600 text-white shadow":"text-[#8B92A9] hover:text-[#4B5168]"}`}>{l}</button>
        ))}
      </div>

      {/* Ad-level */}
      {view==="adlevel"&&data&&(
        <div className="space-y-3">
          {(!data.adLevel||!data.adLevel.length)&&<div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-10 text-center text-[12px] text-[#8B92A9]">No lead data in this period.</div>}
          {(data.adLevel||[]).map((camp,ci)=>(
            <AdLevelCampCard key={camp.campaign+ci} camp={camp} ci={ci}/>
          ))}
        </div>
      )}

      {/* Lead table */}
      {(view==="converting"||view==="all")&&data&&(
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs"><Search className="w-3.5 h-3.5 text-[#8B92A9] absolute left-2.5 top-1/2 -translate-y-1/2"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, campaign…" className="w-full text-[12px] pl-8 pr-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]"/>
            </div>
            <span className="text-[11px] text-[#8B92A9] ml-auto">{filteredLeads.length} leads</span>
          </div>
          <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
                {["Lead","Contact","Campaign","Ad Set","Source","Status","Agent","Date"].map(h=><th key={h} className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {(view==="converting"?filteredLeads.filter(l=>l.status==="Converted"):filteredLeads).slice(0,200).map((l,i)=>(
                  <tr key={l._id||i} className="border-b border-[#F1F3F9] dark:border-white/5 last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{background:l.status==="Converted"?"#10B981":l.status==="In Progress"?"#F59E0B":"#6366F1"}}>{(l.name||"?").charAt(0).toUpperCase()}</div><p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{l.name}</p></div></td>
                    <td className="px-3 py-3"><p className="text-[12px] tabular-nums text-[#4B5168] dark:text-[#9DA3BB]">{l.mobile}</p></td>
                    <td className="px-3 py-3 text-[11px] text-[#4B5168] dark:text-[#9DA3BB] max-w-[130px]"><p className="truncate">{l.campaign||"—"}</p></td>
                    <td className="px-3 py-3 text-[11px] text-[#8B92A9] max-w-[120px]"><p className="truncate">{l.adSet||"—"}</p></td>
                    <td className="px-3 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F8F9FC] dark:bg-white/5 text-[#4B5168]">{l.source||"—"}</span></td>
                    <td className="px-3 py-3"><StatusBadge status={l.status}/></td>
                    <td className="px-3 py-3 text-[11px] text-[#4B5168] whitespace-nowrap">{l.agent}</td>
                    <td className="px-3 py-3 text-[11px] text-[#8B92A9] whitespace-nowrap">{l.date?new Date(l.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"2-digit"}):""}</td>
                  </tr>
                ))}
                {!filteredLeads.length&&<tr><td colSpan={8} className="px-3 py-8 text-center text-[12px] text-[#8B92A9]">No leads match</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── REPORTS TAB ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function ReportsTab({ from, to, refreshKey }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{const{data:d}=await mktApi.get("/reports/summary",{params:{from,to}});setData(d);}
    catch(e){setError(e?.response?.data?.message||"Failed to generate report.");}
    finally{setLoading(false);}
  },[from,to]);

  useEffect(()=>{load();},[load,refreshKey]);

  const downloadCSV=()=>{
    if(!data) return;
    const rows=[];
    rows.push(["Period",data.range?.from+" to "+data.range?.to,"",""]);
    rows.push([""]);
    rows.push(["Pipeline Summary"]);
    rows.push(["Total Leads","Converted","In Progress","New","Not Interested","Conv Rate %"]);
    const p=data.pipeline||{};
    rows.push([p.total,p.converted,p.inProgress,p.newLeads,p.notInt,p.convRate]);
    rows.push([""]);
    rows.push(["By Source","Total","Converted","Conv %"]);
    (data.bySrc||[]).forEach(r=>rows.push([r.source,r.total,r.converted,r.convRate]));
    rows.push([""]);
    rows.push(["By Campaign","Total","Converted"]);
    (data.byCamp||[]).forEach(r=>rows.push([r.campaign,r.total,r.converted]));
    rows.push([""]);
    rows.push(["By Employee","Total","Converted","Conv %"]);
    (data.byEmployee||[]).forEach(r=>rows.push([r.name,r.total,r.converted,r.convRate]));
    const csv=rows.map(r=>r.map(c=>JSON.stringify(c==null?"":c)).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`report_${from}_to_${to}.csv`;a.click();
    URL.revokeObjectURL(url);
  };

  if(loading&&!data) return <Loader/>;
  if(error) return <Err msg={error}/>;

  const p=data?.pipeline||{};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-white"/></div>
        <div><p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">Performance Report</p><p className="text-[11px] text-[#8B92A9]">Summary for {from} → {to}</p></div>
        <div className="ml-auto flex items-center gap-2">
          {loading&&<Loader2 className="w-4 h-4 animate-spin text-[#8B92A9]"/>}
          {data&&<button onClick={downloadCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"><Download className="w-3.5 h-3.5"/>Export CSV</button>}
        </div>
      </div>

      {data&&<>
        {/* Pipeline summary */}
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4">
          <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-3">Pipeline Summary</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              {label:"Total Leads",value:p.total||0,tint:"#6366F1"},
              {label:"New",value:p.newLeads||0,tint:"#3B82F6"},
              {label:"In Progress",value:p.inProgress||0,tint:"#F59E0B"},
              {label:"Converted",value:p.converted||0,tint:"#10B981"},
              {label:"Not Interested",value:p.notInt||0,tint:"#EF4444"},
              {label:"Conv. Rate",value:pct(p.convRate),tint:"#8B5CF6"},
            ].map(c=>(
              <div key={c.label} className="rounded-xl p-3 border border-[#E4E7EF] dark:border-[#1E2133]">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-1">{c.label}</p>
                <p className="text-[18px] font-extrabold" style={{color:c.tint}}>{c.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="By Source" icon={PieChart}>
            <SortTable rows={(data.bySrc||[]).map(r=>({...r,convRateStr:pct(r.convRate)}))} columns={[
              {key:"source",label:"Source",render:r=><span className="font-medium">{r.source}</span>},
              {key:"total",label:"Leads",align:"right",render:r=>num(r.total)},
              {key:"converted",label:"Converted",align:"right",render:r=><span className="text-emerald-600 font-semibold">{num(r.converted)}</span>},
              {key:"convRate",label:"Conv %",align:"right",render:r=><span className="font-bold" style={{color:r.convRate>=10?"#059669":r.convRate>=5?"#D97706":"#EF4444"}}>{pct(r.convRate)}</span>},
            ]}/>
          </Panel>
          <Panel title="By Campaign" icon={BarChart3}>
            <SortTable rows={data.byCamp||[]} columns={[
              {key:"campaign",label:"Campaign",render:r=><span className="font-medium truncate max-w-[150px] block">{r.campaign||"—"}</span>},
              {key:"total",label:"Leads",align:"right",render:r=>num(r.total)},
              {key:"converted",label:"Converted",align:"right",render:r=><span className="text-emerald-600 font-semibold">{num(r.converted)}</span>},
            ]}/>
          </Panel>
        </div>

        <Panel title="Sales Executive Performance" icon={Award}>
          <SortTable rows={data.byEmployee||[]} columns={[
            {key:"name",label:"Executive",render:r=><span className="font-semibold">{r.name}</span>},
            {key:"total",label:"Assigned",align:"right",render:r=>num(r.total)},
            {key:"converted",label:"Converted",align:"right",render:r=><span className="text-emerald-600 font-semibold">{num(r.converted)}</span>},
            {key:"convRate",label:"Conv %",align:"right",render:r=><span className="font-bold" style={{color:r.convRate>=20?"#059669":r.convRate>=10?"#D97706":"#EF4444"}}>{pct(r.convRate)}</span>},
          ]}/>
        </Panel>

        <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4 text-[11px] text-[#8B92A9] text-center">
          Generated {new Date(data.generatedAt).toLocaleString("en-IN")} · {data.metaCampaigns} Meta configs · {data.googleCampaigns} Google campaigns
        </div>
      </>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── AD-LEVEL TAB — individual ad cards with full creative + metrics ───────────
// ─────────────────────────────────────────────────────────────────────────────
function getTips(m, cr) {
  const tips = [];
  const ctr = Number(m.ctr) || 0, freq = Number(m.frequency) || 0, cpc = Number(m.cpc) || 0;
  const spend = Number(m.spend) || 0, impr = Number(m.impressions) || 0, reach = Number(m.reach) || 0;
  if (ctr < 1) tips.push("Low CTR (<1%) — try a stronger hook in the headline or a more attention-grabbing image/video.");
  if (ctr >= 3) tips.push("High CTR — ad is performing well. Consider increasing budget to scale reach.");
  if (freq > 5) tips.push(`High frequency (${Number(freq).toFixed(1)}×) — audience is seeing this too often. Refresh the creative or expand the audience.`);
  if (freq > 8) tips.push("Severe fatigue — widen audience or pause and rotate this creative urgently.");
  if (cpc > 50) tips.push("High CPC — test different creatives or audience segments to reduce click cost.");
  if (reach > 0 && impr > 0 && (impr / reach) > 6) tips.push("Very high impressions/reach ratio — consider widening your targeting.");
  if (!cr.headline && !cr.body) tips.push("No creative copy detected — ensure the ad is set up correctly in Meta Ads Manager.");
  if (cr.cta === "LEARN_MORE" && ctr < 1) tips.push("'Learn More' CTA with low CTR — try 'Sign Up', 'Get Quote', or 'Contact Us'.");
  if (spend > 0 && impr === 0) tips.push("Spend recorded but zero impressions — check ad review status or delivery settings.");
  return tips.length ? tips : ["Ad is within normal range. Monitor frequency and CTR over time."];
}

function AdCard({ ad }) {
  const [showCr,setShowCr]=useState(false);
  const [showTips,setShowTips]=useState(false);
  const m=ad.metrics||{},cr=ad.creative||{};
  const score=scoreAd(m),tips=getTips(m,cr);
  const ScoreIcon=score.icon;
  const stCls={"ACTIVE":"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30","PAUSED":"bg-amber-50 text-amber-700 dark:bg-amber-950/30","CAMPAIGN_PAUSED":"bg-slate-100 text-slate-500","DELETED":"bg-rose-50 text-rose-600"}[ad.status]||"bg-slate-100 text-slate-500";
  const hasCr=!!(cr.thumbnail||cr.headline||cr.body||cr.cta);
  return (
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        {cr.thumbnail&&(
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#F1F3F9] dark:bg-white/5">
            <img src={cr.thumbnail} alt="creative" className="w-full h-full object-cover" onError={e=>{e.target.parentNode.style.display="none";}}/>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] truncate">{ad.adName}</p>
          <p className="text-[10px] text-[#8B92A9] truncate">{ad.adsetName} · {ad.campaignName}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
          {ad.status&&<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${stCls}`}>{ad.status.toLowerCase().replace(/_/g," ")}</span>}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${score.bg}`} style={{color:score.color}}><ScoreIcon className="w-3 h-3"/>{score.label}</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-px bg-[#F1F3F9] dark:bg-[#1E2133] mx-4 mb-3 rounded-xl overflow-hidden">
        {[
          ["Spend",`₹${Number(m.spend||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`,"#EF4444"],
          ["Impr.",Number(m.impressions||0).toLocaleString("en-IN"),"#6366F1"],
          ["Reach",Number(m.reach||0).toLocaleString("en-IN"),"#10B981"],
          ["Clicks",Number(m.clicks||0).toLocaleString("en-IN"),"#0EA5E9"],
          ["CTR",`${Number(m.ctr||0).toFixed(2)}%`,Number(m.ctr||0)>=2?"#10B981":Number(m.ctr||0)>=1?"#F59E0B":"#EF4444"],
          ["CPM",`₹${Number(m.cpm||0).toFixed(2)}`,"#8B92A9"],
          ["CPC",`₹${Number(m.cpc||0).toFixed(2)}`,"#8B92A9"],
          ["Freq.",`${Number(m.frequency||0).toFixed(1)}×`,Number(m.frequency||0)>5?"#EF4444":Number(m.frequency||0)>3?"#F59E0B":"#10B981"],
        ].map(([k,v,c])=>(
          <div key={k} className="bg-white dark:bg-[#11131C] px-2 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{k}</p>
            <p className="text-[12px] font-extrabold tabular-nums" style={{color:c}}>{v}</p>
          </div>
        ))}
      </div>

      {/* Creative section */}
      {hasCr&&(
        <div className="mx-4 mb-3">
          <button onClick={()=>setShowCr(!showCr)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mb-2">
            <Image className="w-3.5 h-3.5"/>{showCr?"Hide creative":"View creative"}
          </button>
          {showCr&&(
            <div className="rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] overflow-hidden">
              {/* Creative preview with thumbnail */}
              {cr.thumbnail&&(
                <div className="relative bg-[#F8F9FC] dark:bg-[#0D0F14] flex justify-center p-3 border-b border-[#E4E7EF] dark:border-[#1E2133]">
                  <img src={cr.thumbnail} alt="Ad creative" className="max-h-48 rounded-lg object-contain shadow-sm" onError={e=>{e.target.parentNode.style.display="none";}}/>
                </div>
              )}
              {/* Creative copy */}
              <div className="p-3 space-y-2">
                {cr.headline&&(
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">Headline</p>
                    <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] leading-snug">{cr.headline}</p>
                  </div>
                )}
                {cr.body&&(
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">Primary Text</p>
                    <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed whitespace-pre-line">{cr.body}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  {cr.cta&&(
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                      <Play className="w-3 h-3"/>{cr.cta.replace(/_/g," ")}
                    </span>
                  )}
                  {cr.linkUrl&&(
                    <a href={cr.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:underline">
                      <ExternalLink className="w-3 h-3"/>{cr.linkUrl.replace(/^https?:\/\//,"").split("/")[0]}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="px-4 pb-4">
        <button onClick={()=>setShowTips(!showTips)} className={`inline-flex items-center gap-1 text-[11px] font-semibold ${showTips?"text-amber-600":"text-[#8B92A9] hover:text-amber-600"} transition-colors`}>
          <Zap className="w-3.5 h-3.5"/>{showTips?"Hide suggestions":`${tips.length} suggestion${tips.length!==1?"s":""}`}
        </button>
        {showTips&&(
          <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-800/30">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1"><Zap className="w-3 h-3"/>Improvement Suggestions</p>
            <ul className="space-y-2">
              {tips.map((t,i)=>(
                <li key={i} className="flex items-start gap-2 text-[12px] text-amber-800 dark:text-amber-300">
                  <span className="w-4 h-4 rounded-full bg-amber-200 dark:bg-amber-800/40 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>{t}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaAdLevelTab({ from, to, refreshKey }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [view,setView]=useState("campaigns");   // campaigns | table | all
  const [campFilter,setCampFilter]=useState(""); // filter by campaign name
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState(""); // ACTIVE | PAUSED | ""

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{const{data:d}=await mktApi.get("/meta-ad-level",{params:{from,to},timeout:60000});setData(d);}
    catch(e){setError(e?.response?.data?.message||"Failed to load ad-level data.");}
    finally{setLoading(false);}
  },[from,to]);

  useEffect(()=>{load();},[load,refreshKey]);

  const allAds=data?.ads||[];
  const campaigns=useMemo(()=>Array.from(new Set(allAds.map(a=>a.campaignName).filter(Boolean))).sort(),[allAds]);

  const filtered=useMemo(()=>{
    let ads=allAds;
    if(campFilter) ads=ads.filter(a=>a.campaignName===campFilter);
    if(statusFilter) ads=ads.filter(a=>a.status===statusFilter);
    if(search){const q=search.toLowerCase();ads=ads.filter(a=>a.adName.toLowerCase().includes(q)||(a.campaignName||"").toLowerCase().includes(q)||(a.adsetName||"").toLowerCase().includes(q));}
    return ads;
  },[allAds,campFilter,statusFilter,search]);

  // Group by campaign for the campaign view
  const byCampaign=useMemo(()=>{
    const map={};
    filtered.forEach(a=>{const k=a.campaignName||"Unknown";if(!map[k])map[k]=[];map[k].push(a);});
    return Object.entries(map).sort((a,b)=>b[1].reduce((s,x)=>s+(x.metrics.spend||0),0)-a[1].reduce((s,x)=>s+(x.metrics.spend||0),0));
  },[filtered]);

  const t=data?.totals||{};
  const goodCount=allAds.filter(a=>scoreAd(a.metrics).label==="Good").length;
  const needsCount=allAds.filter(a=>scoreAd(a.metrics).label==="Needs Attention").length;
  const activeCount=allAds.filter(a=>a.status==="ACTIVE").length;

  if(loading&&!data) return <Loader/>;
  if(error) return <Err msg={error}/>;
  if(data&&!data.configured) return (
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-10 text-center">
      <BarChart3 className="w-8 h-8 text-[#C4C9DA] mx-auto mb-3" strokeWidth={1.5}/>
      <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] mb-1">No Meta ad accounts configured</p>
      <p className="text-[12px] text-[#8B92A9]">Add an Ad Account ID + ads_read token to a Meta campaign config in the CRM to see individual ad performance and creative data.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0"><Image className="w-4 h-4 text-white"/></div>
        <div>
          <p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA]">Meta Ad-Level Performance</p>
          <p className="text-[11px] text-[#8B92A9]">Individual ad metrics · creative preview · headline · CTA · improvement suggestions</p>
        </div>
        {loading&&<Loader2 className="w-4 h-4 animate-spin text-[#8B92A9] ml-auto"/>}
      </div>

      {/* Summary banner */}
      {data&&t.spend>0&&(
        <div className="rounded-2xl p-4 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 text-white shadow-md">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">{allAds.length} ads · {byCampaign.length} campaigns · {from} → {to}</p>
          <p className="text-[13px] leading-relaxed">
            Spent <b>₹{Number(t.spend).toLocaleString("en-IN",{maximumFractionDigits:0})}</b> · <b>{Number(t.impressions).toLocaleString("en-IN")}</b> impressions · <b>{Number(t.clicks).toLocaleString("en-IN")}</b> clicks ·
            <span className="text-emerald-300 font-bold"> {goodCount} ads performing well</span> ·
            <span className="text-rose-300 font-bold"> {needsCount} need attention</span> · {activeCount} active
          </p>
        </div>
      )}

      {/* KPI strip */}
      {data&&t.spend>0&&(
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            {icon:IndianRupee,label:"Spend",value:`₹${Number(t.spend).toLocaleString("en-IN",{maximumFractionDigits:0})}`,tint:"#EF4444"},
            {icon:Eye,label:"Impressions",value:Number(t.impressions).toLocaleString("en-IN"),tint:"#6366F1"},
            {icon:Users,label:"Reach",value:Number(t.reach).toLocaleString("en-IN"),tint:"#10B981"},
            {icon:MousePointerClick,label:"Clicks",value:Number(t.clicks).toLocaleString("en-IN"),tint:"#0EA5E9"},
            {icon:Percent,label:"Avg CTR",value:t.impressions>0?`${((t.clicks/t.impressions)*100).toFixed(2)}%`:"—",tint:"#F59E0B"},
            {icon:BarChart3,label:"Ads",value:allAds.length,tint:"#8B5CF6"},
            {icon:CheckCircle2,label:"Good",value:goodCount,tint:"#10B981"},
            {icon:AlertCircle,label:"Need Attention",value:needsCount,tint:"#EF4444"},
          ].map(c=>(
            <div key={c.label} className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-3" style={{background:`linear-gradient(135deg,${c.tint}12 0%,transparent 70%)`}}>
              <div className="flex items-center gap-1 mb-1"><c.icon className="w-3 h-3" style={{color:c.tint}}/><span className="text-[9px] font-bold uppercase text-[#8B92A9]">{c.label}</span></div>
              <p className="text-[14px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters + view toggle */}
      {data&&(
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl px-4 py-3">
          <div className="relative"><Search className="w-3.5 h-3.5 text-[#8B92A9] absolute left-2.5 top-1/2 -translate-y-1/2"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ads…" className="text-[11px] pl-8 pr-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5] w-44"/>
          </div>
          <select value={campFilter} onChange={e=>setCampFilter(e.target.value)} className="text-[11px] bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2 py-1.5 focus:outline-none text-[#4B5168] dark:text-[#9DA3BB]">
            <option value="">All campaigns</option>
            {campaigns.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="text-[11px] bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2 py-1.5 focus:outline-none text-[#4B5168] dark:text-[#9DA3BB]">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="CAMPAIGN_PAUSED">Campaign Paused</option>
          </select>
          {(search||campFilter||statusFilter)&&<button onClick={()=>{setSearch("");setCampFilter("");setStatusFilter("");}} className="text-[#8B92A9] hover:text-rose-500 p-1"><X className="w-3.5 h-3.5"/></button>}
          <span className="text-[11px] text-[#8B92A9] ml-auto">{filtered.length} ads</span>
          <div className="flex gap-0.5 bg-[#F1F3F9] dark:bg-white/5 rounded-xl p-1">
            {[["campaigns","By Campaign"],["cards","All Cards"],["table","Table"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${view===v?"bg-white dark:bg-[#11131C] text-indigo-600 shadow-sm":"text-[#8B92A9] hover:text-[#4B5168]"}`}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {/* By Campaign view — campaign header + ad cards nested inside */}
      {view==="campaigns"&&data&&(
        <div className="space-y-4">
          {byCampaign.length===0&&<div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-10 text-center text-[12px] text-[#8B92A9]">No ads match the current filters.</div>}
          {byCampaign.map(([campName,ads],ci)=>{
            const spend=ads.reduce((s,a)=>s+(a.metrics.spend||0),0);
            const impr=ads.reduce((s,a)=>s+(a.metrics.impressions||0),0);
            const clicks=ads.reduce((s,a)=>s+(a.metrics.clicks||0),0);
            const ctr=impr>0?((clicks/impr)*100).toFixed(2):"—";
            const active=ads.filter(a=>a.status==="ACTIVE").length;
            const good=ads.filter(a=>scoreAd(a.metrics).label==="Good").length;
            const needs=ads.filter(a=>scoreAd(a.metrics).label==="Needs Attention").length;
            return (
              <div key={campName+ci}>
                {/* Campaign header */}
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white font-bold text-[11px] shrink-0" style={{background:COLORS[ci%COLORS.length]}}>{ci+1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] truncate">{campName}</p>
                    <p className="text-[10px] text-[#8B92A9]">
                      {ads.length} ads · {active} active ·
                      <span className="text-emerald-600 font-semibold"> {good} good</span> ·
                      <span className="text-rose-500 font-semibold"> {needs} need attention</span> ·
                      Spend ₹{Number(spend).toLocaleString("en-IN",{maximumFractionDigits:0})} · CTR {ctr!=="—"?`${ctr}%`:"—"}
                    </p>
                  </div>
                </div>
                {/* Ad cards grid */}
                <div className="grid lg:grid-cols-2 gap-3">
                  {ads.map((ad,ai)=><AdCard key={ad.adId||ai} ad={ad}/>)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All Cards view */}
      {view==="cards"&&data&&(
        <div className="grid lg:grid-cols-2 gap-3">
          {filtered.length===0&&<div className="col-span-2 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-10 text-center text-[12px] text-[#8B92A9]">No ads match.</div>}
          {filtered.map((ad,i)=><AdCard key={ad.adId||i} ad={ad}/>)}
        </div>
      )}

      {/* Table view */}
      {view==="table"&&data&&(
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
              {["Ad","Ad Set","Campaign","Status","Score","Spend","Impr.","Reach","Clicks","CTR","CPM","CPC","Freq.","Creative"].map(h=>(
                <th key={h} className={`text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 whitespace-nowrap ${h==="Ad"||h==="Creative"?"text-left":"text-right"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((ad,i)=>{
                const m=ad.metrics||{},cr=ad.creative||{};
                const sc=scoreAd(m),SI=sc.icon;
                const stCls={"ACTIVE":"bg-emerald-50 text-emerald-700","PAUSED":"bg-amber-50 text-amber-700","CAMPAIGN_PAUSED":"bg-slate-100 text-slate-500","DELETED":"bg-rose-50 text-rose-600"}[ad.status]||"bg-slate-100 text-slate-500";
                return (
                  <tr key={ad.adId||i} className="border-b border-[#F1F3F9] dark:border-white/5 last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 max-w-[160px]">
                      <div className="flex items-center gap-2">
                        {cr.thumbnail&&<img src={cr.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" onError={e=>{e.target.style.display="none";}}/>}
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] truncate">{ad.adName}</p>
                          {cr.headline&&<p className="text-[10px] text-[#8B92A9] truncate">{cr.headline}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[#8B92A9] max-w-[120px]"><p className="truncate">{ad.adsetName}</p></td>
                    <td className="px-3 py-2.5 text-[11px] text-[#8B92A9] max-w-[120px]"><p className="truncate">{ad.campaignName}</p></td>
                    <td className="px-3 py-2.5 text-right"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${stCls}`}>{(ad.status||"").toLowerCase().replace(/_/g," ")}</span></td>
                    <td className="px-3 py-2.5 text-right"><span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg}`} style={{color:sc.color}}><SI className="w-3 h-3"/>{sc.label}</span></td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-semibold text-[#0F1117] dark:text-[#DDE1F5]">₹{Number(m.spend||0).toLocaleString("en-IN",{maximumFractionDigits:0})}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[#8B92A9]">{Number(m.impressions||0).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[#8B92A9]">{Number(m.reach||0).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[#8B92A9]">{Number(m.clicks||0).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-bold" style={{color:Number(m.ctr)>=2?"#10B981":Number(m.ctr)>=1?"#F59E0B":"#EF4444"}}>{Number(m.ctr||0).toFixed(2)}%</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[#8B92A9]">₹{Number(m.cpm||0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[#8B92A9]">₹{Number(m.cpc||0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-bold" style={{color:Number(m.frequency||0)>5?"#EF4444":Number(m.frequency||0)>3?"#F59E0B":"#10B981"}}>{Number(m.frequency||0).toFixed(1)}×</td>
                    <td className="px-3 py-2.5 text-left">
                      {(cr.headline||cr.body||cr.cta)&&(
                        <div className="text-[10px] text-[#4B5168] dark:text-[#9DA3BB] space-y-0.5">
                          {cr.headline&&<p className="font-semibold truncate max-w-[120px]" title={cr.headline}>{cr.headline}</p>}
                          {cr.cta&&<span className="inline-block px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-bold">{cr.cta.replace(/_/g," ")}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filtered.length&&<tr><td colSpan={14} className="px-3 py-8 text-center text-[12px] text-[#8B92A9]">No ads match the current filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data&&data.errors&&data.errors.length>0&&(
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 rounded-2xl p-3 text-[11px] text-rose-600">
          <p className="font-bold mb-1">Some accounts had errors:</p>
          {data.errors.map((e,i)=><p key={i}>Account {e.account}: {e.error}</p>)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MAIN SHELL ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export default function MarketingDashboard() {
  const nav=useNavigate();
  const user=JSON.parse(localStorage.getItem("mkt_user")||"{}");
  const [dark,setDark]=useState(()=>localStorage.getItem("mkt_dark")==="true");
  const [activeTab,setActiveTab]=useState("overview");
  const [from,setFrom]=useState(isoDaysAgo(30));
  const [to,setTo]=useState(isoDaysAgo(0));
  const [preset,setPreset]=useState("Last 30 days");
  const [autoMin,setAutoMin]=useState(null);
  const [refreshKey,setRefreshKey]=useState(0);
  const [lastRefreshed,setLastRefreshed]=useState(null);
  const [globalLoading,setGlobalLoading]=useState(false);

  useEffect(()=>{
    if(!localStorage.getItem("mkt_token")){nav("/marketing/login");return;}
    document.documentElement.classList.toggle("dark",dark);
    localStorage.setItem("mkt_dark",String(dark));
  },[dark,nav]);

  const handleRefresh=useCallback(()=>{
    setRefreshKey(k=>k+1);
    setLastRefreshed(new Date());
  },[]);

  useEffect(()=>{
    if(!autoMin)return;
    const t=setInterval(()=>handleRefresh(),autoMin*60000);
    return()=>clearInterval(t);
  },[autoMin,handleRefresh]);

  const logout=()=>{localStorage.removeItem("mkt_token");localStorage.removeItem("mkt_user");nav("/marketing/login");};

  const TABS=[
    ["overview","Overview",BarChart3],
    ["meta","Meta Ads",Target],
    ["google","Google Ads",Search],
    ["adlevel","Ad-Level",Image],
    ["leads","Leads",Users],
    ["reports","Reports",FileText],
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0D0F14]">
      {/* Nav */}
      <nav className="h-14 bg-white dark:bg-[#11131C] border-b border-[#E4E7EF] dark:border-[#1E2133] px-4 md:px-6 flex items-center gap-3 sticky top-0 z-50">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0"><BarChart3 className="w-4 h-4 text-white"/></div>
          <div className="hidden sm:block">
            <p className="text-[13px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-tight">Performance Marketing</p>
            <p className="text-[10px] text-[#8B92A9]">{user.companyName||"Dashboard"}</p>
          </div>
        </div>

        {/* Desktop tab nav */}
        <div className="hidden lg:flex gap-0.5 bg-[#F1F3F9] dark:bg-white/5 rounded-xl p-1 mx-4">
          {TABS.map(([v,l,Icon])=>(
            <button key={v} onClick={()=>setActiveTab(v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${activeTab===v?"bg-white dark:bg-[#11131C] text-indigo-600 shadow-sm":"text-[#8B92A9] hover:text-[#4B5168] dark:hover:text-[#DDE1F5]"}`}>
              <Icon className="w-3.5 h-3.5"/>{l}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {lastRefreshed&&<span className="text-[10px] text-[#8B92A9] hidden xl:inline">Updated {lastRefreshed.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span>}
          <select value={autoMin||""} onChange={e=>setAutoMin(e.target.value?Number(e.target.value):null)} className="text-[11px] bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2 py-1.5 focus:outline-none text-[#4B5168] hidden sm:block">
            <option value="">Manual</option>
            <option value="5">Auto 5m</option>
            <option value="15">Auto 15m</option>
            <option value="30">Auto 30m</option>
          </select>
          <button onClick={handleRefresh} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold">
            <RefreshCw className="w-3.5 h-3.5"/><span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={()=>setDark(!dark)} className="w-8 h-8 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-center text-[#8B92A9] hover:text-indigo-600 transition-colors">
            {dark?<Sun className="w-4 h-4"/>:<Moon className="w-4 h-4"/>}
          </button>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133]">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">{(user.name||"A").charAt(0).toUpperCase()}</div>
            <span className="text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hidden sm:inline">{user.name||"Admin"}</span>
          </div>
          <button onClick={logout} className="w-8 h-8 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-center text-[#8B92A9] hover:text-rose-500 transition-colors"><LogOut className="w-3.5 h-3.5"/></button>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-5 space-y-4">
        {/* Mobile tabs */}
        <div className="flex gap-1 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-1.5 lg:hidden overflow-x-auto">
          {TABS.map(([v,l,Icon])=>(
            <button key={v} onClick={()=>setActiveTab(v)} className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors ${activeTab===v?"bg-indigo-600 text-white shadow":"text-[#8B92A9] hover:text-[#4B5168]"}`}>
              <Icon className="w-3.5 h-3.5"/>{l}
            </button>
          ))}
        </div>

        {/* Shared date filter */}
        <DateFilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} preset={preset} setPreset={setPreset}/>

        {/* Tab content */}
        {activeTab==="overview"&&<OverviewTab from={from} to={to} refreshKey={refreshKey} onNav={setActiveTab}/>}
        {activeTab==="meta"&&<MetaAdsTab from={from} to={to} refreshKey={refreshKey}/>}
        {activeTab==="google"&&<GoogleAdsTab from={from} to={to} refreshKey={refreshKey}/>}
        {activeTab==="adlevel"&&<MetaAdLevelTab from={from} to={to} refreshKey={refreshKey}/>}
        {activeTab==="leads"&&<LeadsTab from={from} to={to} refreshKey={refreshKey}/>}
        {activeTab==="reports"&&<ReportsTab from={from} to={to} refreshKey={refreshKey}/>}
      </div>
    </div>
  );
}
