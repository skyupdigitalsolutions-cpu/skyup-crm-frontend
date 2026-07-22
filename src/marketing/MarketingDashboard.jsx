// src/marketing/MarketingDashboard.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import mktApi from "./mktApi";
import {
  BarChart3, Users, Target, CheckCircle2, XCircle, Activity, Clock,
  Calendar, AlertTriangle, AlertCircle, TrendingUp, TrendingDown, Minus, RefreshCw,
  Loader2, LogOut, Sun, Moon, ChevronUp, ChevronDown, ArrowUpDown,
  Search, Layers, Award, Zap, PieChart, Bell, X, Star, Filter,
  Eye, MousePointerClick, IndianRupee, Percent, Image, ExternalLink,
  Info, TrendingUp as TUp,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────
const num  = (v) => (v == null ? "—" : Number(v).toLocaleString("en-IN"));
const pct  = (v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0,10); };
const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#0EA5E9","#8B5CF6","#EC4899","#14B8A6","#F97316","#64748B"];
const DATE_PRESETS = [
  { label:"Today",        from:isoDaysAgo(0),  to:isoDaysAgo(0)  },
  { label:"Yesterday",    from:isoDaysAgo(1),  to:isoDaysAgo(1)  },
  { label:"Last 7 days",  from:isoDaysAgo(7),  to:isoDaysAgo(0)  },
  { label:"Last 30 days", from:isoDaysAgo(30), to:isoDaysAgo(0)  },
  { label:"Last 90 days", from:isoDaysAgo(90), to:isoDaysAgo(0)  },
];

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Spark({ data, color }) {
  if (!data || data.length < 2) return null;
  const w=60,h=22, max=Math.max(1,...data);
  const pts = data.map((v,i)=>`${(i/(data.length-1))*w},${h-(v/max)*h}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-14 h-5 shrink-0"><polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" points={pts}/></svg>;
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function Kpi({ icon:Icon, label, value, tint, trend, spark }) {
  const up=trend!=null&&trend>0, dn=trend!=null&&trend<0;
  return (
    <div className="relative overflow-hidden bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-[0.06]" style={{background:tint}}/>
      <div className="flex items-center justify-between mb-2">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:`${tint}22`}}>
          <Icon className="w-4 h-4" style={{color:tint}}/>
        </span>
        {trend!=null&&<span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up?"bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30":dn?"bg-rose-50 text-rose-600 dark:bg-rose-950/30":"bg-slate-100 text-slate-400 dark:bg-white/5"}`}>
          {up?<TrendingUp className="w-2.5 h-2.5"/>:dn?<TrendingDown className="w-2.5 h-2.5"/>:<Minus className="w-2.5 h-2.5"/>}
          {Math.abs(trend)}%
        </span>}
      </div>
      <p className="text-[22px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-none mb-1">{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">{label}</p>
        <Spark data={spark} color={tint}/>
      </div>
    </div>
  );
}

// ── Area chart ─────────────────────────────────────────────────────────────────
function AreaChart({ series, points, height=190 }) {
  const [hov,setHov]=useState(null);
  const ref=useRef(null);
  const n=points.length;
  if(!n) return <p className="text-center text-[12px] text-[#8B92A9] py-10">No daily data</p>;
  const w=640,h=height,pL=36,pR=8,pT=10,pB=22;
  const mx=Math.max(1,...series.flatMap(s=>s.data));
  const x=i=>pL+(i/Math.max(1,n-1))*(w-pL-pR);
  const y=v=>h-pB-((v||0)/mx)*(h-pT-pB);
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${w} ${h}`} className="w-full" style={{height}} onMouseMove={e=>{const br=ref.current.getBoundingClientRect();setHov(Math.round(Math.min(1,Math.max(0,(e.clientX-br.left)/br.width))*(n-1)));}} onMouseLeave={()=>setHov(null)}>
        <defs>{series.map(s=><linearGradient key={s.key} id={`ag${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity="0.2"/><stop offset="100%" stopColor={s.color} stopOpacity="0"/></linearGradient>)}</defs>
        {[0,1,2,3,4].map(t=>{const gy=pT+(t/4)*(h-pT-pB);return<line key={t} x1={pL} y1={gy} x2={w-pR} y2={gy} stroke="currentColor" className="text-[#EEF0F6] dark:text-[#1A1D2A]" strokeWidth="1"/>;})}
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

