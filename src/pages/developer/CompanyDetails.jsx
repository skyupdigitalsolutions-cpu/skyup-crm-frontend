// src/pages/developer/CompanyDetails.jsx — NEW FILE
// Per-company control panel for the Developer.
// For ONE company, the developer can independently:
//   • toggle every feature on/off, or inherit the plan default   → Features tab
//   • set / clear absolute resource & AI limits                  → Limits tab
//   • grant / renew / disable addons (extra feature + limit)     → Addons tab
//   • grant / extend / deactivate free benefits                  → Benefits tab
//   • add AI credit packs                                        → AI Credits tab
//   • pause / resume / suspend the subscription                  → header
//   • read the full entitlement audit trail                      → Activity tab
//
// Every save calls an existing backend endpoint that re-resolves entitlements
// server-side. Nothing is hardcoded and no feature depends on another.

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, Save, CheckCircle, XCircle, AlertTriangle,
  ToggleLeft, Sliders, Package, Gift, Sparkles, ScrollText,
  Plus, X, Trash2, RefreshCw,
} from "lucide-react";
import api from "../../data/axiosConfig";
import AddonManager from "../../components/AddonManager";

// ── Feature catalogue: entitlement (camelCase) key → label + group ────────────
// Keys MUST match the entitlements object the backend returns. Each feature is
// INDEPENDENT — there are intentionally no dependencies between them.
const FEATURE_GROUPS = [
  { group: "Core CRM", items: [
    { key: "leadManagement", label: "Lead Management" },
    { key: "contacts",       label: "Contacts" },
    { key: "basicReports",   label: "Basic Reports" },
    { key: "attendance",     label: "Attendance" },
    { key: "dailyReport",    label: "Daily Report" },
  ]},
  { group: "Outreach", items: [
    { key: "smsBlast",           label: "SMS Blast" },
    { key: "whatsappBlast",      label: "WhatsApp Blast" },
    { key: "emailBlast",         label: "Email Blast" },
    { key: "campaigns",          label: "Campaigns" },
    { key: "whatsappAutomation", label: "WhatsApp Automation" },
  ]},
  { group: "Advertising", items: [
    { key: "googleAds", label: "Google Ads" },
    { key: "metaAds",   label: "Meta / Facebook Ads" },
  ]},
  { group: "Calls & AI", items: [
    { key: "callRecording",     label: "Call Recording" },
    { key: "callTranscription", label: "Call Transcription" },
    { key: "aiSummary",         label: "AI Summary" },
    { key: "voiceBot",          label: "Voice Bot" },
  ]},
  { group: "Platform & Branding", items: [
    { key: "apiAccess",      label: "API Access" },
    { key: "webhookAccess",  label: "Webhook Access" },
    { key: "customReports",  label: "Custom Reports" },
    { key: "whiteLabel",     label: "White Label" },
    { key: "customDomain",   label: "Custom Domain" },
    { key: "customBranding", label: "Custom Branding" },
  ]},
  { group: "Operations", items: [
    { key: "projects",        label: "Projects" },
    { key: "tasks",           label: "Tasks" },
    { key: "payroll",         label: "Payroll" },
    { key: "websiteTracking", label: "Website Tracking" },
  ]},
];
const ALL_FEATURE_KEYS = FEATURE_GROUPS.flatMap(g => g.items.map(i => i.key));

// Numeric limits the developer can override per company.
const LIMIT_FIELDS = [
  { key: "admins",              label: "Admins" },
  { key: "users",               label: "Users" },
  { key: "leads",               label: "Leads" },
  { key: "websites",            label: "Websites" },
  { key: "metaCampaigns",       label: "Meta Campaigns" },
  { key: "googleAccounts",      label: "Google Accounts" },
  { key: "storageMB",           label: "Storage (MB)" },
  { key: "transcriptionsLimit", label: "Transcriptions / month" },
  { key: "summariesLimit",      label: "AI Summaries / month" },
  { key: "voiceBotLimit",       label: "Voice Bot / month" },
];

