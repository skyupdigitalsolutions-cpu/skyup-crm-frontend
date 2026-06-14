// src/components/UpgradePlan.jsx
// Plans + features come from the backend (developer-configured).
// Falls back to sensible defaults if API is unavailable.
import { useState, useEffect, useCallback } from "react";
import { Check as CheckIcon, X as XIcon, Lock as LockIcon, Loader2, FileText, Eye } from "lucide-react";
import api from "../data/axiosConfig";
import InvoiceReceipt from "./InvoiceReceipt";
import UpdatePaymentModal from "./UpdatePaymentModal";
import DowngradeWarningModal from "./DowngradeWarningModal";

const PLAN_ORDER = ["basic", "pro", "enterprise"];
// These limits must match UserManagement.jsx's PLAN_CONFIG exactly.
// Super admin is NEVER counted against the admin limit.
const PLAN_LIMITS = {
  basic:      { admins: 1, users: 10  },   // "starter" in backend
  pro:        { admins: 3, users: 30  },   // "growth"  in backend
  enterprise: { admins: 5, users: 50  },
};
// Map frontend plan IDs → backend plan IDs (backend uses starter/growth/enterprise)
const BACKEND_PLAN_ID = {
  basic:      "starter",
  pro:        "growth",
  enterprise: "enterprise",
};

function planRank(id) { return PLAN_ORDER.indexOf(id ?? "basic"); }
function isDowngradeTo(t, c) { return planRank(t) < planRank(c); }

async function sendInvoiceEmail(payload) {
  try { await api.post("/razorpay/notify-invoice", { ...payload, date: new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) }); }
  catch {}
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function Check({ color }) {
  return <CheckIcon className="w-4 h-4 shrink-0" style={{ color: color || "#059669" }} strokeWidth={2.5} />;
}
function Lock() {
  return <LockIcon className="w-3.5 h-3.5 shrink-0 text-[#8B92A9]" strokeWidth={2} />;
}
function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="animate-spin w-7 h-7 text-[#2563EB]" />
    </div>
  );
}

