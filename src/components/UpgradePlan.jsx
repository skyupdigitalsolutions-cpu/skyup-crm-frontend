// ─────────────────────────────────────────────────────────────────────────────
//  UpgradePlan.jsx  (updated — integrates InvoiceReceipt + UpdatePaymentModal)
//
//  NEW IMPORTS:
//    import InvoiceReceipt    from "./InvoiceReceipt";
//    import UpdatePaymentModal from "./UpdatePaymentModal";
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import api from "../data/axiosConfig";
import InvoiceReceipt from "./InvoiceReceipt";
import UpdatePaymentModal from "./UpdatePaymentModal";

// ─────────────────────────────────────────────
//  SEND INVOICE EMAIL
// ─────────────────────────────────────────────
async function sendInvoiceEmail({
  invoiceId,
  planName,
  amount,
  billingCycle,
  transactionId,
}) {
  const date = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  try {
    await api.post("/razorpay/notify-invoice", {
      invoiceId,
      planName,
      amount,
      billingCycle,
      transactionId,
      date,
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
    <svg
      className="w-4 h-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke={color || "#059669"}
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
function Lock() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0 text-[#8B92A9]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}
function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg
        className="animate-spin w-7 h-7 text-[#2563EB]"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
//  COMPARE TABLE DATA
// ─────────────────────────────────────────────
const COMPARE_ROWS = [
  { label: "Admins", vals: ["1", "3", "5"] },
  { label: "Agents", vals: ["10", "30", "50"] },
  { label: "SMS blast", vals: [false, true, true] },
  { label: "WhatsApp blast", vals: [false, true, true] },
  { label: "Email blast", vals: [false, true, true] },
  { label: "Call recordings", vals: [false, "30 days", "Unlimited"] },
  { label: "Google Ads", vals: [false, true, true] },
  { label: "Facebook Ads", vals: [false, true, true] },
  { label: "API / Webhooks", vals: [true, true, true] },
  { label: "Custom reports", vals: [false, false, true] },
  { label: "White-label", vals: [false, false, true] },
  { label: "Support", vals: ["Email", "Priority", "24/7 phone"] },
];

// ─────────────────────────────────────────────
//  PLAN CARD
// ─────────────────────────────────────────────
function PlanCard({ plan, billing, selected, onUpgrade }) {
  const [hovered, setHovered] = useState(false);
  const price = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const isSel = selected === plan.id;

  // After
  const cardStyle = {
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    transform: hovered ? "translateY(-4px)" : "none",
    boxShadow: plan.popular
      ? hovered
        ? `0 20px 48px ${plan.color}35`
        : "0 8px 30px rgba(37,99,235,0.15)"
      : hovered
        ? `0 16px 40px ${plan.color}28`
        : "none",
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // After
      className="relative bg-white dark:bg-[#11131C] rounded-2xl overflow-hidden border-2"
      style={{
        ...cardStyle,
        borderColor: plan.popular ? "#2563EB" : plan.color,
      }}
    >
      <div className="h-1.5 w-full" style={{ background: plan.color }} />

      {plan.popular && !plan.current && (
        <div className="absolute top-4 right-4">
          <span className="px-2.5 py-1 rounded-full bg-[#2563EB] text-white text-[10px] font-bold">
            Most popular
          </span>
        </div>
      )}
      {plan.current && (
        <div className="absolute top-4 right-4">
          <span className="px-2.5 py-1 rounded-full bg-[#EEF3FF] dark:bg-[#1A2040] text-[#2563EB] text-[10px] font-bold">
            Current plan
          </span>
        </div>
      )}

      <div className="p-6">
        <h3 className="text-[16px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">
          {plan.name}
        </h3>
        <p className="text-[12px] text-[#8B92A9] mt-1 mb-4">{plan.desc}</p>

        <div className="flex items-end gap-1 mb-1">
          <span className="text-[32px] font-bold text-[#0F1117] dark:text-[#DDE1F5] leading-none">
            ₹{price.toLocaleString()}
          </span>
          <span className="text-[13px] text-[#8B92A9] mb-1">/mo</span>
        </div>
        {billing === "yearly" && (
          <p className="text-[11px] text-[#8B92A9] mb-4">
            Billed ₹{(price * 12).toLocaleString()}/yr
          </p>
        )}

        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <span
            className="text-[11px] px-2 py-1 rounded-lg font-semibold"
            style={{ background: plan.color + "15", color: plan.color }}
          >
            {plan.agents} agents
          </span>
          <span
            className="text-[11px] px-2 py-1 rounded-lg font-semibold"
            style={{ background: plan.color + "15", color: plan.color }}
          >
            {plan.admins} admins
          </span>
        </div>

        <div className="space-y-2 mb-5">
          {plan.features.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <Check color={plan.color} />
              <span className="text-[12px] text-[#4B5168] dark:text-[#7B829E]">
                {f}
              </span>
            </div>
          ))}
          {plan.locked.map((f) => (
            <div key={f} className="flex items-center gap-2 opacity-40">
              <Lock />
              <span className="text-[12px] text-[#8B92A9] line-through">
                {f}
              </span>
            </div>
          ))}
        </div>

        {plan.current ? (
          <button
            disabled
            className="w-full py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] text-[13px] font-semibold text-[#8B92A9] dark:text-[#454A63] cursor-not-allowed"
          >
            Current plan
          </button>
        ) : (
          <button
            onClick={() => onUpgrade(plan)}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              background: isSel
                ? plan.color
                : hovered
                  ? plan.color + "25"
                  : plan.color + "15",
              color: isSel ? "#fff" : plan.color,
            }}
          >
            {isSel ? (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                Proceed to Pay ₹{price.toLocaleString()}
              </>
            ) : (
              `Upgrade to ${plan.name}`
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  RAZORPAY HOOK
// ─────────────────────────────────────────────
function useRazorpay() {
  const loadScript = () =>
    new Promise((resolve) => {
      if (document.getElementById("razorpay-sdk")) return resolve(true);
      const script = document.createElement("script");
      script.id = "razorpay-sdk";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const openCheckout = useCallback(async ({ orderData, plan, billing, onSuccess, onFailure }) => {
    const loaded = await loadScript();
    if (!loaded) {
      onFailure("Failed to load Razorpay SDK. Check your internet connection.");
      return;
    }

    const rzp = new window.Razorpay({
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "SkyUp CRM",
      description: `${orderData.planName} Plan – ${billing}`,
      order_id: orderData.orderId,
      theme: { color: plan.color },
      handler: (response) => onSuccess(response),
      modal: { ondismiss: () => onFailure(null) },
    });
    rzp.on("payment.failed", (resp) =>
      onFailure(resp.error?.description || "Payment failed. Please try again.")
    );
    rzp.open();
  }, []);

  return { openCheckout };
}

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────
export default function UpgradePlan({ onPlanChange }) {
  const [billing, setBilling] = useState("monthly");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("plans");
  const [paying, setPaying] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState(null);

  const [invoices, setInvoices] = useState([]);
  const [subscription, setSubscription] = useState(null);

  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState(null);

  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [showUpdatePayment, setShowUpdatePayment] = useState(false);

  const { openCheckout } = useRazorpay();

  const PLANS_DEF = [
    {
      id: "starter",
      name: "Starter",
      desc: "Perfect for small teams just getting started",
      monthlyPrice: 999,
      yearlyPrice: 799,
      color: "#0891B2",
      popular: false,
      admins: "1",
      agents: "10",
      features: [
        "1 admins",
        "10 agents",
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
      admins: "3",
      agents: "30",
      features: [
        "3 admins",
        "30 agents",
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
      admins: "5",
      agents: "50",
      features: [
        "5 admins",
        "50 agents",
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

  const plans = PLANS_DEF.map((p) => ({ ...p, current: p.id === currentPlanId }));

  // Customer details from localStorage
  const CUSTOMER = (() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return {
        name:    user.companyName || user.name || "—",
        email:   user.email || "—",
        address: user.address || "—",
        gstin:   user.gstin || "",
      };
    } catch {
      return { name: "—", email: "—", address: "—", gstin: "" };
    }
  })();

  useEffect(() => {
    fetchSubscription();
  }, []);

  useEffect(() => {
    if (tab === "invoices" && invoices.length === 0) fetchInvoices();
  }, [tab]);

  async function fetchSubscription() {
    try {
      const { data } = await api.get("/razorpay/subscription");
      setSubscription(data);
      const nameToId = { Starter: "starter", Growth: "growth", Enterprise: "enterprise" };
      setCurrentPlanId(nameToId[data.planName] || "starter");
    } catch {
      setCurrentPlanId("starter");
    }
  }

  async function fetchInvoices() {
    setLoadingInvoices(true);
    setError(null);
    try {
      const { data } = await api.get("/razorpay/invoices");
      setInvoices(data);
    } catch {
      setError("Failed to load invoices.");
    } finally {
      setLoadingInvoices(false);
    }
  }

  function handleUpgrade(plan) {
    if (plan.current) return;
    if (selected !== plan.id) {
      setSelected(plan.id);
      return;
    }
    initiatePayment(plan);
  }

  async function initiatePayment(plan) {
    setPaying(true);
    setError(null);
    try {
      const { data: orderData } = await api.post("/razorpay/create-order", {
        planId: plan.id,
        billing,
      });
      openCheckout({
        orderData,
        plan,
        billing,
        onSuccess: (razorpayResponse) => handlePaymentSuccess(plan, razorpayResponse),
        onFailure: (msg) => {
          setPaying(false);
          if (msg) setError(msg);
          setSelected(null);
        },
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Could not initiate payment. Try again.");
    } finally {
      setPaying(false);
    }
  }

  async function handlePaymentSuccess(plan, razorpayResponse) {
    setError(null);
    try {
      const { data } = await api.post("/razorpay/verify-payment", {
        razorpay_order_id:   razorpayResponse.razorpay_order_id,
        razorpay_payment_id: razorpayResponse.razorpay_payment_id,
        razorpay_signature:  razorpayResponse.razorpay_signature,
        planId: plan.id,
        billing,
      });

      const newInv = {
        id: data.invoiceId,
        date: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        amount: `₹${data.amount.toLocaleString("en-IN")}`,
        baseAmount: data.amount,
        status: "Paid",
        planName: data.planName,
        billingCycle: data.billing,
        transactionId: data.transactionId,
      };
      setInvoices((prev) => [newInv, ...prev]);
      setCurrentPlanId(plan.id);
      setSelected(null);
      fetchSubscription();
      if (onPlanChange) onPlanChange(plan.id);
      sendInvoiceEmail({
        invoiceId: data.invoiceId,
        planName: data.planName,
        amount: `₹${data.amount}`,
        billingCycle: data.billing,
        transactionId: data.transactionId,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        "Payment received but plan upgrade failed. Contact support with your payment ID."
      );
    }
  }

  // ── payment method update ───────────────────────────────────────────────
  function handlePaymentMethodSaved(newMethod) {
    setSubscription((prev) => ({ ...prev, paymentMethod: newMethod }));
    setShowUpdatePayment(false);
  }

  const currentPlan = plans.find((p) => p.current);
  const growthPlan = plans.find((p) => p.id === "growth");
  const savingsPct = growthPlan
    ? Math.round(
        ((growthPlan.monthlyPrice - growthPlan.yearlyPrice) /
          growthPlan.monthlyPrice) *
          100,
      )
    : 20;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0B0D14] min-h-screen font-poppins px-6 py-8">
      {/* ── Razorpay preparing checkout overlay ── */}
      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-10 py-8 flex flex-col items-center gap-4 shadow-2xl">
            <svg
              className="animate-spin w-10 h-10 text-[#2563EB]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <p className="text-[14px] font-semibold text-[#0F1117]">Preparing checkout…</p>
          </div>
        </div>
      )}

      {/* ── Invoice receipt modal ── */}
      {viewingInvoice && (
        <InvoiceReceipt
          invoice={{
            ...viewingInvoice,
            invoiceId: viewingInvoice.id,
            customer: CUSTOMER,
          }}
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
          <button
            onClick={() => setError(null)}
            className="ml-4 text-[16px] leading-none"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">
            Billing & Plans
          </h1>
          <p className="text-[13px] text-[#8B92A9] mt-0.5">
            {currentPlan ? (
              <>
                <span>You are on the </span>
                <span className="font-semibold text-[#0891B2]">
                  {currentPlan.name} plan
                </span>
                <span> · Renews {subscription?.renewsOn ?? "—"}</span>
              </>
            ) : (
              "Loading subscription…"
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-1 mb-8 w-fit">
        {[
          { k: "plans", l: "Upgrade plan" },
          { k: "invoices", l: "Invoices" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition ${
              tab === t.k
                ? "bg-[#2563EB] text-white"
                : "text-[#4B5168] dark:text-[#7B829E] hover:bg-[#F1F4FF] dark:hover:bg-[#181B27]"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* ══ PLANS TAB ══ */}
      {tab === "plans" && (
        <div>
          <>
            <div className="flex items-center justify-center gap-3 mb-8">
              <button
                onClick={() => setBilling("monthly")}
                className={`text-[13px] font-semibold transition ${billing === "monthly" ? "text-[#0F1117] dark:text-[#DDE1F5]" : "text-[#8B92A9]"}`}
              >
                Monthly
              </button>
              <button
                onClick={() =>
                  setBilling(billing === "monthly" ? "yearly" : "monthly")
                }
                className={`relative w-12 h-6 rounded-full transition-colors ${billing === "yearly" ? "bg-[#2563EB]" : "bg-[#E4E7EF] dark:bg-[#2A2D3E]"}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${billing === "yearly" ? "left-7" : "left-1"}`}
                />
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`text-[13px] font-semibold transition ${billing === "yearly" ? "text-[#0F1117] dark:text-[#DDE1F5]" : "text-[#8B92A9]"}`}
              >
                Yearly
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-[#0C2A1A] text-[#059669] dark:text-[#34D399] text-[10px] font-bold">
                  Save {savingsPct}%
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  billing={billing}
                  selected={selected}
                  onUpgrade={handleUpgrade}
                />
              ))}
            </div>

            {plans.length > 0 && (
              <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133]">
                  <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">
                    Full feature comparison
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F17]">
                        <th className="text-left px-6 py-3 text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide w-[40%]">
                          Feature
                        </th>
                        {plans.map((p) => (
                          <th
                            key={p.id}
                            className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap"
                            style={{ color: p.color }}
                          >
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARE_ROWS.map((row, i) => (
                        <tr
                          key={row.label}
                          className={`border-b border-[#E4E7EF] dark:border-[#1F2333] last:border-0 ${i % 2 !== 0 ? "bg-[#FAFBFF] dark:bg-[#0F111A]" : "dark:bg-[#11131C]"}`}
                        >
                          <td className="px-6 py-3 text-[#4B5168] dark:text-[#7B829E] font-medium">
                            {row.label}
                          </td>
                          {row.vals.map((v, vi) => (
                            <td key={vi} className="px-4 py-3 text-center">
                              {v === true ? (
                                <span className="flex justify-center">
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="#059669"
                                    strokeWidth={2.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                </span>
                              ) : v === false ? (
                                <span className="flex justify-center">
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="#DC2626"
                                    strokeWidth={2.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </span>
                              ) : (
                                <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">
                                  {v}
                                </span>
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
        </div>
      )}

      {/* ══ INVOICES TAB ══ */}
      {tab === "invoices" && (
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
          {loadingInvoices ? (
            <Spinner />
          ) : (
            <>
              <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-between">
                <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">
                  Invoice history
                </h2>
                <span className="text-[12px] text-[#8B92A9]">
                  {subscription
                    ? `${subscription.planName} plan · ₹${plans.find((p) => p.current)?.monthlyPrice?.toLocaleString() ?? "—"}/mo`
                    : "—"}
                </span>
              </div>
              <div className="divide-y divide-[#E4E7EF] dark:divide-[#1F2333]">
                {invoices.map((inv, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-6 py-4 hover:bg-[#F8F9FC] dark:hover:bg-[#181B27] transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2040] flex items-center justify-center shrink-0">
                        <svg
                          className="w-4 h-4 text-[#2563EB]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">
                          {inv.id}
                        </div>
                        <div className="text-[11px] text-[#8B92A9]">
                          {inv.date}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">
                        {inv.amount}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669]">
                        {inv.status}
                      </span>
                      {/* ── View invoice button (NEW) ── */}
                      <button
                        onClick={() => setViewingInvoice(inv)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7C3AED] hover:underline"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {subscription && (
                <div className="px-6 py-4 border-t border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-between">
                  <span className="text-[12px] text-[#8B92A9]">
                    Total paid: {subscription.totalPaid}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] text-[#8B92A9]">
                        Payment method
                      </div>
                      <div className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">
                        {subscription.paymentMethod}
                      </div>
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