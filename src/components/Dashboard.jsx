import { useState, useMemo, useEffect } from "react";
import { fetchAll, getRole, getStoredUser } from "../data/dataService";
import UserManagement from "./UserMangement";
import AdminChat from "./Adminchat";
// import CallButton from "./CallButton"
// import CallRecordings from "./CallRecording"


// ── Date helpers ──────────────────────────────────────────────────────────────
function parseDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  const match = dateStr.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (match) {
    const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    const [, day, mon, yr] = match;
    return new Date(Number(yr), months[mon], parseInt(day, 10), 12);
  }
  return new Date(dateStr);
}
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function getRangeWindow(range) {
  const now = new Date();
  switch (range) {
    case "today":   return { start: startOfDay(now), end: endOfDay(now) };
    case "week":    { const s = startOfDay(new Date()); s.setDate(s.getDate()-6); return { start: s, end: endOfDay(now) }; }
    case "month":   return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
    case "quarter": { const q = Math.floor(now.getMonth()/3); return { start: new Date(now.getFullYear(), q*3, 1), end: endOfDay(now) }; }
    default:        return null;
  }
}
function filterByRange(leads, range) {
  const win = getRangeWindow(range);
  if (!win) return leads;
  return leads.filter(l => { const d = parseDate(l.date); return d >= win.start && d <= win.end; });
}
function buildChartBuckets(leads, range) {
  const now = new Date();
  if (range === "today") {
    const hours = Array.from({length:8}, (_,i) => 9+i);
    return {
      labels: hours.map(h => `${h > 12 ? h-12 : h}${h >= 12 ? "pm":"am"}`),
      new:    hours.map(h => leads.filter(l => { const d = parseDate(l.date); return d.getHours()===h; }).length),
      conv:   hours.map(h => leads.filter(l => l.status==="Converted" && parseDate(l.date).getHours()===h).length),
    };
  }
  if (range === "week") {
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    return {
      labels: Array.from({length:7}, (_,i) => { const d=new Date(); d.setDate(d.getDate()-6+i); return days[d.getDay()]; }),
      new:    Array.from({length:7}, (_,i) => { const d=new Date(); d.setDate(d.getDate()-6+i); return leads.filter(l => { const ld=parseDate(l.date); return ld.toDateString()===d.toDateString(); }).length; }),
      conv:   Array.from({length:7}, (_,i) => { const d=new Date(); d.setDate(d.getDate()-6+i); return leads.filter(l => l.status==="Converted" && parseDate(l.date).toDateString()===d.toDateString()).length; }),
    };
  }
  if (range === "month") {
    return {
      labels: ["Wk 1","Wk 2","Wk 3","Wk 4"],
      new:  [1,2,3,4].map(w => leads.filter(l => { const d=parseDate(l.date); return Math.ceil(d.getDate()/7)===w; }).length),
      conv: [1,2,3,4].map(w => leads.filter(l => l.status==="Converted" && Math.ceil(parseDate(l.date).getDate()/7)===w).length),
    };
  }
  const q = Math.floor(now.getMonth()/3);
  const months = [q*3, q*3+1, q*3+2];
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return {
    labels: months.map(m => MON[m]),
    new:    months.map(m => leads.filter(l => parseDate(l.date).getMonth()===m).length),
    conv:   months.map(m => leads.filter(l => l.status==="Converted" && parseDate(l.date).getMonth()===m).length),
  };
}

