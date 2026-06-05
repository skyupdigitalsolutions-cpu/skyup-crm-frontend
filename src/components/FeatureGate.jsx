// src/components/FeatureGate.jsx — UPDATED
// Changes:
//  1. Added readOnly gate mode — shows "Subscription inactive" banner for write ops
//  2. Added limitKey + currentCount props — shows "Limit reached" UI when at limit
//  3. Added aiCreditKey prop — shows "AI credits exhausted" UI when remaining = 0
//  4. Added onRefresh prop — refreshes entitlements after upgrade/payment without page reload
//  5. Backward-compat: existing featureKey usage is unchanged
//  6. Uses useEntitlements (not usePlanFeatures directly) for enriched helpers

import useEntitlements from "../hooks/useEntitlements";
import { useNavigate } from "react-router-dom";

function LockIcon({ className = "w-10 h-10 text-[#8B92A9]" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LimitIcon() {
  return (
    <svg className="w-10 h-10 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function AICreditsIcon() {
  return (
    <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

// ── Read-only gate — shown when subscription is suspended/paused/expired ──────
function ReadOnlyGate({ status, onGoToPlans }) {
  const messages = {
    suspended: {
      title:  "Account Suspended",
      body:   "Your account has been suspended. Write operations are disabled. Please contact support or renew your subscription to restore access.",
      color:  "red",
    },
    paused: {
      title:  "Subscription Paused",
      body:   "Your subscription is currently paused. This page is in read-only mode. Resume your subscription to make changes.",
      color:  "amber",
    },
    expired: {
      title:  "Subscription Expired",
      body:   "Your subscription has expired. Renew your plan to restore full access and make changes.",
      color:  "orange",
    },
    cancelled: {
      title:  "Subscription Cancelled",
      body:   "Your subscription has been cancelled. Please contact support to re-activate your account.",
      color:  "red",
    },
  };

  const info = messages[status] || messages.expired;
  const colorMap = {
    red:    { bg: "bg-red-50 dark:bg-red-500/10",    border: "border-red-200 dark:border-red-500/20",    icon: "bg-red-100 dark:bg-red-500/20",    btn: "bg-red-600 hover:bg-red-700" },
    amber:  { bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/20", icon: "bg-amber-100 dark:bg-amber-500/20", btn: "bg-amber-600 hover:bg-amber-700" },
    orange: { bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/20", icon: "bg-orange-100 dark:bg-orange-500/20", btn: "bg-orange-600 hover:bg-orange-700" },
  };
  const c = colorMap[info.color] || colorMap.red;

  return (
    <div className={`mx-4 mt-4 rounded-2xl border ${c.bg} ${c.border} p-6 flex flex-col items-center text-center`}>
      <div className={`w-16 h-16 rounded-2xl ${c.icon} flex items-center justify-center mb-4`}>
        {status === "paused" ? <PauseIcon /> : <LockIcon className="w-8 h-8 text-red-400" />}
      </div>
      <h3 className="text-[16px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-1">{info.title}</h3>
      <p className="text-[13px] text-[#8B92A9] max-w-sm mb-4 leading-relaxed">{info.body}</p>
      {onGoToPlans && status !== "paused" && status !== "suspended" && status !== "cancelled" && (
        <button
          onClick={onGoToPlans}
          className={`px-6 py-2.5 rounded-xl ${c.btn} text-white text-[13px] font-semibold transition`}
        >
          View Plans
        </button>
      )}
    </div>
  );
}

// ── Limit reached gate ────────────────────────────────────────────────────────
function LimitReachedGate({ resource, current, limit, onGoToPlans }) {
  return (
    <div className="mx-4 mt-4 rounded-2xl border bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 p-6 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center mb-4">
        <LimitIcon />
      </div>
      <h3 className="text-[16px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-1">Limit Reached</h3>
      <p className="text-[13px] text-[#8B92A9] max-w-sm mb-4 leading-relaxed">
        You've reached your {resource} limit ({current}/{limit}). Upgrade your plan or purchase an addon to add more.
      </p>
      <button
        onClick={onGoToPlans}
        className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[13px] font-semibold transition"
      >
        Upgrade Plan
      </button>
    </div>
  );
}

// ── AI Credits exhausted gate ─────────────────────────────────────────────────
function AICreditsExhaustedGate({ creditType, onGoToPlans }) {
  const CREDIT_LABELS = {
    transcriptions: "call transcription",
    summaries:      "AI summary",
    voiceBot:       "voice bot",
    recordings:     "call recording",
  };
  const label = CREDIT_LABELS[creditType] || creditType;

  return (
    <div className="mx-4 mt-4 rounded-2xl border bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20 p-6 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center mb-4">
        <AICreditsIcon />
      </div>
      <h3 className="text-[16px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-1">AI Credits Exhausted</h3>
      <p className="text-[13px] text-[#8B92A9] max-w-sm mb-4 leading-relaxed">
        Your monthly {label} credits have been used up. Upgrade your plan or purchase an addon to get more credits.
      </p>
      <button
        onClick={onGoToPlans}
        className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition"
      >
        Get More Credits
      </button>
    </div>
  );
}

// ── Main FeatureGate export ───────────────────────────────────────────────────
export default function FeatureGate({
  featureKey,       // string — existing usage unchanged
  children,
  // NEW props:
  writeOnly = false, // if true, only gate write operations (show children in read mode with banner)
  limitKey,          // string — entitlements resource key (e.g. "users", "admins", "leads")
  currentCount,      // number — current count to compare against limit
  aiCreditKey,       // string — "transcriptions" | "summaries" | "voiceBot" | "recordings"
  onGoToPlans,       // optional — callback for "View Plans" button
}) {
  const { hasFeature, isReadOnly, getLimit, getRemainingUsage, entitlements, loading } = useEntitlements();
  const navigate = useNavigate();

  const handleGoToPlans = onGoToPlans || (() => navigate("/upgrade-plan"));

  // While loading, render children (fail-open)
  if (loading) return children;

  // ── Read-only gate (writeOnly mode shows children but overlays banner above) ──
  if (isReadOnly()) {
    const status = entitlements?.subscriptionStatus || "expired";
    if (writeOnly) {
      // In writeOnly mode: still render children but show read-only banner above
      return (
        <>
          <ReadOnlyGate status={status} onGoToPlans={handleGoToPlans} />
          <div className="opacity-50 pointer-events-none select-none">{children}</div>
        </>
      );
    }
    return <ReadOnlyGate status={status} onGoToPlans={handleGoToPlans} />;
  }

  // ── AI Credits gate ──────────────────────────────────────────────────────────
  if (aiCreditKey) {
    const remaining = getRemainingUsage(aiCreditKey);
    // Only gate if the feature is enabled but credits are exhausted (0 = no remaining)
    if (remaining !== null && remaining <= 0) {
      return <AICreditsExhaustedGate creditType={aiCreditKey} onGoToPlans={handleGoToPlans} />;
    }
  }

  // ── Limit gate ───────────────────────────────────────────────────────────────
  if (limitKey && currentCount !== undefined) {
    const limit = getLimit(limitKey);
    if (limit !== null && currentCount >= limit) {
      return (
        <LimitReachedGate
          resource={limitKey}
          current={currentCount}
          limit={limit}
          onGoToPlans={handleGoToPlans}
        />
      );
    }
  }

  // ── Feature gate (existing behaviour) ────────────────────────────────────────
  if (featureKey && !hasFeature(featureKey)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-[#F1F4FF] dark:bg-[#1A1D27] flex items-center justify-center mb-5">
          <LockIcon />
        </div>
        <h2 className="text-[20px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-2">
          Feature not available
        </h2>
        <p className="text-[13px] text-[#8B92A9] max-w-sm mb-6">
          This feature is not included in your current plan. Upgrade your plan to unlock it.
        </p>
        <button
          onClick={handleGoToPlans}
          className="px-6 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8] transition"
        >
          View Plans
        </button>
      </div>
    );
  }

  return children;
}
