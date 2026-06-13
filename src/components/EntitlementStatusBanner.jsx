// src/components/EntitlementStatusBanner.jsx — UPDATED
// Changes:
//  1. Added dismissible support — banner can be closed for the session
//  2. Added "Renew Plan" button for expired status (links to /upgrade-plan)
//  3. Added "Contact Support" mailto link for suspended/paused/cancelled
//  4. Improved accessibility: role="alert", aria-live="polite"
//  5. Consistent with EntitlementStatusBanner used in App.jsx (no duplicate renders)

import { useState } from "react";
import useEntitlements from "../hooks/useEntitlements";
import { Lock, PauseCircle, AlertTriangle, Ban } from "lucide-react";

const STATUS_CONFIG = {
  suspended: {
    bg:       "bg-red-600",
    Icon:     Lock,
    msg:      "Account suspended — your CRM is in read-only mode. Creating, editing, and exporting data is disabled.",
    sub:      "Contact support at support@skyupcrm.com to restore access.",
    showRenew: false,
    showContact: true,
  },
  paused: {
    bg:       "bg-amber-500",
    Icon:     PauseCircle,
    msg:      "Subscription paused — your CRM is in read-only mode. No changes can be made until the subscription is resumed.",
    sub:      "Contact your administrator to resume the subscription.",
    showRenew: false,
    showContact: false,
  },
  expired: {
    bg:       "bg-orange-600",
    Icon:     AlertTriangle,
    msg:      "Subscription expired — your CRM is in read-only mode. Renew your plan to restore full access.",
    sub:      null,
    showRenew: true,
    showContact: false,
  },
  cancelled: {
    bg:       "bg-red-700",
    Icon:     Ban,
    msg:      "Subscription cancelled — your CRM is in read-only mode.",
    sub:      "Contact support to re-activate your account.",
    showRenew: false,
    showContact: true,
  },
};

export default function EntitlementStatusBanner({ onGoToPlans }) {
  const { isReadOnly, subscriptionStatus, loading } = useEntitlements();
  const [dismissed, setDismissed] = useState(false);

  // Don't show for non-blocked statuses or while loading
  if (loading)         return null;
  if (!isReadOnly())   return null;
  if (dismissed)       return null;

  const config = STATUS_CONFIG[subscriptionStatus] || STATUS_CONFIG.expired;
  const handleGoToPlans = onGoToPlans || (() => { window.location.href = "/upgrade-plan"; });

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`${config.bg} text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[12px] font-semibold w-full z-40`}
    >
      {/* Left: icon + message */}
      <div className="flex items-start gap-2">
        <span className="shrink-0 leading-5"><config.Icon className="w-4 h-4" /></span>
        <div>
          <span>{config.msg}</span>
          {config.sub && (
            <span className="block text-[11px] font-normal mt-0.5 text-white/80">
              {config.sub}
            </span>
          )}
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {config.showRenew && (
          <button
            onClick={handleGoToPlans}
            className="px-4 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition text-white text-[11px] font-bold whitespace-nowrap"
          >
            Renew Plan
          </button>
        )}
        {config.showContact && (
          <a
            href="mailto:support@skyupcrm.com"
            className="px-4 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition text-white text-[11px] font-bold whitespace-nowrap"
          >
            Contact Support
          </a>
        )}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition shrink-0 text-sm leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
