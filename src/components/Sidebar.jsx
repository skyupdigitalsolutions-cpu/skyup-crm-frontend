import { useState, useEffect } from "react";
import useEntitlements from "../hooks/useEntitlements";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api, { clearAllCache } from "../data/axiosConfig";
import { getToken, getUser, clearSession } from "../data/sessionStore";

// ── Nav items for ADMIN ───────────────────────────────────────────────────────
const ADMIN_NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: "/leads",
    label: "Leads",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/reportpage",
    label: "Report Page",
    featureKey: "basic-reports",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    to: "/campaigns",
    label: "Campaigns",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    to: "/communications",
    label: "Communications",
    featureKeyAny: ["sms-blast", "whatsapp-blast", "email-blast"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 10h8M8 14h5" />
      </svg>
    ),
  },
  {
    to: "/daily-report",
    label: "Daily Report",
    featureKey: "daily-report",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    to: "/nurture-sequence",
    label: "Lead Nurture",
    featureKey: "leadNurtureSequence",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 2a7 7 0 0 0-7 7c0 3 2 5 3 7l4 6 4-6c1-2 3-4 3-7a7 7 0 0 0-7-7z" />
        <circle cx="12" cy="9" r="2" />
      </svg>
    ),
  },
  {
    to: "/attendance",
    label: "Attendance",
    featureKey: "attendance",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M9 16l2 2 4-4" />
      </svg>
    ),
  },
];

// ── Extra nav items for SUPERADMIN only ───────────────────────────────────────
const SUPERADMIN_EXTRA_ITEMS = [
  // {
  //   to: "/upgrade-plan",
  //   label: "Upgrade Plan",
  //   icon: (
  //     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
  //       <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  //     </svg>
  //   ),
  // },
  {
    to: "/custom-reports",
    label: "Custom Reports",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 3v18h18" />
        <rect x="7" y="11" width="3" height="6" />
        <rect x="12" y="7" width="3" height="10" />
        <rect x="17" y="13" width="3" height="4" />
      </svg>
    ),
  },
];

// ── Nav items for USER role ───────────────────────────────────────────────────
const USER_NAV_ITEMS = [
  {
    to: "/user/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: "/leads",
    label: "My Leads",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/user/communications",
    label: "Communications",
    featureKeyAny: ["sms-blast", "whatsapp-blast", "email-blast"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 10h8M8 14h5" />
      </svg>
    ),
  },
  {
    to: "/daily-report",
    label: "Daily Report",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="16" y2="14" />
        <line x1="8" y1="18" x2="12" y2="18" />
      </svg>
    ),
  },
  {
    // Excel / Google Sheet integration — appears ONLY when the derived
    // effective flag is true (Developer made it available AND Company Admin
    // enabled it). googleSheetIntegrationEnabled is computed server-side in
    // entitlementService.js, so hasFeature() alone enforces both gates.
    to: "/user/sheet-integration",
    label: "Excel / Google Sheet",
    featureKey: "googleSheetIntegrationEnabled",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>
    ),
  },
];

