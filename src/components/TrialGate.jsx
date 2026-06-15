// src/components/TrialGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Drop-in gate for the 7-day Pro trial + auto-billing flow.
//
// Mount ONCE high in the authenticated admin app (e.g. inside your admin layout,
// after login), like:  <TrialGate />
//
// Behaviour (driven entirely by GET /api/trial/status):
//   • needsPaymentMethod → full-screen modal: "Add a payment method to start your
//        7-day Pro trial". Opens Razorpay Checkout (recurring mandate), then
//        verifies and starts the trial.
//   • trialExpired       → full-screen modal: "Trial ended — pick a plan". Plans
//        charge the SAVED method automatically (no card re-entry).
//   • trialActive        → thin banner with days remaining (non-blocking).
//   • otherwise          → renders nothing.
//
// Requires: backend routes/trialRoute.js mounted at /api/trial.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { Loader2, ShieldCheck, CreditCard, AlertTriangle, Check } from "lucide-react";
import api from "../data/axiosConfig";

// Plan catalog — prices/ids mirror the backend (controllers/trialController PLANS).
const PLANS = [
  { id: "starter", name: "Basic",   monthly: 999,  yearly: 799,  blurb: "1 admin · 10 agents" },
  { id: "growth",  name: "Pro",     monthly: 2499, yearly: 1999, blurb: "3 admins · 30 agents", popular: true },
  { id: "advance", name: "Advance", monthly: 5999, yearly: 4799, blurb: "5 admins · 50 agents" },
];

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    if (document.getElementById("razorpay-sdk")) {
      document.getElementById("razorpay-sdk").addEventListener("load", () => resolve(true));
      return;
    }
    const s = document.createElement("script");
    s.id = "razorpay-sdk";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function TrialGate() {
  const [status, setStatus]   = useState(null);   // /trial/status payload
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState("");
  const [billing, setBilling] = useState("monthly");

  const fetchStatus = useCallback(async () => {
    // Only admins / super_admins manage billing. Skip for developers + employees.
    let role = null;
    try { role = JSON.parse(localStorage.getItem("user") || "null")?.role || null; } catch {}
    if (role === "developer" || role === "user") { setLoading(false); return; }

    try {
      const { data } = await api.get("/trial/status");
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ── Step 1: register a payment method (mandate) and start the trial ──────────
  const addPaymentMethod = async () => {
    setBusy(true); setError("");
    try {
      const ok = await loadRazorpay();
      if (!ok) { setError("Could not load the payment SDK. Check your connection."); setBusy(false); return; }

      const { data: order } = await api.post("/trial/mandate/create-order");

      const rzp = new window.Razorpay({
        key:         order.keyId,
        order_id:    order.orderId,
        customer_id: order.customerId,
        recurring:   1,
        amount:      order.amount,
        currency:    order.currency,
        name:        "SkyUp CRM",
        description: "Start your 7-day Pro trial — save your payment method",
        theme:       { color: "#2563EB" },
        handler: async (res) => {
          try {
            await api.post("/trial/mandate/verify", {
              razorpay_order_id:   res.razorpay_order_id,
              razorpay_payment_id: res.razorpay_payment_id,
              razorpay_signature:  res.razorpay_signature,
            });
            await fetchStatus();
          } catch (e) {
            setError(e.response?.data?.message || "Could not verify your payment method.");
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", (r) => {
        setError(r.error?.description || "Payment authorization failed.");
        setBusy(false);
      });
      rzp.open();
    } catch (e) {
      setError(e.response?.data?.message || "Could not start the trial.");
      setBusy(false);
    }
  };

  // ── Step 2: pick a plan after the trial → auto-charge the saved method ───────
  const selectPlan = async (planId) => {
    setBusy(true); setError("");
    try {
      await api.post("/trial/select-plan", { planId, billing });
      await fetchStatus();
      // Reload so entitlement-gated UI unlocks everywhere.
      window.location.reload();
    } catch (e) {
      const code = e.response?.data?.code;
      setError(
        code === "CHARGE_FAILED"
          ? (e.response?.data?.message || "Automatic payment failed. Please update your payment method.")
          : (e.response?.data?.message || "Could not activate the plan.")
      );
      setBusy(false);
    }
  };

  if (loading || !status) return null;

  // ── Thin banner while the trial is active ────────────────────────────────────
  if (status.trialActive && !status.needsPaymentMethod) {
    return (
      <div className="w-full bg-[#EEF3FF] dark:bg-[#1A2540] border-b border-[#C7D7FF] dark:border-[#2D3A6B] px-4 py-2 flex items-center justify-center gap-2 text-[13px]">
        <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
        <span className="text-[#2563EB] dark:text-[#9DB4FF] font-semibold">
          Pro trial active — {status.daysRemaining} day{status.daysRemaining === 1 ? "" : "s"} left.
        </span>
        <span className="text-[#4B5168] dark:text-[#9DA3BB]">
          You won't be charged until you choose a plan.
        </span>
      </div>
    );
  }

  const needPayment = status.needsPaymentMethod;
  const expired     = status.trialExpired;
  if (!needPayment && !expired) return null;

  // ── Full-screen blocking modal ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 bg-[#2563EB]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              {needPayment ? <CreditCard className="w-5 h-5 text-white" /> : <AlertTriangle className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-white leading-none">
                {needPayment ? "Start your 7-day Pro trial" : "Your free trial has ended"}
              </h2>
              <p className="text-[12px] text-white/80 mt-1">
                {needPayment
                  ? "Add a payment method to unlock full Pro access"
                  : "Pick a plan to keep working — no card re-entry needed"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {needPayment ? (
            <>
              <ul className="space-y-2 mb-5">
                {[
                  "7 days of full Pro access, free.",
                  "Your payment method is saved securely with Razorpay.",
                  "You're not charged during the trial.",
                  "After 7 days, pick a plan and we continue automatically — no re-entering card details.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[13px] text-[#4B5168] dark:text-[#9DA3BB]">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
              {error && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[12px] text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              <button
                onClick={addPaymentMethod}
                disabled={busy}
                className="w-full py-3 rounded-xl bg-[#2563EB] text-white text-[14px] font-bold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {busy ? "Opening secure checkout…" : "Add payment method & start trial"}
              </button>
              <p className="text-[11px] text-[#8B92A9] text-center mt-2">
                Secured by Razorpay. Cancel anytime before the trial ends to avoid charges.
              </p>
            </>
          ) : (
            <>
              {/* Billing toggle */}
              <div className="flex items-center justify-center gap-1 mb-4 bg-[#F1F4FF] dark:bg-[#13161E] rounded-xl p-1 w-fit mx-auto">
                {["monthly", "yearly"].map((b) => (
                  <button
                    key={b}
                    onClick={() => setBilling(b)}
                    className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition ${
                      billing === b
                        ? "bg-[#2563EB] text-white"
                        : "text-[#8B92A9] hover:text-[#2563EB]"
                    }`}
                  >
                    {b}{b === "yearly" ? " (save 20%)" : ""}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 mb-4">
                {PLANS.map((p) => {
                  const price = billing === "yearly" ? p.yearly : p.monthly;
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectPlan(p.id)}
                      disabled={busy}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition text-left disabled:opacity-50 ${
                        p.popular
                          ? "border-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540]"
                          : "border-[#E4E7EF] dark:border-[#262A38] hover:border-[#2563EB]"
                      }`}
                    >
                      <div>
                        <p className="text-[14px] font-bold text-[#0F1117] dark:text-white flex items-center gap-2">
                          {p.name}
                          {p.popular && (
                            <span className="text-[10px] font-bold bg-[#2563EB] text-white px-1.5 py-0.5 rounded-full">POPULAR</span>
                          )}
                        </p>
                        <p className="text-[11px] text-[#8B92A9]">{p.blurb}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[15px] font-black text-[#0F1117] dark:text-white">
                          ₹{price.toLocaleString("en-IN")}
                          <span className="text-[11px] font-normal text-[#8B92A9]">/{billing === "yearly" ? "mo, billed yearly" : "mo"}</span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[12px] text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#8B92A9]">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                {busy ? "Charging your saved payment method…" : "Charged automatically to your saved payment method"}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}