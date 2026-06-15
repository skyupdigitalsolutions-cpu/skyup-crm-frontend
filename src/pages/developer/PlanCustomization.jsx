// src/pages/developer/PlanCustomization.jsx — UPDATED
// Developer panel: customise GLOBAL plan defaults — names, prices, every limit,
// AI monthly quotas, the recording flag, and feature flags.
// Changes persist via POST /developer/plans/config and immediately drive the
// UpgradePlan page + the entitlement engine (PlanConfig).
//
// What changed vs. the old version:
//  • Added the "trial" plan (GAP 6)
//  • Added every extended limit + AI quota + recording toggle (GAP 1 / GAP 7)
//  • Features grouped with descriptions; each feature is INDEPENDENT (GAP 8)

import { useState, useEffect } from "react";
import {
  Settings, CheckCircle, XCircle, Loader2, RefreshCw,
  ChevronDown, AlertTriangle, Save,
} from "lucide-react";
import api from "../../data/axiosConfig";
import AddonPricingPanel from "./AddonPricingPanel";

// ── Feature catalogue, grouped (keys match entitlementService PLAN_FEATURE_KEY_MAP) ──
// No feature depends on another — they are simple independent flags.
const FEATURE_GROUPS = [
  { group: "Core CRM", items: [
    { key: "leads",         label: "Lead Management", desc: "Capture, assign & track leads" },
    { key: "contacts",      label: "Contacts",        desc: "Contact directory" },
    { key: "basic-reports", label: "Basic Reports",   desc: "Standard dashboards" },
    { key: "attendance",    label: "Attendance",      desc: "Staff check-in / out" },
    { key: "daily-report",  label: "Daily Report",    desc: "Automated email summary" },
  ]},
  { group: "Outreach", items: [
    { key: "sms-blast",           label: "SMS Blast",           desc: "Bulk SMS campaigns" },
    { key: "whatsapp-blast",      label: "WhatsApp Blast",      desc: "Bulk WhatsApp campaigns" },
    { key: "email-blast",         label: "Email Blast",         desc: "Bulk email campaigns" },
    { key: "campaigns",           label: "Campaigns",           desc: "Campaign builder" },
    { key: "whatsapp-automation", label: "WhatsApp Automation", desc: "Auto WhatsApp on new lead" },
  ]},
  { group: "Advertising", items: [
    { key: "google-ads", label: "Google Ads", desc: "Google Ads lead sync" },
    { key: "meta-ads",   label: "Meta Ads",   desc: "Facebook / Instagram lead sync" },
  ]},
  { group: "Calls & AI", items: [
    { key: "call-recording",     label: "Call Recording",     desc: "Store call recordings" },
    { key: "call-transcription", label: "Call Transcription", desc: "Speech-to-text on calls" },
    { key: "ai-summary",         label: "AI Summary",         desc: "AI call summaries" },
  ]},
  { group: "Operations", items: [
    { key: "projects",         label: "Projects",         desc: "Project management board" },
    { key: "tasks",            label: "Tasks",            desc: "Task assignment & tracking" },
    { key: "payroll",          label: "Payroll",          desc: "Payroll calculation & history" },
    { key: "website-tracking", label: "Website Tracking", desc: "Pixel / website lead capture" },
  ]},
];
const ALL_FEATURE_KEYS = FEATURE_GROUPS.flatMap(g => g.items.map(i => i.key));

// trial is now editable (GAP 6)
const PLAN_IDS = ["trial", "basic", "pro", "advance", "enterprise"];

