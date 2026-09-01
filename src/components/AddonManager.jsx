// src/components/AddonManager.jsx
// Reusable component used inside CompanyDetails page.
// Shows addon list with status badges, expiry dates, renew/disable actions.
//
// Addon types MUST match CompanyAddon.ADDON_TYPES on the backend exactly —
// this dropdown posts addonType straight to POST /addons/:companyId/grant,
// which is validated against that enum. (Previously this file used a


import { useState } from "react";
import api from "../data/axiosConfig";
import {
  Package,
  Plus,
  RefreshCw,
  X,
  Loader2,
  ChevronDown,
  ShieldCheck,
  User,
  Mic,
  Globe,
  BarChart2,
  Share2,
} from "lucide-react";

// ─── Addon catalog ────────────────────────────────────────────────────────────
// ADDON_LABELS = currently GRANTABLE addons (drives the picker dropdown).
const ADDON_LABELS = {
  extra_admin:                    "Extra Admin (+1 admin seat)",
  extra_users_5:                  "5 Extra Users",
  extra_leads_5000:                "5,000 Extra Leads",
  extra_website:                  "Extra Website",
  extra_meta_campaign:             "Extra Meta Campaign",
  extra_google_account:            "Extra Google Account",
  storage_1gb:                    "1 GB Storage",
  storage_5gb:                    "5 GB Storage",
  storage_10gb:                   "10 GB Storage",
  call_recording:                 "Call Recording",
  call_transcription:             "Call Transcription",
  ai_summary:                     "AI Summary",
  voice_bot:                      "Voice Bot",
  whatsapp_automation:            "WhatsApp Automation",
  api_access:                     "API Access",
  webhook_access:                 "Webhook Access",
  white_label:                    "White Label",
  custom_domain:                  "Custom Domain",
  custom_branding:                "Custom Branding",
  transcription_summary_100mins:  "AI Minutes +100 (Transcription & Summary)",
  transcriptions_5000mins:        "Transcription Minutes +5,000",
  transcriptions_20000mins:       "Transcription Minutes +20,000",
  summaries_5000mins:             "Summary Minutes +5,000",
  summaries_20000mins:            "Summary Minutes +20,000",
};

// Retired types — kept only to DISPLAY legacy addon records, never in the picker.
const LEGACY_ADDON_LABELS = {
  transcriptions_100:             "AI Transcriptions +100 (legacy)",
  transcriptions_500:             "AI Transcriptions +500 (legacy)",
  summaries_100:                  "AI Summaries +100 (legacy)",
  summaries_500:                  "AI Summaries +500 (legacy)",
  transcription_summary_500mins:  "AI Minutes +500 (legacy)",
  transcription_summary_1000mins: "AI Minutes +1,000 (legacy)",
};

const ALL_ADDON_LABELS = { ...ADDON_LABELS, ...LEGACY_ADDON_LABELS };

// Icon map by addonType
const ADDON_ICONS = {
  extra_admin:                    ShieldCheck,
  extra_users_5:                  User,
  transcription_summary_100mins:  Mic,
  transcriptions_5000mins:        Mic,
  transcriptions_20000mins:       Mic,
  summaries_5000mins:             Mic,
  summaries_20000mins:            Mic,
  transcription_summary_500mins:  Mic,
  transcription_summary_1000mins: Mic,
  extra_website:                  Globe,
  extra_google_account:            BarChart2,
  extra_meta_campaign:             Share2,
};

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  active:   "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400",
  expired:  "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
  disabled: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
};

const PAYMENT_STYLE = {
  paid:    "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
  free:    "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
  pending: "bg-gray-100 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function AddonIcon({ addonType, className = "w-4 h-4" }) {
  const Icon = ADDON_ICONS[addonType] || Package;
  return <Icon className={className} />;
}

// ─── AddonManager ─────────────────────────────────────────────────────────────