// ── Charts ────────────────────────────────────────────────────────────────────
function LineChart({ data1, data2, labels, color1="#2563EB", color2="#059669" }) {
  const W=500, H=120, PAD={t:10,b:24,l:30,r:10};
  const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
  const maxV = Math.max(...data1,...data2,1)*1.1;
  const pts = arr => arr.map((v,i) => `${PAD.l+(i/(arr.length-1||1))*cw},${PAD.t+ch-(v/maxV)*ch}`).join(" ");
  const area = arr => { const top=arr.map((v,i)=>`${PAD.l+(i/(arr.length-1||1))*cw},${PAD.t+ch-(v/maxV)*ch}`).join(" "); return `${PAD.l},${PAD.t+ch} ${top} ${PAD.l+cw},${PAD.t+ch}`; };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-[#0F1117] dark:text-[#9DA3BB]" style={{height:120}}>
      {[0,0.5,1].map(f=><line key={f} x1={PAD.l} y1={PAD.t+ch*(1-f)} x2={PAD.l+cw} y2={PAD.t+ch*(1-f)} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1"/>)}
      <polygon points={area(data1)} fill={color1} fillOpacity="0.08"/>
      <polygon points={area(data2)} fill={color2} fillOpacity="0.08"/>
      <polyline points={pts(data1)} fill="none" stroke={color1} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      <polyline points={pts(data2)} fill="none" stroke={color2} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {labels.map((l,i)=><text key={i} x={PAD.l+(i/(labels.length-1||1))*cw} y={H-4} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.7">{l}</text>)}
    </svg>
  );
}
function DonutChart({ segments }) {
  const R=44, r=28, cx=54, cy=54;
  const total = segments.reduce((s,x)=>s+x.value,0)||1;
  let angle=-90;
  const arcs = segments.map(seg=>{
    const sweep=(seg.value/total)*360;
    const a1=(angle*Math.PI)/180, a2=((angle+sweep)*Math.PI)/180;
    const x1=cx+R*Math.cos(a1),y1=cy+R*Math.sin(a1),x2=cx+R*Math.cos(a2),y2=cy+R*Math.sin(a2);
    const lg=sweep>180?1:0;
    const d=`M ${x1} ${y1} A ${R} ${R} 0 ${lg} 1 ${x2} ${y2} L ${cx+r*Math.cos(a2)} ${cy+r*Math.sin(a2)} A ${r} ${r} 0 ${lg} 0 ${cx+r*Math.cos(a1)} ${cy+r*Math.sin(a1)} Z`;
    angle+=sweep;
    return {...seg,d};
  });
  return <svg viewBox="0 0 108 108" className="w-full max-w-[108px]">{arcs.map((a,i)=><path key={i} d={a.d} fill={a.color}/>)}</svg>;
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, up, icon }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{label}</span>
        <span className="w-8 h-8 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[#2563EB] dark:text-[#4F8EF7]">{icon}</span>
      </div>
      <div className="text-[30px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none mb-2">{value}</div>
      {sub && (
        <div className={`text-[12px] font-medium flex items-center gap-1 ${up ? "text-[#059669] dark:text-[#34D399]" : "text-[#DC2626] dark:text-[#F87171]"}`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={up ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}/>
          </svg>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Error banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 text-[#DC2626] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <p className="text-[13px] font-semibold text-[#991B1B] dark:text-[#F87171]">{message}</p>
      </div>
      <button onClick={onRetry} className="text-[12px] font-bold text-[#DC2626] underline underline-offset-2 shrink-0">
        Retry
      </button>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-6 py-8 animate-pulse">
      <div className="h-8 w-48 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-3"/>
      <div className="h-4 w-64 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-8"/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_,i)=><div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-28"/>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-48"/>
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-48"/>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconUsers = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>;
const IconCheck = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const IconPct   = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>;
const IconClock = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const IconBuilding = <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>;

const SOURCE_COLORS = {
  "Google Ads":"#2563EB","Campaign":"#7C3AED",
  "Facebook Ads":"#0891B2","Web Form":"#059669","Referral":"#D97706",
};
const RANGE_LABELS = { today:"Today", week:"This week", month:"This month", quarter:"Quarter" };

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
const [activeCallSid, setActiveCallSid] = useState(null);

  const [allLeads,    setAllLeads]    = useState([]);
  const [agents,      setAgents]      = useState([]);
  const [dbAdmins,    setDbAdmins]    = useState([]);   // admins from DB for UserManagement
  const [dbUsers,     setDbUsers]     = useState([]);   // users from DB for UserManagement
  const [companyPlan, setCompanyPlan] = useState("basic");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [range,       setRange]       = useState("week");
  const [superStats,  setSuperStats]  = useState(null); // only for superadmin

  // ── CSV Import state ────────────────────────────────────────────────────────
  // const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult,    setCsvResult]    = useState(null); // { saved, errors }

  // const handleAdminImportCSV = async (e) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;
  //   e.target.value = ""; // reset so same file can be re-selected
  //   setCsvImporting(true);
  //   setCsvResult(null);
  //   try {
  //     const text = await file.text();
  //     const lines = text.trim().split("\n").filter(Boolean);
  //     if (lines.length < 2) { setCsvResult({ error: "CSV must have a header row and at least one data row." }); return; }

  //     // Parse header
  //     const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
  //     const leads = [];
  //     for (let i = 1; i < lines.length; i++) {
  //       const values = lines[i].split(",").map(v => v.replace(/^"|"$/g, "").trim());
  //       const row = {};
  //       headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
  //       if (!row.name && !row.mobile) continue;
  //       leads.push({
  //         name:     row.name     || row["full name"] || "",
  //         mobile:   row.mobile   || row.phone || row["phone number"] || "",
  //         email:    row.email    || "",
  //         source:   row.source   || "CSV Import",
  //         campaign: row.campaign || "",
  //         status:   row.status   || "New",
  //         date:     row.date     || "",
  //         remark:   row.remark   || row.notes || "Imported via CSV",
  //       });
  //     }

  //     if (!leads.length) { setCsvResult({ error: "No valid rows found in CSV." }); return; }

  //     const { default: api } = await import("../data/axiosConfig");
  //     const res = await api.post("/leads/admin/import-csv", { leads });
  //     setCsvResult({ saved: res.data.savedCount, errors: res.data.errorCount, total: res.data.total });
  //     loadData(); // refresh dashboard
  //   } catch (err) {
  //     setCsvResult({ error: err.response?.data?.message || "Import failed." });
  //   } finally {
  //     setCsvImporting(false);
  //   }
  // };

  const contacts = allLeads
  .filter(l => l.mobile)
  .map(l => ({ id: l.id, name: l.name, number: String(l.mobile) }))
  .filter((c, i, arr) => arr.findIndex(x => x.number === c.number) === i);
  const [selectedContact, setSelectedContact] = useState(null);

  const role = getRole();
  const user = getStoredUser();
  const isSuperAdmin = role === "superadmin";

  // ── Fetch data ──────────────────────────────────────────────────────────────
 const loadData = () => {
  // Regular users have no dashboard data to fetch
  if (role === "user") {
    setLoading(false);
    return;
  }

  setLoading(true);
  setError(null);

  // ── Fetch leads + agent stats (admin & superadmin) ───────────────────────
  fetchAll()
    .then(({ agents, leads, stats }) => {
      setAgents(agents || []);
      setAllLeads(leads || []);
      if (stats) setSuperStats(stats);
    })
    .catch((err) => {
      setError(err.response?.data?.message || "Failed to load dashboard data.");
    })
    .finally(() => setLoading(false));

  // ── Fetch real admin list + user list + company plan (admin only) ────────
  if (role === "admin") {
    import("../data/axiosConfig").then(({ default: api }) => {
      Promise.all([
        api.get("/admin/"),            // all admins in this company
        api.get("/admin/company/users"), // all users in this company
        api.get("/admin/company/me"),    // company info (plan)
      ]).then(([adminsRes, usersRes, companyRes]) => {
        setDbAdmins(adminsRes.data  || []);
        setDbUsers(usersRes.data    || []);
        setCompanyPlan(companyRes.data?.plan || "basic");
      }).catch(() => {
        // Non-fatal — UserManagement will just start empty
      });
    });
  }
};

  useEffect(() => { loadData(); }, []);

  const leads = useMemo(() => filterByRange(allLeads, range), [allLeads, range]);
  const kpi   = useMemo(() => {
    const total = leads.length, converted = leads.filter(l => l.status === "Converted").length;
    return { total, converted, rate:`${total > 0 ? Math.round(converted/total*100) : 0}%`, response:"—" };
  }, [leads]);
  const chart  = useMemo(() => buildChartBuckets(leads, range), [leads, range]);
  const pipeline = useMemo(() => ({
    new:      leads.filter(l=>l.status==="New").length,
    progress: leads.filter(l=>l.status==="In Progress").length,
    lost:     leads.filter(l=>l.status==="Not Interested").length,
    converted:leads.filter(l=>l.status==="Converted").length,
  }), [leads]);
  const agentStats = useMemo(() =>
    agents.map(a=>{ const al=leads.filter(l=>l.agent===a.name); return {...a,leads:al.length,conv:al.filter(l=>l.status==="Converted").length}; })
      .sort((a,b)=>b.leads-a.leads),
  [leads, agents]);
  const sourceStats = useMemo(() => {
    const total=leads.length||1;
    return Object.entries(SOURCE_COLORS).map(([label,color])=>({label,color,pct:Math.round(leads.filter(l=>l.source===label).length/total*100)})).filter(s=>s.pct>0);
  }, [leads]);
  const activity = useMemo(() =>
    [...allLeads].sort((a,b)=>String(b.id).localeCompare(String(a.id))).slice(0,6).map(l=>({
      text:`${l.agent} · ${l.name} — ${l.status}`, time:l.date,
      dot: l.status==="Converted"?"#059669":l.status==="In Progress"?"#D97706":l.status==="Not Interested"?"#DC2626":"#2563EB",
    })),
  [allLeads]);
  const maxLeads = Math.max(...agentStats.map(a=>a.leads),1);
  const pipelineSegs = [
    {value:pipeline.new,color:"#2563EB"},{value:pipeline.progress,color:"#D97706"},
    {value:pipeline.lost,color:"#DC2626"},{value:pipeline.converted,color:"#059669"},
  ];
  const uniqueSources   = [...new Set(allLeads.map(l=>l.source))].length;
  const uniqueCampaigns = [...new Set(allLeads.map(l=>l.campaign).filter(c=>c&&c!=="—"))].length;

  if (loading) return <Skeleton/>;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-6 py-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Dashboard</h1>
            {/* ✅ Role badge */}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
              ${isSuperAdmin
                ? "bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400"
                : "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"}`}>
              {isSuperAdmin ? "SuperAdmin" : "Admin"}
            </span>
          </div>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">
            Welcome back, {user?.name || "Admin"} ·{" "}
            {isSuperAdmin
              ? `${superStats?.totalCompanies || 0} companies · ${allLeads.length} total leads`
              : `${allLeads.length} total leads · ${agents.length} users`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ✅ Refresh button */}
          <button onClick={loadData}
            className="p-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#8B92A9] hover:text-[#2563EB] transition"
            title="Refresh data">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>

        

          <div className="flex items-center gap-1.5 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1">
            {Object.entries(RANGE_LABELS).map(([key,label])=>(
              <button key={key} onClick={()=>setRange(key)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${range===key?"bg-[#2563EB] text-white":"text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A]"}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ✅ Error banner */}
      {error && <ErrorBanner message={error} onRetry={loadData} />}

      {/* ✅ SuperAdmin extra stats */}
      {isSuperAdmin && superStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Companies"  value={superStats.totalCompanies}  sub="Registered companies" up={true}  icon={IconBuilding}/>
          <KpiCard label="Active Companies" value={superStats.activeCompanies} sub="Currently active"      up={true}  icon={IconCheck}/>
          <KpiCard label="Total Admins"     value={superStats.totalAdmins}     sub="Across all companies"  up={true}  icon={IconUsers}/>
          <KpiCard label="Total Users"      value={superStats.totalUsers}      sub="Across all companies"  up={true}  icon={IconUsers}/>
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Leads"    value={kpi.total.toLocaleString()}     sub={`${leads.length} in selected range`} up={true}  icon={IconUsers}/>
        <KpiCard label="Conversions"    value={kpi.converted.toLocaleString()} sub={`${kpi.rate} conversion rate`}       up={kpi.converted>0} icon={IconCheck}/>
        <KpiCard label="Conv. rate"     value={kpi.rate}                       sub={`${pipeline.progress} in progress`}  up={parseInt(kpi.rate)>=15} icon={IconPct}/>
        <KpiCard label="Not Interested" value={pipeline.lost.toLocaleString()} sub="Review needed" up={false} icon={IconClock}/>
      </div>

      {/* ── Chart row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Leads over time</h2>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[11px] text-[#8B92A9] dark:text-[#565C75]"><span className="w-3 h-1.5 rounded-full bg-[#2563EB] inline-block"/>New leads</span>
              <span className="flex items-center gap-1.5 text-[11px] text-[#8B92A9] dark:text-[#565C75]"><span className="w-3 h-1.5 rounded-full bg-[#059669] inline-block"/>Converted</span>
            </div>
          </div>
          {leads.length===0
            ? <div className="h-[120px] flex items-center justify-center text-[13px] text-[#8B92A9] dark:text-[#565C75]">No leads in this period</div>
            : <LineChart data1={chart.new} data2={chart.conv} labels={chart.labels}/>
          }
        </div>
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">Pipeline status</h2>
          <div className="flex items-center gap-4">
            <DonutChart segments={pipelineSegs}/>
            <div className="space-y-2.5 flex-1">
              {[{label:"New",value:pipeline.new,color:"#2563EB"},{label:"In progress",value:pipeline.progress,color:"#D97706"},{label:"Not interested",value:pipeline.lost,color:"#DC2626"},{label:"Converted",value:pipeline.converted,color:"#059669"}].map(s=>(
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{background:s.color}}/>
                  <span className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] flex-1 leading-none">{s.label}</span>
                  <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{s.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">
            {isSuperAdmin ? "Top users" : "User performance"}
          </h2>
          {agentStats.every(a=>a.leads===0)
            ? <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No activity in this period.</p>
            : <div className="space-y-4">{agentStats.map(a=>(
                <div key={a.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{background:a.color}}>{a.avatar}</div>
                      <span className="text-[12px] font-medium text-[#0F1117] dark:text-[#F0F2FA]">{a.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#059669] dark:text-[#34D399]">{a.conv} conv</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{width:`${Math.round(a.leads/maxLeads*100)}%`,background:a.color}}/>
                    </div>
                    <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] w-7 text-right">{a.leads}</span>
                  </div>
                </div>
              ))}</div>
          }
        </div>
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">Leads by source</h2>
          <div className="space-y-3">
            {sourceStats.length===0
              ? <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No data for this period.</p>
              : sourceStats.map(s=>(
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{background:s.color}}/><span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{s.label}</span></div>
                      <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{s.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${s.pct}%`,background:s.color}}/></div>
                  </div>
                ))
            }
          </div>
          <div className="mt-5 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38] grid grid-cols-2 gap-3">
            {[
              {label:"Total leads",  value:allLeads.length},
              {label:"Active users", value:agents.length},
              {label:"Sources",      value:uniqueSources},
              {label:"Campaigns",    value:uniqueCampaigns},
            ].map(s=>(
              <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-2.5">
                <div className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{s.value}</div>
                <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Recent activity</h2>
            <span className="flex items-center gap-1.5 text-[10px] text-[#8B92A9] dark:text-[#565C75]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse inline-block"/>Live
            </span>
          </div>
          <div className="space-y-0">
            {activity.length===0
              ? <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] py-4">No recent activity.</p>
              : activity.map((a,i)=>(
                  <div key={i} className="flex gap-3 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] last:border-0">
                    <div className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{background:a.dot}}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] leading-snug">{a.text}</p>
                      <span className="text-[10px] text-[#8B92A9] dark:text-[#565C75] mt-0.5 block">{a.time}</span>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      </div>
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Contact picker */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">
            Select Contact
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {contacts.length === 0
              ? <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] text-center py-4">
                  No contacts with phone numbers found.
                </p>
              : contacts.map((c) => (
                <button
                  key={c.number}
                  onClick={() => setSelectedContact(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition text-left
                    ${selectedContact?.number === c.number
                      ? "border-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540]"
                      : "border-[#E4E7EF] dark:border-[#262A38] hover:border-[#2563EB]"
                    }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{c.name}</p>
                    <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">{c.number}</p>
                  </div>
                  {selectedContact?.number === c.number && (
                    <svg className="w-4 h-4 text-[#2563EB] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                </button>
              ))
            }
          </div>
        </div>

     

      </div>
      <AdminChat />
      <UserManagement
        currentPlan={companyPlan}
        existingAdmins={dbAdmins}
        existingUsers={dbUsers}
      />
    </div>
  );
}