// Defaults mirror DEFAULT_PLAN_LIMITS in the backend entitlementService.
const DEFAULT_PLANS = {
  trial: {
    name: "Trial", monthlyPrice: 0, yearlyPrice: 0,
    maxUsers: 3, maxAdmins: 1, maxLeads: 100,
    maxWebsites: 1, maxMetaCampaigns: 0, maxGoogleAccounts: 0, maxStorageMB: 50,
    transcriptionsPerMonth: 0, summariesPerMonth: 0, voiceBotPerMonth: 0,
    recordingEnabled: false, dataRetentionDays: 7,
    features: ["leads", "contacts", "basic-reports"],
  },
  basic: {
    name: "Basic", monthlyPrice: 999, yearlyPrice: 799,
    maxUsers: 5, maxAdmins: 1, maxLeads: 1000,
    maxWebsites: 1, maxMetaCampaigns: 1, maxGoogleAccounts: 1, maxStorageMB: 100,
    transcriptionsPerMonth: 0, summariesPerMonth: 0, voiceBotPerMonth: 0,
    recordingEnabled: false, dataRetentionDays: 15,
    features: ["leads", "contacts", "basic-reports", "attendance", "daily-report"],
  },
  pro: {
    name: "Pro", monthlyPrice: 2999, yearlyPrice: 2399,
    maxUsers: 20, maxAdmins: 3, maxLeads: 10000,
    maxWebsites: 3, maxMetaCampaigns: 5, maxGoogleAccounts: 3, maxStorageMB: 5120,
    transcriptionsPerMonth: 200, summariesPerMonth: 200, voiceBotPerMonth: 100,
    recordingEnabled: true, dataRetentionDays: 60,
    features: [
      "leads", "contacts", "basic-reports", "attendance", "daily-report",
      "sms-blast", "whatsapp-blast", "email-blast", "campaigns",
      "google-ads", "meta-ads", "call-recording",
      "call-transcription", "ai-summary", "whatsapp-automation",
      "projects", "tasks", "website-tracking",
    ],
  },
  advance: {
    name: "Advance", monthlyPrice: 9999, yearlyPrice: 7999,
    maxUsers: 999, maxAdmins: 10, maxLeads: 999999,
    maxWebsites: 999, maxMetaCampaigns: 999, maxGoogleAccounts: 999, maxStorageMB: 51200,
    transcriptionsPerMonth: 2000, summariesPerMonth: 2000, voiceBotPerMonth: 1000,
    recordingEnabled: true, dataRetentionDays: 365,
    features: ALL_FEATURE_KEYS.slice(),
  },
  // Custom "Contact us" tier — price hidden, not purchasable.
  enterprise: {
    name: "Enterprise", custom: true, monthlyPrice: 0, yearlyPrice: 0,
    maxUsers: 999, maxAdmins: 10, maxLeads: 999999,
    maxWebsites: 999, maxMetaCampaigns: 999, maxGoogleAccounts: 999, maxStorageMB: 51200,
    transcriptionsPerMonth: 2000, summariesPerMonth: 2000, voiceBotPerMonth: 1000,
    recordingEnabled: true, dataRetentionDays: 365,
    features: ALL_FEATURE_KEYS.slice(),
  },
};

function FeatureToggle({ featureKey, label, desc, enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(featureKey, !enabled)}
      title={desc}
      className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
        enabled
          ? "border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10"
          : "border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]"
      }`}
    >
      {enabled
        ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
        : <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#9DA3BB]" />}
      <span>
        <span className={`block text-[12px] font-semibold ${enabled ? "text-green-700 dark:text-green-400" : "text-[#6B7280] dark:text-[#9DA3BB]"}`}>{label}</span>
        <span className="block text-[10px] text-[#9DA3BB]">{desc}</span>
      </span>
    </button>
  );
}

function NumberField({ label, value, onChange, min = 0, step = 1 }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type="number" min={min} step={step}
        value={value ?? 0}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
      />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type="text" value={value ?? ""} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9DA] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
      />
    </div>
  );
}

function BoolToggle({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">{label}</label>
      <button
        onClick={() => onChange(!value)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-[13px] font-semibold transition ${
          value
            ? "border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
            : "border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#9DA3BB]"
        }`}
      >
        {value ? "Enabled" : "Disabled"}
        <span className={`w-9 h-5 rounded-full relative transition ${value ? "bg-green-500" : "bg-[#CBD2E0] dark:bg-[#3A3F52]"}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${value ? "left-4" : "left-0.5"}`} />
        </span>
      </button>
    </div>
  );
}