// Benefit / addon enum → friendly label (same enum on both endpoints)
const TYPE_LABELS = {
  extra_admin: "Extra Admin", extra_users_5: "Extra Users (+5)",
  extra_leads_5000: "Extra Leads (+5,000)", extra_website: "Extra Website",
  extra_meta_campaign: "Extra Meta Campaign", extra_google_account: "Extra Google Account",
  storage_1gb: "Storage +1 GB", storage_5gb: "Storage +5 GB", storage_10gb: "Storage +10 GB",
  call_recording: "Call Recording", call_transcription: "Call Transcription",
  ai_summary: "AI Summary", voice_bot: "Voice Bot", whatsapp_automation: "WhatsApp Automation",
  api_access: "API Access", webhook_access: "Webhook Access", white_label: "White Label",
  custom_domain: "Custom Domain", custom_branding: "Custom Branding",
  transcriptions_100: "AI Transcriptions +100", transcriptions_500: "AI Transcriptions +500",
  summaries_100: "AI Summaries +100", summaries_500: "AI Summaries +500",
};

const CREDIT_TYPES = ["transcriptions_100", "transcriptions_500", "summaries_100", "summaries_500"];
const STATUS_OPTIONS = ["active", "trial", "paused", "suspended", "cancelled"];

const TABS = [
  { id: "features", label: "Features",   icon: ToggleLeft },
  { id: "limits",   label: "Limits",     icon: Sliders },
  { id: "addons",   label: "Addons",     icon: Package },
  { id: "benefits", label: "Benefits",   icon: Gift },
  { id: "credits",  label: "AI Credits", icon: Sparkles },
  { id: "activity", label: "Activity",   icon: ScrollText },
];

function fmtDate(d) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Build the tri-state UI state from a devOverrides object
function deriveState(overrides = {}) {
  const ft = overrides.featureToggles || {};
  const features = {};
  for (const key of ALL_FEATURE_KEYS) {
    features[key] = key in ft ? (ft[key] ? "on" : "off") : "inherit";
  }
  const limits = {};
  for (const f of LIMIT_FIELDS) {
    const v = overrides[f.key];
    limits[f.key] = v === null || v === undefined ? "" : String(v);
  }
  // Per-field expiry + price metadata (from devOverrides.limitMeta)
  const meta = overrides.limitMeta || {};
  const limitMeta = {};
  for (const f of LIMIT_FIELDS) {
    const m = meta[f.key] || {};
    limitMeta[f.key] = {
      // <input type="date"> wants YYYY-MM-DD
      expiresAt: m.expiresAt ? new Date(m.expiresAt).toISOString().slice(0, 10) : "",
      price:     m.price != null && m.price !== 0 ? String(m.price) : "",
    };
  }
  const rec = overrides.recordingEnabled;
  const recording = rec === null || rec === undefined ? "inherit" : rec ? "on" : "off";
  return { features, limits, limitMeta, recording };
}