// ── Nav items for DEVELOPER role ──────────────────────────────────────────────
const DEVELOPER_NAV_ITEMS = [
  {
    to: "/developer/dashboard",
    label: "Platform Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: "/developer/companies",
    label: "Companies",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
        <path d="M9 9h.01M9 12h.01M9 15h.01M9 18h.01" />
      </svg>
    ),
  },
  {
    to: "/developer/subscriptions",
    label: "Subscriptions",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
        <line x1="6"  y1="15" x2="6.01" y2="15" strokeWidth="3" strokeLinecap="round" />
        <line x1="10" y1="15" x2="14"   y2="15" />
      </svg>
    ),
  },
  {
    to: "/developer/plan-customization",
    label: "Plan Customization",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const [minimized, setMinimized] = useState(
    () => localStorage.getItem("sidebar_minimized") === "true"
  );
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [followUpAlerts, setFollowUpAlerts] = useState({ todayCount: 0, overdueCount: 0 });
  // Total unread inbound WhatsApp messages (red badge on Communications)
  const [waUnread, setWaUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Track viewport so the minimized (72px icon-rail) layout never applies on
  // mobile — there the sidebar is a full-width slide-in drawer, and a cramped
  // icon rail would be confusing. md breakpoint = 768px.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange);
    };
  }, []);
  // On mobile, always render the full (non-minimized) layout.
  const effMinimized = minimized && !isMobile;

  const location = useLocation();
  const navigate  = useNavigate();

  const user        = getUser();
  const rawRole     = user?.role?.toLowerCase() || "user";

  const role        = rawRole === "superadmin" ? "super_admin" : rawRole;
  const isSuperAdmin = role === "super_admin";
  const isDeveloper  = role === "developer";

  // ── Sidebar branding is fixed — always shows SKYUP identity ─────────────
  const companyName = "SKYUP";
  const companyLogo = "/skyup_logo1.svg";

  // ── Entitlement-driven feature gating ────────────────────────────────────
  // Switched from usePlanFeatures to useEntitlements for richer helpers.
  // hasFeature() behaviour is unchanged — sidebar items are filtered by plan.
  // readOnlyMode adds a visual indicator in the footer area.
  const {
    hasFeature,
    readOnlyMode,
    subscriptionStatus,
    refreshEntitlements,
  } = useEntitlements();

  // ── Poll follow-up alerts every 5 minutes (skip for developer) ────────────
  useEffect(() => {
    const token = getToken();
    if (!token || isDeveloper) return;
    const isAdmin    = role === "admin" || role === "super_admin";
    const endpoint   = isAdmin ? "/lead/admin/follow-up-alerts" : "/lead/follow-up-alerts";
    const fetchAlerts = async () => {
      try {
        const res = await api.get(endpoint);
        setFollowUpAlerts({
          todayCount:   res.data.todayCount   || 0,
          overdueCount: res.data.overdueCount || 0,
        });
      } catch (_) { /* silent */ }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WhatsApp unread total for the Communications badge ─────────────────────
  // Mirrors the red badge in the Communications lead list. Counts inbound
  // messages the leads sent that haven't been opened yet. Refreshes on a timer,
  // whenever the route changes (so it clears right after reading a chat), and
  // whenever a new WhatsApp message arrives via socket.
  useEffect(() => {
    const token = getToken();
    if (!token || isDeveloper) return;
    const fetchUnread = async () => {
      try {
        const { data } = await api.get("/whatsapp/unread-counts");
        const total = Object.values(data?.byLead || {}).reduce((a, b) => a + (b || 0), 0);
        setWaUnread(total);
      } catch (_) { /* silent — badge just stays as-is */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60 * 1000);
    const onWaMessage = () => fetchUnread();
    window.addEventListener("wa_unread_refresh", onWaMessage);
    return () => {
      clearInterval(interval);
      window.removeEventListener("wa_unread_refresh", onWaMessage);
    };
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh entitlements when plan_updated fires (e.g. after payment) ────
  useEffect(() => {
    const handler = () => refreshEntitlements();
    window.addEventListener("plan_updated", handler);
    return () => window.removeEventListener("plan_updated", handler);
  }, [refreshEntitlements]);

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const roleStyle = {
    super_admin: { border: "border-amber-500/30",  bg: "bg-amber-500/10",  text: "text-amber-400"  },
    admin:       { border: "border-purple-500/30", bg: "bg-purple-500/10", text: "text-purple-400" },
    user:        { border: "border-blue-500/30",   bg: "bg-blue-500/10",   text: "text-blue-400"   },
    developer:   { border: "border-emerald-500/30",bg: "bg-emerald-500/10",text: "text-emerald-400" },
  }[role] ?? { border: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-400" };

  // ── Build nav items based on role, filtered by entitlement feature flags ──
  // NOTE: Items without a featureKey are always shown regardless of plan.
  //       Items WITH a featureKey are hidden if hasFeature() returns false —
  //       which is now driven by the entitlements API, not hardcoded plan names.
  const ALL_NAV_ITEMS =
    isDeveloper  ? DEVELOPER_NAV_ITEMS :
    role === "user" ? USER_NAV_ITEMS :
    isSuperAdmin ? [...ADMIN_NAV_ITEMS, ...SUPERADMIN_EXTRA_ITEMS] :
    ADMIN_NAV_ITEMS;

  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => {
    if (Array.isArray(item.featureKeyAny) && item.featureKeyAny.length) {
      return item.featureKeyAny.some(k => hasFeature(k));
    }
    return !item.featureKey || hasFeature(item.featureKey);
  });

  const handleLogout = () => {
    clearSession();
    clearAllCache();
    window.dispatchEvent(new Event("user_changed"));
    navigate("/login", { replace: true });
  };

  // Close mobile sidebar when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // ── Read-only status pill — shown in sidebar footer for admin/superadmin ──
  const READ_ONLY_STATUS_STYLES = {
    suspended: { bg: "bg-red-500/10",    text: "text-red-400",    dot: "bg-red-500",    label: "Suspended"  },
    paused:    { bg: "bg-amber-500/10",  text: "text-amber-400",  dot: "bg-amber-500",  label: "Paused"     },
    expired:   { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-500", label: "Expired"    },
    cancelled: { bg: "bg-red-500/10",    text: "text-red-400",    dot: "bg-red-500",    label: "Cancelled"  },
  };
  const readOnlyStyle = READ_ONLY_STATUS_STYLES[subscriptionStatus] || null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        .sidebar {
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: 'DM Sans', sans-serif;
          overflow: visible;
          flex-shrink: 0;
        }
        .nav-label {
          transition: opacity 0.2s ease;
          white-space: nowrap;
          overflow: hidden;
          flex-shrink: 0;
        }
        .tooltip {
          pointer-events: none;
          opacity: 0;
          transform: translateX(-4px);
          transition: opacity 0.15s ease, transform 0.15s ease;
          white-space: nowrap;
        }
        .nav-item:hover .tooltip,
        .logout-btn:hover .tooltip { opacity: 1; transform: translateX(0); }
        .toggle-btn { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease; }
        .nav-item, .logout-btn { transition: background 0.15s ease, color 0.15s ease; position: relative; overflow: visible; }
        .icon-wrap { transition: transform 0.15s ease; flex-shrink: 0; }
        .nav-item:hover .icon-wrap,
        .logout-btn:hover .icon-wrap { transform: scale(1.15); }
        .modal-overlay { animation: fadeIn 0.15s ease; }
        .modal-box { animation: scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .mobile-overlay { animation: fadeIn 0.2s ease; }
        .sidebar-mobile-enter { animation: slideInLeft 0.25s cubic-bezier(0.4,0,0.2,1); }
        @keyframes fadeIn  { from { opacity:0; }                          to { opacity:1; } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.92); }   to { opacity:1; transform:scale(1); } }
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `}</style>

      {/* ── Logout Confirmation Modal ─────────────────────────────────────── */}
      {showLogoutModal && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="modal-box bg-white dark:bg-[#1A1D27] border border-gray-100 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-red-500">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <h2 className="text-[16px] font-bold text-center text-gray-900 dark:text-white mb-1">Sign out?</h2>
            <p className="text-[13px] text-center text-gray-400 dark:text-gray-500 mb-6">
              You'll need to log in again to access your account.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile overlay backdrop ───────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="mobile-overlay fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile hamburger FAB ──────────────────────────────────────────── */}
      <button
        className="fixed top-3 left-3 z-50 md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#13161E] border border-gray-200 dark:border-white/10 shadow-md text-gray-600 dark:text-gray-300"
        onClick={() => setMobileOpen((v) => !v)}
        title="Toggle menu"
      >
        {mobileOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        )}
      </button>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <div
        className={`sidebar h-screen flex flex-col bg-white dark:bg-[#13161E] border-r border-gray-100 dark:border-white/5 shadow-sm
          fixed md:sticky inset-y-0 left-0 z-40 top-0
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{ width: effMinimized ? "72px" : "260px" }}
      >
        {/* Header — shows dynamic brand logo/name */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100 dark:border-white/5 min-w-0">
          <img
            src={companyLogo}
            className={`h-10 w-auto max-w-[120px] object-contain me-2 ${effMinimized ? "cursor-pointer" : ""}`}
            alt={companyName}
            onClick={() => { if (effMinimized) { localStorage.setItem("sidebar_minimized", "false"); setMinimized(false); } }}
            title={effMinimized ? "Expand sidebar" : undefined}
            onError={e => { e.currentTarget.src = "/skyup_logo1.svg"; }}
          />
          {!effMinimized && (
            <span className="nav-label font-semibold text-lg tracking-widest uppercase text-gray-600 dark:text-gray-500 truncate max-w-[110px]">
              {companyName}
            </span>
          )}
          {!effMinimized && !isMobile && (
            <button
              onClick={() => { localStorage.setItem("sidebar_minimized", "true"); setMinimized(true); }}
              className="toggle-btn ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
              title="Minimize sidebar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
        </div>

        {/* Employee Profile */}
        {user && (
          <div className={`mx-3 mt-3 rounded-xl border bg-gray-50 dark:bg-white/[0.03] ${effMinimized ? "p-2 flex justify-center" : "p-3 flex items-center gap-3"} ${roleStyle.border}`}>
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${roleStyle.bg} ${roleStyle.border} ${roleStyle.text}`}>
              {initials}
            </div>
            {!effMinimized && (
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 truncate">{user.name}</p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${roleStyle.bg} ${roleStyle.text}`}>
                  {user.role}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const isActive      = location.pathname === item.to;
            const isDailyReport = item.to === "/daily-report";
            const isComms       = item.to === "/communications" || item.to === "/user/communications";
            const hasWaUnread   = isComms && waUnread > 0;
            const hasOverdue    = isDailyReport && followUpAlerts.overdueCount > 0;
            const hasToday      = isDailyReport && !hasOverdue && followUpAlerts.todayCount > 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                  ${isActive
                    ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-indigo-500/15 hover:text-gray-900 dark:hover:text-indigo-300"
                  }`}
              >
                <span className={`icon-wrap relative ${isActive ? "text-indigo-500 dark:text-indigo-400" : ""}`}>
                  {item.icon}
                  {hasOverdue && (
                    <span
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white dark:border-[#13161E] animate-pulse"
                      title={`${followUpAlerts.overdueCount} overdue follow-up${followUpAlerts.overdueCount > 1 ? "s" : ""}`}
                    />
                  )}
                  {hasToday && (
                    <span
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-yellow-400 border-2 border-white dark:border-[#13161E]"
                      title={`${followUpAlerts.todayCount} follow-up${followUpAlerts.todayCount > 1 ? "s" : ""} due today`}
                    />
                  )}
                  {hasWaUnread && (
                    <span
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white dark:border-[#13161E]"
                      title={`${waUnread} unread WhatsApp message${waUnread > 1 ? "s" : ""}`}
                    />
                  )}
                </span>
                {!effMinimized && (
                  <span className="nav-label flex items-center gap-1.5 flex-1">
                    {item.label}
                    {hasWaUnread && (
                      <span
                        className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white"
                        title={`${waUnread} unread WhatsApp message${waUnread > 1 ? "s" : ""}`}
                      >
                        {waUnread > 99 ? "99+" : waUnread}
                      </span>
                    )}
                    {hasOverdue && (
                      <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                        {followUpAlerts.overdueCount > 9 ? "9+" : followUpAlerts.overdueCount}
                      </span>
                    )}
                    {hasToday && (
                      <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400">
                        {followUpAlerts.todayCount > 9 ? "9+" : followUpAlerts.todayCount}
                      </span>
                    )}
                  </span>
                )}
                {effMinimized && isActive && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
                {effMinimized && (
                  <span className="tooltip absolute left-16 z-50 bg-gray-900 dark:bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl">
                    {item.label}
                    {hasOverdue && ` (${followUpAlerts.overdueCount} overdue)`}
                    {hasToday && ` (${followUpAlerts.todayCount} today)`}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-gray-100 dark:border-white/5 flex flex-col gap-1">
          {/* Read-only indicator — shown when subscription is not active/trial */}
          {readOnlyMode && !isDeveloper && !effMinimized && readOnlyStyle && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-1 ${readOnlyStyle.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${readOnlyStyle.dot}`} />
              <span className={`text-[11px] font-semibold ${readOnlyStyle.text}`}>
                Read-only — {readOnlyStyle.label}
              </span>
            </div>
          )}
          {readOnlyMode && !isDeveloper && effMinimized && readOnlyStyle && (
            <div className="relative flex justify-center mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${readOnlyStyle.dot}`} />
              <span className="tooltip absolute left-16 z-50 bg-gray-900 dark:bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl">
                Read-only — {readOnlyStyle.label}
              </span>
            </div>
          )}

          <button
            onClick={() => setShowLogoutModal(true)}
            className={`logout-btn flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium w-full
              text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300
              ${effMinimized ? "justify-center" : ""}`}
          >
            <span className="icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            {!effMinimized && <span className="nav-label">Sign out</span>}
            {effMinimized && (
              <span className="tooltip absolute left-16 z-50 bg-gray-900 dark:bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl">
                Sign out
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
