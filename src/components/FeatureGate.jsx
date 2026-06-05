// src/components/FeatureGate.jsx — UPDATED
// Changes:
//  1. Added readOnly gate mode — shows "Subscription inactive" banner for write ops
//  2. Added limitKey + currentCount props — shows "Limit reached" UI when at limit
//  3. Backward-compat: existing featureKey usage is unchanged

import usePlanFeatures from "../hooks/usePlanFeatures";
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
      {onGoToPlans && status !== "paused" && (
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
function LimitReachedGate({ resource, current, limit }) {
  const navigate = useNavigate();
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
        onClick={() => navigate("/upgrade-plan")}
        className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[13px] font-semibold transition"
      >
        Upgrade Plan
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
  limitKey,          // string — entitlements resource key (e.g. "users", "leads")
  currentCount,      // number — current count to compare against limit
  onGoToPlans,       // optional — callback for "View Plans" button
}) {
  const { hasFeature, isReadOnly, getLimit, entitlements, loading } = usePlanFeatures();
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

  // ── Limit gate ───────────────────────────────────────────────────────────────
  if (limitKey && currentCount !== undefined) {
    const limit = getLimit(limitKey);
    if (limit !== null && currentCount >= limit) {
      return (
        <LimitReachedGate
          resource={limitKey}
          current={currentCount}
          limit={limit}
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
