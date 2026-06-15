// src/components/AddonStore.jsx — NEW FILE
// Customer-facing add-on store, rendered as a tab inside UpgradePlan.
//
// Flow:
//   1. GET /subscription/addons        → priced add-ons for this company's plan
//   2. POST /razorpay/addon/create-order { addonType, quantity }
//   3. Razorpay checkout (amount comes from the server order, not the client)
//   4. POST /razorpay/addon/verify-payment → backend verifies signature and
//      creates the CompanyAddon, which the entitlement engine applies live.
//   5. We fire window "entitlements_updated" so gated UI refreshes immediately.

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Minus, ShoppingCart, CheckCircle2, AlertTriangle, Package } from "lucide-react";
import api from "../data/axiosConfig";

const BILLING_SUFFIX = { monthly: "/mo", yearly: "/yr", one_time: "" };

const CATEGORY_BADGE = {
  resource: { label: "Resource", cls: "bg-[#EEF3FF] text-[#2563EB]" },
  feature:  { label: "Feature",  cls: "bg-[#F3EEFF] text-[#7C3AED]" },
  credit:   { label: "Credits",  cls: "bg-[#FFF7E6] text-[#B45309]" },
};

function loadRazorpaySdk() {
  return new Promise(resolve => {
    if (document.getElementById("razorpay-sdk")) return resolve(true);
    const s = document.createElement("script");
    s.id = "razorpay-sdk";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function AddonCard({ addon, busy, onBuy }) {
  const [qty, setQty] = useState(1);
  const max = Math.max(1, addon.maxQuantity || 1);
  const badge = CATEGORY_BADGE[addon.category] || CATEGORY_BADGE.feature;
  const suffix = BILLING_SUFFIX[addon.billingPeriod] ?? "";
  const total = (addon.price || 0) * qty;

  return (
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{addon.name}</h3>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${badge.cls}`}>{badge.label}</span>
      </div>
      <p className="text-[12px] text-[#8B92A9] mb-4 flex-1">{addon.description}</p>

      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-[22px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">
          ₹{(addon.price || 0).toLocaleString("en-IN")}
        </span>
        {suffix && <span className="text-[12px] text-[#8B92A9]">{suffix}</span>}
        {addon.billingPeriod === "one_time" && <span className="text-[11px] text-[#8B92A9]">one-time</span>}
      </div>

      {max > 1 && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Qty</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-center text-[#4B5168] hover:border-[#2563EB] hover:text-[#2563EB] transition"
            ><Minus className="w-3.5 h-3.5" /></button>
            <span className="w-6 text-center text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{qty}</span>
            <button
              onClick={() => setQty(q => Math.min(max, q + 1))}
              className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-center text-[#4B5168] hover:border-[#2563EB] hover:text-[#2563EB] transition"
            ><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      <button
        onClick={() => onBuy(addon, qty)}
        disabled={busy}
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-[13px] font-semibold transition"
      >
        {busy
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <ShoppingCart className="w-4 h-4" />}
        {busy ? "Processing…" : `Pay ₹${total.toLocaleString("en-IN")} & enable`}
      </button>
    </div>
  );
}

export default function AddonStore() {
  const [addons,  setAddons]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState(null);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/subscription/addons");
      setAddons(Array.isArray(data?.addons) ? data.addons : []);
    } catch {
      setError("Could not load add-ons. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const buy = async (addon, quantity) => {
    setError(null); setSuccess(null); setBusyType(addon.addonType);
    try {
      const { data: order } = await api.post("/razorpay/addon/create-order", {
        addonType: addon.addonType,
        quantity,
      });
      if (!order?.orderId) throw new Error(order?.message || "Order failed");

      const ok = await loadRazorpaySdk();
      if (!ok) { setError("Failed to load payment SDK."); setBusyType(null); return; }

      const rzp = new window.Razorpay({
        key:      order.keyId,
        amount:   order.amount,
        currency: order.currency,
        name:     "SkyUp CRM",
        description: `Add-on: ${order.addonName}${order.quantity > 1 ? ` × ${order.quantity}` : ""}`,
        order_id: order.orderId,
        theme:    { color: "#2563EB" },
        handler: async (resp) => {
          try {
            const { data: verify } = await api.post("/razorpay/addon/verify-payment", {
              razorpay_order_id:   resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature:  resp.razorpay_signature,
              addonType: addon.addonType,
              quantity,
            });
            setSuccess(`${verify.addonName} enabled.`);
            // Tell the rest of the app to drop its cached entitlements so the
            // newly-unlocked feature/limit shows up without a manual reload.
            window.dispatchEvent(new Event("entitlements_updated"));
          } catch (err) {
            setError(err?.response?.data?.message || "Payment received but activation failed. Contact support.");
          } finally {
            setBusyType(null);
          }
        },
        modal: { ondismiss: () => setBusyType(null) },
      });
      rzp.on("payment.failed", r => {
        setError(r.error?.description || "Payment failed.");
        setBusyType(null);
      });
      rzp.open();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not start payment.");
      setBusyType(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[13px] font-semibold text-[#DC2626]">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[13px] font-semibold text-[#059669]">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {addons.length === 0 ? (
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl px-6 py-16 text-center">
          <Package className="w-8 h-8 text-[#C4C9DA] mx-auto mb-3" />
          <p className="text-[13px] text-[#8B92A9]">No add-ons are available for your plan right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {addons.map(a => (
            <AddonCard key={a.addonType} addon={a} busy={busyType === a.addonType} onBuy={buy} />
          ))}
        </div>
      )}
    </div>
  );
}
