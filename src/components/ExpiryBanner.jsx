// src/components/ExpiryBanner.jsx
// Shows a sticky warning banner when subscription expires in ≤5 days,
// and a full suspension screen when the company is blocked.
import { useState, useEffect } from "react";
import api from "../data/axiosConfig";

function AlertIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
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

// ── Suspension screen — shown when company is blocked ────────────────────────
export function SuspensionScreen({ onGoToPlans }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0B0D14]/95 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#11131C] rounded-2xl p-10 max-w-md w-full mx-4 shadow-2xl border border-red-200 dark:border-red-900 text-center">
        <div className="flex justify-center mb-5">
          <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <LockIcon />
          </div>
        </div>
        <h2 className="text-[22px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-2">
          Account Suspended
        </h2>
        <p className="text-[13px] text-[#8B92A9] mb-6 leading-relaxed">
          Your subscription has expired and your account has been temporarily suspended.
          Renew your plan to restore full access.
        </p>
        <button
          onClick={onGoToPlans}
          className="w-full py-3 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold hover:bg-[#1D4ED8] transition"
        >
          View Plans & Renew
        </button>
        <p className="mt-4 text-[11px] text-[#8B92A9]">
          Need help? Contact support at support@skyupcrm.com
        </p>
      </div>
    </div>
  );
}

// ── Expiry warning banner — shown when ≤5 days remain ───────────────────────
export default function ExpiryBanner({ onGoToPlans }) {
  const [status,    setStatus]    = useState(null); // null | { daysRemaining, expiringSoon, suspended, status }
  const [dismissed, setDismissed] = useState(false);
  const [role,      setRole]      = useState(null);

  useEffect(() => {
    // FIX: read role from the "user" JSON object (standalone "role" key is never set by login pages)
    let r = null;
    try { r = JSON.parse(localStorage.getItem("user") || "null")?.role || null; } catch {}
    setRole(r);
    // Only show for admin / super_admin — not developer or user
    if (r === "developer" || r === "user") return;

    api.get("/subscription/my/status")
      .then(({ data }) => setStatus(data))
      .catch(() => {}); // silent — banner is optional
  }, []);

  if (!status) return null;
  if (status.suspended) return <SuspensionScreen onGoToPlans={onGoToPlans} />;
  if (!status.expiringSoon || dismissed) return null;

  const isSuperAdmin = role === "super_admin";
  const days = status.daysRemaining;
  const isUrgent = days <= 2;
  const bgColor  = isUrgent ? "bg-red-600" : "bg-amber-500";
  const msg      = days === 0
    ? "Your subscription expires today!"
    : days === 1
    ? "Your subscription expires tomorrow!"
    : `Your subscription expires in ${days} days.`;

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
        {/* Renew Now button — only for super_admin */}
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
