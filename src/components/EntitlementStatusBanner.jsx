// src/components/EntitlementStatusBanner.jsx — NEW FILE
// Full-width banner shown at the top of the admin layout when the subscription
// is suspended, paused, or expired. Explains read-only mode and what's blocked.
// Used inside AppLayout in App.jsx.

import useEntitlements from "../hooks/useEntitlements";

const STATUS_CONFIG = {
  suspended: {
    bg:   "bg-red-600",
    icon: "🔒",
    msg:  "Account suspended — your CRM is in read-only mode. Creating, editing, and exporting data is disabled.",
    sub:  "Contact support at support@skyupcrm.com to restore access.",
  },
  paused: {
    bg:   "bg-amber-500",
    icon: "⏸️",
    msg:  "Subscription paused — your CRM is in read-only mode. No changes can be made until the subscription is resumed.",
    sub:  "Contact your administrator to resume the subscription.",
  },
  expired: {
    bg:   "bg-orange-600",
    icon: "⚠️",
    msg:  "Subscription expired — your CRM is in read-only mode. Renew your plan to restore full access.",
    sub:  null,
  },
  cancelled: {
    bg:   "bg-red-700",
    icon: "🚫",
    msg:  "Subscription cancelled — your CRM is in read-only mode.",
    sub:  "Contact support to re-activate your account.",
  },
};

export default function EntitlementStatusBanner({ onGoToPlans }) {
  const { isReadOnly, subscriptionStatus, loading } = useEntitlements();

  // Don't show for non-blocked statuses or while loading
  if (loading) return null;
  if (!isReadOnly()) return null;

  const config = STATUS_CONFIG[subscriptionStatus] || STATUS_CONFIG.expired;

  return (
    <div className={`${config.bg} text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[12px] font-semibold w-full z-40`}>
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0">{config.icon}</span>
        <div>
          <span>{config.msg}</span>
          {config.sub && (
            <span className="block text-[11px] font-normal mt-0.5 text-white/80">
              {config.sub}
            </span>
          )}
        </div>
      </div>
      {subscriptionStatus === "expired" && onGoToPlans && (
        <button
          onClick={onGoToPlans}
          className="shrink-0 px-4 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition text-white text-[11px] font-bold whitespace-nowrap"
        >
          Renew Plan
        </button>
      )}
    </div>
  );
}
