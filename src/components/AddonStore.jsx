// src/components/AddonStore.jsx
// Customer-facing add-on store — now uses the global cart instead of
// triggering individual Razorpay checkouts per item.

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Plus, Minus, ShoppingCart, CheckCircle2,
  AlertTriangle, Package, ShieldCheck, User, Mic,
  Globe, BarChart2, Share2,
} from "lucide-react";
import api from "../data/axiosConfig";
import { useCart } from "../context/CartContext";

const BILLING_SUFFIX = { monthly: "/mo", yearly: "/yr", one_time: "" };

const CATEGORY_BADGE = {
  resource: { label: "Resource",  cls: "bg-[#EEF3FF] text-[#2563EB]" },
  feature:  { label: "Feature",   cls: "bg-[#F3EEFF] text-[#7C3AED]" },
  credit:   { label: "AI Minutes",cls: "bg-[#FFF7E6] text-[#B45309]" },
};

const COMBINED_PACK_MINS = {
  transcription_summary_100mins:  100,
  transcription_summary_500mins:  500,
  transcription_summary_1000mins: 1000,
};

const ADDON_ICONS = {
  extra_admin:                    ShieldCheck,
  extra_users_5:                  User,
  transcription_summary_100mins:  Mic,
  transcription_summary_500mins:  Mic,
  transcription_summary_1000mins: Mic,
  transcriptions_5000mins:        Mic,
  transcriptions_20000mins:       Mic,
  summaries_5000mins:             Mic,
  summaries_20000mins:            Mic,
  extra_website:                  Globe,
  extra_google_account:           BarChart2,
  extra_meta_campaign:            Share2,
};

function AddonCard({ addon, onAddToCart, inCart }) {
  const [qty, setQty] = useState(1);
  const [autoRenew, setAutoRenew] = useState(addon.renewalMode === "required");

  const max    = Math.max(1, addon.maxQuantity || 1);
  const badge  = CATEGORY_BADGE[addon.category] || CATEGORY_BADGE.feature;
  const suffix = BILLING_SUFFIX[addon.billingPeriod] ?? "";
  const total  = (addon.price || 0) * qty;

  const isCombined  = !!COMBINED_PACK_MINS[addon.addonType];
  const minuteCount = isCombined ? COMBINED_PACK_MINS[addon.addonType] * qty : null;
  const pricePerMin = isCombined && addon.price > 0
    ? (addon.price / COMBINED_PACK_MINS[addon.addonType]).toFixed(2) : null;

  const showRenewalToggle = addon.renewalMode === "optional";
  const showRenewalBadge  = addon.renewalMode === "required";
  const effectiveAutoRenew = addon.renewalMode === "required" ? true
    : addon.renewalMode === "optional" ? autoRenew : false;

  const Icon = ADDON_ICONS[addon.addonType] || Package;

  return (
    <div className={`bg-white dark:bg-[#11131C] border rounded-2xl p-5 flex flex-col transition ${
      inCart
        ? "border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-900"
        : "border-[#E4E7EF] dark:border-[#1E2133]"
    }`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#EEF3FF] dark:bg-[#1E2A4A] flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-[#2563EB]" />
          </div>
          <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{addon.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {inCart && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">In cart</span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${badge.cls}`}>{badge.label}</span>
        </div>
      </div>

      <p className="text-[12px] text-[#8B92A9] mb-3 flex-1">{addon.description}</p>

      {/* Combined pack pills */}
      {isCombined && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EEF3FF] text-[#2563EB] text-[10px] font-bold">Transcription</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F3EEFF] text-[#7C3AED] text-[10px] font-bold">AI Summary</span>
          {pricePerMin && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF7E6] text-[#B45309] text-[10px] font-bold">₹{pricePerMin}/min</span>
          )}
        </div>
      )}

      {/* Price */}
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-[22px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">
          ₹{(addon.price || 0).toLocaleString("en-IN")}
        </span>
        {suffix && <span className="text-[12px] text-[#8B92A9]">{suffix}</span>}
        {addon.billingPeriod === "one_time" && <span className="text-[11px] text-[#8B92A9]">one-time</span>}
        {minuteCount && <span className="ml-1 text-[11px] font-semibold text-[#8B92A9]">· {minuteCount} mins</span>}
      </div>

      {/* Renewal badge */}
      {showRenewalBadge && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-[#EEF3FF] border border-[#BFDBFE]">
          <span className="text-[11px] font-bold text-[#2563EB]">🔄 Auto-renews monthly</span>
        </div>
      )}

      {/* Renewal toggle */}
      {showRenewalToggle && (
        <div className="mb-4">
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F16]">
            <div>
              <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">Monthly auto-renew</p>
              <p className="text-[10px] text-[#8B92A9]">
                {autoRenew ? "Renews each month automatically" : "One-time — re-buy when needed"}
              </p>
            </div>
            <button
              onClick={() => setAutoRenew(r => !r)}
              aria-pressed={autoRenew}
              className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${autoRenew ? "bg-[#2563EB]" : "bg-[#D1D5DB] dark:bg-[#374151]"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${autoRenew ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
      )}

      {/* Qty */}
      {max > 1 && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Qty</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-center text-[#4B5168] hover:border-[#2563EB] hover:text-[#2563EB] transition">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-6 text-center text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{qty}</span>
            <button onClick={() => setQty(q => Math.min(max, q + 1))}
              className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-center text-[#4B5168] hover:border-[#2563EB] hover:text-[#2563EB] transition">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Add to cart / already in cart */}
      <button
        onClick={() => onAddToCart(addon, qty, effectiveAutoRenew)}
        className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-[13px] font-semibold transition mt-auto ${
          inCart
            ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-400 dark:border-indigo-600"
            : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
        }`}
      >
        {inCart ? <CheckCircle2 className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
        {inCart
          ? `Update cart · ₹${total.toLocaleString("en-IN")}${suffix}`
          : effectiveAutoRenew
            ? `Add to cart · ₹${total.toLocaleString("en-IN")}/mo`
            : `Add to cart · ₹${total.toLocaleString("en-IN")}`}
      </button>
    </div>
  );
}

// ── AddonStore ────────────────────────────────────────────────────────────────
export default function AddonStore({ onCartOpen }) {
  const [addons,  setAddons]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const { addAddon, addonItems } = useCart();

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

  const handleAddToCart = (addon, quantity, autoRenew) => {
    addAddon({
      type:          "addon",
      addonType:     addon.addonType,
      addonName:     addon.name,
      quantity,
      autoRenew,
      billingPeriod: addon.billingPeriod,
      price:         (addon.price || 0) * quantity,
      category:      addon.category,
      renewalMode:   addon.renewalMode,
      maxQuantity:   addon.maxQuantity || 1,
    });
    onCartOpen?.();   // open drawer when first item added
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

      {addonItems.length > 0 && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40">
          <p className="text-[12px] font-semibold text-indigo-700 dark:text-indigo-400">
            {addonItems.length} add-on{addonItems.length !== 1 ? "s" : ""} in cart
          </p>
          <button
            onClick={() => onCartOpen?.()}
            className="text-[12px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> View cart
          </button>
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
            <AddonCard
              key={a.addonType}
              addon={a}
              onAddToCart={handleAddToCart}
              inCart={addonItems.some(i => i.addonType === a.addonType)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
