// ─────────────────────────────────────────────────────────────────────────────
//  UpgradePlan.jsx  (updated — integrates InvoiceReceipt + UpdatePaymentModal)
//
//  NEW IMPORTS:
//    import InvoiceReceipt    from "./InvoiceReceipt";
//    import UpdatePaymentModal from "./UpdatePaymentModal";
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import axios from "axios";
import InvoiceReceipt    from "./InvoiceReceipt";
import UpdatePaymentModal from "./UpdatePaymentModal";

const API = axios.create({ baseURL: "/api" });

API.interceptors.request.use(async (config) => {
  await new Promise((r) => setTimeout(r, 500));

  const MOCK = {
    "/plans": [
      {
        id: "starter",
        name: "Starter",
        desc: "Perfect for small teams just getting started",
        monthlyPrice: 999,
        yearlyPrice: 799,
        color: "#0891B2",
        popular: false,
        current: true,
        admins: "1",
        agents: "10",
        features: [
          "1 admins", "10 agents", "SMS & WhatsApp blast",
          "Basic dashboard", "Daily report (email)", "Email support",
        ],
        locked: [
          "Google Ads integration", "Facebook Ads integration",
          "API / Webhook access", "Call recordings", "Custom reports", "Priority support",
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
        admins: "3",
        agents: "30",
        features: [
          "3 admins", "30 agents", "SMS, WhatsApp & Email blast",
          "Advanced dashboard", "Daily report (email + PDF)",
          "Google Ads integration", "Facebook Ads integration",
          "Call recordings (30 days)", "API / Webhook access", "Priority support",
        ],
        locked: [
          "Unlimited leads", "Unlimited call recordings",
          "White-label CRM", "Dedicated account manager",
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
        admins: "5",
        agents: "50",
        features: [
          "5 admins", "50 agents", "All blast channels",
          "Full analytics suite", "Custom report builder",
          "Google & Facebook Ads", "API / Webhook access",
          "Unlimited call recordings", "White-label CRM",
          "Dedicated account manager", "SLA guarantee", "24/7 phone support",
        ],
        locked: [],
      },
    ],
    "/invoices": [
      { date: "01 Mar 2025", amount: "₹999",  baseAmount: 999,  status: "Paid", id: "INV-2025-03", planName: "Starter", billingCycle: "monthly", transactionId: "TXN1709251200001" },
      { date: "01 Feb 2025", amount: "₹999",  baseAmount: 999,  status: "Paid", id: "INV-2025-02", planName: "Starter", billingCycle: "monthly", transactionId: "TXN1706572800002" },
      { date: "01 Jan 2025", amount: "₹999",  baseAmount: 999,  status: "Paid", id: "INV-2025-01", planName: "Starter", billingCycle: "monthly", transactionId: "TXN1704067200003" },
      { date: "01 Dec 2024", amount: "₹999",  baseAmount: 999,  status: "Paid", id: "INV-2024-12", planName: "Starter", billingCycle: "monthly", transactionId: "TXN1701388800004" },
    ],
    "/subscription": {
      planName: "Starter",
      renewsOn: "01 Apr 2025",
      totalPaid: "₹3,996",
      paymentMethod: "Visa •••• 4242",
    },
  };

  for (const [path, data] of Object.entries(MOCK)) {
    if (config.url.startsWith(path)) {
      config.adapter = () =>
        Promise.resolve({ data, status: 200, statusText: "OK", headers: {}, config });
      break;
    }
  }
  return config;
});

// ─────────────────────────────────────────────
//  SEND INVOICE EMAIL
// ─────────────────────────────────────────────
const ADMIN_EMAIL       = "admin@yourdomain.com";
const SUPER_ADMIN_EMAIL = "superadmin@gmail.com";

async function sendInvoiceEmail({ invoiceId, planName, amount, billingCycle, transactionId }) {
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  try {
    await API.post("/notify-invoice", {
      invoiceId, planName, amount, billingCycle, transactionId, date,
      recipients: [ADMIN_EMAIL, SUPER_ADMIN_EMAIL],
    });
  } catch (err) {
    console.error("[Invoice email] Notification failed:", err);
  }
}

// ─────────────────────────────────────────────
//  SHARED ICONS
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  COMPARE TABLE DATA
// ─────────────────────────────────────────────
const COMPARE_ROWS = [
  { label: "Admins",          vals: ["1", "3", "5"] },
  { label: "Agents",          vals: ["10", "30", "50"] },
  { label: "SMS blast",       vals: [false, true, true] },
  { label: "WhatsApp blast",  vals: [false, true, true] },
  { label: "Email blast",     vals: [false, true, true] },
  { label: "Call recordings", vals: [false, "30 days", "Unlimited"] },
  { label: "Google Ads",      vals: [false, true, true] },
  { label: "Facebook Ads",    vals: [false, true, true] },
  { label: "API / Webhooks",  vals: [true, true, true] },
  { label: "Custom reports",  vals: [false, false, true] },
  { label: "White-label",     vals: [false, false, true] },
  { label: "Support",         vals: ["Email", "Priority", "24/7 phone"] },
];

// ─────────────────────────────────────────────
//  PLAN CARD
// ─────────────────────────────────────────────
function PlanCard({ plan, billing, selected, onUpgrade }) {
  const [hovered, setHovered] = useState(false);
  const price = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const isSel = selected === plan.id;

  const cardStyle = {
    transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
    transform: hovered ? "translateY(-4px)" : "none",
    ...(plan.popular
      ? { boxShadow: hovered ? `0 20px 48px ${plan.color}35` : "0 8px 30px rgba(37,99,235,0.15)" }
      : {
          boxShadow:   hovered ? `0 16px 40px ${plan.color}28` : "none",
          borderColor: hovered ? plan.color : undefined,
          borderWidth: hovered ? "2px" : undefined,
        }
    ),
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={cardStyle}
      className={`relative bg-white dark:bg-[#11131C] rounded-2xl overflow-hidden ${
        plan.popular
          ? "border-2 border-[#2563EB]"
          : "border border-[#E4E7EF] dark:border-[#1E2133]"
      }`}
    >
      <div className="h-1.5 w-full" style={{ background: plan.color }} />

      {plan.popular && !plan.current && (
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
          <span className="text-[32px] font-bold text-[#0F1117] dark:text-[#DDE1F5] leading-none">₹{price.toLocaleString()}</span>
          <span className="text-[13px] text-[#8B92A9] mb-1">/mo</span>
        </div>
        {billing === "yearly" && (
          <p className="text-[11px] text-[#8B92A9] mb-4">Billed ₹{(price * 12).toLocaleString()}/yr</p>
        )}

        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <span className="text-[11px] px-2 py-1 rounded-lg font-semibold" style={{ background: plan.color + "15", color: plan.color }}>{plan.agents} agents</span>
          <span className="text-[11px] px-2 py-1 rounded-lg font-semibold" style={{ background: plan.color + "15", color: plan.color }}>{plan.admins} admins</span>
        </div>

        <div className="space-y-2 mb-5">
          {plan.features.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <Check color={plan.color} />
              <span className="text-[12px] text-[#4B5168] dark:text-[#7B829E]">{f}</span>
            </div>
          ))}
          {plan.locked.map((f) => (
            <div key={f} className="flex items-center gap-2 opacity-40">
              <Lock />
              <span className="text-[12px] text-[#8B92A9] line-through">{f}</span>
            </div>
          ))}
        </div>

        {plan.current ? (
          <button disabled className="w-full py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] text-[13px] font-semibold text-[#8B92A9] dark:text-[#454A63] cursor-not-allowed">
            Current plan
          </button>
        ) : (
          <button
            onClick={() => onUpgrade(plan)}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              background: isSel ? plan.color : hovered ? plan.color + "25" : plan.color + "15",
              color: isSel ? "#fff" : plan.color,
            }}
          >
            {isSel ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Proceed to Pay ₹{price.toLocaleString()}
              </>
            ) : `Upgrade to ${plan.name}`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  RAZORPAY MOCK MODAL
// ─────────────────────────────────────────────
function RazorpayModal({ plan, billing, onSuccess, onClose }) {
  const price = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const [step, setStep]             = useState("pay");
  const [payMethod, setPayMethod]   = useState("card");
  const [transactionId, setTxnId]   = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry]         = useState("");
  const [cvv, setCvv]               = useState("");
  const [name, setName]             = useState("");
  const [upiId, setUpiId]           = useState("");
  const [upiVerified, setUpiVerified] = useState(null);
  const [selectedBank, setSelectedBank] = useState(null);
  const [error, setError]           = useState("");
  const [procMsg, setProcMsg]       = useState("Processing payment...");
  const [newInvoiceId, setNewInvoiceId] = useState("");

  const BANKS = [
    { id: "sbi",   label: "State Bank", short: "SBI",  color: "#002D62" },
    { id: "hdfc",  label: "HDFC",       short: "HDFC", color: "#004C8F" },
    { id: "icici", label: "ICICI",      short: "ICICI",color: "#F96922" },
    { id: "axis",  label: "Axis",       short: "AXIS", color: "#97144D" },
    { id: "kotak", label: "Kotak",      short: "KMB",  color: "#EE3124" },
    { id: "yes",   label: "Yes Bank",   short: "YES",  color: "#00549F" },
  ];

  const formatCard   = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (v) => { const c = v.replace(/\D/g, "").slice(0, 4); return c.length >= 3 ? c.slice(0,2)+"/"+c.slice(2) : c; };

  function startProcessing(msg) {
    const txn = "TXN" + Date.now().toString().slice(-10);
    const invId = "INV-" + new Date().toISOString().slice(0, 7) + "-" + Math.floor(Math.random() * 9000 + 1000);
    setTxnId(txn);
    setNewInvoiceId(invId);
    setProcMsg(msg || "Processing payment...");
    setStep("processing");
    setTimeout(() => {
      setStep("success");
      sendInvoiceEmail({ invoiceId: invId, planName: plan.name, amount: `₹${price.toLocaleString()}`, billingCycle: billing, transactionId: txn });
    }, 2500);
  }

  const handlePayCard = () => {
    if (!name.trim())                             return setError("Enter cardholder name.");
    if (cardNumber.replace(/\s/g,"").length < 16) return setError("Enter a valid 16-digit card number.");
    if (expiry.length < 5)                        return setError("Enter a valid expiry (MM/YY).");
    if (cvv.length < 3)                           return setError("Enter a valid CVV.");
    setError(""); startProcessing("Processing payment...");
  };
  const handleVerifyUPI = () => {
    const valid = /^[\w.\-]+@[\w]+$/.test(upiId.trim());
    setUpiVerified(valid);
    setError(valid ? "" : "Enter a valid UPI ID (e.g. name@upi).");
  };
  const handlePayUPI = () => {
    if (!upiId.trim()) return setError("Enter your UPI ID.");
    if (!upiVerified)  return setError("Verify your UPI ID first.");
    setError(""); startProcessing("Awaiting UPI confirmation...");
  };
  const handlePayNB = () => {
    if (!selectedBank) return setError("Please select a bank.");
    setError(""); startProcessing(`Redirecting to ${selectedBank.label}...`);
  };

  const TAB_STYLE = (active) => ({
    flex:1, padding:"10px 4px", fontSize:12, fontWeight:600, border:"none",
    borderBottom: active ? `2px solid ${plan.color}` : "2px solid transparent",
    background: active ? "white" : "#F8F9FC",
    color: active ? plan.color : "#8B92A9",
    cursor:"pointer", transition:"all 0.15s",
  });

  const inputCls = "mt-1 w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] bg-white text-[13px] text-[#0F1117] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white border border-[#E4E7EF] rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">

        <div className="px-6 py-4 flex items-center justify-between" style={{ background: plan.color }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={plan.color} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
            </div>
            <div>
              <p className="text-white text-[11px] opacity-80">Paying to</p>
              <p className="text-white text-[13px] font-bold">SkyUp CRM</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-[11px] opacity-80">{plan.name} Plan</p>
            <p className="text-white text-[20px] font-bold">₹{price.toLocaleString()}</p>
          </div>
        </div>

        {step === "pay" && (
          <div className="flex border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F17]">
            {[{id:"card",label:"Card"},{id:"upi",label:"UPI / QR"},{id:"netbanking",label:"Net banking"}].map((t) => (
              <button key={t.id} onClick={() => { setPayMethod(t.id); setError(""); }} style={TAB_STYLE(payMethod===t.id)}>{t.label}</button>
            ))}
          </div>
        )}

        {step === "processing" && (
          <div className="px-6 py-14 flex flex-col items-center gap-4">
            <svg className="animate-spin w-12 h-12 text-[#2563EB]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
            <p className="text-[14px] font-semibold text-[#0F1117]">{procMsg}</p>
            <p className="text-[12px] text-[#8B92A9]">Please do not close this window</p>
          </div>
        )}

        {step === "success" && (
          <div className="px-6 py-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-[16px] font-bold text-[#0F1117]">Payment Successful!</h3>
              <p className="text-[12px] text-[#8B92A9] mt-1">
                You are now on the <span className="font-semibold" style={{ color: plan.color }}>{plan.name}</span> plan
              </p>
              <p className="text-[11px] text-[#8B92A9] mt-1">₹{price.toLocaleString()} charged successfully</p>
            </div>
            <div className="w-full px-4 py-3 rounded-xl bg-[#F8F9FC] border border-[#E4E7EF] text-center">
              <p className="text-[11px] text-[#8B92A9]">Transaction ID</p>
              <p className="text-[12px] font-mono font-bold text-[#0F1117] mt-0.5">{transactionId}</p>
            </div>
            <div className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0]">
              <svg className="w-4 h-4 text-[#059669] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <div>
                <p className="text-[11px] font-semibold text-[#059669]">Invoice emailed successfully</p>
                <p className="text-[10px] text-[#059669]/80 mt-0.5">Sent to admin &amp; super admin</p>
              </div>
            </div>
            <button
              onClick={() => onSuccess({ transactionId, invoiceId: newInvoiceId, price, billing })}
              className="w-full py-3 rounded-xl text-white text-[13px] font-semibold transition hover:opacity-90"
              style={{ background: plan.color }}
            >
              Continue to Dashboard
            </button>
          </div>
        )}

        {step === "pay" && (
          <div className="px-6 py-5">
            {error && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                <p className="text-[11px] text-red-600">{error}</p>
              </div>
            )}

            {payMethod === "card" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-[#8B92A9] uppercase tracking-wide">Cardholder Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className={inputCls}/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#8B92A9] uppercase tracking-wide">Card Number</label>
                  <input type="text" value={cardNumber} onChange={(e) => setCardNumber(formatCard(e.target.value))} placeholder="1234 5678 9012 3456" maxLength={19} className={inputCls + " font-mono"}/>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-[#8B92A9] uppercase tracking-wide">Expiry</label>
                    <input type="text" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5} className={inputCls + " font-mono"}/>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-[#8B92A9] uppercase tracking-wide">CVV</label>
                    <input type="password" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g,"").slice(0,3))} placeholder="•••" maxLength={3} className={inputCls + " font-mono"}/>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] text-[13px] font-semibold text-[#4B5168] hover:bg-[#F1F4FF] transition">Cancel</button>
                  <button onClick={handlePayCard} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition hover:opacity-90" style={{ background: plan.color }}>
                    Pay ₹{price.toLocaleString()}
                  </button>
                </div>
              </div>
            )}

            {payMethod === "upi" && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-[#E4E7EF]"/><span className="text-[10px] text-[#8B92A9]">enter UPI ID</span><div className="flex-1 h-px bg-[#E4E7EF]"/>
                </div>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={upiId} onChange={(e) => { setUpiId(e.target.value); setUpiVerified(null); }} placeholder="yourname@okaxis" className={inputCls}/>
                  <button onClick={handleVerifyUPI} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] text-[12px] font-semibold text-[#2563EB] hover:bg-[#EEF3FF] transition">Verify</button>
                </div>
                {upiVerified === true && (
                  <p className="text-[11px] text-green-600 flex items-center gap-1 mb-2">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    UPI ID verified
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] text-[13px] font-semibold text-[#4B5168] hover:bg-[#F1F4FF] transition">Cancel</button>
                  <button onClick={handlePayUPI} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition hover:opacity-90" style={{ background: plan.color }}>Pay ₹{price.toLocaleString()}</button>
                </div>
              </div>
            )}

            {payMethod === "netbanking" && (
              <div>
                <p className="text-[10px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-3">Select your bank</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {BANKS.map((bank) => {
                    const isSel = selectedBank?.id === bank.id;
                    return (
                      <button key={bank.id} onClick={() => setSelectedBank(bank)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition"
                        style={{ borderColor: isSel ? plan.color : "#E4E7EF", background: isSel ? plan.color+"12" : "transparent" }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ background: bank.color }}>{bank.short.slice(0,3)}</div>
                        <span className="text-[12px] font-semibold text-[#0F1117]">{bank.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-1">
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] text-[13px] font-semibold text-[#4B5168] hover:bg-[#F1F4FF] transition">Cancel</button>
                  <button onClick={handlePayNB} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition hover:opacity-90" style={{ background: plan.color }}>Pay ₹{price.toLocaleString()}</button>
                </div>
              </div>
            )}
            <p className="text-[10px] text-[#8B92A9] text-center mt-4">Secured by <span className="font-bold text-[#2563EB]">Razorpay</span></p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────
export default function UpgradePlan({ onPlanChange }) {
  const [billing, setBilling]       = useState("monthly");
  const [selected, setSelected]     = useState(null);
  const [tab, setTab]               = useState("plans");
  const [payingPlan, setPayingPlan] = useState(null);

  const [plans, setPlans]               = useState([]);
  const [invoices, setInvoices]         = useState([]);
  const [subscription, setSubscription] = useState(null);

  const [loadingPlans, setLoadingPlans]       = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError]                     = useState(null);

  // ── NEW state ──────────────────────────────────────────────────────────
  const [viewingInvoice, setViewingInvoice]         = useState(null);   // open InvoiceReceipt modal
  const [showUpdatePayment, setShowUpdatePayment]   = useState(false);  // open UpdatePaymentModal

  // Customer details — replace with real auth/session data
  const CUSTOMER = {
    name:    "Acme Corp",
    email:   "billing@acmecorp.com",
    address: "12, MG Road, Bengaluru – 560001, Karnataka",
    gstin:   "29AABCU9603R1ZX",
  };

  useEffect(() => {
    if (tab === "plans"    && plans.length === 0)    fetchPlans();
    if (tab === "invoices" && invoices.length === 0) fetchInvoices();
  }, [tab]);

  async function fetchPlans() {
    setLoadingPlans(true); setError(null);
    try { const { data } = await API.get("/plans"); setPlans(data); }
    catch { setError("Failed to load plans. Please try again."); }
    finally { setLoadingPlans(false); }
  }

  async function fetchInvoices() {
    setLoadingInvoices(true); setError(null);
    try {
      const [invRes, subRes] = await Promise.all([API.get("/invoices"), API.get("/subscription")]);
      setInvoices(invRes.data); setSubscription(subRes.data);
    } catch { setError("Failed to load invoices."); }
    finally { setLoadingInvoices(false); }
  }

  function handleUpgrade(plan) {
    if (plan.current) return;
    if (selected !== plan.id) { setSelected(plan.id); return; }
    setPayingPlan(plan);
  }

  // ── updated: receives transactionId from RazorpayModal success ─────────
  async function handlePaymentSuccess({ transactionId, invoiceId, price, billing: cycle }) {
    const plan = payingPlan;
    setPayingPlan(null); setSelected(null);

    // Immediately add new invoice to list
    const newInv = {
      id: invoiceId,
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      amount: `₹${price.toLocaleString()}`,
      baseAmount: price,
      status: "Paid",
      planName: plan.name,
      billingCycle: cycle,
      transactionId,
    };
    setInvoices((prev) => [newInv, ...prev]);

    try {
      await API.post("/upgrade", { planId: plan.id, billing });
      setPlans((prev) => prev.map((p) => ({ ...p, current: p.id === plan.id })));
      if (onPlanChange) onPlanChange(plan.id);
    } catch { setError("Plan update failed. Contact support."); }
  }

  // ── payment method update ───────────────────────────────────────────────
  function handlePaymentMethodSaved(newMethod) {
    setSubscription((prev) => ({ ...prev, paymentMethod: newMethod }));
    setShowUpdatePayment(false);
  }

  const currentPlan = plans.find((p) => p.current);
  const growthPlan  = plans.find((p) => p.id === "growth");
  const savingsPct  = growthPlan
    ? Math.round(((growthPlan.monthlyPrice - growthPlan.yearlyPrice) / growthPlan.monthlyPrice) * 100)
    : 20;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0B0D14] min-h-screen font-poppins px-6 py-8">

      {/* ── Razorpay payment modal ── */}
      {payingPlan && (
        <RazorpayModal
          plan={payingPlan}
          billing={billing}
          onSuccess={handlePaymentSuccess}
          onClose={() => { setPayingPlan(null); setSelected(null); }}
        />
      )}

      {/* ── Invoice receipt modal ── */}
      {viewingInvoice && (
        <InvoiceReceipt
          invoice={{ ...viewingInvoice, invoiceId: viewingInvoice.id, customer: CUSTOMER }}
          onClose={() => setViewingInvoice(null)}
        />
      )}

      {/* ── Update payment modal ── */}
      {showUpdatePayment && (
        <UpdatePaymentModal
          currentMethod={subscription?.paymentMethod}
          onSave={handlePaymentMethodSaved}
          onClose={() => setShowUpdatePayment(false)}
        />
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-[12px] font-semibold">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-[16px] leading-none">×</button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Billing & Plans</h1>
          <p className="text-[13px] text-[#8B92A9] mt-0.5">
            {currentPlan
              ? <><span>You are on the </span><span className="font-semibold text-[#0891B2]">{currentPlan.name} plan</span><span> · Renews {subscription?.renewsOn ?? "—"}</span></>
              : "Loading subscription…"
            }
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-1 mb-8 w-fit">
        {[{ k:"plans", l:"Upgrade plan" }, { k:"invoices", l:"Invoices" }].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition ${
              tab === t.k ? "bg-[#2563EB] text-white" : "text-[#4B5168] dark:text-[#7B829E] hover:bg-[#F1F4FF] dark:hover:bg-[#181B27]"
            }`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ══ PLANS TAB ══ */}
      {tab === "plans" && (
        <div>
          {loadingPlans ? <Spinner /> : (
            <>
              <div className="flex items-center justify-center gap-3 mb-8">
                <button onClick={() => setBilling("monthly")}
                  className={`text-[13px] font-semibold transition ${billing==="monthly" ? "text-[#0F1117] dark:text-[#DDE1F5]" : "text-[#8B92A9]"}`}>
                  Monthly
                </button>
                <button onClick={() => setBilling(billing==="monthly" ? "yearly" : "monthly")}
                  className={`relative w-12 h-6 rounded-full transition-colors ${billing==="yearly" ? "bg-[#2563EB]" : "bg-[#E4E7EF] dark:bg-[#2A2D3E]"}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${billing==="yearly" ? "left-7" : "left-1"}`}/>
                </button>
                <button onClick={() => setBilling("yearly")}
                  className={`text-[13px] font-semibold transition ${billing==="yearly" ? "text-[#0F1117] dark:text-[#DDE1F5]" : "text-[#8B92A9]"}`}>
                  Yearly
                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-[#0C2A1A] text-[#059669] dark:text-[#34D399] text-[10px] font-bold">Save {savingsPct}%</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                {plans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} billing={billing} selected={selected} onUpgrade={handleUpgrade}/>
                ))}
              </div>

              {plans.length > 0 && (
                <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133]">
                    <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Full feature comparison</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F17]">
                          <th className="text-left px-6 py-3 text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide w-[40%]">Feature</th>
                          {plans.map((p) => (
                            <th key={p.id} className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: p.color }}>{p.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {COMPARE_ROWS.map((row, i) => (
                          <tr key={row.label} className={`border-b border-[#E4E7EF] dark:border-[#1F2333] last:border-0 ${i%2!==0 ? "bg-[#FAFBFF] dark:bg-[#0F111A]" : "dark:bg-[#11131C]"}`}>
                            <td className="px-6 py-3 text-[#4B5168] dark:text-[#7B829E] font-medium">{row.label}</td>
                            {row.vals.map((v, vi) => (
                              <td key={vi} className="px-4 py-3 text-center">
                                {v===true ? (
                                  <span className="flex justify-center"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></span>
                                ) : v===false ? (
                                  <span className="flex justify-center"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></span>
                                ) : (
                                  <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{v}</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ INVOICES TAB ══ */}
      {tab === "invoices" && (
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
          {loadingInvoices ? <Spinner /> : (
            <>
              <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-between">
                <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Invoice history</h2>
                <span className="text-[12px] text-[#8B92A9]">
                  {subscription ? `${subscription.planName} plan · ₹${plans.find((p) => p.current)?.monthlyPrice?.toLocaleString() ?? "—"}/mo` : "—"}
                </span>
              </div>
              <div className="divide-y divide-[#E4E7EF] dark:divide-[#1F2333]">
                {invoices.map((inv, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-[#F8F9FC] dark:hover:bg-[#181B27] transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2040] flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{inv.id}</div>
                        <div className="text-[11px] text-[#8B92A9]">{inv.date}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{inv.amount}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669]">{inv.status}</span>
                      {/* ── View invoice button (NEW) ── */}
                      <button
                        onClick={() => setViewingInvoice(inv)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7C3AED] hover:underline"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
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
                    {/* ── Update card button now opens UpdatePaymentModal ── */}
                    <button
                      onClick={() => setShowUpdatePayment(true)}
                      className="px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] text-[11px] font-semibold text-[#4B5168] dark:text-[#7B829E] hover:border-[#2563EB] hover:text-[#2563EB] transition"
                    >
                      Update card
                    </button>
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