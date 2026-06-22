// src/components/CartDrawer.jsx
// Slide-in cart drawer shown when user has items in cart.
// Shows plan + addons as line items, total, and triggers Razorpay checkout.

import { useState, useCallback } from "react";
import {
  X, ShoppingCart, Trash2, Award, Zap, Loader2,
  CheckCircle2, AlertTriangle, RefreshCw, Minus, Plus,
} from "lucide-react";
import api from "../data/axiosConfig";
import { useCart } from "../context/CartContext";

const BILLING_SUFFIX = { monthly: "/mo", yearly: "/yr", one_time: "" };

function loadRazorpaySdk() {
  return new Promise(resolve => {
    if (document.getElementById("razorpay-sdk")) return resolve(true);
    const s = document.createElement("script");
    s.id  = "razorpay-sdk";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function fmt(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

// ── Single line item row ──────────────────────────────────────────────────────
function LineItem({ item, onRemove, onQtyChange }) {
  const suffix = BILLING_SUFFIX[item.billingPeriod || item.billing] ?? "";
  const unitPrice = item.type === "addon" ? Math.round(item.price / (item.quantity || 1)) : item.price;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#F0F2FA] dark:border-[#1E2133] last:border-0">
      {/* Icon */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
        item.type === "plan"
          ? "bg-indigo-100 dark:bg-indigo-950/40"
          : "bg-[#F0F2FA] dark:bg-[#1E2133]"
      }`}>
        {item.type === "plan"
          ? <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          : <Zap className="w-4 h-4 text-[#8B92A9]" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] truncate">
          {item.planName || item.addonName}
        </p>
        <p className="text-[11px] text-[#8B92A9]">
          {item.type === "plan"
            ? `${item.billing === "yearly" ? "Annual" : "Monthly"} plan`
            : item.autoRenew ? "Monthly · auto-renews" : `${suffix ? suffix.replace("/", "") : "one-time"}`}
        </p>

        {/* Qty stepper for addons */}
        {item.type === "addon" && item.maxQuantity > 1 && (
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={() => onQtyChange(Math.max(1, item.quantity - 1), unitPrice)}
              className="w-5 h-5 rounded border border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-center text-[#8B92A9] hover:border-indigo-400 hover:text-indigo-600 transition"
            ><Minus className="w-2.5 h-2.5" /></button>
            <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5] w-4 text-center">{item.quantity}</span>
            <button
              onClick={() => onQtyChange(Math.min(item.maxQuantity, item.quantity + 1), unitPrice)}
              className="w-5 h-5 rounded border border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-center text-[#8B92A9] hover:border-indigo-400 hover:text-indigo-600 transition"
            ><Plus className="w-2.5 h-2.5" /></button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">
          {fmt(item.price)}{suffix}
        </p>
        <button
          onClick={onRemove}
          className="text-[#C4C9DA] hover:text-rose-500 transition"
          title="Remove"
        ><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

// ── CartDrawer ────────────────────────────────────────────────────────────────
export default function CartDrawer({ open, onClose }) {
  const {
    items, planItem, addonItems, totalPrice,
    clearPlan, removeAddon, updateAddonQty, clearCart,
  } = useCart();

  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(null);

  const checkout = useCallback(async () => {
    if (!items.length) return;
    setError(null); setSuccess(null); setBusy(true);

    try {
      // Build cart payload
      const payload = {
        billing: planItem?.billing || "monthly",
        plan:    planItem ? (planItem.planId) : undefined,
        addons:  addonItems.map(a => ({
          addonType: a.addonType,
          quantity:  a.quantity,
          autoRenew: a.autoRenew,
        })),
      };

      const { data: order } = await api.post("/razorpay/cart/create-order", payload);
      if (!order?.orderId) throw new Error(order?.message || "Order creation failed");

      const ok = await loadRazorpaySdk();
      if (!ok) { setError("Failed to load payment SDK."); setBusy(false); return; }

      const rzp = new window.Razorpay({
        key:      order.keyId,
        amount:   order.amount,
        currency: order.currency,
        name:     "SkyUp CRM",
        description: `Cart: ${order.lineItems.map(l => l.planName || l.addonName).join(", ")}`,
        order_id: order.orderId,
        theme:    { color: "#2563EB" },
        handler: async (resp) => {
          try {
            const { data: verify } = await api.post("/razorpay/cart/verify-payment", {
              razorpay_order_id:   resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature:  resp.razorpay_signature,
              ...payload,
            });

            setSuccess(`Payment successful! ${
              verify.planActivated ? "Plan activated. " : ""
            }${verify.addonsActivated?.length ? `Add-ons enabled: ${verify.addonsActivated.join(", ")}.` : ""}`);
            clearCart();
            window.dispatchEvent(new Event("entitlements_updated"));
            window.dispatchEvent(new Event("plan_updated"));
          } catch (err) {
            setError(err?.response?.data?.message || "Payment received but activation failed. Contact support.");
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });

      rzp.on("payment.failed", r => {
        setError(r.error?.description || "Payment failed.");
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not start payment.");
      setBusy(false);
    }
  }, [items, planItem, addonItems, clearCart]);

  if (!open) return null;

  const isEmpty = items.length === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[400px] bg-white dark:bg-[#11131C] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133]">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Your cart</h2>
            {!isEmpty && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEmpty && (
              <button
                onClick={clearCart}
                className="text-[11px] text-[#8B92A9] hover:text-rose-500 transition font-medium"
              >Clear all</button>
            )}
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8B92A9] hover:bg-[#F0F2FA] dark:hover:bg-[#1E2133] transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {success && (
            <div className="mb-4 flex items-start gap-2.5 px-3 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {success}
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2.5 px-3 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-[12px] font-semibold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <ShoppingCart className="w-10 h-10 text-[#C4C9DA]" strokeWidth={1.5} />
              <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">Your cart is empty</p>
              <p className="text-[12px] text-[#8B92A9]">Add a plan or add-ons from the tabs above.</p>
            </div>
          ) : (
            <div>
              {/* Plan section */}
              {planItem && (
                <div className="mb-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-2">Plan</p>
                  <LineItem
                    item={planItem}
                    onRemove={clearPlan}
                    onQtyChange={() => {}}
                  />
                </div>
              )}

              {/* Add-ons section */}
              {addonItems.length > 0 && (
                <div className="mt-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#8B92A9] mb-2">Add-ons</p>
                  {addonItems.map(a => (
                    <LineItem
                      key={a.addonType}
                      item={a}
                      onRemove={() => removeAddon(a.addonType)}
                      onQtyChange={(qty, unitPrice) => updateAddonQty(a.addonType, qty, unitPrice)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — total + checkout */}
        {!isEmpty && (
          <div className="px-5 py-4 border-t border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F14]">

            {/* Line-item subtotals */}
            <div className="space-y-1 mb-3">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[12px] text-[#8B92A9]">
                  <span className="truncate max-w-[220px]">{item.planName || item.addonName}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</span>
                  <span>{fmt(item.price)}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-baseline justify-between mb-4 pt-3 border-t border-[#E4E7EF] dark:border-[#1E2133]">
              <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Total</span>
              <span className="text-[20px] font-bold text-indigo-600 dark:text-indigo-400">{fmt(totalPrice)}</span>
            </div>

            {/* Auto-renew notice */}
            {items.some(i => i.autoRenew || i.billing === "monthly" || i.billing === "yearly") && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-medium">
                  Recurring items renew automatically. Cancel anytime from Billing.
                </p>
              </div>
            )}

            <button
              onClick={checkout}
              disabled={busy}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[14px] font-bold transition"
            >
              {busy
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ShoppingCart className="w-4 h-4" />}
              {busy ? "Processing…" : `Pay ${fmt(totalPrice)} & activate`}
            </button>

            <p className="text-[10px] text-[#C4C9DA] text-center mt-2">Secured by Razorpay · UPI, Cards, Net Banking</p>
          </div>
        )}
      </div>
    </>
  );
}
