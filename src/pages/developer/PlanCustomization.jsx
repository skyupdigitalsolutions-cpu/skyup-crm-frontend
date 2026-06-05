// src/pages/developer/PlanCustomization.jsx
// Developer panel: customise plan names, prices, feature flags, and user/lead limits.
// Changes are persisted via POST /developer/plans/config and are immediately
// reflected in the UpgradePlan page (which fetches from the same endpoint).

import { useState, useEffect } from "react";
import {
  Settings, CheckCircle, XCircle, Loader2, RefreshCw,
  ChevronDown, AlertTriangle, Save,
} from "lucide-react";
import api from "../../data/axiosConfig";

// ── Feature catalogue (keep in sync with usePlanFeatures FEATURE_KEY_MAP) ─────
const ALL_FEATURES = [
  { key: "leads",               label: "Lead Management"      },
  { key: "contacts",            label: "Contacts"             },
  { key: "basic-reports",       label: "Basic Reports"        },
  { key: "attendance",          label: "Attendance"           },
  { key: "daily-report",        label: "Daily Report"         },
  { key: "sms-blast",           label: "SMS Blast"            },
  { key: "whatsapp-blast",      label: "WhatsApp Blast"       },
  { key: "email-blast",         label: "Email Blast"          },
  { key: "campaigns",           label: "Campaigns"            },
  { key: "google-ads",          label: "Google Ads"           },
  { key: "meta-ads",            label: "Meta Ads"             },
  { key: "call-recording",      label: "Call Recording"       },
  { key: "call-transcription",  label: "Call Transcription"   },
  { key: "ai-summary",          label: "AI Summary"           },
  { key: "voice-bot",           label: "Voice Bot"            },
  { key: "whatsapp-automation", label: "WhatsApp Automation"  },
  { key: "api-access",          label: "API Access"           },
  { key: "webhook-access",      label: "Webhook Access"       },
  { key: "custom-reports",      label: "Custom Reports"       },
  { key: "white-label",         label: "White Label"          },
  { key: "custom-domain",       label: "Custom Domain"        },
  { key: "custom-branding",     label: "Custom Branding"      },
];

const PLAN_IDS = ["basic", "pro", "enterprise"];

const DEFAULT_PLANS = {
  basic: {
    name: "Basic", monthlyPrice: 999, yearlyPrice: 799,
    maxUsers: 5, maxLeads: 1000, maxAdmins: 1,
    features: ["leads", "contacts", "basic-reports", "attendance"],
  },
  pro: {
    name: "Pro", monthlyPrice: 2999, yearlyPrice: 2399,
    maxUsers: 20, maxLeads: 10000, maxAdmins: 3,
    features: [
      "leads", "contacts", "basic-reports", "attendance", "daily-report",
      "sms-blast", "whatsapp-blast", "email-blast", "campaigns",
      "google-ads", "meta-ads", "call-recording", "api-access",
    ],
  },
  enterprise: {
    name: "Enterprise", monthlyPrice: 9999, yearlyPrice: 7999,
    maxUsers: 999, maxLeads: 999999, maxAdmins: 5,
    features: ALL_FEATURES.map(f => f.key),
  },
};

