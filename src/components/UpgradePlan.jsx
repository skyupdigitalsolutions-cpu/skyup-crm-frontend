import { useState } from "react";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    desc: "Perfect for small teams just getting started",
    monthlyPrice: 999,
    yearlyPrice: 799,
    color: "#0891B2",
    popular: false,
    current: true,
    agents: 3,
    leads: "500/mo",
    features: [
      "Up to 3 agents",
      "500 leads per month",
      "SMS & WhatsApp blast",
      "Basic dashboard",
      "Daily report (email)",
      "Email support",
    ],
    locked: [
      "Google Ads integration",
      "Facebook Ads integration",
      "API / Webhook access",
      "Call recordings",
      "Custom reports",
      "Priority support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    desc: "For growing teams that need more power",
    monthlyPrice: 2499,
    yearlyPrice: 1999,
    color: "#2563EB",
    popular: true,
    current: false,
    agents: 10,
    leads: "2,500/mo",
    features: [
      "Up to 10 agents",
      "2,500 leads per month",
      "SMS, WhatsApp & Email blast",
      "Advanced dashboard",
      "Daily report (email + PDF)",
      "Google Ads integration",
      "Facebook Ads integration",
      "Call recordings (30 days)",
      "API / Webhook access",
      "Priority support",
    ],
    locked: [
      "Unlimited leads",
      "Unlimited call recordings",
      "White-label CRM",
      "Dedicated account manager",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    desc: "Unlimited scale for large organisations",
    monthlyPrice: 5999,
    yearlyPrice: 4799,
    color: "#7C3AED",
    popular: false,
    current: false,
    agents: "Unlimited",
    leads: "Unlimited",
    features: [
      "Unlimited agents",
      "Unlimited leads",
      "All blast channels",
      "Full analytics suite",
      "Custom report builder",
      "Google & Facebook Ads",
      "API / Webhook access",
      "Unlimited call recordings",
      "White-label CRM",
      "Dedicated account manager",
      "SLA guarantee",
      "24/7 phone support",
    ],
    locked: [],
  },
];

const USAGE = {
  leads:     { used: 418,  total: 500,  label: "Leads this month" },
  agents:    { used: 3,    total: 3,    label: "Active agents"    },
  campaigns: { used: 8,    total: 10,   label: "Campaigns sent"   },
  storage:   { used: 1.2,  total: 5,    label: "Storage (GB)"     },
};

const INVOICES = [
  { date: "01 Mar 2025", amount: "₹999",  status: "Paid",   id: "INV-2025-03" },
  { date: "01 Feb 2025", amount: "₹999",  status: "Paid",   id: "INV-2025-02" },
  { date: "01 Jan 2025", amount: "₹999",  status: "Paid",   id: "INV-2025-01" },
  { date: "01 Dec 2024", amount: "₹999",  status: "Paid",   id: "INV-2024-12" },
];

function Check({ color }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color || "#059669"} strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Lock() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0 text-[#8B92A9] dark:text-[#565C75]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function UsageBar({ label, used, total, color }) {
  const pct = Math.min(Math.round((used / total) * 100), 100);
  const critical = pct >= 90;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{label}</span>
        <span className={`text-[12px] font-semibold ${critical ? "text-[#DC2626] dark:text-[#F87171]" : "text-[#0F1117] dark:text-[#F0F2FA]"}`}>
          {used} / {total}
        </span>
      </div>
      <div className="h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: critical ? "#DC2626" : color }}
        />
      </div>
      {critical && (
        <p className="text-[10px] text-[#DC2626] dark:text-[#F87171] mt-1 font-medium">
          Near limit — upgrade to avoid disruption
        </p>
      )}
    </div>
  );
}

