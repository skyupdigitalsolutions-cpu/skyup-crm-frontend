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
  Package, CheckCircle, XCircle, Loader2, Save, AlertTriangle, Plus, X,
} from "lucide-react";
import api from "../../data/axiosConfig";

// Plan keys an add-on can be scoped to. Empty selection = all plans.
const PLAN_KEYS = ["trial", "basic", "pro", "advance", "enterprise"];

// Full catalogue of add-on types the developer can create & price.
// addonType MUST match the backend CompanyAddon.ADDON_TYPES enum exactly.
const ADDON_CATALOG = [
  { addonType: "extra_admin",          name: "Extra Admin",          category: "resource", billingPeriod: "monthly",  description: "+1 admin seat" },
  { addonType: "extra_users_5",        name: "5 Extra Users",        category: "resource", billingPeriod: "monthly",  description: "+5 user seats" },
  { addonType: "extra_leads_5000",     name: "5,000 Extra Leads",    category: "resource", billingPeriod: "monthly",  description: "+5,000 lead capacity" },
  { addonType: "extra_website",        name: "Extra Website",        category: "resource", billingPeriod: "monthly",  description: "+1 tracked website" },
  { addonType: "extra_meta_campaign",  name: "Extra Meta Campaign",  category: "resource", billingPeriod: "monthly",  description: "+1 Meta campaign" },
  { addonType: "extra_google_account", name: "Extra Google Account", category: "resource", billingPeriod: "monthly",  description: "+1 Google Ads account" },
  { addonType: "call_transcription",   name: "Call Transcription",   category: "feature",  billingPeriod: "monthly",  description: "Speech-to-text on calls" },
  { addonType: "ai_summary",           name: "AI Summary",           category: "feature",  billingPeriod: "monthly",  description: "AI call summaries" },
  { addonType: "whatsapp_automation",  name: "WhatsApp Automation",  category: "feature",  billingPeriod: "monthly",  description: "Auto WhatsApp on new lead" },
  { addonType: "custom_branding",      name: "Custom Branding",      category: "feature",  billingPeriod: "monthly",  description: "Logo, colours & theme" },
  // ── AI credit pack — the only one sold ──────────────────────────────────────
  // Combined pack: tops up BOTH the transcription and summary minute pools by
  // 100 each. Larger needs come from the plan tier. Price editable here.
  { addonType: "transcription_summary_100mins", name: "100 Min Transcription & Summary", category: "credit", billingPeriod: "one_time", description: "+100 mins — transcription + AI summary (both pools)", minuteCount: 100 },
];

function newRowFor(addonType) {
  const base = ADDON_CATALOG.find(a => a.addonType === addonType);
  return {
    addonType,
    name:          base?.name || addonType,
    description:   base?.description || "",
    category:      base?.category || "feature",
    billingPeriod: base?.billingPeriod || "monthly",
    price:         0,
    currency:      "INR",
    maxQuantity:   base?.category === "feature" ? 1 : 10,
    visiblePlans:  [],
    isPublic:      false,
    isActive:      true,
  };
}

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