function FeatureToggle({ featureKey, label, enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(featureKey, !enabled)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-medium transition-all ${
        enabled
          ? "border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#9DA3BB]"
      }`}
    >
      {enabled
        ? <CheckCircle className="w-3.5 h-3.5 shrink-0" />
        : <XCircle className="w-3.5 h-3.5 shrink-0" />
      }
      {label}
    </button>
  );
}

function NumberField({ label, value, onChange, min = 0, step = 1 }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
      />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9DA] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
      />
    </div>
  );
}

function PlanCard({ planId, plan, onChange }) {
  const ACCENT = {
    basic:      { border: "border-slate-300 dark:border-slate-600",   badge: "bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400" },
    pro:        { border: "border-blue-300 dark:border-blue-600",     badge: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    enterprise: { border: "border-violet-300 dark:border-violet-600", badge: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  };
  const acc = ACCENT[planId] || ACCENT.basic;
  const [open, setOpen] = useState(true);

  const toggleFeature = (key, val) => {
    const next = val
      ? [...new Set([...plan.features, key])]
      : plan.features.filter(f => f !== key);
    onChange(planId, "features", next);
  };

  return (
    <div className={`bg-white dark:bg-[#1A1D27] border-2 ${acc.border} rounded-2xl overflow-hidden`}>
      {/* Card header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
      >
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${acc.badge}`}>
            {planId}
          </span>
          <span className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{plan.name}</span>
          <span className="text-[12px] text-[#6B7280] dark:text-[#565C75]">
            ₹{plan.monthlyPrice?.toLocaleString()}/mo · {plan.maxUsers} users
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-[#F0F2FA] dark:border-[#1E2130] pt-4">

          {/* Name + Prices */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextField
              label="Plan Name"
              value={plan.name}
              onChange={v => onChange(planId, "name", v)}
              placeholder="e.g. Basic"
            />
            <NumberField
              label="Monthly Price (₹)"
              value={plan.monthlyPrice}
              onChange={v => onChange(planId, "monthlyPrice", v)}
            />
            <NumberField
              label="Yearly Price (₹/mo)"
              value={plan.yearlyPrice}
              onChange={v => onChange(planId, "yearlyPrice", v)}
            />
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <NumberField
              label="Max Users"
              value={plan.maxUsers}
              onChange={v => onChange(planId, "maxUsers", v)}
              min={1}
            />
            <NumberField
              label="Max Admins"
              value={plan.maxAdmins}
              onChange={v => onChange(planId, "maxAdmins", v)}
              min={1}
            />
            <NumberField
              label="Max Leads"
              value={plan.maxLeads}
              onChange={v => onChange(planId, "maxLeads", v)}
              min={100}
              step={100}
            />
          </div>

          {/* Features */}
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-3">
              Features ({plan.features.length}/{ALL_FEATURES.length} enabled)
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_FEATURES.map(f => (
                <FeatureToggle
                  key={f.key}
                  featureKey={f.key}
                  label={f.label}
                  enabled={plan.features.includes(f.key)}
                  onChange={toggleFeature}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanCustomization() {
  const [plans,    setPlans]    = useState(DEFAULT_PLANS);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null); // { msg, ok }

  // Load existing config
  useEffect(() => {
    api.get("/developer/plans/config")
      .then(({ data }) => {
        if (data && typeof data === "object") {
          // Merge server config over defaults (so new features always appear)
          const merged = {};
          for (const id of PLAN_IDS) {
            merged[id] = { ...DEFAULT_PLANS[id], ...(data[id] || {}) };
            // Ensure features is always an array
            if (!Array.isArray(merged[id].features)) {
              merged[id].features = DEFAULT_PLANS[id].features;
            }
          }
          setPlans(merged);
        }
      })
      .catch(() => {
        // Backend doesn't have this endpoint yet — use defaults silently
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (planId, field, value) => {
    setPlans(prev => ({
      ...prev,
      [planId]: { ...prev[planId], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/developer/plans/config", plans);
      // Notify all open tabs that plan config changed
      window.dispatchEvent(new Event("plan_updated"));
      showToast("Plan configuration saved successfully.", true);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save — check API.", false);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!window.confirm("Reset all plans to their default values?")) return;
    setPlans(DEFAULT_PLANS);
  };

  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  if (loading) {
    return (
      <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-6 sm:py-8 font-poppins">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-white text-[13px] font-semibold shadow-xl transition-all ${
          toast.ok ? "bg-[#059669]" : "bg-red-600"
        }`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-blue-500" />
            <h1 className="text-[22px] sm:text-[24px] font-bold text-[#0F1117] dark:text-white">
              Plan Customization
            </h1>
          </div>
          <p className="text-[13px] text-[#8B92A9]">
            Configure plan names, prices, user limits, and feature flags shown to clients.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[13px] font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F0F2FA] dark:hover:bg-[#262A38] transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Info notice */}
      <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-[12px] text-blue-700 dark:text-blue-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Saving applies globally to all new subscriptions. Existing subscriptions retain their current entitlements
          until renewed or manually updated via the <strong>Subscriptions</strong> page.
        </span>
      </div>

      {/* Plan cards */}
      <div className="space-y-4">
        {PLAN_IDS.map(id => (
          <PlanCard
            key={id}
            planId={id}
            plan={plans[id]}
            onChange={handleChange}
          />
        ))}
      </div>

    </div>
  );
}