// ── Feature → limit text ──────────────────────────────────────────────────────
// Maps a feature key to the relevant numeric limit on the plan, returning a
// short inline string (e.g. "10,000" or "Unlimited") to show next to the label.
// Returns "" when the feature has no associated limit or the limit is 0/unset.
function featureLimitText(key, plan) {
  // Treat null/undefined/-1/0 as "no explicit cap to show". A very large value
  // or an explicit unlimited sentinel renders as "Unlimited".
  const fmt = (v, suffix = "") => {
    if (v == null) return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    if (n < 0 || n >= 1_000_000) return "Unlimited";
    if (n === 0) return "";
    return `${n.toLocaleString()}${suffix}`;
  };

  // Feature keys arrive in two formats depending on the source:
  //   • planDefs (PLAN_DEFAULTS / developer config) → kebab-case: "leads", "meta-ads"
  //   • myFeatures (resolved entitlements for the current plan) → camelCase: "leadManagement", "metaAds"
  // Normalize so the same limit shows regardless of which list rendered the row.
  switch (key) {
    case "leads":
    case "leadManagement":
      return fmt(plan.maxLeads, " leads");
    case "google-ads":
    case "googleAds":
      return fmt(plan.maxGoogleAccounts, plan.maxGoogleAccounts === 1 ? " account" : " accounts");
    case "meta-ads":
    case "metaAds":
      return fmt(plan.maxMetaCampaigns, plan.maxMetaCampaigns === 1 ? " campaign" : " campaigns");
    case "website-tracking":
    case "websiteTracking":
      return fmt(plan.maxWebsites, plan.maxWebsites === 1 ? " website" : " websites");
    case "call-transcription":
    case "callTranscription":
      return fmt(plan.transcriptionsPerMonth, "/mo");
    case "ai-summary":
    case "aiSummary":
      return fmt(plan.summariesPerMonth, "/mo");
    case "voice-bot":
    case "voiceBot":
      return fmt(plan.voiceBotPerMonth, "/mo");
    default:
      return "";
  }
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, billing, selected, onUpgrade }) {
  const [hovered, setHovered] = useState(false);
  const price   = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const isSel   = selected === plan.id;
  const enabled = plan.features.filter(f => f.enabled);
  const locked  = plan.features.filter(f => !f.enabled);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative bg-white dark:bg-[#11131C] rounded-2xl overflow-hidden border-2 transition-all"
      style={{
        borderColor: plan.popular ? "#2563EB" : plan.color,
        transform:   hovered ? "translateY(-4px)" : "none",
        boxShadow:   plan.popular
          ? hovered ? `0 20px 48px ${plan.color}35` : "0 8px 30px rgba(37,99,235,0.15)"
          : hovered ? `0 16px 40px ${plan.color}28` : "none",
      }}
    >
      <div className="h-1.5 w-full" style={{ background: plan.color }} />

      {plan.isDowngrade && !plan.current && (
        <div className="absolute top-4 right-4">
          <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold">Downgrade</span>
        </div>
      )}
      {plan.popular && !plan.current && !plan.isDowngrade && (
        <div className="absolute top-4 right-4">
          <span className="px-2.5 py-1 rounded-full bg-[#2563EB] text-white text-[10px] font-bold">Most popular</span>
        </div>
      )}
      {plan.current && (
        <div className="absolute top-4 right-4">
          <span className="px-2.5 py-1 rounded-full bg-[#EEF3FF] dark:bg-[#1A2040] text-[#2563EB] text-[10px] font-bold">Current plan</span>
        </div>
      )}

      <div className="p-6">
        <h3 className="text-[16px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">{plan.name}</h3>
        <p className="text-[12px] text-[#8B92A9] mt-1 mb-4">{plan.desc}</p>

        <div className="flex items-end gap-1 mb-1">
          <span className="text-[32px] font-bold text-[#0F1117] dark:text-[#DDE1F5] leading-none">
            ₹{price.toLocaleString()}
          </span>
          <span className="text-[13px] text-[#8B92A9] mb-1">/mo</span>
        </div>
        {billing === "yearly" && (
          <p className="text-[11px] text-[#8B92A9] mb-4">Billed ₹{(price * 12).toLocaleString()}/yr</p>
        )}

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-[11px] px-2 py-1 rounded-lg font-semibold" style={{ background: plan.color + "15", color: plan.color }}>
            {plan.maxUsers} users
          </span>
        </div>

        {/* Enabled features */}
        <div className="space-y-2 mb-5">
          {enabled.map(f => {
            const limit = featureLimitText(f.key, plan);
            return (
              <div key={f.key} className="flex items-center gap-2">
                <Check color={plan.color} />
                <span className="text-[12px] text-[#4B5168] dark:text-[#7B829E]">{f.label}</span>
                {limit && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md ml-auto whitespace-nowrap"
                    style={{ background: plan.color + "15", color: plan.color }}
                  >
                    {limit}
                  </span>
                )}
              </div>
            );
          })}
          {locked.map(f => (
            <div key={f.key} className="flex items-center gap-2 opacity-40">
              <Lock />
              <span className="text-[12px] text-[#8B92A9] line-through">{f.label}</span>
            </div>
          ))}
        </div>

        {plan.current ? (
          // Current plan — show Renew button so admin can extend before expiry
          <button
            onClick={() => onUpgrade(plan)}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{
              background: isSel ? plan.color : hovered ? plan.color + "25" : plan.color + "15",
              color: isSel ? "#fff" : plan.color,
            }}
          >
            {isSel ? `Proceed to Pay ₹${price.toLocaleString()}` : `Renew ${plan.name}`}
          </button>
        ) : (
          <button
            onClick={() => onUpgrade(plan)}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{
              background: isSel ? plan.color : hovered ? plan.color + "25" : plan.color + "15",
              color: isSel ? "#fff" : plan.color,
            }}
          >
            {plan.isDowngrade ? `Downgrade to ${plan.name}` : isSel ? `Proceed to Pay ₹${price.toLocaleString()}` : `Upgrade to ${plan.name}`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Razorpay hook ─────────────────────────────────────────────────────────────
function useRazorpay() {
  const openCheckout = useCallback(async ({ orderData, plan, billing, onSuccess, onFailure }) => {
    const loaded = await new Promise(resolve => {
      if (document.getElementById("razorpay-sdk")) return resolve(true);
      const s = document.createElement("script");
      s.id = "razorpay-sdk";
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
    if (!loaded) { onFailure("Failed to load Razorpay SDK."); return; }
    const rzp = new window.Razorpay({
      key: orderData.keyId, amount: orderData.amount, currency: orderData.currency,
      name: "SkyUp CRM", description: `${orderData.planName} – ${billing}`,
      order_id: orderData.orderId, theme: { color: plan.color },
      handler: res => onSuccess(res),
      modal: { ondismiss: () => onFailure(null) },
    });
    rzp.on("payment.failed", r => onFailure(r.error?.description || "Payment failed."));
    rzp.open();
  }, []);
  return { openCheckout };
}

// ── Feature keys hidden from the UI (still tracked server-side) ───────────────
const HIDDEN_FEATURE_KEYS = new Set([
  "voice-bot", "voiceBot",
  "api-access", "apiAccess",
  "webhook-access", "webhookAccess",
  "custom-reports", "customReports",
  "white-label", "whiteLabel",
  "custom-domain", "customDomain",
  "custom-branding", "customBranding",
]);

// ── Feature label catalogue ───────────────────────────────────────────────────
// Maps a feature key → human label so features enabled in the developer
// Plan Customization page render with a proper name on the upgrade cards.
// Keys/labels mirror FEATURE_GROUPS in PlanCustomization.jsx.
const FEATURE_LABELS = {
  "leads":               "Lead Management",
  "contacts":            "Contacts",
  "basic-reports":       "Basic Reports",
  "attendance":          "Attendance",
  "daily-report":        "Daily Report",
  "sms-blast":           "SMS Blast",
  "whatsapp-blast":      "WhatsApp Blast",
  "email-blast":         "Email Blast",
  "campaigns":           "Campaigns",
  "whatsapp-automation": "WhatsApp Automation",
  "google-ads":          "Google Ads",
  "meta-ads":            "Meta Ads",
  "call-recording":      "Call Recordings",
  "call-transcription":  "Call Transcription",
  "ai-summary":          "AI Summary",
  "projects":            "Projects",
  "tasks":               "Tasks",
  "payroll":             "Payroll",
  "website-tracking":    "Website Tracking",
};

function prettyFeatureLabel(key) {
  return (
    FEATURE_LABELS[key] ||
    String(key)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// Merge the developer-configured plan config (from /developer/plans/config)
// into the UI plan shape. The config keys plans by id and stores `features`
// as a string[] of ENABLED keys; the UI needs a `[{key,label,enabled}]` list.
//   • Price/name/maxUsers are taken from the config when present.
//   • The feature list = union of the plan's existing UI features and any new
//     keys the developer enabled, each marked enabled/disabled from the config.
function mergeConfigIntoDefaults(defaults, config) {
  if (!config || typeof config !== "object") return defaults;
  const merged = {};

  for (const id of PLAN_ORDER) {
    const base = defaults[id] || { id, name: id, features: [] };
    const cfg = config[id];

    if (!cfg || typeof cfg !== "object") {
      merged[id] = base;
      continue;
    }

    const enabledKeys = Array.isArray(cfg.features) ? cfg.features : null;

    let features = base.features;
    if (enabledKeys) {
      const enabledSet = new Set(enabledKeys);
      // Start from the base UI features (preserves order/labels)...
      const seen = new Set();
      features = base.features.map((f) => {
        seen.add(f.key);
        return { ...f, enabled: enabledSet.has(f.key) };
      });
      // ...then append any enabled keys the base list didn't already include.
      for (const key of enabledKeys) {
        if (!seen.has(key)) {
          features.push({ key, label: prettyFeatureLabel(key), enabled: true });
          seen.add(key);
        }
      }
    }

    merged[id] = {
      ...base,
      name:         cfg.name != null ? cfg.name : base.name,
      monthlyPrice: cfg.monthlyPrice != null ? Number(cfg.monthlyPrice) : base.monthlyPrice,
      yearlyPrice:  cfg.yearlyPrice  != null ? Number(cfg.yearlyPrice)  : base.yearlyPrice,
      maxUsers:     cfg.maxUsers     != null ? Number(cfg.maxUsers)     : base.maxUsers,
      // Resource & quota limits (only override when the config provides them).
      maxAdmins:              cfg.maxAdmins              != null ? Number(cfg.maxAdmins)              : base.maxAdmins,
      maxLeads:               cfg.maxLeads               != null ? Number(cfg.maxLeads)               : base.maxLeads,
      maxWebsites:            cfg.maxWebsites            != null ? Number(cfg.maxWebsites)            : base.maxWebsites,
      maxMetaCampaigns:       cfg.maxMetaCampaigns       != null ? Number(cfg.maxMetaCampaigns)       : base.maxMetaCampaigns,
      maxGoogleAccounts:      cfg.maxGoogleAccounts      != null ? Number(cfg.maxGoogleAccounts)      : base.maxGoogleAccounts,
      maxStorageMB:           cfg.maxStorageMB           != null ? Number(cfg.maxStorageMB)           : base.maxStorageMB,
      transcriptionsPerMonth: cfg.transcriptionsPerMonth != null ? Number(cfg.transcriptionsPerMonth) : base.transcriptionsPerMonth,
      summariesPerMonth:      cfg.summariesPerMonth      != null ? Number(cfg.summariesPerMonth)      : base.summariesPerMonth,
      voiceBotPerMonth:       cfg.voiceBotPerMonth       != null ? Number(cfg.voiceBotPerMonth)       : base.voiceBotPerMonth,
      dataRetentionDays:      cfg.dataRetentionDays      != null ? Number(cfg.dataRetentionDays)      : base.dataRetentionDays,
      features,
    };
  }

  return merged;
}

// ── Default plan shapes (shown while API loads) ───────────────────────────────
const PLAN_DEFAULTS = {
  basic: {
    id: "basic", name: "Basic", desc: "For small teams just getting started",
    monthlyPrice: 999, yearlyPrice: 799, color: "#6B7280", popular: false, maxUsers: 5,
    features: [
      { key: "leads",         label: "Lead Management",   enabled: true  },
      { key: "contacts",      label: "Contacts",          enabled: true  },
      { key: "basic-reports", label: "Basic Reports",     enabled: true  },
      { key: "attendance",    label: "Attendance",        enabled: true  },
      { key: "sms-blast",     label: "SMS Blast",         enabled: false },
      { key: "email-blast",   label: "Email Blast",       enabled: false },
      { key: "campaigns",     label: "Campaigns",         enabled: false },
      { key: "google-ads",    label: "Google Ads",        enabled: false },
      { key: "meta-ads",      label: "Meta Ads",          enabled: false },
      { key: "call-recording",label: "Call Recordings",   enabled: false },
    ],
  },
  pro: {
    id: "pro", name: "Pro", desc: "For growing teams that need more power",
    monthlyPrice: 2999, yearlyPrice: 2399, color: "#2563EB", popular: true, maxUsers: 20,
    features: [
      { key: "leads",          label: "Lead Management",  enabled: true  },
      { key: "contacts",       label: "Contacts",         enabled: true  },
      { key: "basic-reports",  label: "Basic Reports",    enabled: true  },
      { key: "attendance",     label: "Attendance",       enabled: true  },
      { key: "sms-blast",      label: "SMS Blast",        enabled: true  },
      { key: "email-blast",    label: "Email Blast",      enabled: true  },
      { key: "campaigns",      label: "Campaigns",        enabled: true  },
      { key: "google-ads",     label: "Google Ads",       enabled: true  },
      { key: "meta-ads",       label: "Meta Ads",         enabled: true  },
      { key: "call-recording", label: "Call Recordings",  enabled: true  },
    ],
  },
  enterprise: {
    id: "enterprise", name: "Enterprise", desc: "Unlimited scale for large organisations",
    monthlyPrice: 9999, yearlyPrice: 7999, color: "#7C3AED", popular: false, maxUsers: 999,
    features: [
      { key: "leads",          label: "Lead Management",  enabled: true },
      { key: "contacts",       label: "Contacts",         enabled: true },
      { key: "basic-reports",  label: "Basic Reports",    enabled: true },
      { key: "attendance",     label: "Attendance",       enabled: true },
      { key: "sms-blast",      label: "SMS Blast",        enabled: true },
      { key: "email-blast",    label: "Email Blast",      enabled: true },
      { key: "campaigns",      label: "Campaigns",        enabled: true },
      { key: "google-ads",     label: "Google Ads",       enabled: true },
      { key: "meta-ads",       label: "Meta Ads",         enabled: true },
      { key: "call-recording", label: "Call Recordings",  enabled: true },
    ],
  },
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UpgradePlan({ onPlanChange, currentAdmins = [], currentUsers = [], onDowngrade = null }) {
  const [billing,      setBilling]      = useState("monthly");
  const [selected,     setSelected]     = useState(null);
  const [tab,          setTab]          = useState("plans");
  const [paying,       setPaying]       = useState(false);
  const [currentPlanId,setCurrentPlanId]= useState(null);
  const [planDefs,     setPlanDefs]     = useState(PLAN_DEFAULTS);
  const [myFeatures,   setMyFeatures]   = useState(null); // resolved features for MY company
  const [invoices,     setInvoices]     = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error,        setError]        = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [showUpdatePayment, setShowUpdatePayment] = useState(false);
  const [downgradePlan, setDowngradePlan] = useState(null);
  const [showDowngrade, setShowDowngrade] = useState(false);
  const { openCheckout } = useRazorpay();

  // ── Load developer-configured plan definitions ───────────────────────────
  // Prices, names, user limits and feature flags are set in the developer
  // Plan Customization page (POST /developer/plans/config). Customers read them
  // from the PUBLIC endpoint GET /subscription/plans — the /developer/* route is
  // locked to the developer role, so company super-admins get a 403 there and
  // would silently fall back to hardcoded defaults. /subscription/plans reads the
  // same PlanConfig collection but is reachable by any caller.
  const loadPlanConfig = useCallback(async () => {
    try {
      const { data } = await api.get("/subscription/plans");
      const plansMap = data?.plans;
      if (plansMap && typeof plansMap === "object" && !Array.isArray(plansMap)) {
        // Normalize the public shape into the flat config mergeConfigIntoDefaults
        // expects: price.{monthly,yearly} -> monthly/yearlyPrice, and
        // features:[{key,label,enabled}] -> string[] of enabled keys.
        const flat = {};
        for (const [id, p] of Object.entries(plansMap)) {
          if (!p || typeof p !== "object") continue;
          flat[id] = {
            name:         p.name,
            monthlyPrice: p.price?.monthly,
            yearlyPrice:  p.price?.yearly,
            maxUsers:     p.maxUsers,
            // Resource & quota limits — carried through so cards can show them
            // inline next to the relevant feature.
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
              ? p.features.filter(f => f && f.enabled).map(f => f.key)
              : undefined,
          };
        }
        setPlanDefs(mergeConfigIntoDefaults(PLAN_DEFAULTS, flat));
      }
    } catch {
      // Endpoint unavailable (API down) — keep defaults.
    }
  }, []);

  useEffect(() => {
    loadPlanConfig();
    // Refresh when the developer saves changes in the same session.
    const onPlanUpdated = () => loadPlanConfig();
    window.addEventListener("plan_updated", onPlanUpdated);
    return () => window.removeEventListener("plan_updated", onPlanUpdated);
  }, [loadPlanConfig]);

  useEffect(() => {
    // Fetch my company's resolved features (plan is set by fetchSubscription)
    const role = localStorage.getItem("role");
    if (role === "user") return; // users don't have subscription access
    api.get("/subscription/my/status")
      .then(({ data }) => {
        if (data?.resolvedFeatures?.features) {
          setMyFeatures(data.resolvedFeatures.features);
        }
        // Also set plan here as early as possible (fetchSubscription may still be loading)
        if (data?.plan) {
          setCurrentPlanId(data.plan.toLowerCase());
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchSubscription(); }, []);
  useEffect(() => { if (tab === "invoices" && invoices.length === 0) fetchInvoices(); }, [tab]);

  async function fetchSubscription() {
    try {
      // Primary source of truth: company's own plan field from DB
      const { data: statusData } = await api.get("/subscription/my/status");
      if (statusData?.plan) {
        setCurrentPlanId(statusData.plan.toLowerCase());
      }
      // Secondary: razorpay subscription for billing/renewal info
      try {
        const { data } = await api.get("/razorpay/subscription");
        setSubscription(data);
        // Only use planName from razorpay if status didn't give us a plan
        if (!statusData?.plan) {
          const nameToId = { Basic: "basic", Pro: "pro", Enterprise: "enterprise" };
          setCurrentPlanId(nameToId[data.planName] || "basic");
        }
      } catch {
        // Razorpay call failed — that's fine, we already have the plan from status
      }
    } catch {
      // Fall back to razorpay only
      try {
        const { data } = await api.get("/razorpay/subscription");
        setSubscription(data);
        const nameToId = { Basic: "basic", Pro: "pro", Enterprise: "enterprise" };
        setCurrentPlanId(nameToId[data.planName] || "basic");
      } catch {
        setCurrentPlanId("basic");
      }
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

  // Build enriched plan list
  const plans = Object.values(planDefs).map(p => ({
    ...p,
    current:     p.id === currentPlanId,
    isDowngrade: isDowngradeTo(p.id, currentPlanId),
    // Use my company's resolved features if available
    features:    ((p.id === currentPlanId && myFeatures) ? myFeatures : p.features)
                   .filter(f => !HIDDEN_FEATURE_KEYS.has(f.key)),
  }));

  const CUSTOMER = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return { name: u.companyName || u.name || "—", email: u.email || "—", address: u.address || "—", gstin: u.gstin || "" };
    } catch { return { name: "—", email: "—", address: "—", gstin: "" }; }
  })();

  function handleUpgrade(plan) {
    // Allow renewing the current plan (plan.current) — same flow as upgrade
    if (plan.isDowngrade) { setDowngradePlan(plan); setShowDowngrade(true); return; }
    if (selected !== plan.id) { setSelected(plan.id); return; }
    initiatePayment(plan, false, [], []);
  }

  // Called when user finishes selecting members and clicks "Proceed to pay".
  // Members are NOT deleted here — deletion only happens AFTER payment succeeds.
  async function handleDowngradeConfirmed(adminsToRemove, usersToRemove) {
    if (!downgradePlan) return;
    const planSnapshot = downgradePlan; // capture before closing modal
    setShowDowngrade(false);            // close selection modal, Razorpay opens next
    // If payment is cancelled/failed, selection is simply discarded — no one is deleted.
    await initiatePayment(planSnapshot, true, adminsToRemove, usersToRemove);
    setDowngradePlan(null);
  }

  async function initiatePayment(plan, isDg = false, adminsR = [], usersR = []) {
    setPaying(true); setError(null);
    try {
      const { data: orderData } = await api.post("/razorpay/create-order", {
        planId: BACKEND_PLAN_ID[plan.id] || plan.id, billing,
        // Send the IDs so the backend can record them, but does NOT delete yet.
        removedAdmins: adminsR.map(a => a._id || a.id),
        removedUsers:  usersR.map(u  => u._id || u.id),
      });
      openCheckout({
        orderData, plan, billing,
        // ✅ Payment succeeded → verify, THEN delete selected members
        onSuccess: r => handlePaymentSuccess(plan, r, isDg, adminsR, usersR),
        // ❌ Payment cancelled/failed → clear selection, delete nothing
        onFailure: msg => {
          setPaying(false);
          if (msg) setError(msg);
          setSelected(null);
          // Selection is discarded — no one was removed
        },
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Could not initiate payment.");
    } finally { setPaying(false); }
  }

  async function handlePaymentSuccess(plan, razorpayResponse, isDg = false, adminsR = [], usersR = []) {
    setError(null);
    try {
      const { data } = await api.post("/razorpay/verify-payment", {
        razorpay_order_id:   razorpayResponse.razorpay_order_id,
        razorpay_payment_id: razorpayResponse.razorpay_payment_id,
        razorpay_signature:  razorpayResponse.razorpay_signature,
        planId: BACKEND_PLAN_ID[plan.id] || plan.id, billing,
      });

      // ✅ Payment verified — NOW safe to remove the selected members
      if (isDg) {
        if (adminsR.length) {
          await Promise.all(
            adminsR.map(a => api.delete(`/admin/${a._id || a.id}`).catch(() => {}))
          );
        }
        if (usersR.length) {
          await Promise.all(
            usersR.map(u => api.delete(`/admin/company/users/${u._id || u.id}`).catch(() => {}))
          );
        }
        if (onDowngrade) onDowngrade(adminsR, usersR);
      }

      setInvoices(prev => [{ id: data.invoiceId, date: new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }), amount: `₹${data.amount.toLocaleString("en-IN")}`, baseAmount: data.amount, status: "Paid", planName: data.planName, billingCycle: data.billing, transactionId: data.transactionId }, ...prev]);
      setCurrentPlanId(plan.id); setSelected(null);
      fetchSubscription();
      if (onPlanChange) onPlanChange(plan.id);
      sendInvoiceEmail({ invoiceId: data.invoiceId, planName: data.planName, amount: `₹${data.amount}`, billingCycle: data.billing, transactionId: data.transactionId });
    } catch (err) {
      setError(err?.response?.data?.message || "Payment received but upgrade failed. Contact support.");
    }
  }

  const currentPlan = plans.find(p => p.current);
  const savingsPct  = Math.round(((plans[1]?.monthlyPrice - plans[1]?.yearlyPrice) / (plans[1]?.monthlyPrice || 2999)) * 100) || 20;
  const downgradeLimits = downgradePlan ? (PLAN_LIMITS[downgradePlan.id] || { admins:1, users:5 }) : { admins:1, users:5 };

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0B0D14] min-h-screen font-poppins px-6 py-8">

      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-10 py-8 flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="animate-spin w-10 h-10 text-[#2563EB]" />
            <p className="text-[14px] font-semibold text-[#0F1117]">Preparing checkout…</p>
          </div>
        </div>
      )}

      {showDowngrade && downgradePlan && (
        <DowngradeWarningModal
          targetPlan={downgradePlan} currentAdmins={currentAdmins} currentUsers={currentUsers}
          targetAdminLimit={downgradeLimits.admins} targetUserLimit={downgradeLimits.users}
          onConfirm={handleDowngradeConfirmed} onCancel={() => { setShowDowngrade(false); setDowngradePlan(null); }}
        />
      )}
      {viewingInvoice && (
        <InvoiceReceipt invoice={{ ...viewingInvoice, invoiceId: viewingInvoice.id, customer: CUSTOMER }} onClose={() => setViewingInvoice(null)} />
      )}
      {showUpdatePayment && (
        <UpdatePaymentModal currentMethod={subscription?.paymentMethod} onSave={m => { setSubscription(p => ({...p, paymentMethod: m})); setShowUpdatePayment(false); }} onClose={() => setShowUpdatePayment(false)} />
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-[12px] font-semibold">
          {error}<button onClick={() => setError(null)} className="ml-4 text-[16px]">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Billing & Plans</h1>
          <p className="text-[13px] text-[#8B92A9] mt-0.5">
            {currentPlan
              ? <><span>You are on the </span><span className="font-semibold" style={{ color: currentPlan.color }}>{currentPlan.name} plan</span><span> · Renews {subscription?.renewsOn ?? "—"}</span></>
              : "Loading subscription…"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-xl p-1 mb-8 w-fit">
        {[{ k:"plans", l:"Upgrade Plan" }, { k:"features", l:"My Features" }, { k:"invoices", l:"Invoices" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition ${tab===t.k ? "bg-[#2563EB] text-white" : "text-[#4B5168] dark:text-[#7B829E] hover:bg-[#F1F4FF] dark:hover:bg-[#181B27]"}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── Plans tab ── */}
      {tab === "plans" && (
        <div>
          <div className="flex items-center justify-center gap-3 mb-8">
            <button onClick={() => setBilling("monthly")} className={`text-[13px] font-semibold ${billing==="monthly" ? "text-[#0F1117] dark:text-[#DDE1F5]" : "text-[#8B92A9]"}`}>Monthly</button>
            <button onClick={() => setBilling(b => b==="monthly" ? "yearly" : "monthly")}
              className={`relative w-12 h-6 rounded-full transition-colors ${billing==="yearly" ? "bg-[#2563EB]" : "bg-[#E4E7EF] dark:bg-[#2A2D3E]"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${billing==="yearly" ? "left-7" : "left-1"}`} />
            </button>
            <button onClick={() => setBilling("yearly")} className={`text-[13px] font-semibold ${billing==="yearly" ? "text-[#0F1117] dark:text-[#DDE1F5]" : "text-[#8B92A9]"}`}>
              Yearly <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] text-[10px] font-bold">Save {savingsPct}%</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {plans.map(plan => (
              <PlanCard key={plan.id} plan={plan} billing={billing} selected={selected} onUpgrade={handleUpgrade} />
            ))}
          </div>

          {/* Feature comparison table */}
          <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133]">
              <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Full feature comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E4E7EF] dark:border-[#1E2133] bg-[#F8F9FC] dark:bg-[#0D0F17]">
                    <th className="text-left px-6 py-3 text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide w-[35%]">Feature</th>
                    {plans.map(p => (
                      <th key={p.id} className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: p.color }}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Build rows from all unique feature keys across plans */}
                  {[...new Map(plans.flatMap(p => p.features).map(f => [f.key, f])).values()].map((feat, i) => (
                    <tr key={feat.key} className={`border-b border-[#E4E7EF] dark:border-[#1F2333] last:border-0 ${i%2!==0 ? "bg-[#FAFBFF] dark:bg-[#0F111A]" : "dark:bg-[#11131C]"}`}>
                      <td className="px-6 py-3 text-[#4B5168] dark:text-[#7B829E] font-medium">{feat.label}</td>
                      {plans.map(p => {
                        const f = p.features.find(x => x.key === feat.key);
                        return (
                          <td key={p.id} className="px-4 py-3 text-center">
                            {f?.enabled
                              ? <span className="flex justify-center"><CheckIcon className="w-4 h-4" style={{ color: "#059669" }} strokeWidth={2.5} /></span>
                              : <span className="flex justify-center"><XIcon className="w-4 h-4" style={{ color: "#DC2626" }} strokeWidth={2.5} /></span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── My Features tab ── */}
      {tab === "features" && (
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133]">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Features on your plan</h2>
            <p className="text-[12px] text-[#8B92A9] mt-1">These are the features enabled for your company by your service provider.</p>
          </div>
          {!myFeatures ? (
            <Spinner />
          ) : (
            <div className="divide-y divide-[#E4E7EF] dark:divide-[#1F2333]">
              {myFeatures.filter(feat => !HIDDEN_FEATURE_KEYS.has(feat.key)).map(feat => (
                <div key={feat.key} className="flex items-center justify-between px-6 py-3.5">
                  <span className="text-[13px] font-medium text-[#4B5168] dark:text-[#7B829E]">{feat.label}</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${feat.enabled ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: feat.enabled ? "#059669" : "#DC2626" }} />
                    {feat.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Invoices tab ── */}
      {tab === "invoices" && (
        <div className="bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl overflow-hidden">
          {loadingInvoices ? <Spinner /> : (
            <>
              <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-between">
                <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#DDE1F5]">Invoice history</h2>
              </div>
              <div className="divide-y divide-[#E4E7EF] dark:divide-[#1F2333]">
                {invoices.length === 0 ? (
                  <div className="px-6 py-12 text-center"><p className="text-[13px] text-[#8B92A9]">No invoices yet.</p></div>
                ) : invoices.map((inv, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-[#F8F9FC] dark:hover:bg-[#181B27] transition">
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
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669]">{inv.status}</span>
                      <button onClick={() => setViewingInvoice(inv)} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7C3AED] hover:underline">
                        <Eye className="w-3.5 h-3.5" strokeWidth={2} />
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {subscription && (
                <div className="px-6 py-4 border-t border-[#E4E7EF] dark:border-[#1E2133] flex items-center justify-between">
                  <span className="text-[12px] text-[#8B92A9]">Total paid: {subscription.totalPaid}</span>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] text-[#8B92A9]">Payment method</div>
                      <div className="text-[12px] font-semibold text-[#0F1117] dark:text-[#DDE1F5]">{subscription.paymentMethod}</div>
                    </div>
                    <button onClick={() => setShowUpdatePayment(true)} className="px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] text-[11px] font-semibold text-[#4B5168] hover:border-[#2563EB] hover:text-[#2563EB] transition">Update card</button>
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