function AddonRow({ item, onChange, onRemove }) {
  const cat = CATEGORY_STYLE[item.category] || CATEGORY_STYLE.feature;
  const plans = Array.isArray(item.visiblePlans) ? item.visiblePlans : [];

  // For combined transcription+summary packs: look up minuteCount from catalog
  const catalogEntry = ADDON_CATALOG.find(a => a.addonType === item.addonType);
  const minuteCount  = catalogEntry?.minuteCount || null;
  const pricePerMin  = minuteCount && item.price > 0
    ? (item.price / minuteCount).toFixed(3)
    : null;

  // Credit packs (transcription/summary minutes) NEVER auto-renew —
  // they are consumed by usage and repurchased manually by the customer.
  const isCredit = item.category === "credit";
  const renewalMode = isCredit ? "none" : (item.renewalMode || "none");

  const RENEWAL_OPTIONS = [
    { value: "none",     label: "One-time only",   hint: "Customer buys once; no renewal." },
    { value: "optional", label: "Customer's choice", hint: "Customer picks monthly renew or one-time at checkout." },
    { value: "required", label: "Always renews",    hint: "Always renews monthly; customer cannot opt out." },
  ];

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
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onChange(item.addonType, "isPublic", !item.isPublic)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition ${
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
            <button
              onClick={() => onRemove(item.addonType)}
              title="Remove add-on"
              className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E5E7EB] dark:border-[#262A38] text-[#9DA3BB] hover:text-red-600 hover:border-red-200 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
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
            {/* Per-minute cost hint for combined transcription+summary packs */}
            {pricePerMin && (
              <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                ≈ ₹{pricePerMin}/min · {minuteCount} mins
              </p>
            )}
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

        {/* Renewal mode — locked to "One-time only" for credit/transcription packs */}
        <div>
          <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-2">
            Renewal mode
            {isCredit && (
              <span className="ml-2 text-[9px] font-normal text-amber-500 dark:text-amber-400 normal-case">
                (credit packs are always one-time — based on usage limit)
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            {RENEWAL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                disabled={isCredit}
                title={opt.hint}
                onClick={() => !isCredit && onChange(item.addonType, "renewalMode", opt.value)}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition ${
                  renewalMode === opt.value
                    ? opt.value === "none"
                      ? "border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300"
                      : opt.value === "optional"
                        ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                        : "border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400"
                    : "border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#9DA3BB]"
                } ${isCredit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {!isCredit && renewalMode !== "none" && (
            <p className="mt-1.5 text-[10px] text-[#8B92A9]">
              {renewalMode === "optional"
                ? "Customers will see a toggle at checkout: monthly auto-renew or one-time purchase."
                : "This add-on will always renew monthly. Customers cannot opt out."}
            </p>
          )}
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
  const [picker,  setPicker]  = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState({
    name: "", description: "", price: "", grantField: "users", grantDelta: "",
    billingPeriod: "monthly", maxQuantity: 1, isPublic: false,
  });
  const [creating, setCreating] = useState(false);

  const reload = () => api.get("/developer/addon-catalog")
    .then(({ data }) => setItems(Array.isArray(data?.items) ? data.items : []))
    .catch(() => {});

  useEffect(() => {
    api.get("/developer/addon-catalog")
      .then(({ data }) => setItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => { /* keep empty — developer can add rows manually */ })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (addonType, field, value) => {
    setItems(prev => prev.map(it => it.addonType === addonType ? { ...it, [field]: value } : it));
  };

  const handleAdd = (addonType) => {
    setPicker(false);
    setItems(prev => prev.some(it => it.addonType === addonType) ? prev : [...prev, newRowFor(addonType)]);
  };

  const handleRemove = (addonType) => {
    setItems(prev => prev.filter(it => it.addonType !== addonType));
  };

  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleCreateCustom = async () => {
    if (!custom.name.trim()) return showToast("Name is required.", false);
    if (!custom.grantDelta || Number(custom.grantDelta) <= 0) return showToast("Enter a positive grant amount.", false);
    setCreating(true);
    try {
      const { data } = await api.post("/developer/addon-catalog/custom", {
        name: custom.name.trim(),
        description: custom.description.trim(),
        price: Number(custom.price) || 0,
        grantField: custom.grantField,
        grantDelta: Number(custom.grantDelta),
        billingPeriod: custom.billingPeriod,
        maxQuantity: Number(custom.maxQuantity) || 1,
        isPublic: !!custom.isPublic,
      });
      if (data?.success === false) throw new Error(data?.message);
      showToast(`Custom add-on "${custom.name}" created.`, true);
      setCustom({ name: "", description: "", price: "", grantField: "users", grantDelta: "", billingPeriod: "monthly", maxQuantity: 1, isPublic: false });
      setShowCustom(false);
      reload();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || "Failed to create custom add-on.", false);
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send fields the backend expects; strip Mongo metadata.
      const payload = items.map(({ _id, createdAt, updatedAt, __v, ...keep }) => keep);
      const { data } = await api.put("/developer/addon-catalog", { items: payload });
      if (data?.success === false) throw new Error(data?.message || "Save rejected");
      showToast(`Add-on pricing saved${typeof data?.saved === "number" ? ` (${data.saved})` : ""}.`, true);
    } catch (err) {
      showToast(err.response?.data?.message || err.message || "Failed to save add-on pricing.", false);
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
  const available = ADDON_CATALOG.filter(a => !items.some(it => it.addonType === a.addonType));

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
            Add an add-on, set its price and visibility. Add-ons marked <strong>On sale</strong> appear on the
            customer Upgrade page, where they can pay and enable them instantly. {publicCount} on sale.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              onClick={() => setPicker(p => !p)}
              disabled={available.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-50 text-[13px] font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Add-on
            </button>
            {picker && available.length > 0 && (
              <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto z-20 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] shadow-xl p-1.5">
                {available.map(a => (
                  <button
                    key={a.addonType}
                    onClick={() => handleAdd(a.addonType)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F4F6FA] dark:hover:bg-[#13161E] transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{a.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${CATEGORY_STYLE[a.category]}`}>{a.category}</span>
                    </div>
                    <p className="text-[11px] text-[#9DA3BB]">{a.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowCustom(s => !s)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-violet-500 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 text-[13px] font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" /> Create Custom
          </button>
          <button
            onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Add-on Pricing"}
          </button>
        </div>
      </div>

      {/* Create Custom Add-on form */}
      {showCustom && (
        <div className="mb-6 p-5 rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-500/5">
          <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-white mb-1">Create a custom add-on</h3>
          <p className="text-[12px] text-[#8B92A9] mb-4">Define your own priced add-on that grants a resource. When a company buys it, the amount is added to that limit (× quantity).</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8B92A9] mb-1">Name</label>
              <input value={custom.name} onChange={e => setCustom(c => ({ ...c, name: e.target.value }))} placeholder="e.g. 10 Extra Users" className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8B92A9] mb-1">Grants</label>
              <select value={custom.grantField} onChange={e => setCustom(c => ({ ...c, grantField: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px]">
                <option value="users">Users</option>
                <option value="leads">Leads</option>
                <option value="admins">Admins</option>
                <option value="websites">Websites</option>
                <option value="metaCampaigns">Meta Campaigns</option>
                <option value="googleAccounts">Google Accounts</option>
                <option value="storageMB">Storage (MB)</option>
                <option value="transcriptionsLimit">Transcription minutes</option>
                <option value="summariesLimit">Summary minutes</option>
                <option value="voiceBotLimit">Voice bot minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8B92A9] mb-1">Amount (per unit)</label>
              <input type="number" min="1" value={custom.grantDelta} onChange={e => setCustom(c => ({ ...c, grantDelta: e.target.value }))} placeholder="e.g. 10" className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8B92A9] mb-1">Price</label>
              <input type="number" min="0" value={custom.price} onChange={e => setCustom(c => ({ ...c, price: e.target.value }))} placeholder="₹" className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8B92A9] mb-1">Billing</label>
              <select value={custom.billingPeriod} onChange={e => setCustom(c => ({ ...c, billingPeriod: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px]">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="one_time">One-time</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8B92A9] mb-1">Max quantity</label>
              <input type="number" min="1" value={custom.maxQuantity} onChange={e => setCustom(c => ({ ...c, maxQuantity: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px]" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8B92A9] mb-1">Description</label>
              <input value={custom.description} onChange={e => setCustom(c => ({ ...c, description: e.target.value }))} placeholder="Short description shown on the card" className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px]" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={custom.isPublic} onChange={e => setCustom(c => ({ ...c, isPublic: e.target.checked }))} className="w-4 h-4 accent-violet-600" />
              <span className="text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">Put on sale (visible on customer Upgrade page)</span>
            </label>
            <button onClick={handleCreateCustom} disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-[13px] font-semibold transition">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {creating ? "Creating…" : "Create Add-on"}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#E5E7EB] dark:border-[#262A38] py-12 px-6 text-center">
          <Package className="w-8 h-8 text-[#C4C9DA] mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] mb-1">No add-ons yet</p>
          <p className="text-[12px] text-[#8B92A9] mb-4">Click <strong>Add Add-on</strong> to create your first one, set a price, mark it <strong>On sale</strong>, then Save.</p>
          <button
            onClick={() => setPicker(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Add-on
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map(it => (
            <AddonRow key={it.addonType} item={it} onChange={handleChange} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
