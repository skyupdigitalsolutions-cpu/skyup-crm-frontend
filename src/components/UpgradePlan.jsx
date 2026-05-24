// src/components/UpgradePlan.jsx
// Plans + features come from the backend (developer-configured).
// Falls back to sensible defaults if API is unavailable.
import { useState, useEffect, useCallback } from "react";
import api from "../data/axiosConfig";
import InvoiceReceipt from "./InvoiceReceipt";
import UpdatePaymentModal from "./UpdatePaymentModal";
import DowngradeWarningModal from "./DowngradeWarningModal";

const PLAN_ORDER = ["basic", "pro", "enterprise"];
const PLAN_LIMITS = {
  basic:      { admins: 1, users: 5  },
  pro:        { admins: 3, users: 20 },
  enterprise: { admins: 5, users: 999},
};
function planRank(id) { return PLAN_ORDER.indexOf(id ?? "basic"); }
function isDowngradeTo(t, c) { return planRank(t) < planRank(c); }

async function sendInvoiceEmail(payload) {
  try { await api.post("/razorpay/notify-invoice", { ...payload, date: new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) }); }
  catch {}
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function Check({ color }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color || "#059669"} strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
function Lock() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg className="animate-spin w-7 h-7 text-[#2563EB]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, billing, selected, onUpgrade }) {
  const [hovered, setHovered] = useState(false);
  const price   = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const isSel   = selected === plan.id;
  const enabled = plan.features.filter(f => f.enabled);
  const locked  = plan.features.filter(f => !f.enabled);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative bg-white dark:bg-[#11131C] rounded-2xl overflow-hidden border-2 transition-all"
      style={{
        borderColor: plan.popular ? "#2563EB" : plan.color,
        transform:   hovered ? "translateY(-4px)" : "none",
        boxShadow:   plan.popular
          ? hovered ? `0 20px 48px ${plan.color}35` : "0 8px 30px rgba(37,99,235,0.15)"
          : hovered ? `0 16px 40px ${plan.color}28` : "none",
      }}
    >
      <div className="h-1.5 w-full" style={{ background: plan.color }} />

      {plan.isDowngrade && !plan.current && (
        <div className="absolute top-4 right-4">
          <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold">Downgrade</span>
        </div>
      )}
      {plan.popular && !plan.current && !plan.isDowngrade && (
        <div className="absolute top-4 right-4">
          <span className="px-2.5 py-1 rounded-full bg-[#2563EB] text-white text-[10px] font-bold">Most popular</span>
        </div>
      )}
      {plan.current && (
        <div className="absolute top-4 right-4">
          <span className="px-2.5 py-1 rounded-full bg-[#EEF3FF] dark:bg-[#1A2040] text-[#2563EB] text-[10px] font-bold">Current plan</span>
        </div>
      )}

      <div className="p-6">
        <h3 className="text-[16px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{plan.name}</h3>
        <p className="text-[12px] text-[#8B92A9] mt-1 mb-4">{plan.desc}</p>

        <div className="flex items-end gap-1 mb-1">
          <span className="text-[32px] font-bold text-[#0F1117] dark:text-[#DDE1F5] leading-none">
            ₹{price.toLocaleString()}
          </span>
          <span className="text-[13px] text-[#8B92A9] mb-1">/mo</span>
        </div>
        {billing === "yearly" && (
          <p className="text-[11px] text-[#8B92A9] mb-4">Billed ₹{(price * 12).toLocaleString()}/yr</p>
        )}

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-[11px] px-2 py-1 rounded-lg font-semibold" style={{ background: plan.color + "15", color: plan.color }}>
            {plan.maxUsers} users
          </span>
        </div>

        {/* Enabled features */}
        <div className="space-y-2 mb-5">
          {enabled.map(f => (
            <div key={f.key} className="flex items-center gap-2">
              <Check color={plan.color} />
              <span className="text-[12px] text-[#4B5168] dark:text-[#7B829E]">{f.label}</span>
            </div>
          ))}
          {locked.map(f => (
            <div key={f.key} className="flex items-center gap-2 opacity-40">
              <Lock />
              <span className="text-[12px] text-[#8B92A9] line-through">{f.label}</span>
            </div>
          ))}
        </div>

        {plan.current ? (
          <button disabled className="w-full py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] text-[13px] font-semibold text-[#8B92A9] cursor-not-allowed">
            Current plan
          </button>
        ) : (
          <button
            onClick={() => onUpgrade(plan)}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{
              background: isSel ? plan.color : hovered ? plan.color + "25" : plan.color + "15",
              color: isSel ? "#fff" : plan.color,
            }}
          >
            {plan.isDowngrade ? `Downgrade to ${plan.name}` : isSel ? `Proceed to Pay ₹${price.toLocaleString()}` : `Upgrade to ${plan.name}`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Razorpay hook ─────────────────────────────────────────────────────────────
function useRazorpay() {
  const openCheckout = useCallback(async ({ orderData, plan, billing, onSuccess, onFailure }) => {
    const loaded = await new Promise(resolve => {
      if (document.getElementById("razorpay-sdk")) return resolve(true);
      const s = document.createElement("script");
      s.id = "razorpay-sdk";
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
    if (!loaded) { onFailure("Failed to load Razorpay SDK."); return; }
    const rzp = new window.Razorpay({
      key: orderData.keyId, amount: orderData.amount, currency: orderData.currency,
      name: "SkyUp CRM", description: `${orderData.planName} – ${billing}`,
      order_id: orderData.orderId, theme: { color: plan.color },
      handler: res => onSuccess(res),
      modal: { ondismiss: () => onFailure(null) },
    });
    rzp.on("payment.failed", r => onFailure(r.error?.description || "Payment failed."));
    rzp.open();
  }, []);
  return { openCheckout };
}

// ── Default plan shapes (shown while API loads) ───────────────────────────────
const PLAN_DEFAULTS = {
  basic: {
    id: "basic", name: "Basic", desc: "For small teams just getting started",
    monthlyPrice: 999, yearlyPrice: 799, color: "#6B7280", popular: false, maxUsers: 5,
    features: [
      { key: "leads",         label: "Lead Management",   enabled: true  },
      { key: "contacts",      label: "Contacts",          enabled: true  },
      { key: "basic-reports", label: "Basic Reports",     enabled: true  },
      { key: "attendance",    label: "Attendance",        enabled: true  },
      { key: "sms-blast",     label: "SMS Blast",         enabled: false },
      { key: "email-blast",   label: "Email Blast",       enabled: false },
      { key: "campaigns",     label: "Campaigns",         enabled: false },
      { key: "google-ads",    label: "Google Ads",        enabled: false },
      { key: "meta-ads",      label: "Meta Ads",          enabled: false },
      { key: "call-recording",label: "Call Recordings",   enabled: false },
      { key: "api-access",    label: "API / Webhooks",    enabled: false },
    ],
  },
  pro: {
    id: "pro", name: "Pro", desc: "For growing teams that need more power",
    monthlyPrice: 2999, yearlyPrice: 2399, color: "#2563EB", popular: true, maxUsers: 20,
    features: [
      { key: "leads",          label: "Lead Management",  enabled: true  },
      { key: "contacts",       label: "Contacts",         enabled: true  },
      { key: "basic-reports",  label: "Basic Reports",    enabled: true  },
      { key: "attendance",     label: "Attendance",       enabled: true  },
      { key: "sms-blast",      label: "SMS Blast",        enabled: true  },
      { key: "email-blast",    label: "Email Blast",      enabled: true  },
      { key: "campaigns",      label: "Campaigns",        enabled: true  },
      { key: "google-ads",     label: "Google Ads",       enabled: true  },
      { key: "meta-ads",       label: "Meta Ads",         enabled: true  },
      { key: "call-recording", label: "Call Recordings",  enabled: true  },
      { key: "api-access",     label: "API / Webhooks",   enabled: true  },
    ],
  },
  enterprise: {
    id: "enterprise", name: "Enterprise", desc: "Unlimited scale for large organisations",
    monthlyPrice: 9999, yearlyPrice: 7999, color: "#7C3AED", popular: false, maxUsers: 999,
    features: [
      { key: "leads",          label: "Lead Management",  enabled: true },
      { key: "contacts",       label: "Contacts",         enabled: true },
      { key: "basic-reports",  label: "Basic Reports",    enabled: true },
      { key: "attendance",     label: "Attendance",       enabled: true },
      { key: "sms-blast",      label: "SMS Blast",        enabled: true },
      { key: "email-blast",    label: "Email Blast",      enabled: true },
      { key: "campaigns",      label: "Campaigns",        enabled: true },
      { key: "google-ads",     label: "Google Ads",       enabled: true },
      { key: "meta-ads",       label: "Meta Ads",         enabled: true },
      { key: "call-recording", label: "Call Recordings",  enabled: true },
      { key: "api-access",     label: "API / Webhooks",   enabled: true },
      { key: "custom-reports", label: "Custom Reports",   enabled: true },
      { key: "white-label",    label: "White Label",      enabled: true },
    ],
  },
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UpgradePlan({ onPlanChange, currentAdmins = [], currentUsers = [], onDowngrade = null }) {
  const [billing,      setBilling]      = useState("monthly");
  const [selected,     setSelected]     = useState(null);
  const [tab,          setTab]          = useState("plans");
  const [paying,       setPaying]       = useState(false);
  const [currentPlanId,setCurrentPlanId]= useState(null);
  const [planDefs,     setPlanDefs]     = useState(PLAN_DEFAULTS);
  const [myFeatures,   setMyFeatures]   = useState(null); // resolved features for MY company
  const [invoices,     setInvoices]     = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error,        setError]        = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [showUpdatePayment, setShowUpdatePayment] = useState(false);
  const [downgradePlan, setDowngradePlan] = useState(null);
  const [showDowngrade, setShowDowngrade] = useState(false);
  const { openCheckout } = useRazorpay();

  // ── Fetch plan definitions from backend ──────────────────────────────────
  useEffect(() => {
    api.get("/subscription/plans")
      .then(({ data }) => {
        if (!data?.plans) return;
        const merged = {};
        for (const [key, def] of Object.entries(data.plans)) {
          const base = PLAN_DEFAULTS[key] || {};
          merged[key] = {
            ...base,
            id:    key,
            name:  def.name  || base.name,
            color: def.color || base.color,
            monthlyPrice: def.price?.monthly || base.monthlyPrice,
            yearlyPrice:  def.price?.yearly  || base.yearlyPrice,
            maxUsers: def.maxUsers || base.maxUsers,
            features: def.features || base.features || [],
          };
        }
        setPlanDefs(merged);
      })
      .catch(() => {}); // keep defaults on failure

    // Also fetch my company's resolved features
    api.get("/subscription/my/status")
      .then(({ data }) => {
        if (data?.resolvedFeatures?.features) {
          setMyFeatures(data.resolvedFeatures.features);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchSubscription(); }, []);
  useEffect(() => { if (tab === "invoices" && invoices.length === 0) fetchInvoices(); }, [tab]);

  async function fetchSubscription() {
    try {
      const { data } = await api.get("/razorpay/subscription");
      setSubscription(data);
      const nameToId = { Basic: "basic", Pro: "pro", Enterprise: "enterprise" };
      setCurrentPlanId(nameToId[data.planName] || "basic");
    } catch {
      setCurrentPlanId("basic");
    }
  }

  async function fetchInvoices() {
    setLoadingInvoices(true);
    try {
      const { data } = await api.get("/razorpay/invoices");
      setInvoices(data);
    } catch {
      setError("Failed to load invoices.");
    } finally {
      setLoadingInvoices(false);
    }
  }

  // Build enriched plan list
  const plans = Object.values(planDefs).map(p => ({
    ...p,
    current:     p.id === currentPlanId,
    isDowngrade: isDowngradeTo(p.id, currentPlanId),
    // Use my company's resolved features if available
    features:    (p.id === currentPlanId && myFeatures) ? myFeatures : p.features,
  }));

  const CUSTOMER = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return { name: u.companyName || u.name || "—", email: u.email || "—", address: u.address || "—", gstin: u.gstin || "" };
    } catch { return { name: "—", email: "—", address: "—", gstin: "" }; }
  })();

  function handleUpgrade(plan) {
    if (plan.current) return;
    if (plan.isDowngrade) { setDowngradePlan(plan); setShowDowngrade(true); return; }
    if (selected !== plan.id) { setSelected(plan.id); return; }
    initiatePayment(plan, false, [], []);
  }

  async function handleDowngradeConfirmed(adminsToRemove, usersToRemove) {
    if (!downgradePlan) return;
    try {
      if (adminsToRemove.length) await Promise.all(adminsToRemove.map(a => api.delete(`/admin/${a._id || a.id}`).catch(() => {})));
      if (usersToRemove.length)  await Promise.all(usersToRemove.map(u => api.delete(`/admin/company/users/${u._id || u.id}`).catch(() => {})));
    } catch {}
    if (onDowngrade) onDowngrade(adminsToRemove, usersToRemove);
    setShowDowngrade(false);
    setDowngradePlan(null);
    await initiatePayment(downgradePlan, true, adminsToRemove, usersToRemove);
  }

  async function initiatePayment(plan, _isDg = false, adminsR = [], usersR = []) {
    setPaying(true); setError(null);
    try {
      const { data: orderData } = await api.post("/razorpay/create-order", {
        planId: plan.id, billing,
        removedAdmins: adminsR.map(a => a._id || a.id),
        removedUsers:  usersR.map(u  => u._id || u.id),
      });
      openCheckout({
        orderData, plan, billing,
        onSuccess: r => handlePaymentSuccess(plan, r),
        onFailure: msg => { setPaying(false); if (msg) setError(msg); setSelected(null); },
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Could not initiate payment.");
    } finally { setPaying(false); }
  }

  async function handlePaymentSuccess(plan, razorpayResponse) {
    setError(null);
    try {
      const { data } = await api.post("/razorpay/verify-payment", {
        razorpay_order_id:   razorpayResponse.razorpay_order_id,
        razorpay_payment_id: razorpayResponse.razorpay_payment_id,
        razorpay_signature:  razorpayResponse.razorpay_signature,
        planId: plan.id, billing,
      });
      setInvoices(prev => [{ id: data.invoiceId, date: new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }), amount: `₹${data.amount.toLocaleString("en-IN")}`, baseAmount: data.amount, status: "Paid", planName: data.planName, billingCycle: data.billing, transactionId: data.transactionId }, ...prev]);
      setCurrentPlanId(plan.id); setSelected(null);
      fetchSubscription();
      if (onPlanChange) onPlanChange(plan.id);
      sendInvoiceEmail({ invoiceId: data.invoiceId, planName: data.planName, amount: `₹${data.amount}`, billingCycle: data.billing, transactionId: data.transactionId });
    } catch (err) {
      setError(err?.response?.data?.message || "Payment received but upgrade failed. Contact support.");
    }
  }

  const currentPlan = plans.find(p => p.current);
  const savingsPct  = Math.round(((plans[1]?.monthlyPrice - plans[1]?.yearlyPrice) / (plans[1]?.monthlyPrice || 2999)) * 100) || 20;
  const downgradeLimits = downgradePlan ? (PLAN_LIMITS[downgradePlan.id] || { admins:1, users:5 }) : { admins:1, users:5 };

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0B0D14] min-h-screen font-poppins px-6 py-8">

      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-10 py-8 flex flex-col items-center gap-4 shadow-2xl">
            <svg className="animate-spin w-10 h-10 text-[#2563EB]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-[14px] font-semibold text-[#0F1117]">Preparing checkout…</p>
          </div>
        </div>
      )}

      {showDowngrade && downgradePlan && (
        <DowngradeWarningModal
          targetPlan={downgradePlan} currentAdmins={currentAdmins} currentUsers={currentUsers}
          targetAdminLimit={downgradeLimits.admins} targetUserLimit={downgradeLimits.users}
          onConfirm={handleDowngradeConfirmed} onCancel={() => { setShowDowngrade(false); setDowngradePlan(null); }}
        />
      )}
      {viewingInvoice && (
        <InvoiceReceipt invoice={{ ...viewingInvoice, invoiceId: viewingInvoice.id, customer: CUSTOMER }} onClose={() => setViewingInvoice(null)} />
      )}
      {showUpdatePayment && (
        <UpdatePaymentModal currentMethod={subscription?.paymentMethod} onSave={m => { setSubscription(p => ({...p, paymentMethod: m})); setShowUpdatePayment(false); }} onClose={() => setShowUpdatePayment(false)} />
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-[12px] font-semibold">
          {error}<button onClick={() => setError(null)} className="ml-4 text-[16px]">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Billing & Plans</h1>
          <p className="text-[13px] text-[#8B92A9] mt-0.5">
            {currentPlan
              ? <><span>You are on the </span><span className="font-semibold" style={{ color: currentPlan.color }}>{currentPlan.name} plan</span><span> · Renews {subscription?.renewsOn ?? "—"}</span></>
              : "Loading subscription…"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-1 mb-8 w-fit">
        {[{ k:"plans", l:"Upgrade Plan" }, { k:"features", l:"My Features" }, { k:"invoices", l:"Invoices" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition ${tab===t.k ? "bg-[#2563EB] text-white" : "text-[#4B5168] dark:text-[#7B829E] hover:bg-[#F1F4FF] dark:hover:bg-[#181B27]"}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── Plans tab ── */}
      {tab === "plans" && (
        <div>
          <div className="flex items-center justify-center gap-3 mb-8">
            <button onClick={() => setBilling("monthly")} className={`text-[13px] font-semibold ${billing==="monthly" ? "text-[#0F1117] dark:text-[#DDE1F5]" : "text-[#8B92A9]"}`}>Monthly</button>
            <button onClick={() => setBilling(b => b==="monthly" ? "yearly" : "monthly")}
              className={`relative w-12 h-6 rounded-full transition-colors ${billing==="yearly" ? "bg-[#2563EB]" : "bg-[#E4E7EF] dark:bg-[#2A2D3E]"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${billing==="yearly" ? "left-7" : "left-1"}`} />
            </button>
            <button onClick={() => setBilling("yearly")} className={`text-[13px] font-semibold ${billing==="yearly" ? "text-[#0F1117] dark:text-[#DDE1F5]" : "text-[#8B92A9]"}`}>
              Yearly <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[10px] font-bold">Save {savingsPct}%</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {plans.map(plan => (
              <PlanCard key={plan.id} plan={plan} billing={billing} selected={selected} onUpgrade={handleUpgrade} />
            ))}
          </div>

          {/* Feature comparison table */}
          <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133]">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Full feature comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F17]">
                    <th className="text-left px-6 py-3 text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide w-[35%]">Feature</th>
                    {plans.map(p => (
                      <th key={p.id} className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: p.color }}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Build rows from all unique feature keys across plans */}
                  {[...new Map(plans.flatMap(p => p.features).map(f => [f.key, f])).values()].map((feat, i) => (
                    <tr key={feat.key} className={`border-b border-[#E4E7EF] dark:border-[#1F2333] last:border-0 ${i%2!==0 ? "bg-[#FAFBFF] dark:bg-[#0F111A]" : "dark:bg-[#11131C]"}`}>
                      <td className="px-6 py-3 text-[#4B5168] dark:text-[#7B829E] font-medium">{feat.label}</td>
                      {plans.map(p => {
                        const f = p.features.find(x => x.key === feat.key);
                        return (
                          <td key={p.id} className="px-4 py-3 text-center">
                            {f?.enabled
                              ? <span className="flex justify-center"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></span>
                              : <span className="flex justify-center"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── My Features tab ── */}
      {tab === "features" && (
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133]">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Features on your plan</h2>
            <p className="text-[12px] text-[#8B92A9] mt-1">These are the features enabled for your company by your service provider.</p>
          </div>
          {!myFeatures ? (
            <Spinner />
          ) : (
            <div className="divide-y divide-[#E4E7EF] dark:divide-[#1F2333]">
              {myFeatures.map(feat => (
                <div key={feat.key} className="flex items-center justify-between px-6 py-3.5">
                  <span className="text-[13px] font-medium text-[#4B5168] dark:text-[#7B829E]">{feat.label}</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${feat.enabled ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: feat.enabled ? "#059669" : "#DC2626" }} />
                    {feat.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Invoices tab ── */}
      {tab === "invoices" && (
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
          {loadingInvoices ? <Spinner /> : (
            <>
              <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-between">
                <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Invoice history</h2>
              </div>
              <div className="divide-y divide-[#E4E7EF] dark:divide-[#1F2333]">
                {invoices.length === 0 ? (
                  <div className="px-6 py-12 text-center"><p className="text-[13px] text-[#8B92A9]">No invoices yet.</p></div>
                ) : invoices.map((inv, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-[#F8F9FC] dark:hover:bg-[#181B27] transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2040] flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{inv.id}</div>
                        <div className="text-[11px] text-[#8B92A9]">{inv.date}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{inv.amount}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669]">{inv.status}</span>
                      <button onClick={() => setViewingInvoice(inv)} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7C3AED] hover:underline">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {subscription && (
                <div className="px-6 py-4 border-t border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-between">
                  <span className="text-[12px] text-[#8B92A9]">Total paid: {subscription.totalPaid}</span>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] text-[#8B92A9]">Payment method</div>
                      <div className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{subscription.paymentMethod}</div>
                    </div>
                    <button onClick={() => setShowUpdatePayment(true)} className="px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] text-[11px] font-semibold text-[#4B5168] hover:border-[#2563EB] hover:text-[#2563EB] transition">Update card</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
