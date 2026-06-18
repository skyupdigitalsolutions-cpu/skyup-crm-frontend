// src/components/UpgradePlan.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Billing & Plans page — premium SaaS pricing layout.
// Icons: lucide-react only.
// Tabs: Plans | Add-ons | My Features | Invoices
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Lock,
  Loader2,
  FileText,
  Eye,
  Smartphone,
  Monitor,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Building2,
  Star,
  Phone,
  Bell,
  Mic,
  RefreshCw,
  Users,
  ClipboardList,
  BarChart3,
  UserCheck,
  Globe,
  Mail,
  Info,
  ChevronRight,
  CreditCard,
  Zap,
  Shield,
  Award,
} from "lucide-react";
import api from "../data/axiosConfig";
import InvoiceReceipt from "./InvoiceReceipt";
import UpdatePaymentModal from "./UpdatePaymentModal";
import DowngradeWarningModal from "./DowngradeWarningModal";
import AddonStore from "./AddonStore";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_ORDER = ["basic", "pro", "advance", "enterprise"];

const PLAN_LIMITS = {
  basic:      { admins: 1,   users: 5 },
  pro:        { admins: 3,   users: 20 },
  advance:    { admins: 5,   users: 50 },
  enterprise: { admins: 999, users: 999 },
};

const BACKEND_PLAN_ID = {
  basic: "starter",
  pro: "growth",
  enterprise: "enterprise",
};

const HIDDEN_FEATURE_KEYS = new Set([
  "voice-bot", "voiceBot", "api-access", "apiAccess",
  "webhook-access", "webhookAccess", "custom-reports", "customReports",
  "white-label", "whiteLabel", "custom-domain", "customDomain",
  "custom-branding", "customBranding", "tasks", "payroll",
]);

const FEATURE_LABELS = {
  "leads":                 "Lead Management",
  "contacts":              "Contacts",
  "projects":              "Projects",
  "basic-reports":         "Reports",
  "attendance":            "Attendance",
  "daily-report":          "Daily Report",
  "ai-remark":             "AI Remark Summary",
  "sms-blast":             "SMS Blast",
  "whatsapp-blast":        "WhatsApp Blast",
  "email-blast":           "Email Blast",
  "campaigns":             "Campaign Management",
  "google-ads":            "Google Ads",
  "meta-ads":              "Meta Ads",
  "call-recording":        "Call Recording",
  "call-transcription":    "Call Transcription",
  "ai-summary":            "AI Call Summary",
  "website-tracking":      "Website Tracking",
  "telegram-notification": "Telegram Notifications",
};

const ADDON_LABELS = {
  extra_admin:            "Extra Admin",
  extra_users_5:          "5 Extra Users",
  extra_leads_5000:       "5,000 Extra Leads",
  extra_website:          "Extra Website",
  extra_meta_campaign:    "Extra Meta Campaign",
  extra_google_account:   "Extra Google Account",
  storage_1gb:            "1 GB Storage",
  storage_5gb:            "5 GB Storage",
  storage_10gb:           "10 GB Storage",
  call_recording:         "Call Recording",
  call_transcription:     "Call Transcription",
  ai_summary:             "AI Summary",
  transcriptions_100:     "100 Transcriptions",
  transcriptions_500:     "500 Transcriptions",
  summaries_100:          "100 AI Summaries",
  summaries_500:          "500 AI Summaries",
};

const STATUS_STYLE = {
  active:    { bg: "#ECFDF5", fg: "#059669", label: "Active" },
  trial:     { bg: "#EFF6FF", fg: "#2563EB", label: "Trial" },
  expired:   { bg: "#FEF2F2", fg: "#DC2626", label: "Expired" },
  cancelled: { bg: "#FEF2F2", fg: "#DC2626", label: "Cancelled" },
  suspended: { bg: "#FFF7ED", fg: "#D97706", label: "Suspended" },
  paused:    { bg: "#FFF7ED", fg: "#D97706", label: "Paused" },
};

const PLAN_COLORS = {
  basic:      "#6B7280",
  pro:        "#2563EB",
  advance:    "#7C3AED",
  enterprise: "#0E7490",
};