// ── Donut ─────────────────────────────────────────────────────────────────────
function Donut({ data }) {
  const rows=(data||[]).filter(d=>(d.count||0)>0);
  const total=rows.reduce((s,d)=>s+d.count,0)||1;
  let acc=0; const R=52,C=2*Math.PI*R;
  if(!rows.length) return <p className="text-center text-[12px] text-[#8B92A9] py-8">No data</p>;
  return(
    <div className="flex items-center gap-4">
      <div className="relative w-[120px] h-[120px] shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full">
          <g transform="translate(70,70) rotate(-90)">
            <circle r={R} fill="none" stroke="currentColor" className="text-[#F1F3F9] dark:text-white/5" strokeWidth="14"/>
            {rows.map((d,i)=>{const frac=d.count/total;const el=<circle key={d.stage} r={R} fill="none" stroke={d.color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.max(0,frac*C-2)} ${C}`} strokeDashoffset={-acc*C}/>;acc+=frac;return el;})}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] text-[#8B92A9]">Total</span>
          <span className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#DDE1F5]">{num(total)}</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {rows.map((d,i)=><div key={d.stage} className="flex items-center gap-2 text-[11px]">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{background:d.color}}/>
          <span className="flex-1 text-[#4B5168] dark:text-[#9DA3BB]">{d.stage}</span>
          <span className="font-bold text-[#0F1117] dark:text-[#DDE1F5]">{num(d.count)}</span>
          <span className="text-[#8B92A9] w-9 text-right">{Math.round((d.count/total)*100)}%</span>
        </div>)}
      </div>
    </div>
  );
}

// ── Funnel ─────────────────────────────────────────────────────────────────────
function Funnel({ stages }) {
  const data=(stages||[]).filter(s=>s.count>0);
  if(!data.length) return <p className="text-center text-[12px] text-[#8B92A9] py-8">No data</p>;
  const max=data[0].count;
  return(
    <div className="space-y-2">
      {data.map((s,i)=>{const w=Math.max(20,(s.count/max)*100);const drop=i>0&&data[i-1].count>0?Math.round((1-s.count/data[i-1].count)*100):null;return(
        <div key={s.stage} className="flex items-center gap-3">
          <div className="flex-1 flex justify-center">
            <div className="h-9 rounded-xl flex items-center justify-center transition-all" style={{width:`${w}%`,background:s.color,minWidth:60}}>
              <span className="text-white text-[11px] font-bold">{num(s.count)}</span>
            </div>
          </div>
          <div className="w-36 shrink-0">
            <p className="text-[11px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{s.stage}</p>
            {drop!=null&&<p className="text-[10px] text-rose-500">▼ {drop}% drop-off</p>}
          </div>
        </div>
      );})}
    </div>
  );
}

// ── Rank bars ─────────────────────────────────────────────────────────────────
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

// ── Sortable table ────────────────────────────────────────────────────────────
function Table({ columns, rows }) {
  const [sort,setSort]=useState({key:columns[0].key,dir:"desc"});
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1); const PER=10;
  const toggle=k=>setSort(s=>s.key===k?{key:k,dir:s.dir==="asc"?"desc":"asc"}:{key:k,dir:"desc"});
  const filtered=useMemo(()=>{const q=search.toLowerCase();return(rows||[]).filter(r=>!q||columns.some(c=>String(r[c.key]||"").toLowerCase().includes(q)));},[rows,search,columns]);
  const sorted=useMemo(()=>{const arr=[...filtered];arr.sort((a,b)=>{let av=a[sort.key],bv=b[sort.key];if(typeof av==="string")return sort.dir==="asc"?av.localeCompare(bv):bv.localeCompare(av);av=av??-Infinity;bv=bv??-Infinity;return sort.dir==="asc"?av-bv:bv-av;});return arr;},[filtered,sort]);
  const pages=Math.ceil(sorted.length/PER);
  const paged=sorted.slice((page-1)*PER,page*PER);
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

function Panel({ title, icon:Icon, children, className="" }) {
  return(
    <div className={`bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3"><Icon className="w-4 h-4 text-[#8B92A9]"/><p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{title}</p></div>
      {children}
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
// ── Ad performance scoring ────────────────────────────────────────────────────
function scoreAd(m) {
  const ctr=Number(m.ctr)||0, freq=Number(m.frequency)||0, cpc=Number(m.cpc)||0;
  if(ctr>=2&&freq<=4) return{label:"Good",color:"#10B981",bg:"bg-emerald-50 dark:bg-emerald-950/20",icon:CheckCircle2};
  if(ctr>=1||(cpc>0&&freq<=6)) return{label:"Fair",color:"#F59E0B",bg:"bg-amber-50 dark:bg-amber-950/20",icon:Info};
  return{label:"Needs Attention",color:"#EF4444",bg:"bg-rose-50 dark:bg-rose-950/20",icon:AlertCircle};
}

function getTips(m,cr){
  const tips=[]; const ctr=Number(m.ctr)||0,freq=Number(m.frequency)||0,cpc=Number(m.cpc)||0,reach=Number(m.reach)||0,impr=Number(m.impressions)||0;
  if(ctr<1) tips.push("Low CTR (<1%) — try a stronger hook in your headline or use a more attention-grabbing image/video.");
  if(ctr>=3) tips.push("High CTR — ad is performing well. Consider increasing the budget to scale reach.");
  if(freq>5) tips.push(`High frequency (${Number(freq).toFixed(1)}×) — audience is seeing this too often. Refresh the creative or expand the audience.`);
  if(freq>8) tips.push("Severe audience fatigue — CPM is likely rising. Pause or rotate this ad creative urgently.");
  if(cpc>50) tips.push("High CPC — test different creatives or audience segments to reduce click cost.");
  if(reach>0&&impr>0&&(impr/reach)>6) tips.push("Very high frequency vs reach — widen your audience targeting.");
  if(!cr.headline&&!cr.body) tips.push("No creative copy detected — ensure the ad is properly set up in Meta Ads Manager.");
  if(cr.cta==="LEARN_MORE"&&ctr<1) tips.push("'Learn More' CTA with low CTR — try 'Sign Up', 'Get Quote', or 'Contact Us' for more direct action.");
  return tips.length?tips:["Ad is within normal range. Monitor frequency and CTR over time."];
}

// ── Meta ad row ───────────────────────────────────────────────────────────────
function MktAdRow({ad}){
  const[showCr,setShowCr]=useState(false);
  const[showTips,setShowTips]=useState(false);
  const m=ad.metrics||{},cr=ad.creative||{};
  const score=scoreAd(m),tips=getTips(m,cr),ScoreIcon=score.icon;
  const statusCls={"ACTIVE":"bg-emerald-50 text-emerald-700","PAUSED":"bg-amber-50 text-amber-700","CAMPAIGN_PAUSED":"bg-slate-100 text-slate-500","DELETED":"bg-rose-50 text-rose-600"}[ad.status]||"bg-slate-100 text-slate-500";
  return(
    <div className="px-4 py-3 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.015] transition-colors border-b border-[#F1F3F9] dark:border-white/5 last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] truncate">{ad.adName}</p>
          <p className="text-[10px] text-[#8B92A9] truncate">{ad.adsetName}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
          {ad.status&&<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusCls}`}>{ad.status.toLowerCase().replace(/_/g," ")}</span>}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${score.bg}`} style={{color:score.color}}><ScoreIcon className="w-3 h-3"/>{score.label}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 mb-2">
        {[["Spend",`₹${Number(m.spend||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`],["Impr.",Number(m.impressions||0).toLocaleString("en-IN")],["Reach",Number(m.reach||0).toLocaleString("en-IN")],["Clicks",Number(m.clicks||0).toLocaleString("en-IN")],["CTR",`${Number(m.ctr||0).toFixed(2)}%`],["CPM",`₹${Number(m.cpm||0).toFixed(2)}`],["CPC",`₹${Number(m.cpc||0).toFixed(2)}`],["Freq.",`${Number(m.frequency||0).toFixed(1)}×`]].map(([k,v])=>(
          <div key={k} className="bg-[#F8F9FC] dark:bg-white/5 rounded-lg px-2 py-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{k}</p>
            <p className="text-[11px] font-bold text-[#0F1117] dark:text-[#DDE1F5] tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {(cr.body||cr.headline||cr.thumbnail)&&<button onClick={()=>setShowCr(!showCr)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"><Image className="w-3 h-3"/>{showCr?"Hide creative":"View creative"}</button>}
        <button onClick={()=>setShowTips(!showTips)} className={`inline-flex items-center gap-1 text-[11px] font-semibold ${showTips?"text-amber-600":"text-[#8B92A9] hover:text-amber-600"}`}><Zap className="w-3 h-3"/>{showTips?"Hide tips":`${tips.length} tip${tips.length!==1?"s":""}`}</button>
        {cr.linkUrl&&<a href={cr.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:underline ml-auto"><ExternalLink className="w-3 h-3"/>{cr.linkUrl.replace(/^https?:\/\//,"").slice(0,30)}…</a>}
      </div>
      {showCr&&(cr.body||cr.headline||cr.thumbnail)&&(
        <div className="mt-2 p-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133]">
          <div className="flex gap-3">
            {cr.thumbnail&&<img src={cr.thumbnail} alt="Ad" className="w-16 h-16 object-cover rounded-lg shrink-0" onError={e=>{e.target.style.display="none";}}/>}
            <div className="flex-1 min-w-0 space-y-1">
              {cr.headline&&<p className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{cr.headline}</p>}
              {cr.body&&<p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed">{cr.body}</p>}
              {cr.cta&&<span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30"><Zap className="w-3 h-3"/>{cr.cta.replace(/_/g," ")}</span>}
            </div>
          </div>
        </div>
      )}
      {showTips&&(
        <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-800/30">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3"/>Improvement Suggestions</p>
          <ul className="space-y-1.5">{tips.map((t,i)=><li key={i} className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300"><span className="w-4 h-4 rounded-full bg-amber-200 dark:bg-amber-800/40 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>{t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ── Meta Campaigns Tab (primary view) ────────────────────────────────────────
function MetaCampaignRow({camp,idx}){
  const[open,setOpen]=useState(false);
  const m=camp.metrics||{};
  const isConfigured=camp.configured;
  const hasSpend=(m.spend||0)>0;
  const statusActive=camp.metaActive!==false&&camp.isActive!==false;

  // Performance rating
  const ctr=Number(m.ctr)||0, freq=Number(m.frequency)||0;
  const perf = ctr>=2&&freq<=4?"Good":ctr>=1?"Fair":"Needs Attention";
  const perfColor = perf==="Good"?"#10B981":perf==="Fair"?"#F59E0B":"#EF4444";
  const perfBg    = perf==="Good"?"bg-emerald-50 dark:bg-emerald-950/20":perf==="Fair"?"bg-amber-50 dark:bg-amber-950/20":"bg-rose-50 dark:bg-rose-950/20";
  const PerfIcon  = perf==="Good"?CheckCircle2:perf==="Fair"?Info:AlertCircle;

  const convRate=camp.leads>0?Math.round((camp.converted/camp.leads)*10000)/100:0;

  return(
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
      {/* Campaign header */}
      <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02] transition-colors" onClick={()=>setOpen(!open)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[13px] shrink-0"
          style={{background:COLORS[idx%COLORS.length]}}>{idx+1}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] truncate">{camp.campaignName}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {camp.category&&<span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">{camp.category}</span>}
            <p className="text-[10px] text-[#8B92A9] truncate">{camp.adSetName||"Campaign level"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusActive?"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30":"bg-slate-100 text-slate-500 dark:bg-white/5"}`}>
            {statusActive?"Active":"Paused"}
          </span>
          {isConfigured&&hasSpend&&(
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${perfBg}`} style={{color:perfColor}}>
              <PerfIcon className="w-3 h-3"/>{perf}
            </span>
          )}
          {open?<ChevronUp className="w-4 h-4 text-[#8B92A9]"/>:<ChevronDown className="w-4 h-4 text-[#8B92A9]"/>}
        </div>
      </div>

      {/* Metrics strip */}
      {isConfigured?(
        <div className="grid grid-cols-4 sm:grid-cols-8 bg-[#F8F9FC] dark:bg-[#0D0F14] border-t border-[#E4E7EF] dark:border-[#1E2133] divide-x divide-[#E4E7EF] dark:divide-[#1E2133]">
          {[
            ["Spend",    hasSpend?`₹${Number(m.spend).toLocaleString("en-IN",{maximumFractionDigits:0})}`:"—"],
            ["Impr.",    hasSpend?Number(m.impressions||0).toLocaleString("en-IN"):"—"],
            ["Reach",    hasSpend?Number(m.reach||0).toLocaleString("en-IN"):"—"],
            ["Clicks",   hasSpend?Number(m.clicks||0).toLocaleString("en-IN"):"—"],
            ["CTR",      hasSpend?`${Number(m.ctr||0).toFixed(2)}%`:"—"],
            ["CPM",      hasSpend?`₹${Number(m.cpm||0).toFixed(2)}`:"—"],
            ["Leads",    camp.leads||0],
            ["Converted",camp.converted||0],
          ].map(([k,v])=>(
            <div key={k} className="flex flex-col px-2 py-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{k}</span>
              <span className="text-[11px] font-bold text-[#0F1117] dark:text-[#DDE1F5] tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      ):(
        <div className="px-4 py-2 bg-[#F8F9FC] dark:bg-[#0D0F14] border-t border-[#E4E7EF] dark:border-[#1E2133]">
          <p className="text-[11px] text-[#8B92A9]">No ads_read token configured — add Ad Account ID + token to see metrics.</p>
        </div>
      )}

      {/* Expanded: CPL + Conv Rate + Issues + Suggestions */}
      {open&&(
        <div className="px-4 py-4 border-t border-[#E4E7EF] dark:border-[#1E2133] space-y-3">
          {/* CPL + Conv Rate KPIs */}
          {isConfigured&&(
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {label:"Cost per Lead",    value:camp.costPerLead?`₹${Number(camp.costPerLead).toLocaleString("en-IN",{maximumFractionDigits:2})}`:"—",tint:"#6366F1"},
                {label:"Conv. Rate",       value:camp.leads>0?`${convRate}%`:"—",tint:"#10B981"},
                {label:"Cost per Conv.",   value:camp.costPerConversion?`₹${Number(camp.costPerConversion).toLocaleString("en-IN",{maximumFractionDigits:2})}`:"—",tint:"#F59E0B"},
                {label:"Frequency",        value:hasSpend?`${Number(m.frequency||0).toFixed(1)}×`:"—",tint:Number(m.frequency)>5?"#EF4444":"#0EA5E9"},
              ].map(c=>(
                <div key={c.label} className="rounded-xl p-3 border border-[#E4E7EF] dark:border-[#1E2133]" style={{background:`${c.tint}0D`}}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{c.label}</p>
                  <p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#DDE1F5]">{c.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Setup issues */}
          {camp.issues&&camp.issues.length>0&&(
            <div className="space-y-1.5">
              {camp.issues.map((issue,i)=>(
                <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-xl text-[11px] ${issue.level==="error"?"bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400":issue.level==="warn"?"bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400":"bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400"}`}>
                  {issue.level==="error"?<AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>:issue.level==="warn"?<AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>:<Info className="w-3.5 h-3.5 shrink-0 mt-0.5"/>}
                  {issue.msg}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetaCampaignsTab({from,to}){
  const[data,setData]=useState(null);
  const[loading,setLoad]=useState(false);
  const[error,setError]=useState("");
  const[aiLoading,setAiLoad]=useState(false);
  const[catFilter,setCatFilter]=useState(""); // category filter

  const load=useCallback(async(withAI=false)=>{
    withAI?setAiLoad(true):setLoad(true);setError("");
    try{
      const{data:d}=await mktApi.get("/meta-insights",{params:{from,to,ai:withAI?"true":"false"},timeout:withAI?70000:30000});
      setData(d);
    }catch(e){setError(e?.response?.data?.message||"Failed to load Meta campaign data.");}
    finally{withAI?setAiLoad(false):setLoad(false);}
  },[from,to]);

  useEffect(()=>{load(false);},[load]);

  const allCamps=data?.campaigns||[];
  // All distinct categories for filter
  const categories=useMemo(()=>{
    const cats=new Set(allCamps.map(c=>c.category||"").filter(Boolean));
    return Array.from(cats).sort();
  },[allCamps]);

  // Filter by selected category
  const camps=useMemo(()=>catFilter?allCamps.filter(c=>(c.category||"")=== catFilter):allCamps,[allCamps,catFilter]);

  // Group camps by category for grouped view
  const byCategory=useMemo(()=>{
    const map={};
    camps.forEach(c=>{const k=c.category||"Uncategorised";if(!map[k])map[k]=[];map[k].push(c);});
    return Object.entries(map).sort((a,b)=>a[0]==="Uncategorised"?1:b[0]==="Uncategorised"?-1:a[0].localeCompare(b[0]));
  },[camps]);

  const t=data?.totals||{};
  const configured=allCamps.filter(c=>c.configured&&c.metrics&&(c.metrics.spend||0)>0);
  const ai=data?.aiAnalysis;

  if(loading&&!data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#8B92A9]"/></div>;
  if(error) return <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 text-rose-600 text-[12px]"><AlertTriangle className="w-4 h-4 shrink-0"/>{error}</div>;

  return(
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
          <BarChart3 className="w-4 h-4 text-white"/>
        </div>
        <div>
          <p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-tight">Meta Campaign Performance</p>
          <p className="text-[11px] text-[#8B92A9]">Spend · reach · CTR · leads · conversions · CPL per campaign</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={()=>load(false)} disabled={loading||aiLoading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] text-[11px] font-semibold text-[#8B92A9] hover:text-indigo-600">
            {loading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<RefreshCw className="w-3.5 h-3.5"/>} Refresh
          </button>
          <button onClick={()=>load(true)} disabled={loading||aiLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold">
            {aiLoading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Zap className="w-3.5 h-3.5"/>} Generate AI Analysis
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {data&&(t.spend>0||t.leads>0)&&(
        <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white shadow-md">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1.5">{camps.length} campaign configs · {from} → {to}</p>
          <p className="text-[13px] leading-relaxed">
            Spent <b>₹{Number(t.spend||0).toLocaleString("en-IN",{maximumFractionDigits:0})}</b> reaching <b>{Number(t.reach||0).toLocaleString("en-IN")}</b> people,
            generating <b>{t.leads||0} leads</b> at <b>₹{t.costPerLead||"—"}/lead</b> with <b>{t.converted||0} conversions</b> ({t.conversionRatePct||0}% conv. rate).
          </p>
        </div>
      )}

      {/* KPIs */}
      {data&&(t.spend>0||t.leads>0)&&(
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            {icon:IndianRupee,label:"Total Spend",    value:`₹${Number(t.spend||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`,tint:"#EF4444"},
            {icon:Eye,        label:"Impressions",    value:Number(t.impressions||0).toLocaleString("en-IN"),tint:"#6366F1"},
            {icon:Users,      label:"Reach",          value:Number(t.reach||0).toLocaleString("en-IN"),tint:"#10B981"},
            {icon:MousePointerClick,label:"Clicks",   value:Number(t.clicks||0).toLocaleString("en-IN"),tint:"#0EA5E9"},
            {icon:Target,     label:"Leads",          value:t.leads||0,tint:"#F59E0B"},
            {icon:CheckCircle2,label:"Converted",     value:t.converted||0,tint:"#10B981"},
            {icon:IndianRupee,label:"Cost per Lead",  value:t.costPerLead?`₹${t.costPerLead}`:"—",tint:"#8B5CF6"},
            {icon:Percent,    label:"Conv. Rate",     value:t.conversionRatePct!=null?`${t.conversionRatePct}%`:"—",tint:"#EC4899"},
          ].map(c=>(
            <div key={c.label} className="relative overflow-hidden bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-3.5 hover:shadow-md transition-all" style={{background:`linear-gradient(135deg,${c.tint}12 0%,transparent 70%)`}}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background:`${c.tint}22`}}><c.icon className="w-3.5 h-3.5" style={{color:c.tint}}/></span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9]">{c.label}</span>
              </div>
              <p className="text-[18px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Category-wise spend breakdown */}
      {data&&byCategory.length>1&&(()=>{
        // Compute per-category totals
        const catStats=byCategory.map(([cat,catCamps])=>({
          cat,
          spend:  catCamps.reduce((s,c)=>s+(c.metrics&&c.metrics.spend||0),0),
          leads:  catCamps.reduce((s,c)=>s+(c.leads||0),0),
          conv:   catCamps.reduce((s,c)=>s+(c.converted||0),0),
          impr:   catCamps.reduce((s,c)=>s+(c.metrics&&c.metrics.impressions||0),0),
          clicks: catCamps.reduce((s,c)=>s+(c.metrics&&c.metrics.clicks||0),0),
          count:  catCamps.length,
        })).filter(c=>c.spend>0||c.leads>0).sort((a,b)=>b.spend-a.spend);
        if(!catStats.length) return null;
        const maxSpend=Math.max(1,...catStats.map(c=>c.spend));
        const totalSpend=catStats.reduce((s,c)=>s+c.spend,0)||1;
        return(
          <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Category-wise Performance</p>
                <p className="text-[10px] text-[#8B92A9] mt-0.5">Spend distribution across {catStats.length} categories</p>
              </div>
            </div>
            <div className="space-y-3">
              {catStats.map((c,i)=>{
                const convRate=c.leads>0?Math.round((c.conv/c.leads)*10000)/100:0;
                const cpl=c.leads>0?Math.round((c.spend/c.leads)*100)/100:null;
                const spendPct=Math.round((c.spend/totalSpend)*100);
                const barW=Math.max(2,(c.spend/maxSpend)*100);
                return(
                  <div key={c.cat} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:COLORS[i%COLORS.length]}}/>
                        <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] truncate">{c.cat}</span>
                        <span className="text-[10px] text-[#8B92A9] shrink-0">{c.count} campaign{c.count!==1?"s":""}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">₹{Number(c.spend).toLocaleString("en-IN",{maximumFractionDigits:0})}</p>
                          <p className="text-[9px] text-[#8B92A9]">{spendPct}% of spend</p>
                        </div>
                        <div className="hidden sm:block">
                          <p className="text-[12px] font-bold text-blue-600">{c.leads}</p>
                          <p className="text-[9px] text-[#8B92A9]">Leads</p>
                        </div>
                        <div className="hidden md:block">
                          <p className="text-[12px] font-bold text-emerald-600">{c.conv}</p>
                          <p className="text-[9px] text-[#8B92A9]">Converted</p>
                        </div>
                        <div className="hidden md:block">
                          <p className="text-[12px] font-bold" style={{color:convRate>=10?"#10B981":convRate>=5?"#F59E0B":"#EF4444"}}>{convRate}%</p>
                          <p className="text-[9px] text-[#8B92A9]">Conv%</p>
                        </div>
                        {cpl&&<div className="hidden lg:block">
                          <p className="text-[12px] font-bold text-purple-600">₹{Number(cpl).toLocaleString("en-IN",{maximumFractionDigits:0})}</p>
                          <p className="text-[9px] text-[#8B92A9]">CPL</p>
                        </div>}
                      </div>
                    </div>
                    {/* Spend bar */}
                    <div className="h-2.5 rounded-full bg-[#F1F3F9] dark:bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{width:`${barW}%`,background:`linear-gradient(90deg,${COLORS[i%COLORS.length]}CC,${COLORS[i%COLORS.length]})`}}/>
                    </div>
                    {/* Mini metrics strip */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {c.impr>0&&<span className="text-[10px] text-[#8B92A9]">👁 {Number(c.impr).toLocaleString("en-IN")} impressions</span>}
                      {c.clicks>0&&<span className="text-[10px] text-[#8B92A9]">🖱 {Number(c.clicks).toLocaleString("en-IN")} clicks</span>}
                      {c.impr>0&&c.clicks>0&&<span className="text-[10px] text-[#8B92A9]">CTR {((c.clicks/c.impr)*100).toFixed(2)}%</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* AI Analysis panel */}
      {data&&(
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[#E4E7EF] dark:border-[#1E2133] bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-white"/>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">AI Campaign Analysis & Suggestions</p>
              <p className="text-[10px] text-[#8B92A9]">Click "Generate AI Analysis" to get insights and improvement recommendations</p>
            </div>
          </div>
          <div className="p-5">
            {aiLoading&&<div className="flex flex-col items-center py-10 gap-3"><Loader2 className="w-6 h-6 animate-spin text-indigo-500"/><p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">Analysing campaigns…</p><p className="text-[11px] text-[#8B92A9]">This takes 10–20 seconds</p></div>}
            {!aiLoading&&!ai&&<div className="flex flex-col items-center py-8 text-center"><Zap className="w-8 h-8 text-[#C4C9DA] mb-2"/><p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">No analysis yet</p><p className="text-[12px] text-[#8B92A9] mt-0.5">Click "Generate AI Analysis" above to get recommendations.</p></div>}
            {!aiLoading&&ai&&(
              <div className="space-y-4">
                {ai.summary&&<div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 border border-indigo-100 dark:border-indigo-900/40 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-1.5 flex items-center gap-1"><Star className="w-3 h-3"/>Summary</p><p className="text-[13px] text-[#334155] dark:text-[#CBD5E1] leading-relaxed">{ai.summary}</p></div>}
                <div className="grid md:grid-cols-2 gap-3">
                  {ai.topPerformers&&ai.topPerformers.length>0&&<div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3"/>Top Performers</p><ul className="space-y-2">{ai.topPerformers.map((p,i)=><li key={i} className="text-[12px] text-[#334155] dark:text-[#CBD5E1]"><span className="font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{p.campaign}:</span> {p.why}</li>)}</ul></div>}
                  {ai.underperformers&&ai.underperformers.length>0&&<div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-2 flex items-center gap-1"><TrendingDown className="w-3 h-3"/>Needs Attention</p><ul className="space-y-2">{ai.underperformers.map((p,i)=><li key={i} className="text-[12px] text-[#334155] dark:text-[#CBD5E1]"><span className="font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{p.campaign}:</span> {p.issue}</li>)}</ul></div>}
                </div>
                {ai.suggestions&&ai.suggestions.length>0&&<div className="rounded-xl bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-800/30 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1"><Zap className="w-3 h-3"/>Improvement Suggestions</p><ul className="space-y-2">{ai.suggestions.map((s,i)=><li key={i} className="flex items-start gap-2 text-[12px] text-[#4B5168] dark:text-[#9DA3BB]"><span className="w-4 h-4 rounded-full bg-amber-200 dark:bg-amber-800/40 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>{s}</li>)}</ul></div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Campaign cards — grouped by category */}
      {data&&(
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{camps.length} Campaign Configs</p>
            {/* Category filter */}
            {categories.length>0&&(
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                <span className="text-[11px] text-[#8B92A9]">Category:</span>
                <button onClick={()=>setCatFilter("")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${!catFilter?"bg-indigo-600 text-white":"bg-[#F1F3F9] dark:bg-white/5 text-[#4B5168] dark:text-[#9DA3BB] hover:bg-indigo-50"}`}>
                  All
                </button>
                {categories.map(cat=>(
                  <button key={cat} onClick={()=>setCatFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${catFilter===cat?"bg-indigo-600 text-white":"bg-[#F1F3F9] dark:bg-white/5 text-[#4B5168] dark:text-[#9DA3BB] hover:bg-indigo-50"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-[#8B92A9]">{configured.length} with data · Click to expand</p>
          </div>
          {camps.length===0&&<div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-10 text-center"><BarChart3 className="w-8 h-8 text-[#C4C9DA] mx-auto mb-3" strokeWidth={1.5}/><p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">No Meta campaigns configured</p><p className="text-[12px] text-[#8B92A9] mt-1">Add campaigns in the CRM Campaigns section to see performance here.</p></div>}
          {/* Render grouped by category */}
          {byCategory.map(([cat,catCamps])=>(
            <div key={cat}>
              {byCategory.length>1&&(
                <div className="flex items-center gap-2 py-1.5">
                  <div className="h-px flex-1 bg-[#E4E7EF] dark:bg-[#1E2133]"/>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                    {cat} · {catCamps.length} campaign{catCamps.length!==1?"s":""}
                  </span>
                  <div className="h-px flex-1 bg-[#E4E7EF] dark:bg-[#1E2133]"/>
                </div>
              )}
              {catCamps.map((camp,i)=><MetaCampaignRow key={camp.configId||i} camp={camp} idx={i}/>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function MetaCampaignCard({name,ads,ci}){
  const[open,setOpen]=useState(false);
  const spend=ads.reduce((s,a)=>s+(a.metrics.spend||0),0);
  const impr=ads.reduce((s,a)=>s+(a.metrics.impressions||0),0);
  const clicks=ads.reduce((s,a)=>s+(a.metrics.clicks||0),0);
  const reach=ads.reduce((s,a)=>s+(a.metrics.reach||0),0);
  const ctrC=impr>0?(clicks/impr)*100:0;
  const active=ads.filter(a=>a.status==="ACTIVE").length;
  const goodC=ads.filter(a=>scoreAd(a.metrics).label==="Good").length;
  const needsC=ads.filter(a=>scoreAd(a.metrics).label==="Needs Attention").length;
  const campScore=scoreAd({ctr:ctrC,cpc:clicks>0?spend/clicks:0,frequency:0});
  const CampScoreIcon=campScore.icon;
  return(
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02]" onClick={()=>setOpen(!open)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[13px] shrink-0" style={{background:COLORS[ci%COLORS.length]}}>{ci+1}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] truncate">{name}</p>
          <p className="text-[10px] text-[#8B92A9]">{ads.length} ads · {active} active · <span className="text-emerald-600">{goodC} good</span> · <span className="text-rose-500">{needsC} need attention</span></p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block"><p className="text-[12px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">₹{Number(spend).toLocaleString("en-IN",{maximumFractionDigits:0})}</p><p className="text-[9px] text-[#8B92A9]">Spent</p></div>
          <div className="text-right hidden md:block"><p className="text-[12px] font-bold" style={{color:ctrC>=2?"#10B981":ctrC>=1?"#F59E0B":"#EF4444"}}>{ctrC.toFixed(2)}%</p><p className="text-[9px] text-[#8B92A9]">CTR</p></div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${campScore.bg}`} style={{color:campScore.color}}><CampScoreIcon className="w-3 h-3"/>{campScore.label}</span>
          {open?<ChevronUp className="w-4 h-4 text-[#8B92A9]"/>:<ChevronDown className="w-4 h-4 text-[#8B92A9]"/>}
        </div>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 bg-[#F8F9FC] dark:bg-[#0D0F14] border-t border-[#E4E7EF] dark:border-[#1E2133] divide-x divide-[#E4E7EF] dark:divide-[#1E2133]">
        {[["Spend",`₹${Number(spend).toLocaleString("en-IN",{maximumFractionDigits:0})}`],["Impressions",Number(impr).toLocaleString("en-IN")],["Reach",Number(reach).toLocaleString("en-IN")],["Clicks",Number(clicks).toLocaleString("en-IN")],["CTR",`${ctrC.toFixed(2)}%`],["CPM",`₹${impr>0?(spend/impr*1000).toFixed(2):0}`],["CPC",`₹${clicks>0?(spend/clicks).toFixed(2):0}`],["Ads",ads.length]].map(([k,v])=>(
          <div key={k} className="flex flex-col px-2 py-2"><span className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-0.5">{k}</span><span className="text-[11px] font-bold text-[#0F1117] dark:text-[#DDE1F5] tabular-nums">{v}</span></div>
        ))}
      </div>
      {open&&<div>{ads.map((ad,ai)=><MktAdRow key={ad.adId||ai} ad={ad}/>)}</div>}
    </div>
  );
}

// ── Meta Ads tab ─────────────────────────────────────────────────────────────
function MetaAdsTab({from,to}){
  const[data,setData]=useState(null);
  const[loading,setLoad]=useState(false);
  const[error,setError]=useState("");
  const[view,setView]=useState("campaigns"); // campaigns | table
  const[search,setSearch]=useState("");

  const load=useCallback(async()=>{
    setLoad(true);setError("");
    try{const{data:d}=await mktApi.get("/meta-ad-level",{params:{from,to}});setData(d);}
    catch(e){setError(e?.response?.data?.message||"Failed to load Meta ad data.");}
    finally{setLoad(false);}
  },[from,to]);

  useEffect(()=>{load();},[load]);

  const byCampaign=useMemo(()=>{
    const map={};
    (data?.ads||[]).forEach(a=>{const k=a.campaignName||"Unknown";if(!map[k])map[k]=[];map[k].push(a);});
    return Object.entries(map).sort((a,b)=>b[1].reduce((s,x)=>s+(x.metrics.spend||0),0)-a[1].reduce((s,x)=>s+(x.metrics.spend||0),0));
  },[data]);

  const filtered=useMemo(()=>(data?.ads||[]).filter(a=>!search||a.adName.toLowerCase().includes(search.toLowerCase())||(a.campaignName||"").toLowerCase().includes(search.toLowerCase())),[data,search]);
  const t=data?.totals||{};
  const ctr=t.impressions>0?((t.clicks/t.impressions)*100).toFixed(2):0;
  const goodAds=(data?.ads||[]).filter(a=>scoreAd(a.metrics).label==="Good").length;
  const needsAds=(data?.ads||[]).filter(a=>scoreAd(a.metrics).label==="Needs Attention").length;
  const COLORS=["#6366F1","#10B981","#F59E0B","#EF4444","#0EA5E9","#8B5CF6","#EC4899","#14B8A6"];

  if(loading&&!data) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#8B92A9]"/></div>;
  if(error) return <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 text-rose-600 text-[12px]"><AlertTriangle className="w-4 h-4 shrink-0"/>{error}</div>;
  if(data&&!data.configured) return <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-10 text-center"><BarChart3 className="w-8 h-8 text-[#C4C9DA] mx-auto mb-3" strokeWidth={1.5}/><p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] mb-1">No Meta ad accounts configured</p><p className="text-[12px] text-[#8B92A9]">Add an Ad Account ID + ads_read token to a Meta campaign config in the CRM.</p></div>;
  if(!data) return null;

  return(
    <div className="space-y-4">
      {/* Summary strip */}
      {t.spend>0&&(
        <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">{data.ads.length} ads · {byCampaign.length} campaigns · {data.range?.from} → {data.range?.to}</p>
          <p className="text-[13px] leading-relaxed">
            Spent <b>₹{Number(t.spend).toLocaleString("en-IN",{maximumFractionDigits:0})}</b> reaching <b>{Number(t.reach).toLocaleString("en-IN")}</b> people with <b>{Number(t.impressions).toLocaleString("en-IN")}</b> impressions and <b>{Number(t.clicks).toLocaleString("en-IN")}</b> clicks (<b>{ctr}% CTR</b>).{" "}
            <span className="text-emerald-300 font-bold">{goodAds} ads</span> performing well · <span className="text-rose-300 font-bold">{needsAds} ads</span> need attention.
          </p>
        </div>
      )}

      {/* KPIs */}
      {t.spend>0&&(
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            {icon:IndianRupee,label:"Spend",value:"₹"+Number(t.spend).toLocaleString("en-IN",{maximumFractionDigits:0}),tint:"#EF4444"},
            {icon:Eye,label:"Impressions",value:Number(t.impressions).toLocaleString("en-IN"),tint:"#6366F1"},
            {icon:Users,label:"Reach",value:Number(t.reach).toLocaleString("en-IN"),tint:"#10B981"},
            {icon:MousePointerClick,label:"Clicks",value:Number(t.clicks).toLocaleString("en-IN"),tint:"#0EA5E9"},
            {icon:Percent,label:"CTR",value:`${ctr}%`,tint:"#F59E0B"},
            {icon:BarChart3,label:"Campaigns",value:byCampaign.length,tint:"#8B5CF6"},
            {icon:CheckCircle2,label:"Good Ads",value:goodAds,tint:"#10B981"},
            {icon:AlertCircle,label:"Need Attention",value:needsAds,tint:"#EF4444"},
          ].map(c=>(
            <div key={c.label} className="relative overflow-hidden bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-3.5 hover:shadow-md transition-all" style={{background:`linear-gradient(135deg,${c.tint}14 0%,transparent 70%)`}}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{background:`${c.tint}22`}}><c.icon className="w-3.5 h-3.5" style={{color:c.tint}}/></span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9]">{c.label}</span>
              </div>
              <p className="text-[18px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* View toggle + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Ad Details</p>
        <div className="flex gap-1 bg-[#F1F3F9] dark:bg-white/5 rounded-xl p-1">
          {[["campaigns","By Campaign"],["table","All Ads"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${view===v?"bg-white dark:bg-[#11131C] text-indigo-600 shadow-sm":"text-[#8B92A9] hover:text-[#4B5168]"}`}>{l}</button>
          ))}
        </div>
        {view==="table"&&(
          <div className="relative ml-2">
            <Search className="w-3.5 h-3.5 text-[#8B92A9] absolute left-2.5 top-1/2 -translate-y-1/2"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" className="text-[11px] pl-8 pr-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5] w-44"/>
          </div>
        )}
        <button onClick={load} disabled={loading} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] text-[11px] font-semibold text-[#8B92A9] hover:text-indigo-600">
          {loading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<RefreshCw className="w-3.5 h-3.5"/>}
        </button>
      </div>

      {/* Campaign view */}
      {view==="campaigns"&&(
        <div className="space-y-3">
          {byCampaign.length===0&&<div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-10 text-center text-[12px] text-[#8B92A9]">No ads in this period. Try a wider date range.</div>}
          {byCampaign.map(([name,ads],ci)=>(
            <MetaCampaignCard key={name+ci} name={name} ads={ads} ci={ci}/>
          ))}
        </div>
      )}

      {/* Table view */}
      {view==="table"&&(
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
              {["Ad","Campaign","Status","Score","Spend","Impr.","Clicks","CTR","CPC","Freq."].map(h=><th key={h} className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((ad,i)=>{
                const m=ad.metrics||{},sc=scoreAd(m),SI=sc.icon;
                const stCls={"ACTIVE":"bg-emerald-50 text-emerald-700","PAUSED":"bg-amber-50 text-amber-700","CAMPAIGN_PAUSED":"bg-slate-100 text-slate-500","DELETED":"bg-rose-50 text-rose-600"}[ad.status]||"bg-slate-100 text-slate-500";
                return(
                  <tr key={ad.adId||i} className="border-b border-[#F1F3F9] dark:border-white/5 last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] max-w-[150px] truncate" title={ad.adName}>{ad.adName}</td>
                    <td className="px-3 py-2.5 text-[11px] text-[#8B92A9] max-w-[120px] truncate">{ad.campaignName}</td>
                    <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${stCls}`}>{(ad.status||"").toLowerCase().replace(/_/g," ")}</span></td>
                    <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg}`} style={{color:sc.color}}><SI className="w-3 h-3"/>{sc.label}</span></td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-semibold text-[#0F1117] dark:text-[#DDE1F5]">₹{Number(m.spend||0).toLocaleString("en-IN",{maximumFractionDigits:0})}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[#8B92A9]">{Number(m.impressions||0).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[#8B92A9]">{Number(m.clicks||0).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-bold" style={{color:Number(m.ctr)>=2?"#10B981":Number(m.ctr)>=1?"#F59E0B":"#EF4444"}}>{Number(m.ctr||0).toFixed(2)}%</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[#8B92A9]">₹{Number(m.cpc||0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-bold" style={{color:Number(m.frequency)>5?"#EF4444":Number(m.frequency)>3?"#F59E0B":"#10B981"}}>{Number(m.frequency||0).toFixed(1)}×</td>
                  </tr>
                );
              })}
              {!filtered.length&&<tr><td colSpan={10} className="px-3 py-8 text-center text-[12px] text-[#8B92A9]">No ads match</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Campaign ad-level card (own component so useState is valid) ───────────────
const CAMP_COLORS=["#6366F1","#10B981","#F59E0B","#EF4444","#0EA5E9","#8B5CF6"];
function CampaignAdCard({camp,ci}){
  const[open,setOpen]=useState(false);
  return(
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02] transition-colors" onClick={()=>setOpen(!open)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[13px] shrink-0"
          style={{background:CAMP_COLORS[ci%CAMP_COLORS.length]}}>{ci+1}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5] truncate">{camp.campaign}</p>
          <p className="text-[10px] text-[#8B92A9]">{camp.adSets.length} ad set{camp.adSets.length!==1?"s":""} · {camp.total} total leads</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[16px] font-extrabold text-emerald-600">{camp.converted}</p>
            <p className="text-[9px] text-[#8B92A9] uppercase tracking-wide">Converted</p>
          </div>
          <div className="text-right">
            <p className="text-[16px] font-extrabold text-[#0F1117] dark:text-[#DDE1F5]">{camp.convRate}%</p>
            <p className="text-[9px] text-[#8B92A9] uppercase tracking-wide">Conv. Rate</p>
          </div>
          {open?<ChevronUp className="w-4 h-4 text-[#8B92A9]"/>:<ChevronDown className="w-4 h-4 text-[#8B92A9]"/>}
        </div>
      </div>
      <div className="px-4 pb-3">
        <ConvBar total={camp.total} converted={camp.converted}
          inProgress={camp.adSets.reduce((s,a)=>s+(a.inProgress||0),0)}
          notInt={camp.adSets.reduce((s,a)=>s+(a.notInt||0),0)}/>
      </div>
      {open&&(
        <div className="border-t border-[#E4E7EF] dark:border-[#1E2133]">
          <div className="grid grid-cols-8 bg-[#F8F9FC] dark:bg-[#0D0F14] px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] gap-2">
            <div className="col-span-2">Ad Set / Source</div>
            <div className="text-center">Total</div>
            <div className="text-center text-blue-600">New</div>
            <div className="text-center text-amber-600">In Progress</div>
            <div className="text-center text-purple-600">Verif.</div>
            <div className="text-center text-emerald-600">Converted</div>
            <div className="text-center text-rose-500">Not Int.</div>
          </div>
          {camp.adSets.map((adSet,ai)=>(
            <div key={ai} className="border-t border-[#F1F3F9] dark:border-white/5">
              <div className="grid grid-cols-8 px-4 py-3 gap-2 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.015] transition-colors">
                <div className="col-span-2">
                  <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] truncate">{adSet.adSet||"—"}</p>
                  <p className="text-[10px] text-[#8B92A9]">{adSet.source}</p>
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-extrabold text-[#0F1117] dark:text-[#DDE1F5]">{adSet.total}</p>
                  <p className="text-[9px] font-bold text-[#8B92A9]">{adSet.convRate}% conv</p>
                </div>
                <div className="text-center"><p className="text-[14px] font-bold text-blue-600">{adSet.newLeads}</p></div>
                <div className="text-center"><p className="text-[14px] font-bold text-amber-600">{adSet.inProgress}</p></div>
                <div className="text-center"><p className="text-[14px] font-bold text-purple-600">{adSet.verif}</p></div>
                <div className="text-center"><p className="text-[16px] font-extrabold text-emerald-600">{adSet.converted}</p></div>
                <div className="text-center"><p className="text-[14px] font-bold text-rose-500">{adSet.notInt}</p></div>
              </div>
              <div className="px-4 pb-2">
                <ConvBar total={adSet.total} converted={adSet.converted} inProgress={adSet.inProgress} notInt={adSet.notInt}/>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


const STATUS_COLOR = {
  "New":             { bg:"bg-blue-50 text-blue-700 dark:bg-blue-950/30",     dot:"#3B82F6" },
  "In Progress":     { bg:"bg-amber-50 text-amber-700 dark:bg-amber-950/30",  dot:"#F59E0B" },
  "Converted":       { bg:"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30", dot:"#10B981" },
  "Not Interested":  { bg:"bg-rose-50 text-rose-700 dark:bg-rose-950/30",     dot:"#EF4444" },
  "Verification":    { bg:"bg-purple-50 text-purple-700 dark:bg-purple-950/30",dot:"#8B5CF6" },
};

function StatusBadge({status}){
  const s=STATUS_COLOR[status]||{bg:"bg-slate-100 text-slate-500",dot:"#94A3B8"};
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${s.bg}`}>{status||"—"}</span>;
}

function ConvBar({total,converted,inProgress,notInt}){
  if(!total) return null;
  const pct=v=>Math.round((v/total)*100);
  const segs=[
    {v:converted,  color:"#10B981",label:"Converted"},
    {v:inProgress, color:"#F59E0B",label:"In Progress"},
    {v:notInt,     color:"#EF4444",label:"Not Interested"},
  ];
  return(
    <div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px bg-[#F1F3F9] dark:bg-white/5">
        {segs.map(s=>s.v>0&&<div key={s.label} className="rounded-full" style={{width:`${pct(s.v)}%`,background:s.color}}/>)}
      </div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {segs.map(s=><span key={s.label} className="inline-flex items-center gap-1 text-[9px] text-[#8B92A9]">
          <span className="w-1.5 h-1.5 rounded-full" style={{background:s.color}}/>{s.label}: <b className="text-[#4B5168] dark:text-[#9DA3BB]">{s.v}</b> ({pct(s.v)}%)
        </span>)}
      </div>
    </div>
  );
}

function LeadsIntelligenceTab({from,to}){
  const[data,setData]=useState(null);
  const[loading,setLoad]=useState(false);
  const[error,setError]=useState("");
  const[view,setView]=useState("adlevel"); // adlevel | converting | all
  const[campFilter,setCampFilter]=useState("");
  const[statusFilter,setStatusFilter]=useState("");
  const[search,setSearch]=useState("");

  const load=useCallback(async()=>{
    setLoad(true);setError("");
    try{
      const p={};
      if(from)p.from=from; if(to)p.to=to;
      if(campFilter)p.campaign=campFilter;
      if(statusFilter)p.status=statusFilter;
      const{data:d}=await mktApi.get("/leads-intelligence",{params:p});
      setData(d);
    }catch(e){setError(e?.response?.data?.message||"Failed to load leads data.");}
    finally{setLoad(false);}
  },[from,to,campFilter,statusFilter]);

  useEffect(()=>{load();},[load]);

  const filteredLeads=useMemo(()=>{
    const src=view==="converting"?(data?.convertedLeads||[]):(data?.allLeads||[]);
    if(!search)return src;
    const q=search.toLowerCase();
    return src.filter(l=>l.name.toLowerCase().includes(q)||l.mobile.includes(q)||(l.campaign||"").toLowerCase().includes(q)||(l.adSet||"").toLowerCase().includes(q));
  },[data,view,search]);

  const totals=useMemo(()=>{
    const leads=data?.allLeads||[];
    return{
      total:leads.length,
      converted:leads.filter(l=>l.status==="Converted").length,
      inProgress:leads.filter(l=>l.status==="In Progress").length,
      notInt:leads.filter(l=>l.status==="Not Interested").length,
      newLeads:leads.filter(l=>l.status==="New").length,
    };
  },[data]);

  if(loading&&!data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#8B92A9]"/></div>;
  if(error) return <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 text-rose-600 text-[12px]"><AlertTriangle className="w-4 h-4 shrink-0"/>{error}</div>;

  return(
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
          <Target className="w-4 h-4 text-white"/>
        </div>
        <div>
          <p className="text-[15px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-tight">Leads Intelligence</p>
          <p className="text-[11px] text-[#8B92A9]">Ad-level lead attribution · conversion tracking · lead details</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <select value={campFilter} onChange={e=>{setCampFilter(e.target.value);}}
            className="text-[11px] bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2.5 py-1.5 focus:outline-none text-[#4B5168] dark:text-[#9DA3BB]">
            <option value="">All campaigns</option>
            {(data?.filters?.campaigns||[]).map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold">
            {loading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<RefreshCw className="w-3.5 h-3.5"/>}
          </button>
        </div>
      </div>

      {/* KPI summary */}
      {data&&(
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            {label:"Total Leads",  value:totals.total,     tint:"#6366F1"},
            {label:"New",          value:totals.newLeads,  tint:"#3B82F6"},
            {label:"In Progress",  value:totals.inProgress,tint:"#F59E0B"},
            {label:"Converted",    value:totals.converted, tint:"#10B981"},
            {label:"Not Interested",value:totals.notInt,   tint:"#EF4444"},
          ].map(c=>(
            <div key={c.label} className="relative overflow-hidden bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-3" style={{background:`linear-gradient(135deg,${c.tint}12 0%,transparent 70%)`}}>
              <p className="text-[20px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{c.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] mt-0.5">{c.label}</p>
              <div className="absolute right-3 top-3 w-2 h-2 rounded-full" style={{background:c.tint}}/>
            </div>
          ))}
        </div>
      )}

      {/* Conversion summary strip */}
      {data&&totals.total>0&&(
        <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">{data.range?.from} → {data.range?.to}</p>
          <p className="text-[13px] leading-relaxed">
            <b>{totals.total}</b> leads generated — <b className="text-emerald-200">{totals.converted} converted</b> ({totals.total>0?Math.round((totals.converted/totals.total)*100):0}% conversion rate), <b>{totals.inProgress}</b> in progress, <b className="text-rose-300">{totals.notInt}</b> not interested.
          </p>
        </div>
      )}

      {/* View tabs */}
      <div className="flex gap-1 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-1">
        {[["adlevel","Ad-Level Breakdown"],["converting","Converting Leads"],["all","All Leads"]].map(([v,l])=>(
          <button key={v} onClick={()=>{setView(v);setSearch("");}}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${view===v?"bg-indigo-600 text-white shadow":"text-[#8B92A9] hover:text-[#4B5168] dark:hover:text-[#DDE1F5]"}`}>{l}</button>
        ))}
      </div>

      {/* ── AD-LEVEL BREAKDOWN ─────────────────────────────────────────────── */}
      {view==="adlevel"&&data&&(
        <div className="space-y-3">
          {(!data.adLevel||data.adLevel.length===0)&&(
            <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-10 text-center text-[12px] text-[#8B92A9]">No lead data in this period.</div>
          )}
          {(data.adLevel||[]).map((camp,ci)=>(
            <CampaignAdCard key={camp.campaign+ci} camp={camp} ci={ci}/>
          ))}
        </div>
      )}

      {/* ── CONVERTING / ALL LEADS TABLE ───────────────────────────────────── */}
      {(view==="converting"||view==="all")&&data&&(
        <div className="space-y-2">
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-[#8B92A9] absolute left-2.5 top-1/2 -translate-y-1/2"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, campaign…"
                className="w-full text-[12px] pl-8 pr-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]"/>
            </div>
            <span className="text-[11px] text-[#8B92A9] ml-auto">{filteredLeads.length} leads</span>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">
                {["Lead","Contact","Campaign","Ad Set","Source","Status","Agent","Date","Last Remark"].map(h=>(
                  <th key={h} className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9] px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredLeads.slice(0,200).map((l,i)=>(
                  <tr key={l._id||i} className="border-b border-[#F1F3F9] dark:border-white/5 last:border-0 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                          style={{background:l.status==="Converted"?"#10B981":l.status==="In Progress"?"#F59E0B":"#6366F1"}}>
                          {(l.name||"?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{l.name}</p>
                          {l.language&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30">{l.language}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-[12px] tabular-nums text-[#4B5168] dark:text-[#9DA3BB]">{l.mobile}</p>
                      {l.email&&<p className="text-[10px] text-[#8B92A9] truncate max-w-[120px]">{l.email}</p>}
                    </td>
                    <td className="px-3 py-3 text-[11px] text-[#4B5168] dark:text-[#9DA3BB] max-w-[130px]">
                      <p className="truncate font-medium" title={l.campaign}>{l.campaign||"—"}</p>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-[#8B92A9] max-w-[120px]">
                      <p className="truncate" title={l.adSet}>{l.adSet||"—"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F8F9FC] dark:bg-white/5 text-[#4B5168] dark:text-[#9DA3BB]">{l.source||"—"}</span>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={l.status}/></td>
                    <td className="px-3 py-3 text-[11px] text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{l.agent}</td>
                    <td className="px-3 py-3 text-[11px] text-[#8B92A9] whitespace-nowrap">{l.date?new Date(l.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"2-digit"}):""}</td>
                    <td className="px-3 py-3 text-[11px] text-[#8B92A9] max-w-[180px]">
                      <p className="line-clamp-2" title={l.remark}>{l.remark||"—"}</p>
                    </td>
                  </tr>
                ))}
                {filteredLeads.length===0&&<tr><td colSpan={9} className="px-3 py-10 text-center text-[12px] text-[#8B92A9]">No leads match</td></tr>}
              </tbody>
            </table>
          </div>
          {filteredLeads.length>200&&<p className="text-center text-[11px] text-[#8B92A9]">Showing 200 of {filteredLeads.length} — use the campaign filter to narrow results.</p>}
        </div>
      )}
    </div>
  );
}

export default function MarketingDashboard() {
  const nav=useNavigate();
  const user=JSON.parse(localStorage.getItem("mkt_user")||"{}");
  const [dark,setDark]=useState(()=>localStorage.getItem("mkt_dark")==="true");
  const [activeTab,setActiveTab]=useState("meta");
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [from,setFrom]=useState(isoDaysAgo(30));
  const [to,setTo]=useState(isoDaysAgo(0));
  const [preset,setPreset]=useState("Last 30 days");
  const [campaign,setCampaign]=useState("");
  const [source,setSource]=useState("");
  const [autoMin,setAutoMin]=useState(null);

  useEffect(()=>{
    if(!localStorage.getItem("mkt_token")){ nav("/marketing/login"); return; }
    document.documentElement.classList.toggle("dark",dark);
    localStorage.setItem("mkt_dark",String(dark));
  },[dark,nav]);

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const p={from,to};
      if(campaign)p.campaign=campaign;
      if(source)p.source=source;
      const {data:d}=await mktApi.get("/dashboard",{params:p});
      setData(d);
    }catch(e){setError(e?.response?.data?.message||"Failed to load. Check connection.");}
    finally{setLoading(false);}
  },[from,to,campaign,source]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{if(!autoMin)return;const t=setInterval(()=>load(),autoMin*60000);return()=>clearInterval(t);},[autoMin,load]);

  const logout=()=>{localStorage.removeItem("mkt_token");localStorage.removeItem("mkt_user");nav("/marketing/login");};
  const applyPreset=p=>{setPreset(p.label);setFrom(p.from);setTo(p.to);};

  const k=data?.kpis||{};
  const daily=data?.daily||[];
  const sparkTotal=daily.slice(-14).map(d=>d.total||0);
  const sparkConv=daily.slice(-14).map(d=>d.converted||0);
  const statusDonut=[
    {stage:"New",            count:k.newLeads||0,      color:"#3B82F6"},
    {stage:"In Progress",    count:k.inProgress||0,    color:"#F59E0B"},
    {stage:"Verification",   count:k.verification||0,  color:"#8B5CF6"},
    {stage:"Converted",      count:k.converted||0,     color:"#10B981"},
    {stage:"Not Interested", count:k.notInterested||0, color:"#EF4444"},
  ];

  return(
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0D0F14]">
      {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
      <nav className="h-14 bg-white dark:bg-[#11131C] border-b border-[#E4E7EF] dark:border-[#1E2133] px-4 md:px-6 flex items-center gap-3 sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 text-white"/>
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-tight">Performance Marketing</p>
            <p className="text-[10px] text-[#8B92A9]">{user.companyName||"Dashboard"}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Auto-refresh */}
          <select value={autoMin||""} onChange={e=>setAutoMin(e.target.value?Number(e.target.value):null)}
            className="text-[11px] bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2 py-1.5 focus:outline-none text-[#4B5168] dark:text-[#9DA3BB] hidden sm:block">
            <option value="">Manual</option>
            <option value="5">Auto 5m</option>
            <option value="15">Auto 15m</option>
            <option value="30">Auto 30m</option>
          </select>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold">
            {loading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<RefreshCw className="w-3.5 h-3.5"/>} <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={()=>setDark(!dark)} className="w-8 h-8 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-center text-[#8B92A9] hover:text-indigo-600 transition-colors">
            {dark?<Sun className="w-4 h-4"/>:<Moon className="w-4 h-4"/>}
          </button>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#F8F9FC] dark:bg-[#0D0F14] border border-[#E4E7EF] dark:border-[#1E2133]">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">{(user.name||"A").charAt(0).toUpperCase()}</div>
            <span className="text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hidden sm:inline">{user.name||"Admin"}</span>
          </div>
          <button onClick={logout} className="w-8 h-8 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-center text-[#8B92A9] hover:text-rose-500 transition-colors" title="Logout">
            <LogOut className="w-3.5 h-3.5"/>
          </button>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-5 space-y-4">
        {/* ── TAB NAV ─────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-1.5">
          {[["meta","Meta Campaigns"],["leads","Leads"],["adlevel","Ad-Level"],["overview","Overview"]].map(([v,l])=>(
            <button key={v} onClick={()=>setActiveTab(v)}
              className={`flex-1 py-2 rounded-xl text-[12px] font-bold transition-colors ${activeTab===v?"bg-indigo-600 text-white shadow":"text-[#8B92A9] hover:text-[#4B5168] dark:hover:text-[#DDE1F5]"}`}>{l}</button>
          ))}
        </div>

        {/* ── META ADS TAB ─────────────────────────────────────────────────── */}
        {activeTab==="meta"&&<MetaCampaignsTab from={from} to={to}/>}
        {activeTab==="leads"&&<LeadsIntelligenceTab from={from} to={to}/>}
        {activeTab==="adlevel"&&<MetaAdsTab from={from} to={to}/>}

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab==="overview"&&<div className="space-y-4">
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 flex-wrap">
              {DATE_PRESETS.map(p=>(
                <button key={p.label} onClick={()=>applyPreset(p)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${preset===p.label?"bg-indigo-600 text-white":"bg-[#F1F3F9] dark:bg-white/5 text-[#4B5168] dark:text-[#9DA3BB] hover:bg-indigo-50 dark:hover:bg-indigo-950/20"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPreset("Custom");}}
                className="text-[11px] px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]"/>
              <span className="text-[#8B92A9] text-[11px]">→</span>
              <input type="date" value={to} onChange={e=>{setTo(e.target.value);setPreset("Custom");}}
                className="text-[11px] px-2 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] bg-white dark:bg-[#11131C] focus:outline-none text-[#0F1117] dark:text-[#DDE1F5]"/>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <select value={source} onChange={e=>setSource(e.target.value)}
                className="text-[11px] bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2 py-1.5 focus:outline-none text-[#4B5168] dark:text-[#9DA3BB]">
                <option value="">All sources</option>
                {(data?.filters?.sources||[]).map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={campaign} onChange={e=>setCampaign(e.target.value)}
                className="text-[11px] bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-lg px-2 py-1.5 focus:outline-none text-[#4B5168] dark:text-[#9DA3BB]">
                <option value="">All campaigns</option>
                {(data?.filters?.campaigns||[]).map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              {(source||campaign)&&<button onClick={()=>{setSource("");setCampaign("");}} className="text-[#8B92A9] hover:text-rose-500 p-1"><X className="w-3.5 h-3.5"/></button>}
            </div>
          </div>
        </div>

        {error&&<div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 text-rose-600 text-[13px]"><AlertTriangle className="w-4 h-4 shrink-0"/>{error}</div>}
        {loading&&!data&&<div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#8B92A9]"/></div>}

        {data&&<>
          {/* ── KPI GRID ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <Kpi icon={Users}        label="Total Leads"    value={num(k.totalLeads)}      tint="#6366F1" trend={k.trends?.totalLeads} spark={sparkTotal}/>
            <Kpi icon={Star}         label="New"            value={num(k.newLeads)}         tint="#3B82F6"/>
            <Kpi icon={Activity}     label="In Progress"    value={num(k.inProgress)}       tint="#F59E0B"/>
            <Kpi icon={CheckCircle2} label="Converted"      value={num(k.converted)}        tint="#10B981" trend={k.trends?.converted} spark={sparkConv}/>
            <Kpi icon={XCircle}      label="Not Interested" value={num(k.notInterested)}    tint="#EF4444"/>
            <Kpi icon={Target}       label="Conv. Rate"     value={pct(k.conversionRate)}   tint="#8B5CF6"/>
            <Kpi icon={AlertTriangle}label="Verification"   value={num(k.verification)}     tint="#A855F7"/>
            <Kpi icon={Bell}         label="Today Followups"value={num(data.followups?.today)}    tint="#F97316"/>
            <Kpi icon={Clock}        label="Upcoming"       value={num(data.followups?.upcoming)} tint="#0EA5E9"/>
            <Kpi icon={AlertCircle}  label="Missed"         value={num(data.followups?.missed)}   tint="#EF4444"/>
          </div>

          {/* ── SUMMARY STRIP ─────────────────────────────────────────────── */}
          <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">{data.range?.from} → {data.range?.to}</p>
            <p className="text-[13px] leading-relaxed">
              <b>{num(k.totalLeads)}</b> leads — <b>{num(k.converted)}</b> converted (<b>{pct(k.conversionRate)}</b>),{" "}
              <b>{num(k.inProgress)}</b> in progress, <b>{num(k.newLeads)}</b> new.{" "}
              <b>{num(data.followups?.today)}</b> follow-ups due today, <b>{num(data.followups?.missed)}</b> missed.
            </p>
          </div>

          {/* ── FUNNEL + STATUS ────────────────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-3">
            <Panel title="Lead Funnel" icon={Layers}><Funnel stages={data.funnel}/></Panel>
            <Panel title="Lead Status Breakdown" icon={PieChart}><Donut data={statusDonut}/></Panel>
          </div>

          {/* ── DAILY TREND ───────────────────────────────────────────────── */}
          <Panel title="Daily Lead Trend" icon={TrendingUp}>
            <AreaChart points={daily.map(d=>d.date)} series={[
              {key:"total",label:"Total",color:"#6366F1",data:daily.map(d=>d.total)},
              {key:"inProgress",label:"In Progress",color:"#F59E0B",data:daily.map(d=>d.inProgress)},
              {key:"converted",label:"Converted",color:"#10B981",data:daily.map(d=>d.converted)},
              {key:"new",label:"New",color:"#3B82F6",data:daily.map(d=>d.newLeads)},
            ]}/>
          </Panel>

          {/* ── CAMPAIGN + SOURCE ─────────────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-3">
            <Panel title="Top Campaigns" icon={BarChart3}>
              <RankBars rows={data.campaigns} valueKey="total" labelKey="campaign"/>
            </Panel>
            <Panel title="Lead Sources" icon={PieChart}>
              <Donut data={(data.sources||[]).map((s,i)=>({stage:s.source,count:s.count,color:COLORS[i%COLORS.length]}))}/>
            </Panel>
          </div>

          {/* ── CAMPAIGN TABLE ────────────────────────────────────────────── */}
          <Panel title="Campaign Breakdown" icon={BarChart3}>
            <Table rows={data.campaigns||[]} columns={[
              {key:"campaign",  label:"Campaign",    render:r=><span className="font-semibold">{r.campaign}</span>},
              {key:"source",    label:"Source"},
              {key:"total",     label:"Total",       align:"right",render:r=>num(r.total)},
              {key:"newLeads",  label:"New",         align:"right",render:r=>num(r.newLeads)},
              {key:"inProgress",label:"In Progress", align:"right",render:r=>num(r.inProgress)},
              {key:"converted", label:"Converted",   align:"right",render:r=><span className="text-emerald-600 font-semibold">{num(r.converted)}</span>},
              {key:"convRate",  label:"Conv %",      align:"right",render:r=><span className={`font-semibold ${r.convRate>=10?"text-emerald-600":r.convRate>=5?"text-amber-600":"text-[#8B92A9]"}`}>{pct(r.convRate)}</span>},
              {key:"notInt",    label:"Not Int.",    align:"right",render:r=><span className="text-rose-500">{num(r.notInt)}</span>},
            ]}/>
          </Panel>

          {/* ── EMPLOYEE LEADERBOARD ──────────────────────────────────────── */}
          <Panel title="Sales Executive Performance" icon={Award}>
            <Table rows={data.employees||[]} columns={[
              {key:"name",      label:"Executive",   render:r=><span className="font-semibold">{r.name}</span>},
              {key:"total",     label:"Assigned",    align:"right",render:r=>num(r.total)},
              {key:"inProgress",label:"In Progress", align:"right",render:r=>num(r.inProgress)},
              {key:"converted", label:"Converted",   align:"right",render:r=><span className="text-emerald-600 font-semibold">{num(r.converted)}</span>},
              {key:"notInt",    label:"Not Int.",    align:"right",render:r=><span className="text-rose-500">{num(r.notInt)}</span>},
              {key:"convRate",  label:"Conv %",      align:"right",render:r=><span className="font-bold" style={{color:r.convRate>=20?"#059669":r.convRate>=10?"#D97706":"#EF4444"}}>{pct(r.convRate)}</span>},
            ]}/>
          </Panel>

          {/* ── GOOGLE ADS TABLE ──────────────────────────────────────────── */}
          {data.adPerformance&&data.adPerformance.length>0&&(
            <Panel title="Google Ads Campaigns" icon={Zap}>
              <Table rows={data.adPerformance} columns={[
                {key:"name",       label:"Campaign",  render:r=><span className="font-semibold">{r.name}</span>},
                {key:"impressions",label:"Impressions",align:"right",render:r=>num(r.impressions)},
                {key:"clicks",     label:"Clicks",    align:"right",render:r=>num(r.clicks)},
                {key:"ctr",        label:"CTR",       align:"right",render:r=>pct(r.ctr)},
                {key:"cost",       label:"Spend",     align:"right",render:r=>`₹${num(r.cost)}`},
                {key:"leads",      label:"Leads",     align:"right",render:r=>num(r.leads)},
                {key:"cpl",        label:"CPL",       align:"right",render:r=>`₹${num(r.cpl)}`},
                {key:"converted",  label:"Converted", align:"right",render:r=><span className="text-emerald-600 font-semibold">{num(r.converted)}</span>},
              ]}/>
            </Panel>
          )}

          {/* ── FOLLOW-UP CARDS ────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              {label:"Today's Follow-ups",  count:data.followups?.today,    color:"#F97316",icon:Clock},
              {label:"Upcoming Follow-ups", count:data.followups?.upcoming, color:"#0EA5E9",icon:Calendar},
              {label:"Missed Follow-ups",   count:data.followups?.missed,   color:"#EF4444",icon:AlertTriangle},
            ].map(f=>(
              <div key={f.label} className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{background:`${f.color}22`}}>
                  <f.icon className="w-4 h-4" style={{color:f.color}}/>
                </div>
                <p className="text-[22px] font-extrabold text-[#0F1117] dark:text-[#F0F2FA] leading-none mb-0.5">{num(f.count)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B92A9]">{f.label}</p>
              </div>
            ))}
          </div>

          {/* ── FOOTER ────────────────────────────────────────────────────── */}
          <div className="text-center py-4 text-[11px] text-[#8B92A9]">
            SkyUp CRM · Performance Marketing Panel · {user.companyName} · Data as of {to}
          </div>
        </>
        }
        </div>}
      </div>
    </div>
  );
}