export default function UpgradePlan() {
  const [billing, setBilling] = useState("monthly");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("plans");

  const savings = Math.round(((2499 - 1999) / 2499) * 100);

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-6 py-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Billing & Plans</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
            You are on the <span className="font-semibold text-[#0891B2]">Starter plan</span> · Renews 01 Apr 2025
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1 mb-8 w-fit">
        {[{k:"plans",l:"Upgrade plan"},{k:"usage",l:"Usage"},{k:"invoices",l:"Invoices"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition ${tab===t.k?"bg-[#2563EB] text-white":"text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A]"}`}
          >{t.l}</button>
        ))}
      </div>

      {/* ── PLANS TAB ── */}
      {tab==="plans"&&(
        <div>
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <button onClick={()=>setBilling("monthly")}
              className={`text-[13px] font-semibold transition ${billing==="monthly"?"text-[#0F1117] dark:text-[#F0F2FA]":"text-[#8B92A9] dark:text-[#565C75]"}`}
            >Monthly</button>
            <button onClick={()=>setBilling(billing==="monthly"?"yearly":"monthly")}
              className={`relative w-12 h-6 rounded-full transition-colors ${billing==="yearly"?"bg-[#2563EB]":"bg-[#E4E7EF] dark:bg-[#262A38]"}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${billing==="yearly"?"left-7":"left-1"}`}/>
            </button>
            <button onClick={()=>setBilling("yearly")}
              className={`text-[13px] font-semibold transition ${billing==="yearly"?"text-[#0F1117] dark:text-[#F0F2FA]":"text-[#8B92A9] dark:text-[#565C75]"}`}
            >
              Yearly
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] text-[#059669] dark:text-[#34D399] text-[10px] font-bold">
                Save {savings}%
              </span>
            </button>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {PLANS.map(plan=>{
              const price = billing==="yearly" ? plan.yearlyPrice : plan.monthlyPrice;
              const isSel = selected===plan.id;
              return(
                <div key={plan.id} className={`relative bg-white dark:bg-[#1A1D27] rounded-2xl overflow-hidden transition-shadow ${
                  plan.popular
                    ? "border-2 border-[#2563EB] shadow-[0_8px_30px_rgba(37,99,235,0.15)]"
                    : "border border-[#E4E7EF] dark:border-[#262A38]"
                }`}>
                  {/* Top accent */}
                  <div className="h-1.5 w-full" style={{background:plan.color}}/>

                  {plan.popular&&(
                    <div className="absolute top-4 right-4">
                      <span className="px-2.5 py-1 rounded-full bg-[#2563EB] text-white text-[10px] font-bold">Most popular</span>
                    </div>
                  )}

                  {plan.current&&(
                    <div className="absolute top-4 right-4">
                      <span className="px-2.5 py-1 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] text-[10px] font-bold">Current plan</span>
                    </div>
                  )}

                  <div className="p-6">
                    <h3 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{plan.name}</h3>
                    <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mt-1 mb-4">{plan.desc}</p>

                    <div className="flex items-end gap-1 mb-1">
                      <span className="text-[32px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">₹{price.toLocaleString()}</span>
                      <span className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mb-1">/mo</span>
                    </div>
                    {billing==="yearly"&&(
                      <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mb-4">Billed ₹{(price*12).toLocaleString()}/yr</p>
                    )}

                    {/* Quick stats */}
                    <div className="flex items-center gap-3 mb-5 flex-wrap">
                      <span className="text-[11px] px-2 py-1 rounded-lg font-semibold" style={{background:plan.color+"15",color:plan.color}}>
                        {plan.agents} agents
                      </span>
                      <span className="text-[11px] px-2 py-1 rounded-lg font-semibold" style={{background:plan.color+"15",color:plan.color}}>
                        {plan.leads} leads
                      </span>
                    </div>

                    {/* Features */}
                    <div className="space-y-2 mb-5">
                      {plan.features.map(f=>(
                        <div key={f} className="flex items-center gap-2">
                          <Check color={plan.color}/>
                          <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{f}</span>
                        </div>
                      ))}
                      {plan.locked.map(f=>(
                        <div key={f} className="flex items-center gap-2 opacity-40">
                          <Lock/>
                          <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75] line-through">{f}</span>
                        </div>
                      ))}
                    </div>

                    {plan.current
                      ? <button disabled className="w-full py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#8B92A9] dark:text-[#565C75] cursor-not-allowed">
                          Current plan
                        </button>
                      : <button
                          onClick={()=>setSelected(isSel?null:plan.id)}
                          className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition"
                          style={{
                            background: isSel ? plan.color : plan.color+"15",
                            color: isSel ? "#fff" : plan.color,
                          }}
                        >
                          {isSel ? "Confirm upgrade" : `Upgrade to ${plan.name}`}
                        </button>
                    }
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compare table */}
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Full feature comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">
                    <th className="text-left px-6 py-3 text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide w-[40%]">Feature</th>
                    {PLANS.map(p=>(
                      <th key={p.id} className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" style={{color:p.color}}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {label:"Agents",            vals:["3","10","Unlimited"]},
                    {label:"Leads/month",        vals:["500","2,500","Unlimited"]},
                    {label:"SMS blast",          vals:[true,true,true]},
                    {label:"WhatsApp blast",     vals:[true,true,true]},
                    {label:"Email blast",        vals:[false,true,true]},
                    {label:"Call recordings",    vals:[false,"30 days","Unlimited"]},
                    {label:"Google Ads",         vals:[false,true,true]},
                    {label:"Facebook Ads",       vals:[false,true,true]},
                    {label:"API / Webhooks",     vals:[false,true,true]},
                    {label:"Custom reports",     vals:[false,false,true]},
                    {label:"White-label",        vals:[false,false,true]},
                    {label:"Support",            vals:["Email","Priority","24/7 phone"]},
                  ].map((row,i)=>(
                    <tr key={row.label} className={`border-b border-[#E4E7EF] dark:border-[#262A38] last:border-0 ${i%2===0?"":"bg-[#FAFBFF] dark:bg-[#1E2130]"}`}>
                      <td className="px-6 py-3 text-[#4B5168] dark:text-[#9DA3BB] font-medium">{row.label}</td>
                      {row.vals.map((v,vi)=>(
                        <td key={vi} className="px-4 py-3 text-center">
                          {v===true
                            ? <span className="flex justify-center"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></span>
                            : v===false
                            ? <span className="flex justify-center"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></span>
                            : <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{v}</span>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── USAGE TAB ── */}
      {tab==="usage"&&(
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Current usage</h2>
                <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">Starter plan · Resets 01 Apr 2025</p>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] text-[12px] font-bold">9 days left</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <UsageBar label={USAGE.leads.label}     used={USAGE.leads.used}     total={USAGE.leads.total}     color="#DC2626"/>
              <UsageBar label={USAGE.agents.label}    used={USAGE.agents.used}    total={USAGE.agents.total}    color="#DC2626"/>
              <UsageBar label={USAGE.campaigns.label} used={USAGE.campaigns.used} total={USAGE.campaigns.total} color="#D97706"/>
              <UsageBar label={USAGE.storage.label}   used={USAGE.storage.used}   total={USAGE.storage.total}   color="#2563EB"/>
            </div>
          </div>

          <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FCA5A5] dark:border-[#991B1B] rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#DC2626] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-bold text-[#991B1B] dark:text-[#F87171]">You are close to your limits</h3>
              <p className="text-[12px] text-[#DC2626] dark:text-[#F87171] mt-1">
                Leads (84%) and agents (100%) are near or at the limit. Upgrade to Growth to avoid service interruption.
              </p>
            </div>
            <button
              onClick={()=>setTab("plans")}
              className="shrink-0 px-4 py-2 rounded-xl bg-[#DC2626] text-white text-[12px] font-semibold hover:bg-red-700 transition"
            >Upgrade now</button>
          </div>
        </div>
      )}

      {/* ── INVOICES TAB ── */}
      {tab==="invoices"&&(
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Invoice history</h2>
            <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75]">Starter plan · ₹999/mo</span>
          </div>
          <div className="divide-y divide-[#E4E7EF] dark:divide-[#262A38]">
            {INVOICES.map((inv,i)=>(
              <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-[#2563EB] dark:text-[#4F8EF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{inv.id}</div>
                    <div className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">{inv.date}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{inv.amount}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] dark:bg-[#052E1C] text-[#059669] dark:text-[#34D399]">
                    {inv.status}
                  </span>
                  <button className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2563EB] dark:text-[#4F8EF7] hover:underline">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
            <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75]">Total paid: ₹3,996</span>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">Payment method</div>
                <div className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">Visa •••• 4242</div>
              </div>
              <button className="px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB] transition">
                Update card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}