const PLAN_NAMES = {
  basic:      "Basic",
  pro:        "Pro",
  advance:    "Advance",
  enterprise: "Enterprise",
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

const planRank        = (id) => PLAN_ORDER.indexOf(id ?? "basic");
const isDowngradeTo   = (t, c) => planRank(t) < planRank(c);
const fmtDateLong     = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const prettyFeatureLabel = (key) =>
  FEATURE_LABELS[key] || String(key).replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const addonLabel      = (t) =>
  ADDON_LABELS[t] || (t || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function featureLimitText(key, plan) {
  const fmt = (v, suffix = "") => {
    if (v == null) return "";
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return "";
    if (n < 0 || n >= 1_000_000) return "Unlimited";
    return `${n.toLocaleString()}${suffix}`;
  };
  switch (key) {
    case "leads":
    case "leadManagement":       return fmt(plan.maxLeads, " leads");
    case "google-ads":
    case "googleAds":            return fmt(plan.maxGoogleAccounts, plan.maxGoogleAccounts === 1 ? " account" : " accounts");
    case "meta-ads":
    case "metaAds":              return fmt(plan.maxMetaCampaigns, plan.maxMetaCampaigns === 1 ? " campaign" : " campaigns");
    case "website-tracking":
    case "websiteTracking":      return fmt(plan.maxWebsites, plan.maxWebsites === 1 ? " website" : " websites");
    case "call-transcription":
    case "callTranscription":    return fmt(plan.transcriptionsPerMonth, " min/mo");
    case "ai-summary":
    case "aiSummary":            return fmt(plan.summariesPerMonth, " min/mo");
    default:                     return "";
  }
}

async function sendInvoiceEmail(payload) {
  try {
    await api.post("/razorpay/notify-invoice", {
      ...payload,
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan defaults
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_DEFAULTS = {
  basic: {
    id: "basic", name: "Basic", desc: "For Small Teams",
    monthlyPrice: 2499, yearlyPrice: 24990, color: PLAN_COLORS.basic, popular: false,
    maxAdmins: 1, maxUsers: 5, maxLeads: 1000, maxWebsites: 1,
    maxMetaCampaigns: 1, maxGoogleAccounts: 1, maxStorageMB: 100,
    transcriptionsPerMonth: 0, summariesPerMonth: 0, voiceBotPerMonth: 0, dataRetentionDays: 15,
    features: [
      { key: "leads",                 label: "Lead Management",        enabled: true  },
      { key: "contacts",              label: "Contacts",               enabled: true  },
      { key: "projects",              label: "Projects",               enabled: true  },
      { key: "basic-reports",         label: "Reports",                enabled: true  },
      { key: "attendance",            label: "Attendance",             enabled: true  },
      { key: "daily-report",          label: "Daily Report",           enabled: true  },
      { key: "ai-remark",             label: "AI Remark Summary",      enabled: true  },
      { key: "sms-blast",             label: "SMS Blast",              enabled: false },
      { key: "whatsapp-blast",        label: "WhatsApp Blast",         enabled: false },
      { key: "email-blast",           label: "Email Blast",            enabled: false },
      { key: "campaigns",             label: "Campaign Management",    enabled: false },
      { key: "website-tracking",      label: "Website Tracking",       enabled: false },
      { key: "call-recording",        label: "Call Recording",         enabled: false },
      { key: "call-transcription",    label: "Call Transcription",     enabled: false },
      { key: "ai-summary",            label: "AI Call Summary",        enabled: false },
      { key: "telegram-notification", label: "Telegram Notifications", enabled: false },
    ],
  },
  pro: {
    id: "pro", name: "Pro", desc: "For Growing Businesses",
    monthlyPrice: 6999, yearlyPrice: 69990, color: PLAN_COLORS.pro, popular: true,
    maxAdmins: 3, maxUsers: 20, maxLeads: 2000, maxWebsites: 3,
    maxMetaCampaigns: 3, maxGoogleAccounts: 3, maxStorageMB: 5120,
    transcriptionsPerMonth: 6000, summariesPerMonth: 6000, voiceBotPerMonth: 0, dataRetentionDays: 60,
    features: [
      { key: "leads",                 label: "Lead Management",        enabled: true },
      { key: "contacts",              label: "Contacts",               enabled: true },
      { key: "projects",              label: "Projects",               enabled: true },
      { key: "basic-reports",         label: "Reports",                enabled: true },
      { key: "attendance",            label: "Attendance",             enabled: true },
      { key: "daily-report",          label: "Daily Report",           enabled: true },
      { key: "ai-remark",             label: "AI Remark Summary",      enabled: true },
      { key: "email-blast",           label: "Email Blast",            enabled: true },
      { key: "whatsapp-blast",        label: "WhatsApp Blast",         enabled: true },
      { key: "sms-blast",             label: "SMS Blast",              enabled: true },
      { key: "campaigns",             label: "Campaign Management",    enabled: true },
      { key: "website-tracking",      label: "Website Tracking",       enabled: true },
      { key: "call-recording",        label: "Call Recording",         enabled: true },
      { key: "call-transcription",    label: "Call Transcription",     enabled: true },
      { key: "ai-summary",            label: "AI Call Summary",        enabled: true },
      { key: "telegram-notification", label: "Telegram Notifications", enabled: true },
    ],
  },
  advance: {
    id: "advance", name: "Advance", desc: "Automation & Growth",
    monthlyPrice: 14999, yearlyPrice: 149990, color: PLAN_COLORS.advance, popular: false,
    maxAdmins: 5, maxUsers: 50, maxLeads: 5000, maxWebsites: 5,
    maxMetaCampaigns: 5, maxGoogleAccounts: 5, maxStorageMB: 51200,
    transcriptionsPerMonth: 15000, summariesPerMonth: 15000, voiceBotPerMonth: 0, dataRetentionDays: 365,
    features: [
      { key: "leads",                 label: "Lead Management",        enabled: true },
      { key: "contacts",              label: "Contacts",               enabled: true },
      { key: "projects",              label: "Projects",               enabled: true },
      { key: "basic-reports",         label: "Reports",                enabled: true },
      { key: "attendance",            label: "Attendance",             enabled: true },
      { key: "daily-report",          label: "Daily Report",           enabled: true },
      { key: "ai-remark",             label: "AI Remark Summary",      enabled: true },
      { key: "email-blast",           label: "Email Blast",            enabled: true },
      { key: "whatsapp-blast",        label: "WhatsApp Blast",         enabled: true },
      { key: "sms-blast",             label: "SMS Blast",              enabled: true },
      { key: "campaigns",             label: "Campaign Management",    enabled: true },
      { key: "website-tracking",      label: "Website Tracking",       enabled: true },
      { key: "call-recording",        label: "Call Recording",         enabled: true },
      { key: "call-transcription",    label: "Call Transcription",     enabled: true },
      { key: "ai-summary",            label: "AI Call Summary",        enabled: true },
      { key: "telegram-notification", label: "Telegram Notifications", enabled: true },
    ],
  },
  enterprise: {
    id: "enterprise", name: "Enterprise", desc: "For Large Organizations", custom: true,
    monthlyPrice: 0, yearlyPrice: 0, color: PLAN_COLORS.enterprise, popular: false,
    maxAdmins: 999, maxUsers: 999, maxLeads: 999999, maxWebsites: 999,
    maxMetaCampaigns: 999, maxGoogleAccounts: 999, maxStorageMB: 512000,
    transcriptionsPerMonth: 999999, summariesPerMonth: 999999, voiceBotPerMonth: 0, dataRetentionDays: 3650,
    features: [
      { key: "leads",                 label: "Lead Management",          enabled: true },
      { key: "contacts",              label: "Contacts",                 enabled: true },
      { key: "projects",              label: "Projects",                 enabled: true },
      { key: "basic-reports",         label: "Reports",                  enabled: true },
      { key: "attendance",            label: "Attendance",               enabled: true },
      { key: "daily-report",          label: "Daily Report",             enabled: true },
      { key: "ai-remark",             label: "AI Remark Summary",        enabled: true },
      { key: "email-blast",           label: "Email Blast",              enabled: true },
      { key: "whatsapp-blast",        label: "WhatsApp Blast",           enabled: true },
      { key: "sms-blast",             label: "SMS Blast",                enabled: true },
      { key: "campaigns",             label: "Campaign Management",      enabled: true },
      { key: "website-tracking",      label: "Website Tracking",         enabled: true },
      { key: "call-recording",        label: "Call Recording",           enabled: true },
      { key: "call-transcription",    label: "Call Transcription",       enabled: true },
      { key: "ai-summary",            label: "AI Call Summary",          enabled: true },
      { key: "telegram-notification", label: "Telegram Notifications",   enabled: true },
      { key: "multi-team",            label: "Multi-Team Management",    enabled: true },
      { key: "dedicated-onboarding",  label: "Dedicated Onboarding",     enabled: true },
      { key: "priority-support",      label: "Priority Support",         enabled: true },
      { key: "custom-config",         label: "Custom CRM Configuration", enabled: true },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// mergeConfigIntoDefaults
// ─────────────────────────────────────────────────────────────────────────────

function mergeConfigIntoDefaults(defaults, config) {
  if (!config || typeof config !== "object") return defaults;
  const merged = {};
  const orderedKeys = [
    ...PLAN_ORDER,
    ...Object.keys(config).filter((k) => !PLAN_ORDER.includes(k) && k !== "trial"),
  ];
  for (const id of orderedKeys) {
    const base = defaults[id] || { id, name: id, features: [] };
    const cfg  = config[id];
    if (!cfg || typeof cfg !== "object") { merged[id] = base; continue; }

    const enabledKeys = Array.isArray(cfg.features) ? cfg.features : null;
    let features = base.features;
    if (enabledKeys) {
      const enabledSet = new Set(enabledKeys);
      const seen = new Set();
      features = base.features.map((f) => { seen.add(f.key); return { ...f, enabled: enabledSet.has(f.key) }; });
      for (const key of enabledKeys) {
        if (!seen.has(key)) { features.push({ key, label: prettyFeatureLabel(key), enabled: true }); seen.add(key); }
      }
    }

    const num = (a, b) => (a != null ? Number(a) : b);
    merged[id] = {
      ...base,
      name:                   cfg.name              != null ? cfg.name                     : base.name,
      monthlyPrice:           num(cfg.monthlyPrice, base.monthlyPrice),
      yearlyPrice:            num(cfg.yearlyPrice,  base.yearlyPrice),
      maxUsers:               num(cfg.maxUsers,     base.maxUsers),
      maxAdmins:              num(cfg.maxAdmins,    base.maxAdmins),
      maxLeads:               num(cfg.maxLeads,     base.maxLeads),
      maxWebsites:            num(cfg.maxWebsites,  base.maxWebsites),
      maxMetaCampaigns:       num(cfg.maxMetaCampaigns,   base.maxMetaCampaigns),
      maxGoogleAccounts:      num(cfg.maxGoogleAccounts,  base.maxGoogleAccounts),
      maxStorageMB:           num(cfg.maxStorageMB,       base.maxStorageMB),
      transcriptionsPerMonth: num(cfg.transcriptionsPerMonth, base.transcriptionsPerMonth),
      summariesPerMonth:      num(cfg.summariesPerMonth,  base.summariesPerMonth),
      voiceBotPerMonth:       num(cfg.voiceBotPerMonth,   base.voiceBotPerMonth),
      dataRetentionDays:      num(cfg.dataRetentionDays,  base.dataRetentionDays),
      features,
    };
  }
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay hook
// ─────────────────────────────────────────────────────────────────────────────

function useRazorpay() {
  const openCheckout = useCallback(async ({ orderData, plan, billing, onSuccess, onFailure }) => {
    const loaded = await new Promise((resolve) => {
      if (document.getElementById("razorpay-sdk")) return resolve(true);
      const s = document.createElement("script");
      s.id      = "razorpay-sdk";
      s.src     = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload  = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
    if (!loaded) { onFailure("Failed to load Razorpay SDK."); return; }

    const rzp = new window.Razorpay({
      key:       orderData.keyId,
      amount:    orderData.amount,
      currency:  orderData.currency,
      name:      "SkyUp CRM",
      description: `${orderData.planName} – ${billing}`,
      order_id:  orderData.orderId,
      theme:     { color: plan.color },
      handler:   (res) => onSuccess(res),
      modal:     { ondismiss: () => onFailure(null) },
    });
    rzp.on("payment.failed", (r) => onFailure(r.error?.description || "Payment failed."));
    rzp.open();
  }, []);
  return { openCheckout };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="animate-spin w-7 h-7 text-[#2563EB]" />
    </div>
  );
}

function CheckMark({ color }) {
  return (
    <CheckCircle2
      className="w-4 h-4 shrink-0"
      style={{ color: color || "#059669" }}
      strokeWidth={2}
    />
  );
}

function LockMark() {
  return <Lock className="w-3.5 h-3.5 shrink-0 text-[#C4C9D9]" strokeWidth={2} />;
}

function Chip({ color, children }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-semibold whitespace-nowrap"
      style={{ background: color + "15", color }}
    >
      {children}
    </span>
  );
}

function SectionHeader({ icon: Icon, iconBg, iconColor, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
        <Icon className="w-5 h-5" style={{ color: iconColor }} strokeWidth={2} />
      </div>
      <div>
        <h2 className="text-[20px] font-bold text-[#0F1117] dark:text-white">{title}</h2>
        <p className="text-[13px] text-[#8B92A9] mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const st = STATUS_STYLE[status] || { bg: "#F1F5F9", fg: "#475569", label: status };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: st.bg, color: st.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.fg }} />
      {st.label}
    </span>
  );
}

function ActiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#059669]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
      Active
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PlanCard
// ─────────────────────────────────────────────────────────────────────────────

function PlanCard({ plan, billing, selected, onUpgrade }) {
  const [hovered, setHovered] = useState(false);
  const price   = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const isSel   = selected === plan.id;
  const enabled = plan.features.filter((f) =>  f.enabled && !HIDDEN_FEATURE_KEYS.has(f.key));
  const locked  = plan.features.filter((f) => !f.enabled && !HIDDEN_FEATURE_KEYS.has(f.key));

  /* Limit chips */
  const limitChips = plan.custom
    ? [
        [Zap,    "Custom Admins"],
        [Users,  "Custom Users"],
        [ClipboardList, "Custom Leads"],
        [TrendingUp,    "Custom Meta"],
        [Globe,         "Custom Google"],
        [Monitor,       "Custom Websites"],
        [Sparkles,      "Custom AI"],
      ]
    : [
        [Zap,    `${plan.maxAdmins} Admin${plan.maxAdmins > 1 ? "s" : ""}`],
        [Users,  `${plan.maxUsers} Users`],
        [ClipboardList, `${Number(plan.maxLeads).toLocaleString()} Leads`],
        [TrendingUp,    `${plan.maxMetaCampaigns} Meta`],
        [Globe,         `${plan.maxGoogleAccounts} Google`],
        [Monitor,       `${plan.maxWebsites} Site${plan.maxWebsites > 1 ? "s" : ""}`],
        ...(plan.transcriptionsPerMonth > 0
          ? [[Sparkles, `${Number(plan.transcriptionsPerMonth).toLocaleString()} min AI`]]
          : []),
      ];

  /* CTA label */
  const ctaLabel = () => {
    if (plan.isDowngrade) return `Downgrade to ${plan.name}`;
    if (plan.current)     return isSel ? `Proceed to Pay ₹${price.toLocaleString()}` : `Renew ${plan.name}`;
    if (plan.id === "basic")   return "Start with Basic";
    if (plan.id === "pro")     return isSel ? `Proceed to Pay ₹${price.toLocaleString()}` : "Upgrade to Pro";
    if (plan.id === "advance") return isSel ? `Proceed to Pay ₹${price.toLocaleString()}` : "Go Advanced";
    return `Upgrade to ${plan.name}`;
  };

  const ctaFilled = plan.popular && !plan.current && !plan.isDowngrade;
  const ctaBg = ctaFilled ? plan.color : isSel ? plan.color : hovered ? plan.color + "25" : plan.color + "15";
  const ctaFg = ctaFilled || isSel ? "#fff" : plan.color;

  const cardBorder = plan.popular ? "#2563EB" : plan.id === "basic" ? "#E4E7EF" : plan.color;
  const cardShadow = hovered
    ? `0 20px 48px ${plan.color}28`
    : plan.popular ? "0 8px 32px rgba(37,99,235,0.14)" : "none";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col bg-white dark:bg-[#11131C] rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        border:    `2px solid ${cardBorder}`,
        boxShadow: cardShadow,
        transform: hovered ? "translateY(-3px)" : "none",
      }}
    >
      {/* Top accent bar */}
      <div className="h-1.5 w-full" style={{ background: plan.color }} />

      {/* Badges */}
      {plan.popular && !plan.current && (
        <div className="absolute top-4 right-4 z-10">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#2563EB] text-white text-[10px] font-bold tracking-wide">
            <Star className="w-3 h-3 fill-current" strokeWidth={0} />
            MOST POPULAR
          </span>
        </div>
      )}
      {plan.current && !plan.popular && (
        <div className="absolute top-4 right-4 z-10">
          <span className="px-2.5 py-1 rounded-full bg-[#EEF3FF] dark:bg-[#1A2040] text-[#2563EB] text-[10px] font-bold">
            Current plan
          </span>
        </div>
      )}
      {plan.isDowngrade && !plan.current && (
        <div className="absolute top-4 right-4 z-10">
          <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 text-[10px] font-bold">
            Downgrade
          </span>
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <h3 className="text-[18px] font-bold text-[#0F1117] dark:text-white mt-3">{plan.name}</h3>
        <p className="text-[12px] text-[#8B92A9] mt-0.5 mb-4">{plan.desc}</p>

        {/* Price */}
        {plan.custom ? (
          <div className="mb-5">
            <span className="text-[30px] font-bold text-[#0F1117] dark:text-white leading-none">Custom</span>
            <p className="text-[11px] text-[#8B92A9] mt-1">Pricing tailored for you</p>
          </div>
        ) : (
          <div className="mb-5">
            <div className="flex items-end gap-1">
              <span className="text-[30px] font-bold text-[#0F1117] dark:text-white leading-none">
                ₹{price.toLocaleString()}
              </span>
              <span className="text-[12px] text-[#8B92A9] mb-0.5">/mo</span>
            </div>
            {billing === "yearly" && (
              <p className="text-[11px] text-[#8B92A9] mt-0.5">
                Billed ₹{(price * 12).toLocaleString()}/yr
              </p>
            )}
          </div>
        )}

        {/* Limit chips */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {limitChips.map(([Icon, label]) => (
            <Chip key={label} color={plan.color}>
              <Icon className="w-3 h-3" strokeWidth={2} />
              {label}
            </Chip>
          ))}
        </div>

        <div className="h-px bg-[#F0F2FA] dark:bg-[#1E2133] mb-4" />

        {/* Feature list */}
        <div className="space-y-2">
          {enabled.map((f) => {
            const lim = featureLimitText(f.key, plan);
            return (
              <div key={f.key} className="flex items-center gap-2">
                <CheckMark color={plan.color} />
                <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] flex-1">{f.label}</span>
                {lim && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                    style={{ background: plan.color + "15", color: plan.color }}
                  >
                    {lim}
                  </span>
                )}
              </div>
            );
          })}
          {locked.slice(0, 3).map((f) => (
            <div key={f.key} className="flex items-center gap-2 opacity-40">
              <LockMark />
              <span className="text-[12px] text-[#8B92A9] line-through">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Spacer pushes CTA to bottom */}
      <div className="flex-1" />

      {/* CTA */}
      <div className="px-6 pb-6 pt-2">
        {plan.custom ? (
          <a
            href="mailto:contact@skyupdigitalsolutions.com?subject=Enterprise%20Plan%20Enquiry"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all duration-150"
            style={{ background: hovered ? plan.color : plan.color + "15", color: hovered ? "#fff" : plan.color }}
          >
            <Mail className="w-4 h-4" strokeWidth={2} />
            Contact Sales
          </a>
        ) : (
          <button
            onClick={() => onUpgrade(plan)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all duration-150"
            style={{ background: ctaBg, color: ctaFg }}
          >
            {ctaLabel()}
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile CRM Section
// ─────────────────────────────────────────────────────────────────────────────

const MOBILE_SECTIONS = [
  { icon: BarChart3,    title: "Dashboard",        items: ["Business Dashboard", "Performance Overview"] },
  { icon: ClipboardList,title: "Lead Management",  items: ["View Leads", "Search Leads", "Lead Details", "Lead Timeline", "Update Lead Status"] },
  { icon: Phone,        title: "Calling",           items: ["Click To Call", "Call Logs", "Call Notes", "Call History"] },
  { icon: Bell,         title: "Meetings",          items: ["Meeting Management", "Meeting History", "Follow-Up Scheduling"] },
  { icon: Bell,         title: "Follow-Ups",        items: ["Upcoming Follow-Ups", "Overdue Follow-Ups", "Reminder Alerts"] },
  { icon: UserCheck,    title: "Attendance",        items: ["Check-In", "Check-Out", "Attendance Tracking"] },
  { icon: Bell,         title: "Notifications",     items: ["Lead Alerts", "Follow-Up Alerts", "Meeting Alerts"] },
  { icon: Mic,          title: "Recordings",        items: ["Call Recordings", "Recording Access"] },
  { icon: RefreshCw,    title: "Real-Time Sync",    items: ["Auto Synchronization", "Real-Time Updates"] },
];

function MobileCRMSection() {
  return (
    <section className="mt-16">
      <SectionHeader
        icon={Smartphone}
        iconBg="bg-[#EEF3FF] dark:bg-[#1A2040]"
        iconColor="#2563EB"
        title="Mobile CRM Application"
        subtitle="Manage leads, calls, meetings, attendance and follow-ups from anywhere."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOBILE_SECTIONS.map(({ icon: Icon, title, items }) => (
          <div
            key={title}
            className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-5 hover:border-[#2563EB] dark:hover:border-[#2563EB] transition-colors duration-150"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2040] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[#2563EB]" strokeWidth={2} />
              </div>
              <h3 className="text-[13px] font-bold text-[#0F1117] dark:text-white">{title}</h3>
            </div>
            <div className="space-y-1.5">
              {items.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0" />
                  <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Web CRM Section
// ─────────────────────────────────────────────────────────────────────────────

const WEB_SECTIONS = [
  { icon: ClipboardList, title: "Lead Management", items: ["Lead Creation", "Lead Assignment", "Lead Timeline", "Lead Status Management", "Lead Search & Filters"] },
  { icon: BarChart3,     title: "Dashboard",       items: ["Business Analytics", "Team Performance", "Lead Insights"] },
  { icon: Users,         title: "Contacts",         items: ["Contact Management"] },
  { icon: Globe,         title: "Projects",         items: ["Project Management"] },
  { icon: UserCheck,     title: "Attendance",       items: ["Attendance Management", "Attendance Reports"] },
  { icon: BarChart3,     title: "Reports",          items: ["Daily Reports", "Performance Reports", "Activity Reports"] },
  { icon: Bell,          title: "Notifications",    items: ["CRM Notifications"] },
];

function WebCRMSection() {
  return (
    <section className="mt-14">
      <SectionHeader
        icon={Monitor}
        iconBg="bg-[#F5F3FF] dark:bg-[#1E1040]"
        iconColor="#7C3AED"
        title="Web CRM Features"
        subtitle="Full-featured CRM accessible from any browser."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {WEB_SECTIONS.map(({ icon: Icon, title, items }) => (
          <div
            key={title}
            className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-5 hover:border-[#7C3AED] dark:hover:border-[#7C3AED] transition-colors duration-150"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] dark:bg-[#1E1040] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[#7C3AED]" strokeWidth={2} />
              </div>
              <h3 className="text-[13px] font-bold text-[#0F1117] dark:text-white">{title}</h3>
            </div>
            <div className="space-y-1.5">
              {items.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] shrink-0" />
                  <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison Table
// ─────────────────────────────────────────────────────────────────────────────

const PLANS_LIST = ["basic", "pro", "advance", "enterprise"];

function ComparisonTable({ rows }) {
  const renderCell = (val, planId) => {
    if (val === true)
      return (
        <span className="flex justify-center">
          <CheckCircle2 className="w-4 h-4 text-[#059669]" strokeWidth={2} />
        </span>
      );
    if (val === false)
      return (
        <span className="flex justify-center">
          <XCircle className="w-4 h-4 text-[#DC2626]" strokeWidth={2} />
        </span>
      );
    return (
      <span
        className="inline-block text-[12px] font-semibold px-2 py-0.5 rounded-lg"
        style={{ background: PLAN_COLORS[planId] + "15", color: PLAN_COLORS[planId] }}
      >
        {val}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E4E7EF] dark:border-[#1E2133] mt-6">
      <table className="w-full text-[13px] bg-white dark:bg-[#11131C]">
        <thead>
          <tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F17]">
            <th className="text-left px-6 py-3 text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide w-[36%]">
              Feature
            </th>
            {PLANS_LIST.map((p) => (
              <th
                key={p}
                className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wide"
                style={{ color: PLAN_COLORS[p] }}
              >
                {PLAN_NAMES[p]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className={`border-b border-[#F0F2FA] dark:border-[#1F2333] last:border-0 ${
                i % 2 !== 0 ? "bg-[#FAFBFF] dark:bg-[#0F111A]" : "dark:bg-[#11131C]"
              }`}
            >
              <td className="px-6 py-3.5 font-medium text-[#4B5168] dark:text-[#9DA3BB]">
                <div className="flex items-center gap-2">
                  {row.label}
                  {row.tooltip && (
                    <span className="group relative inline-block">
                      <Info className="w-3.5 h-3.5 text-[#C4C9D9] cursor-help" strokeWidth={2} />
                      <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-60 text-[11px] bg-[#0F1117] text-white rounded-lg px-3 py-2 z-20 shadow-xl leading-relaxed pointer-events-none">
                        {row.tooltip}
                      </span>
                    </span>
                  )}
                </div>
              </td>
              {PLANS_LIST.map((p) => (
                <td key={p} className="px-4 py-3.5 text-center">
                  {renderCell(row[p], p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Comparison data
const COMM_ROWS = [
  { label: "Email Blast",            basic: false, pro: true,  advance: true, enterprise: true },
  { label: "WhatsApp Blast",         basic: false, pro: true,  advance: true, enterprise: true },
  { label: "SMS Blast",              basic: false, pro: true,  advance: true, enterprise: true },
  { label: "Telegram Notifications", basic: false, pro: true,  advance: true, enterprise: true },
];
const AI_ROWS = [
  {
    label: "AI Remark Summary",
    tooltip: "Automatically generates summaries from employee remarks, call conversations and lead interactions.",
    basic: true, pro: true, advance: true, enterprise: true,
  },
  { label: "AI Call Summary",    basic: false, pro: true, advance: true,        enterprise: true     },
  { label: "Call Transcription", basic: false, pro: "6,000 min", advance: "15,000 min", enterprise: "Custom" },
];
const MKT_ROWS = [
  { label: "Meta Campaigns",      basic: "1",    pro: "3",   advance: "5",    enterprise: "Custom" },
  { label: "Google Ads Accounts", basic: "1",    pro: "3",   advance: "5",    enterprise: "Custom" },
  { label: "Websites Tracked",    basic: "1",    pro: "3",   advance: "5",    enterprise: "Custom" },
  { label: "Campaign Management", basic: false,  pro: true,  advance: true,   enterprise: true },
  { label: "Website Tracking",    basic: false,  pro: true,  advance: true,   enterprise: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Enterprise CTA Section
// ─────────────────────────────────────────────────────────────────────────────

const ENTERPRISE_FEATURES = [
  "Custom User Limits",        "Custom Lead Limits",
  "Custom Campaign Limits",    "Custom Website Limits",
  "Custom AI Usage Limits",    "Dedicated Onboarding",
  "Priority Support",          "Multi-Team Management",
  "Custom CRM Configuration",
];

function EnterpriseCTASection() {
  return (
<section className="mt-14">
  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0037ca]/60 via-[#0037ca]/80 to-[#0037ca]/100 p-8 md:p-12">
    {/* Dot grid texture */}
    <div
      className="absolute inset-0 opacity-10"
      style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }}
    />
    <div className="relative z-10 flex flex-col lg:flex-row items-start gap-8">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-blue-200" strokeWidth={2} />
          <span className="text-blue-200 text-[12px] font-bold tracking-widest uppercase">
            Enterprise Solutions
          </span>
        </div>
        <h2 className="text-[24px] md:text-[28px] font-bold text-white mb-2 leading-tight">
          Need higher limits or a custom CRM configuration?
        </h2>
        <p className="text-blue-100 text-[14px] mb-6 max-w-lg">
          Our Enterprise plan is built around your business. Get unlimited scale,
          dedicated support, and a CRM set up exactly the way you need it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ENTERPRISE_FEATURES.map((feat) => (
            <div key={feat} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-300 shrink-0" strokeWidth={2} />
              <span className="text-white text-[13px]">{feat}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="w-full lg:w-auto flex-shrink-0 flex flex-col items-start lg:items-center gap-3 lg:pt-10">
      <a  
          href="mailto:contact@skyupdigitalsolutions.com?subject=Enterprise%20Plan%20Enquiry"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-[#0037ca] font-bold text-[14px] hover:bg-blue-50 transition-colors shadow-lg"
        >
          <Mail className="w-4 h-4" strokeWidth={2} />
          Contact Us
        </a>
        <a
          href="mailto:contact@skyupdigitalsolutions.com"
          className="inline-flex items-center gap-1.5 text-blue-200 text-[11px] hover:text-white transition-colors"
        >
          <Mail className="w-3 h-3" strokeWidth={2} />
          contact@skyupdigitalsolutions.com
        </a>
        <a
          href="tel:8867867775"
          className="inline-flex items-center gap-1.5 text-blue-200 text-[11px] hover:text-white transition-colors"
        >
          <Phone className="w-3 h-3" strokeWidth={2} />
          8867867775
        </a>
      </div>
    </div>
  </div>
</section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage meter (My Features tab)
// ─────────────────────────────────────────────────────────────────────────────

const USAGE_METRICS = [
  { k: "transcriptions", label: "Transcriptions", icon: Mic },
  { k: "summaries",      label: "AI Summaries",   icon: Sparkles },
  { k: "voiceBot",       label: "Voice Bot",       icon: Zap },
];

function UsageMeter({ usage }) {
  if (!usage?.limits) return null;
  return (
    <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133]">
        <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Usage this month</h2>
        <p className="text-[12px] text-[#8B92A9] mt-1">AI quota consumed against your plan limits.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#E4E7EF] dark:bg-[#1F2333]">
        {USAGE_METRICS.map(({ k, label, icon: Icon }) => {
          const lim       = usage.limits[k];
          const used      = usage.used?.[k] ?? 0;
          const unlimited = lim == null || lim < 0 || lim >= 9999;
          const pct       = unlimited || !lim ? 0 : Math.min(100, Math.round((used / lim) * 100));
          const barColor  = pct >= 90 ? "#DC2626" : pct >= 70 ? "#D97706" : "#059669";

          return (
            <div key={k} className="bg-white dark:bg-[#11131C] px-6 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-[#8B92A9]" strokeWidth={2} />
                <p className="text-[12px] text-[#8B92A9]">{label}</p>
              </div>
              <p className="text-[18px] font-bold text-[#0F1117] dark:text-white">
                {used}
                <span className="text-[13px] font-medium text-[#8B92A9]">
                  {" "}/ {unlimited ? "Unlimited" : lim}
                </span>
              </p>
              {!unlimited && (
                <div className="mt-2 h-1.5 rounded-full bg-[#EEF1F6] dark:bg-[#1F2333] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function UpgradePlan({
  onPlanChange,
  currentAdmins = [],
  currentUsers  = [],
  onDowngrade   = null,
}) {
  const [billing,          setBilling]          = useState("monthly");
  const [selected,         setSelected]         = useState(null);
  const [tab,              setTab]              = useState("plans");
  const [paying,           setPaying]           = useState(false);
  const [currentPlanId,    setCurrentPlanId]    = useState(null);
  const [planDefs,         setPlanDefs]         = useState(PLAN_DEFAULTS);
  const [myFeatures,       setMyFeatures]       = useState(null);
  const [planSummary,      setPlanSummary]      = useState(null);
  const [myAddons,         setMyAddons]         = useState([]);
  const [usage,            setUsage]            = useState(null);
  const [invoices,         setInvoices]         = useState([]);
  const [subscription,     setSubscription]     = useState(null);
  const [loadingInvoices,  setLoadingInvoices]  = useState(false);
  const [error,            setError]            = useState(null);
  const [viewingInvoice,   setViewingInvoice]   = useState(null);
  const [showUpdatePayment,setShowUpdatePayment]= useState(false);
  const [downgradePlan,    setDowngradePlan]    = useState(null);
  const [showDowngrade,    setShowDowngrade]    = useState(false);

  const { openCheckout } = useRazorpay();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const loadPlanConfig = useCallback(async () => {
    try {
      const { data } = await api.get("/subscription/plans");
      const plansMap  = data?.plans;
      if (!plansMap || typeof plansMap !== "object" || Array.isArray(plansMap)) return;

      const flat = {};
      for (const [id, p] of Object.entries(plansMap)) {
        if (!p || typeof p !== "object") continue;
        flat[id] = {
          name:                   p.name,
          monthlyPrice:           p.price?.monthly,
          yearlyPrice:            p.price?.yearly,
          maxUsers:               p.maxUsers,
          maxAdmins:              p.maxAdmins,
          maxLeads:               p.maxLeads,
          maxWebsites:            p.maxWebsites,
          maxMetaCampaigns:       p.maxMetaCampaigns,
          maxGoogleAccounts:      p.maxGoogleAccounts,
          maxStorageMB:           p.maxStorageMB,
          transcriptionsPerMonth: p.transcriptionsPerMonth,
          summariesPerMonth:      p.summariesPerMonth,
          voiceBotPerMonth:       p.voiceBotPerMonth,
          dataRetentionDays:      p.dataRetentionDays,
          features: Array.isArray(p.features)
            ? p.features.filter((f) => f && f.enabled).map((f) => f.key)
            : undefined,
        };
      }
      setPlanDefs(mergeConfigIntoDefaults(PLAN_DEFAULTS, flat));
    } catch {}
  }, []);

  useEffect(() => {
    loadPlanConfig();
    window.addEventListener("plan_updated", loadPlanConfig);
    return () => window.removeEventListener("plan_updated", loadPlanConfig);
  }, [loadPlanConfig]);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role === "user") return;
    api.get("/subscription/my/status").then(({ data }) => {
      if (data?.resolvedFeatures?.features) setMyFeatures(data.resolvedFeatures.features);
      if (data?.plan) setCurrentPlanId(data.plan.toLowerCase());
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role === "user") return;
    api.get("/subscription/my/entitlements").then(({ data }) => {
      if (data?.plan)              setPlanSummary(data.plan);
      if (Array.isArray(data?.addons)) setMyAddons(data.addons);
      if (data?.remaining)         setUsage(data.remaining);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchSubscription(); }, []);
  useEffect(() => { if (tab === "invoices" && invoices.length === 0) fetchInvoices(); }, [tab]);

  async function fetchSubscription() {
    try {
      const { data: sd } = await api.get("/subscription/my/status");
      if (sd?.plan) setCurrentPlanId(sd.plan.toLowerCase());
      try {
        const { data } = await api.get("/razorpay/subscription");
        setSubscription(data);
        if (!sd?.plan) {
          const m = { Basic: "basic", Pro: "pro", Enterprise: "enterprise" };
          setCurrentPlanId(m[data.planName] || "basic");
        }
      } catch {}
    } catch {
      try {
        const { data } = await api.get("/razorpay/subscription");
        setSubscription(data);
        const m = { Basic: "basic", Pro: "pro", Enterprise: "enterprise" };
        setCurrentPlanId(m[data.planName] || "basic");
      } catch { setCurrentPlanId("basic"); }
    }
  }

  async function fetchInvoices() {
    setLoadingInvoices(true);
    try {
      const { data } = await api.get("/razorpay/invoices");
      setInvoices(data);
    } catch {
      setError("Failed to load invoices.");
    } finally {
      setLoadingInvoices(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const plans = Object.values(planDefs).map((p) => ({
    ...p,
    current:     p.id === currentPlanId,
    isDowngrade: isDowngradeTo(p.id, currentPlanId),
    features:    ((p.id === currentPlanId && myFeatures) ? myFeatures : p.features)
                   .filter((f) => !HIDDEN_FEATURE_KEYS.has(f.key)),
  }));

  const currentPlan = plans.find((p) => p.current);
  const savingsPct  = Math.round(
    ((plans[1]?.monthlyPrice - plans[1]?.yearlyPrice) / (plans[1]?.monthlyPrice || 6999)) * 100
  ) || 20;

  const CUSTOMER = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return {
        name:    u.companyName || u.name  || "—",
        email:   u.email  || "—",
        address: u.address || "—",
        gstin:   u.gstin  || "",
      };
    } catch {
      return { name: "—", email: "—", address: "—", gstin: "" };
    }
  })();

  const downgradeLimits = downgradePlan
    ? (PLAN_LIMITS[downgradePlan.id] || { admins: 1, users: 5 })
    : { admins: 1, users: 5 };

  // ── Payment handlers ───────────────────────────────────────────────────────

  function handleUpgrade(plan) {
    if (plan.isDowngrade) { setDowngradePlan(plan); setShowDowngrade(true); return; }
    if (selected !== plan.id) { setSelected(plan.id); return; }
    initiatePayment(plan, false, [], []);
  }

  async function handleDowngradeConfirmed(adminsToRemove, usersToRemove) {
    if (!downgradePlan) return;
    const snap = downgradePlan;
    setShowDowngrade(false);
    await initiatePayment(snap, true, adminsToRemove, usersToRemove);
    setDowngradePlan(null);
  }

  async function initiatePayment(plan, isDg = false, adminsR = [], usersR = []) {
    setPaying(true);
    setError(null);
    try {
      const { data: orderData } = await api.post("/razorpay/create-order", {
        planId:        BACKEND_PLAN_ID[plan.id] || plan.id,
        billing,
        removedAdmins: adminsR.map((a) => a._id || a.id),
        removedUsers:  usersR.map((u)  => u._id || u.id),
      });
      openCheckout({
        orderData, plan, billing,
        onSuccess: (r) => handlePaymentSuccess(plan, r, isDg, adminsR, usersR),
        onFailure: (msg) => { setPaying(false); if (msg) setError(msg); setSelected(null); },
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Could not initiate payment.");
    } finally {
      setPaying(false);
    }
  }

  async function handlePaymentSuccess(plan, rp, isDg = false, adminsR = [], usersR = []) {
    setError(null);
    try {
      const { data } = await api.post("/razorpay/verify-payment", {
        razorpay_order_id:   rp.razorpay_order_id,
        razorpay_payment_id: rp.razorpay_payment_id,
        razorpay_signature:  rp.razorpay_signature,
        planId:              BACKEND_PLAN_ID[plan.id] || plan.id,
        billing,
      });

      if (isDg) {
        if (adminsR.length) await Promise.all(adminsR.map((a) => api.delete(`/admin/${a._id || a.id}`).catch(() => {})));
        if (usersR.length)  await Promise.all(usersR.map((u)  => api.delete(`/admin/company/users/${u._id || u.id}`).catch(() => {})));
        if (onDowngrade) onDowngrade(adminsR, usersR);
      }

      setInvoices((prev) => [{
        id:            data.invoiceId,
        date:          new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        amount:        `₹${data.amount.toLocaleString("en-IN")}`,
        baseAmount:    data.amount,
        status:        "Paid",
        planName:      data.planName,
        billingCycle:  data.billing,
        transactionId: data.transactionId,
      }, ...prev]);

      setCurrentPlanId(plan.id);
      setSelected(null);
      fetchSubscription();
      if (onPlanChange) onPlanChange(plan.id);
      sendInvoiceEmail({
        invoiceId:     data.invoiceId,
        planName:      data.planName,
        amount:        `₹${data.amount}`,
        billingCycle:  data.billing,
        transactionId: data.transactionId,
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Payment received but upgrade failed. Contact support.");
    }
  }

  // ── Tabs config ────────────────────────────────────────────────────────────

  const TABS = [
    { k: "plans",    l: "Upgrade Plan",  icon: Award },
    { k: "addons",   l: "Add-ons",       icon: Zap },
    { k: "features", l: "My Features",   icon: Shield },
    { k: "invoices", l: "Invoices",      icon: FileText },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0B0D14] min-h-screen font-poppins px-4 sm:px-6 lg:px-8 py-8">

      {/* Checkout overlay */}
      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#11131C] rounded-2xl px-10 py-8 flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="animate-spin w-10 h-10 text-[#2563EB]" />
            <p className="text-[14px] font-semibold text-[#0F1117] dark:text-white">Preparing checkout…</p>
          </div>
        </div>
      )}

      {/* Modals */}
      {showDowngrade && downgradePlan && (
        <DowngradeWarningModal
          targetPlan={downgradePlan}
          currentAdmins={currentAdmins}
          currentUsers={currentUsers}
          targetAdminLimit={downgradeLimits.admins}
          targetUserLimit={downgradeLimits.users}
          onConfirm={handleDowngradeConfirmed}
          onCancel={() => { setShowDowngrade(false); setDowngradePlan(null); }}
        />
      )}
      {viewingInvoice && (
        <InvoiceReceipt
          invoice={{ ...viewingInvoice, invoiceId: viewingInvoice.id, customer: CUSTOMER }}
          onClose={() => setViewingInvoice(null)}
        />
      )}
      {showUpdatePayment && (
        <UpdatePaymentModal
          currentMethod={subscription?.paymentMethod}
          onSave={(m) => { setSubscription((p) => ({ ...p, paymentMethod: m })); setShowUpdatePayment(false); }}
          onClose={() => setShowUpdatePayment(false)}
        />
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-5 flex items-center justify-between px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-[12px] font-semibold">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-[16px] leading-none">×</button>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="mb-8">
        <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Billing & Plans</h1>
        <p className="text-[13px] text-[#8B92A9] mt-0.5">
          {currentPlan ? (
            <>
              You are on the{" "}
              <span className="font-semibold" style={{ color: currentPlan.color }}>
                {currentPlan.name} plan
              </span>
              {subscription?.renewsOn ? ` · Renews ${subscription.renewsOn}` : ""}
            </>
          ) : (
            "Choose the plan that fits your team."
          )}
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-1 mb-8 w-fit overflow-x-auto">
        {TABS.map(({ k, l, icon: Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition whitespace-nowrap ${
              tab === k
                ? "bg-[#2563EB] text-white"
                : "text-[#4B5168] dark:text-[#7B829E] hover:bg-[#F1F4FF] dark:hover:bg-[#181B27]"
            }`}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
            {l}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PLANS TAB                                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "plans" && (
        <div>
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <button
              onClick={() => setBilling("monthly")}
              className={`text-[13px] font-semibold transition ${
                billing === "monthly" ? "text-[#0F1117] dark:text-[#DDE1F5]" : "text-[#8B92A9]"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling((b) => (b === "monthly" ? "yearly" : "monthly"))}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                billing === "yearly" ? "bg-[#2563EB]" : "bg-[#E4E7EF] dark:bg-[#2A2D3E]"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  billing === "yearly" ? "left-7" : "left-1"
                }`}
              />
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`text-[13px] font-semibold transition ${
                billing === "yearly" ? "text-[#0F1117] dark:text-[#DDE1F5]" : "text-[#8B92A9]"
              }`}
            >
              Yearly{" "}
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] text-[#059669] text-[10px] font-bold">
                Save {savingsPct}%
              </span>
            </button>
          </div>

          {/* 4-column pricing grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billing={billing}
                selected={selected}
                onUpgrade={handleUpgrade}
              />
            ))}
          </div>

          {/* Feature sections */}
          <MobileCRMSection />
          <WebCRMSection />

          <section className="mt-14">
            <SectionHeader
              icon={MessageSquare}
              iconBg="bg-[#ECFDF5] dark:bg-[#052E1C]"
              iconColor="#059669"
              title="Communication Features"
              subtitle="Reach your leads across every channel."
            />
            <ComparisonTable rows={COMM_ROWS} />
          </section>

          <section className="mt-14">
            <SectionHeader
              icon={Sparkles}
              iconBg="bg-[#FFF7ED] dark:bg-[#2D1F00]"
              iconColor="#D97706"
              title="AI Features"
              subtitle="Intelligent automation to save time and surface insights."
            />
            <ComparisonTable rows={AI_ROWS} />
          </section>

          <section className="mt-14">
            <SectionHeader
              icon={TrendingUp}
              iconBg="bg-[#FEF3C7] dark:bg-[#2D1F00]"
              iconColor="#D97706"
              title="Marketing & Campaign Features"
              subtitle="Connect your ad accounts and track performance end-to-end."
            />
            <ComparisonTable rows={MKT_ROWS} />
          </section>

          <EnterpriseCTASection />
          <div className="h-10" />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ADD-ONS TAB                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "addons" && <AddonStore />}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MY FEATURES TAB                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "features" && (
        <div className="space-y-5">

          {/* Plan summary card */}
          <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[12px] text-[#8B92A9] mb-1">Your current plan</p>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[22px] font-bold text-[#0F1117] dark:text-white capitalize">
                    {planSummary?.key || currentPlanId || "—"}
                  </h2>
                  {planSummary?.status && <StatusBadge status={planSummary.status} />}
                </div>
              </div>
              <div className="sm:text-right">
                <p className="text-[12px] text-[#8B92A9] mb-1">
                  {planSummary?.status === "trial" ? "Trial ends" : "Renews / expires"}
                </p>
                <p className="text-[15px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">
                  {fmtDateLong(planSummary?.expiresAt)}
                </p>
                {planSummary?.daysRemaining != null && planSummary.daysRemaining >= 0 && (
                  <p className={`text-[11px] mt-0.5 ${planSummary.expiringSoon ? "text-[#D97706] font-semibold" : "text-[#8B92A9]"}`}>
                    {planSummary.daysRemaining} day{planSummary.daysRemaining === 1 ? "" : "s"} remaining
                    {planSummary.expiringSoon ? " · renew soon" : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Active add-ons */}
          <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133]">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Active add-ons</h2>
              <p className="text-[12px] text-[#8B92A9] mt-1">Extras currently enabled on top of your plan.</p>
            </div>
            {myAddons.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-[13px] text-[#8B92A9]">
                  No active add-ons. Visit the{" "}
                  <button onClick={() => setTab("addons")} className="text-blue-600 font-semibold hover:underline">
                    Add-ons
                  </button>{" "}
                  tab to add more capacity or features.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E4E7EF] dark:divide-[#1F2333]">
                {myAddons.map((a, i) => (
                  <div key={a.addonType + i} className="flex items-center justify-between px-6 py-3.5">
                    <div>
                      <span className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">
                        {addonLabel(a.addonType)}{a.quantity > 1 ? ` × ${a.quantity}` : ""}
                      </span>
                      <p className="text-[11px] text-[#8B92A9] mt-0.5">
                        Since {fmtDateLong(a.startDate)}
                        {a.expiryDate ? ` · expires ${fmtDateLong(a.expiryDate)}` : " · no expiry"}
                      </p>
                    </div>
                    <ActiveBadge />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Usage meters */}
          <UsageMeter usage={usage} />

          {/* Features list */}
          <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133]">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Features on your plan</h2>
              <p className="text-[12px] text-[#8B92A9] mt-1">Features enabled for your company by your service provider.</p>
            </div>
            {!myFeatures ? (
              <Spinner />
            ) : (
              <div className="divide-y divide-[#E4E7EF] dark:divide-[#1F2333]">
                {myFeatures.filter((f) => !HIDDEN_FEATURE_KEYS.has(f.key)).map((feat) => (
                  <div key={feat.key} className="flex items-center justify-between px-6 py-3.5">
                    <span className="text-[13px] font-medium text-[#4B5168] dark:text-[#7B829E]">{feat.label}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        feat.enabled ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#FEF2F2] text-[#DC2626]"
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: feat.enabled ? "#059669" : "#DC2626" }}
                      />
                      {feat.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* INVOICES TAB                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "invoices" && (
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
          {loadingInvoices ? (
            <Spinner />
          ) : (
            <>
              <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133]">
                <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Invoice history</h2>
              </div>

              <div className="divide-y divide-[#E4E7EF] dark:divide-[#1F2333]">
                {invoices.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-[13px] text-[#8B92A9]">No invoices yet.</p>
                  </div>
                ) : (
                  invoices.map((inv, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-6 py-4 hover:bg-[#F8F9FC] dark:hover:bg-[#181B27] transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2040] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-[#2563EB]" strokeWidth={2} />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{inv.id}</div>
                          <div className="text-[11px] text-[#8B92A9]">{inv.date}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{inv.amount}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669]">
                          {inv.status}
                        </span>
                        <button
                          onClick={() => setViewingInvoice(inv)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7C3AED] hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" strokeWidth={2} />
                          View
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {subscription && (
                <div className="px-6 py-4 border-t border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-between">
                  <span className="text-[12px] text-[#8B92A9]">Total paid: {subscription.totalPaid}</span>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] text-[#8B92A9]">Payment method</div>
                      <div className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">
                        {subscription.paymentMethod}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowUpdatePayment(true)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] text-[11px] font-semibold text-[#4B5168] hover:border-[#2563EB] hover:text-[#2563EB] transition"
                    >
                      <CreditCard className="w-3.5 h-3.5" strokeWidth={2} />
                      Update card
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