// ── Tri-state segmented control ───────────────────────────────────────────────
function TriToggle({ value, onChange }) {
  const opts = [
    { v: "inherit", label: "Inherit" },
    { v: "on",      label: "On" },
    { v: "off",     label: "Off" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-[#E5E7EB] dark:border-[#262A38] overflow-hidden">
      {opts.map(o => {
        const active = value === o.v;
        const tone =
          o.v === "on"  ? "bg-green-600 text-white" :
          o.v === "off" ? "bg-red-600 text-white"   :
                          "bg-[#6B7280] text-white";
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`px-2.5 py-1 text-[11px] font-semibold transition ${
              active ? tone : "bg-transparent text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F0F2FA] dark:hover:bg-[#262A38]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CompanyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data,    setData]    = useState(null);   // full /details response
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("features");
  const [toast,   setToast]   = useState(null);    // { msg, ok }

  const [featureState, setFeatureState]   = useState({});
  const [limitState,   setLimitState]     = useState({});
  const [limitMetaState, setLimitMetaState] = useState({});
  const [recordState,  setRecordState]    = useState("inherit");

  const [savingFeatures, setSavingFeatures] = useState(false);
  const [savingLimits,   setSavingLimits]   = useState(false);

  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const applyOverridesToState = useCallback((overrides) => {
    const s = deriveState(overrides || {});
    setFeatureState(s.features);
    setLimitState(s.limits);
    setLimitMetaState(s.limitMeta);
    setRecordState(s.recording);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/developer/companies/${id}/details`);
      setData(res);
      applyOverridesToState(res.company?.devOverrides);
    } catch (e) {
      showToast(e.response?.data?.message || "Failed to load company", false);
    } finally {
      setLoading(false);
    }
  }, [id, applyOverridesToState]);

  useEffect(() => { load(); }, [load]);

  const ent = data?.entitlements || {};

  // ── Save feature toggles ────────────────────────────────────────────────────
  const saveFeatures = async () => {
    setSavingFeatures(true);
    try {
      const featureToggles = {};
      for (const key of ALL_FEATURE_KEYS) {
        if (featureState[key] === "on")  featureToggles[key] = true;
        if (featureState[key] === "off") featureToggles[key] = false;
        // "inherit" → omitted → backend stores nothing for this key → plan value applies
      }
      const { data: res } = await api.put(`/developer/companies/${id}/override`, {
        featureToggles,
        reason: "Feature toggles updated from Company Details",
      });
      setData(prev => prev ? {
        ...prev,
        entitlements: res.entitlements,
        company: { ...prev.company, devOverrides: res.devOverrides },
      } : prev);
      applyOverridesToState(res.devOverrides);
      // Clear entitlement cache so any admin tab for this company refreshes
      window.dispatchEvent(new Event("plan_updated"));
      showToast("Features saved.", true);
    } catch (e) {
      showToast(e.response?.data?.message || "Failed to save features", false);
    } finally {
      setSavingFeatures(false);
    }
  };

  // ── Save numeric / AI limits ─────────────────────────────────────────────────
  const saveLimits = async () => {
    setSavingLimits(true);
    try {
      const body = { reason: "Limits updated from Company Details" };
      const limitMeta = {};
      for (const f of LIMIT_FIELDS) {
        const v = limitState[f.key];
        const hasValue = !(v === "" || v === null);
        body[f.key] = hasValue ? Number(v) : null;

        // Only attach meta for fields that actually have a value set.
        if (hasValue) {
          const m = limitMetaState[f.key] || {};
          limitMeta[f.key] = {
            expiresAt: m.expiresAt ? new Date(m.expiresAt).toISOString() : null,
            price:     m.price === "" || m.price == null ? 0 : Number(m.price),
            currency:  "INR",
          };
        }
      }
      body.limitMeta = limitMeta;
      body.recordingEnabled = recordState === "inherit" ? null : recordState === "on";
      const { data: res } = await api.put(`/developer/companies/${id}/override`, body);
      setData(prev => prev ? {
        ...prev,
        entitlements: res.entitlements,
        company: { ...prev.company, devOverrides: res.devOverrides },
      } : prev);
      applyOverridesToState(res.devOverrides);
      window.dispatchEvent(new Event("plan_updated"));
      const invCount = res.invoices?.length || 0;
      showToast(invCount ? `Limits saved. ${invCount} invoice(s) created.` : "Limits saved.", true);
      // Refresh details so the new invoices + meta show immediately
      if (invCount) load();
    } catch (e) {
      showToast(e.response?.data?.message || "Failed to save limits", false);
    } finally {
      setSavingLimits(false);
    }
  };

  // ── Change subscription status ───────────────────────────────────────────────
  const changeStatus = async (status) => {
    try {
      await api.put(`/developer/companies/${id}/status`, {
        status,
        reason: `Status set to ${status} from Company Details`,
      });
      await load();
      showToast(`Subscription set to ${status}.`, true);
    } catch (e) {
      showToast(e.response?.data?.message || "Failed to change status", false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 py-8 font-poppins">
        <button onClick={() => navigate("/developer/companies")} className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 dark:text-blue-400 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Companies
        </button>
        <p className="text-[14px] text-red-500">Could not load this company.</p>
      </div>
    );
  }

  const { company, usage, remaining, benefits = [], auditLogs = [] } = data;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-6 sm:py-8 font-poppins">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-white text-[13px] font-semibold shadow-xl ${toast.ok ? "bg-[#059669]" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Back */}
      <button onClick={() => navigate("/developer/companies")} className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 dark:text-blue-400 mb-4 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to Companies
      </button>

      {/* Header card */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
              <span className="text-[15px] font-bold text-blue-600 dark:text-blue-400">
                {(company.name || "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA] truncate">{company.name}</h1>
              <p className="text-[12px] text-[#8B92A9] truncate">{company.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 capitalize">
              {company.plan || "trial"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8B92A9]">Status</span>
              <select
                value={company.subscriptionStatus || "trial"}
                onChange={e => changeStatus(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] capitalize focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        {ent.readOnly && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[12px]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            This company is in read-only mode (subscription is {company.subscriptionStatus}). Features below still resolve, but the company cannot perform write actions until reactivated.
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border transition ${
                active
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                  : "border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#6B7280] dark:text-[#9DA3BB] hover:border-[#9DA3BB]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── FEATURES TAB ── */}
      {tab === "features" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-[12px] text-blue-700 dark:text-blue-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Each feature is independent. <strong>Inherit</strong> follows the plan + any addons.
              <strong> On</strong> / <strong>Off</strong> force the feature for this company only — they always win over the plan.
            </span>
          </div>

          {FEATURE_GROUPS.map(group => (
            <div key={group.group} className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0F2FA] dark:border-[#1E2130]">
                <p className="text-[11px] font-bold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider">{group.group}</p>
              </div>
              <div className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                {group.items.map(item => {
                  const effective = !!ent[item.key];
                  return (
                    <div key={item.key} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{item.label}</p>
                        <p className="text-[11px] text-[#8B92A9]">
                          Currently {effective
                            ? <span className="text-green-600 dark:text-green-400 font-semibold">Enabled</span>
                            : <span className="text-[#9DA3BB] font-semibold">Disabled</span>}
                        </p>
                      </div>
                      <TriToggle
                        value={featureState[item.key] || "inherit"}
                        onChange={v => setFeatureState(prev => ({ ...prev, [item.key]: v }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button onClick={saveFeatures} disabled={savingFeatures}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition">
              {savingFeatures ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingFeatures ? "Saving…" : "Save Features"}
            </button>
          </div>
        </div>
      )}

      {/* ── LIMITS TAB ── */}
      {tab === "limits" && (
        <div className="space-y-4">
          {/* Usage summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { k: "transcriptions", label: "Transcriptions" },
              { k: "summaries",      label: "AI Summaries" },
              { k: "voiceBot",       label: "Voice Bot" },
              { k: "recordings",     label: "Recordings" },
            ].map(m => (
              <div key={m.k} className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl px-4 py-3">
                <p className="text-[11px] text-[#8B92A9]">{m.label} (this month)</p>
                <p className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                  {usage?.[`${m.k}Used`] ?? 0}
                  <span className="text-[12px] font-normal text-[#8B92A9]"> used</span>
                </p>
                {remaining?.[m.k] != null && (
                  <p className="text-[11px] text-[#8B92A9]">{remaining[m.k]} left</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-[12px] text-blue-700 dark:text-blue-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Leave a field <strong>blank</strong> to inherit the plan + addon value. Enter a number to set an absolute cap for this company only. Set a <strong>Time Limit</strong> to auto-revert to the plan value on that date, and a <strong>Price</strong> to record a billed invoice for the extra capacity.</span>
          </div>

          <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {LIMIT_FIELDS.map(f => {
                const hasValue = !(limitState[f.key] === "" || limitState[f.key] == null);
                const meta = limitMetaState[f.key] || {};
                return (
                <div key={f.key} className="rounded-2xl border border-[#E5E7EB] dark:border-[#262A38] p-3">
                  <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">{f.label}</label>
                  <input
                    type="number" min={0}
                    value={limitState[f.key] ?? ""}
                    placeholder={`Inherit (${ent[f.key] ?? "—"})`}
                    onChange={e => setLimitState(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9DA] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  {/* Time limit + price — only relevant when an override value is set */}
                  {hasValue && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="block text-[9px] font-semibold text-[#9DA3BB] uppercase tracking-wider mb-1">Time Limit</label>
                        <input
                          type="date"
                          value={meta.expiresAt || ""}
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={e => setLimitMetaState(prev => ({ ...prev, [f.key]: { ...(prev[f.key] || {}), expiresAt: e.target.value } }))}
                          className="w-full px-2.5 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-blue-500"
                          title="Leave blank for no expiry. On this date the limit reverts to the plan value."
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-semibold text-[#9DA3BB] uppercase tracking-wider mb-1">Price (₹)</label>
                        <input
                          type="number" min={0} step="0.01"
                          value={meta.price || ""}
                          placeholder="0"
                          onChange={e => setLimitMetaState(prev => ({ ...prev, [f.key]: { ...(prev[f.key] || {}), price: e.target.value } }))}
                          className="w-full px-2.5 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9DA] focus:outline-none focus:border-blue-500"
                          title="Amount charged for this additional limit. A price creates an invoice entry on save."
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-[#9DA3BB] mt-1.5">
                    Effective now: {ent[f.key] ?? "—"}
                    {hasValue && meta.expiresAt && <span className="text-amber-600 dark:text-amber-400"> · expires {fmtDate(meta.expiresAt)}</span>}
                  </p>
                </div>
                );
              })}

              {/* recordingEnabled tri-state */}
              <div>
                <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">Recording Enabled</label>
                <TriToggle value={recordState} onChange={setRecordState} />
                <p className="text-[10px] text-[#9DA3BB] mt-1">Effective now: {ent.recordingEnabled ? "Enabled" : "Disabled"}</p>
              </div>
            </div>

            <div className="flex justify-end mt-5">
              <button onClick={saveLimits} disabled={savingLimits}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition">
                {savingLimits ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingLimits ? "Saving…" : "Save Limits"}
              </button>
            </div>
          </div>

          {/* ── Billed limit overrides (invoices) ── */}
          {(data.limitInvoices?.length > 0) && (
            <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5">
              <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] mb-3 flex items-center gap-1.5">
                <ScrollText className="w-4 h-4 text-blue-500" /> Billed Limit Overrides
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-[#9DA3BB] border-b border-[#E5E7EB] dark:border-[#262A38]">
                      <th className="py-2 pr-3">Invoice</th>
                      <th className="py-2 pr-3">Limit</th>
                      <th className="py-2 pr-3">Value</th>
                      <th className="py-2 pr-3">Price</th>
                      <th className="py-2 pr-3">Granted</th>
                      <th className="py-2 pr-3">Expires</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.limitInvoices.map(inv => (
                      <tr key={inv._id} className="border-b border-[#F0F2FA] dark:border-[#1E2130] text-[#4B5168] dark:text-[#9DA3BB]">
                        <td className="py-2 pr-3 font-mono text-[11px]">{inv.invoiceId}</td>
                        <td className="py-2 pr-3">{inv.limitLabel || inv.limitKey}</td>
                        <td className="py-2 pr-3">{inv.value}</td>
                        <td className="py-2 pr-3 font-semibold text-[#0F1117] dark:text-[#F0F2FA]">₹{Number(inv.price).toLocaleString()}</td>
                        <td className="py-2 pr-3">{fmtDate(inv.grantedAt)}</td>
                        <td className="py-2 pr-3">{inv.expiresAt ? fmtDate(inv.expiresAt) : "No expiry"}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            inv.status === "paid" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : inv.status === "void" ? "bg-gray-100 dark:bg-gray-500/10 text-gray-500"
                            : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          }`}>{inv.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ADDONS TAB ── (reuse existing component) */}
      {tab === "addons" && (
        <AddonManager companyId={id} addons={data.addons || []} onRefresh={load} />
      )}

      {/* ── BENEFITS TAB ── */}
      {tab === "benefits" && (
        <BenefitManager companyId={id} benefits={benefits} onRefresh={load} showToast={showToast} />
      )}

      {/* ── AI CREDITS TAB ── */}
      {tab === "credits" && (
        <AiCreditsPanel companyId={id} usage={usage} remaining={remaining} onRefresh={load} showToast={showToast} />
      )}

      {/* ── ACTIVITY TAB ── */}
      {tab === "activity" && (
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0F2FA] dark:border-[#1E2130] flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-blue-500" />
            <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Audit Log</h3>
          </div>
          {auditLogs.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[#9DA3BB]">No activity recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
              {auditLogs.map(log => (
                <div key={log._id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{log.action}</span>
                    <span className="text-[11px] text-[#9DA3BB]">{fmtDate(log.createdAt)}</span>
                  </div>
                  {log.field && <p className="text-[11px] text-[#8B92A9] mt-0.5">Field: {log.field}</p>}
                  {log.reason && <p className="text-[11px] text-[#9DA3BB] italic mt-0.5">{log.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Benefit manager (inline) ──────────────────────────────────────────────────
function BenefitManager({ companyId, benefits, onRefresh, showToast }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ benefitType: "extra_users_5", quantity: 1, validDays: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState(null);

  const grant = async () => {
    setBusy(true);
    try {
      await api.post(`/benefits/${companyId}/grant`, {
        benefitType: form.benefitType,
        quantity: Number(form.quantity),
        validDays: form.validDays ? Number(form.validDays) : undefined,
        notes: form.notes,
      });
      setShow(false);
      setForm({ benefitType: "extra_users_5", quantity: 1, validDays: "", notes: "" });
      onRefresh?.();
      showToast?.("Benefit granted.", true);
    } catch (e) {
      showToast?.(e.response?.data?.message || "Failed to grant benefit", false);
    } finally { setBusy(false); }
  };

  const extend = async (benefitId) => {
    const days = window.prompt("Extend benefit by how many days?", "30");
    if (!days) return;
    setActionId(benefitId);
    try {
      await api.put(`/benefits/${benefitId}/extend`, { validDays: Number(days) });
      onRefresh?.();
      showToast?.("Benefit extended.", true);
    } catch (e) {
      showToast?.(e.response?.data?.message || "Failed to extend", false);
    } finally { setActionId(null); }
  };

  const deactivate = async (benefitId) => {
    if (!window.confirm("Deactivate this benefit?")) return;
    setActionId(benefitId);
    try {
      await api.delete(`/benefits/${benefitId}`);
      onRefresh?.();
      showToast?.("Benefit deactivated.", true);
    } catch (e) {
      showToast?.(e.response?.data?.message || "Failed to deactivate", false);
    } finally { setActionId(null); }
  };

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F2FA] dark:border-[#1E2130]">
        <div className="flex items-center gap-2.5">
          <Gift className="w-4 h-4 text-blue-500" />
          <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Benefits</h3>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F0F2FA] dark:bg-[#13161E] text-[#6B7280] dark:text-[#9DA3BB]">
            {benefits.filter(b => b.active).length} active
          </span>
        </div>
        <button onClick={() => setShow(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold transition">
          <Plus className="w-3.5 h-3.5" /> Grant Benefit
        </button>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-[#1A1D27] rounded-2xl p-6 w-full max-w-md border border-[#E5E7EB] dark:border-[#262A38] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-[#0F1117] dark:text-[#F0F2FA]">Grant Free Benefit</h4>
              <button onClick={() => setShow(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">Benefit Type</label>
                <select value={form.benefitType} onChange={e => setForm(p => ({ ...p, benefitType: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">Quantity</label>
                  <input type="number" min={1} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">Valid days</label>
                  <input type="number" min={0} placeholder="Blank = forever" value={form.validDays} onChange={e => setForm(p => ({ ...p, validDays: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9DA] focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block mb-1.5">Notes (optional)</label>
                <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-sm text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShow(false)} className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] text-[13px] font-semibold text-[#6B7280] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
              <button onClick={grant} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[13px] font-semibold transition">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Grant
              </button>
            </div>
          </div>
        </div>
      )}

      {benefits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#9DA3BB]">
          <Gift className="w-7 h-7 text-[#D1D5DB] dark:text-[#374151]" />
          <p className="text-[13px]">No benefits yet</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
          {benefits.map(b => (
            <div key={b._id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{TYPE_LABELS[b.benefitType] || b.benefitType}</span>
                  {b.quantity > 1 && <span className="text-[11px] text-[#8B92A9]">× {b.quantity}</span>}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.active ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                    {b.active ? "active" : "inactive"}
                  </span>
                </div>
                <p className="text-[11px] text-[#8B92A9] mt-0.5">Valid {fmtDate(b.validFrom)} · Until {fmtDate(b.validUntil)}</p>
                {b.notes && <p className="text-[11px] text-[#9DA3BB] italic mt-0.5">{b.notes}</p>}
              </div>
              {b.active && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => extend(b._id)} disabled={actionId === b._id}
                    className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition">
                    <RefreshCw className="w-3 h-3" /> Extend
                  </button>
                  <button onClick={() => deactivate(b._id)} disabled={actionId === b._id}
                    className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                    {actionId === b._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Deactivate
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI credits panel ──────────────────────────────────────────────────────────
function AiCreditsPanel({ companyId, usage, remaining, onRefresh, showToast }) {
  const [form, setForm] = useState({ creditType: "transcriptions_100", quantity: 1, reason: "" });
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      await api.post(`/developer/companies/${companyId}/ai-credits`, {
        creditType: form.creditType,
        quantity: Number(form.quantity),
        reason: form.reason,
      });
      setForm({ creditType: "transcriptions_100", quantity: 1, reason: "" });
      onRefresh?.();
      showToast?.("AI credits added.", true);
    } catch (e) {
      showToast?.(e.response?.data?.message || "Failed to add credits", false);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { k: "transcriptions", label: "Transcriptions" },
          { k: "summaries",      label: "AI Summaries" },
          { k: "voiceBot",       label: "Voice Bot" },
        ].map(m => (
          <div key={m.k} className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl px-4 py-3">
            <p className="text-[11px] text-[#8B92A9]">{m.label}</p>
            <p className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{remaining?.[m.k] ?? 0} <span className="text-[12px] font-normal text-[#8B92A9]">remaining</span></p>
            <p className="text-[11px] text-[#9DA3BB]">{usage?.[`${m.k}Used`] ?? 0} used this month</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Add AI Credit Pack</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">Credit Pack</label>
            <select value={form.creditType} onChange={e => setForm(p => ({ ...p, creditType: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              {CREDIT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">Quantity</label>
            <input type="number" min={1} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] uppercase tracking-wider mb-1.5">Reason (optional)</label>
            <input type="text" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>
        <div className="flex justify-end mt-5">
          <button onClick={add} disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {busy ? "Adding…" : "Add Credits"}
          </button>
        </div>
        <p className="text-[11px] text-[#9DA3BB] mt-3">Credit packs are stored as free, non-expiring addons and stack on top of the monthly plan quota.</p>
      </div>
    </div>
  );
}