function PlanCard({ planId, plan, onChange }) {
  const ACCENT = {
    trial:      { border: "border-amber-300 dark:border-amber-600",   badge: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    basic:      { border: "border-slate-300 dark:border-slate-600",   badge: "bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400" },
    pro:        { border: "border-blue-300 dark:border-blue-600",     badge: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    advance:    { border: "border-violet-300 dark:border-violet-600", badge: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400" },
    enterprise: { border: "border-teal-300 dark:border-teal-600",     badge: "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400" },
  };
  const acc = ACCENT[planId] || ACCENT.basic;
  const [open, setOpen] = useState(planId !== "trial");

  const toggleFeature = (key, val) => {
    const next = val
      ? [...new Set([...(plan.features || []), key])]
      : (plan.features || []).filter(f => f !== key);
    onChange(planId, "features", next);
  };

  const enabledCount = (plan.features || []).length;

  return (
    <div className={`bg-white dark:bg-[#1A1D27] border-2 ${acc.border} rounded-2xl overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${acc.badge}`}>{planId}</span>
          <span className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{plan.name}</span>
          <span className="text-[12px] text-[#6B7280] dark:text-[#565C75]">
            {plan.custom
              ? <>Custom · Contact us · {enabledCount} features</>
              : <>₹{(plan.monthlyPrice || 0).toLocaleString()}/mo · {plan.maxUsers} users · {enabledCount} features</>}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-[#F0F2FA] dark:border-[#1E2130] pt-4">

          {/* Name + Prices */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextField label="Plan Name" value={plan.name} onChange={v => onChange(planId, "name", v)} placeholder="e.g. Basic" />
            {plan.custom ? (
              <div className="sm:col-span-2 flex items-end">
                <div className="px-3 py-2 rounded-xl border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 text-[12px] font-semibold text-teal-700 dark:text-teal-400">
                  Custom plan — shown as “Contact us”. No price, not purchasable online.
                </div>
              </div>
            ) : (
              <>
                <NumberField label="Monthly Price (₹)" value={plan.monthlyPrice} onChange={v => onChange(planId, "monthlyPrice", v)} />
                <NumberField label="Yearly Price (₹/mo)" value={plan.yearlyPrice} onChange={v => onChange(planId, "yearlyPrice", v)} />
              </>
            )}
          </div>

          {/* Core limits */}
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-3">Core Limits</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <NumberField label="Max Users"  value={plan.maxUsers}  onChange={v => onChange(planId, "maxUsers", v)}  min={1} />
              <NumberField label="Max Admins" value={plan.maxAdmins} onChange={v => onChange(planId, "maxAdmins", v)} min={1} />
              <NumberField label="Max Leads"  value={plan.maxLeads}  onChange={v => onChange(planId, "maxLeads", v)}  min={0} step={100} />
            </div>
          </div>

          {/* Extended limits */}
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-3">Resource Limits</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <NumberField label="Websites"        value={plan.maxWebsites}       onChange={v => onChange(planId, "maxWebsites", v)} />
              <NumberField label="Meta Campaigns"  value={plan.maxMetaCampaigns}  onChange={v => onChange(planId, "maxMetaCampaigns", v)} />
              <NumberField label="Google Accounts" value={plan.maxGoogleAccounts} onChange={v => onChange(planId, "maxGoogleAccounts", v)} />
              <NumberField label="Storage (MB)"    value={plan.maxStorageMB}      onChange={v => onChange(planId, "maxStorageMB", v)} step={50} />
              <NumberField label="Retention (days)" value={plan.dataRetentionDays} onChange={v => onChange(planId, "dataRetentionDays", v)} min={1} />
            </div>
          </div>

          {/* AI quotas + recording */}
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-3">AI Monthly Quotas (0 = off)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <NumberField label="Transcriptions / mo" value={plan.transcriptionsPerMonth} onChange={v => onChange(planId, "transcriptionsPerMonth", v)} />
              <NumberField label="Summaries / mo"      value={plan.summariesPerMonth}      onChange={v => onChange(planId, "summariesPerMonth", v)} />
              <BoolToggle  label="Recording Enabled"   value={!!plan.recordingEnabled}     onChange={v => onChange(planId, "recordingEnabled", v)} />
            </div>
          </div>

          {/* Features grouped */}
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-3">
              Features ({enabledCount}/{ALL_FEATURE_KEYS.length} enabled)
            </p>
            <div className="space-y-4">
              {FEATURE_GROUPS.map(g => (
                <div key={g.group}>
                  <p className="text-[10px] font-semibold text-[#9DA3BB] uppercase tracking-widest mb-2">{g.group}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {g.items.map(f => (
                      <FeatureToggle
                        key={f.key}
                        featureKey={f.key}
                        label={f.label}
                        desc={f.desc}
                        enabled={(plan.features || []).includes(f.key)}
                        onChange={toggleFeature}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanCustomization() {
  const [plans,   setPlans]   = useState(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);

  useEffect(() => {
    api.get("/developer/plans/config")
      .then(({ data }) => {
        if (data && typeof data === "object") {
          const merged = {};
          for (const id of PLAN_IDS) {
            merged[id] = { ...DEFAULT_PLANS[id], ...(data[id] || {}) };
            // Server features array takes full priority over defaults.
            // If the server has an explicit array (even empty = all disabled), use it.
            if (data[id] && Array.isArray(data[id].features)) {
              merged[id].features = data[id].features;
            } else {
              merged[id].features = DEFAULT_PLANS[id].features;
            }
          }
          setPlans(merged);
        }
      })
      .catch(() => { /* endpoint missing — keep defaults */ })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (planId, field, value) => {
    setPlans(prev => ({ ...prev, [planId]: { ...prev[planId], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/developer/plans/config", plans);
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

      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-white text-[13px] font-semibold shadow-xl transition-all ${toast.ok ? "bg-[#059669]" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-blue-500" />
            <h1 className="text-[22px] sm:text-[24px] font-bold text-[#0F1117] dark:text-white">Plan Customization</h1>
          </div>
          <p className="text-[13px] text-[#8B92A9]">
            Configure plan names, prices, every limit, AI quotas, and feature flags shown to clients.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[13px] font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F0F2FA] dark:hover:bg-[#262A38] transition">
            <RefreshCw className="w-3.5 h-3.5" /> Reset to Defaults
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-[12px] text-blue-700 dark:text-blue-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          These are the GLOBAL defaults for each plan. For a single company, use <strong>Companies → Manage</strong> to
          override features &amp; limits without touching the plan. Each feature is independent.
        </span>
      </div>

      <div className="space-y-4">
        {PLAN_IDS.map(id => (
          <PlanCard key={id} planId={id} plan={plans[id]} onChange={handleChange} />
        ))}
      </div>

      {/* Add-on pricing — sets prices shown on the customer Upgrade page */}
      <AddonPricingPanel />
    </div>
  );
}
