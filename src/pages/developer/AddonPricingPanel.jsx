// src/pages/developer/AddonPricingPanel.jsx — NEW FILE
// Developer panel section: set the PRICE, billing period, public visibility and
// per-plan availability of each purchasable add-on.
//
// Reads/writes:
//   GET /developer/addon-catalog        → { items: [...] }
//   PUT /developer/addon-catalog         → { items: [...] }  (bulk save)
//
// Anything marked "Public" + active here appears as a buyable card on the
// customer Upgrade Plan page (GET /subscription/addons), filtered by the
// "Show on plans" selection.

import { useState, useEffect } from "react";
import {
  Package, CheckCircle, XCircle, Loader2, Save, AlertTriangle,
} from "lucide-react";
import api from "../../data/axiosConfig";

// Plan keys an add-on can be scoped to. Empty selection = all plans.
const PLAN_KEYS = ["trial", "basic", "pro", "enterprise"];

const CATEGORY_STYLE = {
  resource: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
  feature:  "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400",
  credit:   "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

const BILLING_LABEL = { monthly: "/mo", yearly: "/yr", one_time: "one-time" };

function PlanChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition ${
        active
          ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
          : "border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#9DA3BB]"
      }`}
    >
      {label}
    </button>
  );
}

function AddonRow({ item, onChange }) {
  const cat = CATEGORY_STYLE[item.category] || CATEGORY_STYLE.feature;
  const plans = Array.isArray(item.visiblePlans) ? item.visiblePlans : [];

  const togglePlan = (key) => {
    const next = plans.includes(key) ? plans.filter(p => p !== key) : [...plans, key];
    onChange(item.addonType, "visiblePlans", next);
  };

  return (
    <div className={`rounded-2xl border p-4 transition ${
      item.isPublic && item.isActive
        ? "border-green-200 dark:border-green-500/30 bg-green-50/40 dark:bg-green-500/[0.04]"
        : "border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27]"
    }`}>
      <div className="flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{item.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${cat}`}>{item.category}</span>
            </div>
            <p className="text-[11px] text-[#9DA3BB] mt-0.5">{item.description || item.addonType}</p>
          </div>

          {/* Public toggle */}
          <button
            onClick={() => onChange(item.addonType, "isPublic", !item.isPublic)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition shrink-0 ${
              item.isPublic
                ? "border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
                : "border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#9DA3BB]"
            }`}
          >
            {item.isPublic
              ? <CheckCircle className="w-3.5 h-3.5" />
              : <XCircle className="w-3.5 h-3.5" />}
            {item.isPublic ? "On sale" : "Hidden"}
          </button>
        </div>

        {/* Price + billing + max qty */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1">Price (₹)</label>
            <input
              type="number" min={0}
              value={item.price ?? 0}
              onChange={e => onChange(item.addonType, "price", Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1">Billing</label>
            <select
              value={item.billingPeriod || "monthly"}
              onChange={e => onChange(item.addonType, "billingPeriod", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="one_time">One-time</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1">Max Qty</label>
            <input
              type="number" min={1}
              value={item.maxQuantity ?? 1}
              onChange={e => onChange(item.addonType, "maxQuantity", Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1">Active</label>
            <button
              onClick={() => onChange(item.addonType, "isActive", !item.isActive)}
              className={`w-full px-3 py-2 rounded-xl border text-[12px] font-semibold transition ${
                item.isActive
                  ? "border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
                  : "border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#9DA3BB]"
              }`}
            >
              {item.isActive ? "Active" : "Disabled"}
            </button>
          </div>
        </div>

        {/* Plan visibility */}
        <div>
          <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-2">
            Show on plans <span className="text-[#C4C9DA] normal-case font-normal">(none selected = all plans)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PLAN_KEYS.map(k => (
              <PlanChip key={k} label={k} active={plans.includes(k)} onClick={() => togglePlan(k)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AddonPricingPanel() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);

  useEffect(() => {
    api.get("/developer/addon-catalog")
      .then(({ data }) => setItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => { /* keep empty */ })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (addonType, field, value) => {
    setItems(prev => prev.map(it => it.addonType === addonType ? { ...it, [field]: value } : it));
  };

  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/developer/addon-catalog", { items });
      showToast("Add-on pricing saved.", true);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save add-on pricing.", false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const publicCount = items.filter(i => i.isPublic && i.isActive).length;

  return (
    <div className="mt-10">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-white text-[13px] font-semibold shadow-xl ${toast.ok ? "bg-[#059669]" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-blue-500" />
            <h2 className="text-[18px] sm:text-[20px] font-bold text-[#0F1117] dark:text-white">Add-on Pricing</h2>
          </div>
          <p className="text-[13px] text-[#8B92A9]">
            Set the price and visibility of each add-on. Add-ons marked <strong>On sale</strong> appear on the
            customer Upgrade page, where they can pay and enable them instantly. {publicCount} on sale.
          </p>
        </div>
        <button
          onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition shrink-0"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : "Save Add-on Pricing"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {items.map(it => (
          <AddonRow key={it.addonType} item={it} onChange={handleChange} />
        ))}
      </div>
    </div>
  );
}