export default function AddonManager({ companyId, addons: initialAddons = [], onRefresh }) {
  const [addons,      setAddons]      = useState(initialAddons);
  const [showGrant,   setShowGrant]   = useState(false);
  const [form,        setForm]        = useState({
    addonType:      "extra_admin",
    quantity:       1,
    durationMonths: "",
    notes:          "",
    price:          "",
    currency:       "INR",
  });
  const [busy,        setBusy]        = useState(false);
  const [actionId,    setActionId]    = useState(null);
  const [error,       setError]       = useState("");
  const [renewId,     setRenewId]     = useState(null);
  const [renewMonths, setRenewMonths] = useState(1);

  // ── API helpers ─────────────────────────────────────────────────────────────

  const reload = async () => {
    try {
      const res = await api.get(`/addons/${companyId}`);
      setAddons(res.data.addons || []);
      onRefresh?.();
    } catch {}
  };

  const handleGrant = async () => {
    setBusy(true); setError("");
    try {
      await api.post(`/addons/${companyId}/grant`, {
        addonType:      form.addonType,
        quantity:       Number(form.quantity),
        durationMonths: form.durationMonths ? Number(form.durationMonths) : undefined,
        notes:          form.notes,
        price:          form.price !== "" ? Number(form.price) : 0,
        currency:       form.currency || "INR",
      });
      setShowGrant(false);
      setForm({ addonType: "extra_admin", quantity: 1, durationMonths: "", notes: "", price: "", currency: "INR" });
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to grant addon");
    } finally {
      setBusy(false);
    }
  };

  const handleRenew = async (addonId) => {
    setActionId(addonId); setError("");
    try {
      await api.put(`/addons/${addonId}/renew`, { durationMonths: renewMonths });
      setRenewId(null);
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to renew addon");
    } finally {
      setActionId(null);
    }
  };

  const handleDisable = async (addonId) => {
    if (!window.confirm("Disable this addon? It will no longer apply to the company's entitlements.")) return;
    setActionId(addonId); setError("");
    try {
      await api.put(`/addons/${addonId}/disable`);
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to disable addon");
    } finally {
      setActionId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F2FA] dark:border-[#1E2130]">
        <div className="flex items-center gap-2.5">
          <Package className="w-4 h-4 text-blue-500" />
          <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Addons</h3>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F0F2FA] dark:bg-[#13161E] text-[#6B7280] dark:text-[#9DA3BB]">
            {addons.filter(a => a.status === "active").length} active
          </span>
        </div>
        <button
          onClick={() => setShowGrant(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold transition"
        >
          <Plus className="w-3.5 h-3.5" /> Grant Addon
        </button>
      </div>

      {/* Inline error (outside modal) */}
      {error && !showGrant && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[12px]">
          {error}
        </div>
      )}

      {/* Grant Modal */}
      {showGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-[#1A1D27] rounded-2xl p-6 w-full max-w-md border border-[#E5E7EB] dark:border-[#262A38] shadow-2xl">

            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-[#0F1117] dark:text-[#F0F2FA]">Grant Addon</h4>
              <button onClick={() => { setShowGrant(false); setError(""); }}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">

              {/* Addon Type */}
              <div>
                <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">
                  Addon Type
                </label>
                <div className="relative">
                  <select
                    value={form.addonType}
                    onChange={e => setForm(p => ({ ...p, addonType: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {Object.entries(ADDON_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Quantity + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">
                    Quantity
                  </label>
                  <input
                    type="number" min={1} value={form.quantity}
                    onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">
                    Duration (months)
                  </label>
                  <input
                    type="number" min={0} placeholder="Blank = forever"
                    value={form.durationMonths}
                    onChange={e => setForm(p => ({ ...p, durationMonths: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-[#C4C9DA]"
                  />
                </div>
              </div>

              {/* Price + Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">
                    Price <span className="text-[#9DA3BB] font-normal normal-case">(0 = free)</span>
                  </label>
                  <input
                    type="number" min={0} step="0.01" placeholder="0"
                    value={form.price}
                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-[#C4C9DA]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">
                    Currency
                  </label>
                  <select
                    value={form.currency}
                    onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="INR">INR ₹</option>
                    <option value="USD">USD $</option>
                    <option value="EUR">EUR €</option>
                    <option value="GBP">GBP £</option>
                    <option value="AED">AED د.إ</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">
                  Notes (optional)
                </label>
                <input
                  type="text" placeholder="Reason or context"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-[#C4C9DA]"
                />
              </div>
            </div>

            {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowGrant(false); setError(""); }}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] text-[13px] font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGrant}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[13px] font-semibold transition"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Grant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Addon List */}
      {addons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#9DA3BB]">
          <Package className="w-7 h-7 text-[#D1D5DB] dark:text-[#374151]" />
          <p className="text-[13px]">No addons yet</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
          {addons.map(a => (
            <div key={a._id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Addon icon */}
                  <span className="w-6 h-6 rounded-md bg-[#EEF3FF] dark:bg-[#1E2A4A] flex items-center justify-center flex-shrink-0">
                    <AddonIcon addonType={a.addonType} className="w-3.5 h-3.5 text-[#2563EB]" />
                  </span>

                  <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
                    {ALL_ADDON_LABELS[a.addonType] || a.addonType}
                  </span>

                  {a.quantity > 1 && (
                    <span className="text-[11px] text-[#8B92A9]">× {a.quantity}</span>
                  )}

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[a.status] || ""}`}>
                    {a.status}
                  </span>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${PAYMENT_STYLE[a.paymentStatus] || ""}`}>
                    {a.paymentStatus}
                  </span>
                </div>

                <p className="text-[11px] text-[#8B92A9] mt-0.5">
                  Granted {fmtDate(a.startDate)} · Expires {fmtDate(a.expiryDate)}
                  {a.price > 0 && (
                    <span className="ml-2 font-semibold text-[#059669]">
                      {a.currency || "INR"}{" "}
                      {Number(a.price).toLocaleString("en-IN", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </p>

                {a.notes && (
                  <p className="text-[11px] text-[#9DA3BB] italic mt-0.5">{a.notes}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {renewId === a._id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={1} value={renewMonths}
                      onChange={e => setRenewMonths(Number(e.target.value))}
                      className="w-16 px-2 py-1 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] text-sm bg-[#F8F9FC] dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA]"
                    />
                    <span className="text-[11px] text-[#8B92A9]">mo</span>
                    <button
                      onClick={() => handleRenew(a._id)}
                      disabled={actionId === a._id}
                      className="text-[12px] font-semibold text-green-600 hover:text-green-700 dark:text-green-400 transition"
                    >
                      {actionId === a._id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : "Confirm"}
                    </button>
                    <button
                      onClick={() => setRenewId(null)}
                      className="text-[12px] text-[#8B92A9] hover:text-red-500 transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    {a.status !== "disabled" && (
                      <button
                        onClick={() => { setRenewId(a._id); setRenewMonths(1); }}
                        className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
                      >
                        <RefreshCw className="w-3 h-3" /> Renew
                      </button>
                    )}
                    {a.status !== "disabled" && (
                      <button
                        onClick={() => handleDisable(a._id)}
                        disabled={actionId === a._id}
                        className="text-[12px] font-medium px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                      >
                        {actionId === a._id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : "Disable"}
                      </button>
                    )}
                  </>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
