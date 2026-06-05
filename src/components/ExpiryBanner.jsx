// src/components/ExpiryBanner.jsx — UPDATED
// Changes:
//  1. Extended SuspensionScreen to handle "suspended", "paused", and "cancelled" — not just "expired"
//  2. Banner now shows different messages per status (suspended vs paused vs expiring)
//  3. Backward-compat: all existing prop/import usage unchanged

import { useState, useEffect } from "react";
import api from "../data/axiosConfig";

function AlertIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function PauseCircleIcon() {
  return (
    <svg className="w-12 h-12 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

// ── Status config for the full-screen gate ────────────────────────────────────
const STATUS_CONFIG = {
  expired: {
    icon:    <LockIcon />,
    title:   "Subscription Expired",
    body:    "Your subscription has expired and your account is in read-only mode. Renew your plan to restore full access.",
    btnText: "View Plans & Renew",
    border:  "border-red-200 dark:border-red-900",
    iconBg:  "bg-red-50 dark:bg-red-900/20",
    showBtn: true,
  },
  suspended: {
    icon:    <LockIcon />,
    title:   "Account Suspended",
    body:    "Your account has been suspended by an administrator. Your data is in read-only mode. Please contact support to resolve this.",
    btnText: "Contact Support",
    border:  "border-red-200 dark:border-red-900",
    iconBg:  "bg-red-50 dark:bg-red-900/20",
    showBtn: false,
  },
  paused: {
    icon:    <PauseCircleIcon />,
    title:   "Subscription Paused",
    body:    "Your subscription is currently paused. Your account is in read-only mode. No changes can be made until the subscription is resumed.",
    btnText: "Contact Support",
    border:  "border-amber-200 dark:border-amber-800",
    iconBg:  "bg-amber-50 dark:bg-amber-900/20",
    showBtn: false,
  },
  cancelled: {
    icon:    <LockIcon />,
    title:   "Subscription Cancelled",
    body:    "Your subscription has been cancelled. Please contact support to re-activate your account.",
    btnText: "Contact Support",
    border:  "border-red-200 dark:border-red-900",
    iconBg:  "bg-red-50 dark:bg-red-900/20",
    showBtn: false,
  },
};

// ── Full-screen suspension screen (exported — used in App.jsx) ────────────────
export function SuspensionScreen({ onGoToPlans, status = "expired" }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.expired;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0B0D14]/95 backdrop-blur-sm">
      <div className={`bg-white dark:bg-[#11131C] rounded-2xl p-10 max-w-md w-full mx-4 shadow-2xl border ${config.border} text-center`}>
        <div className="flex justify-center mb-5">
          <div className={`w-20 h-20 rounded-full ${config.iconBg} flex items-center justify-center`}>
            {config.icon}
          </div>
        </div>
        <h2 className="text-[22px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-2">
          {config.title}
        </h2>
        <p className="text-[13px] text-[#8B92A9] mb-6 leading-relaxed">
          {config.body}
        </p>
        {config.showBtn && (
          <button
            onClick={onGoToPlans}
            className="w-full py-3 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold hover:bg-[#1D4ED8] transition"
          >
            {config.btnText}
          </button>
        )}
        <p className="mt-4 text-[11px] text-[#8B92A9]">
          Need help? Contact support at support@skyupcrm.com
        </p>
      </div>
    </div>
  );
}

// ── Expiry / status warning banner ───────────────────────────────────────────
export default function ExpiryBanner({ onGoToPlans }) {
  const [status,    setStatus]    = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [role,      setRole]      = useState(null);

  useEffect(() => {
    let r = null;
    try { r = JSON.parse(localStorage.getItem("user") || "null")?.role || null; } catch {}
    setRole(r);
    if (r === "developer" || r === "user") return;

    api.get("/subscription/my/status")
      .then(({ data }) => setStatus(data))
      .catch(() => {});
  }, []);

  if (!status) return null;

  // Full-screen gate for truly blocked statuses
  if (["expired", "suspended", "paused", "cancelled"].includes(status.status) && status.suspended) {
    return <SuspensionScreen onGoToPlans={onGoToPlans} status={status.status} />;
  }

  if (dismissed) return null;

  // ── Per-status banner messages ────────────────────────────────────────────
  const isSuperAdmin = role === "super_admin" || role === "superadmin";
  const days         = status.daysRemaining ?? 0;

  // Paused banner (not full-screen — subscription is paused but not expired)
  if (status.status === "paused") {
    return (
      <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-[12px] font-semibold z-50">
        <div className="flex items-center gap-2">
          <AlertIcon />
          <span>Your subscription is paused. The account is in read-only mode.</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition"
        >
          ×
        </button>
      </div>
    );
  }

  // Suspended banner
  if (status.status === "suspended") {
    return (
      <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-[12px] font-semibold z-50">
        <div className="flex items-center gap-2">
          <AlertIcon />
          <span>Your account has been suspended. Contact support to restore access.</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition"
        >
          ×
        </button>
      </div>
    );
  }

  // Expiring soon banner (≤5 days)
  if (!status.expiringSoon) return null;

  const isUrgent = days <= 2;
  const bgColor  = isUrgent ? "bg-red-600" : "bg-amber-500";
  const msg =
    days === 0 ? "Your subscription expires today!" :
    days === 1 ? "Your subscription expires tomorrow!" :
    `Your subscription expires in ${days} days.`;

  return (
    <div className={`${bgColor} text-white px-4 py-2.5 flex items-center justify-between gap-3 text-[12px] font-semibold z-50`}>
      <div className="flex items-center gap-2">
        <AlertIcon />
        {isSuperAdmin ? (
          <span>{msg} Renew now to avoid interruption.</span>
        ) : (
          <span>{msg} Please contact your Super Admin to renew.</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isSuperAdmin && (
          <button
            onClick={onGoToPlans}
            className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition text-white text-[11px] font-bold"
          >
            Renew Now
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
