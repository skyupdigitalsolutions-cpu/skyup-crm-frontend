import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

// ── Nav items for ADMIN / SUPERADMIN ─────────────────────────────────────────
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
    to: "/email-history",
    label: "Email History",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
  to: "/attendance",
  label: "Attendance",
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
  {
    to: "/whatsapp",
    label: "WhatsApp",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    to: "/upgrade-plan",
    label: "Upgrade Plan",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
      </svg>
    ),
  },
];

// ── Nav items for USER role (only 3 pages) ────────────────────────────────────
const USER_NAV_ITEMS = [
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
    to: "/user/twilio",
    label: "Twilio Calls",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.36 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
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
];

export function Sidebar() {
  const [minimized,       setMinimized]       = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // ── User info from localStorage ───────────────────────────────────────────
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  // ── Role styles with .toLowerCase() + nullish fallback to prevent crash ───
  const roleStyle = {
    superadmin: { border: "border-amber-500/30",  bg: "bg-amber-500/10",  text: "text-amber-400"  },
    admin:      { border: "border-purple-500/30", bg: "bg-purple-500/10", text: "text-purple-400" },
    user:       { border: "border-blue-500/30",   bg: "bg-blue-500/10",   text: "text-blue-400"   },
  }[user?.role?.toLowerCase() || "user"] ?? { border: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-400" };

  // ── Pick nav items based on role ──────────────────────────────────────────
  const NAV_ITEMS = user?.role?.toLowerCase() === "user" ? USER_NAV_ITEMS : ADMIN_NAV_ITEMS;

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        .sidebar {
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
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
        @keyframes fadeIn  { from { opacity:0; }                          to { opacity:1; } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.92); }   to { opacity:1; transform:scale(1); } }
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

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <div
        className="sidebar sticky top-0 h-screen flex flex-col bg-white dark:bg-[#13161E] border-r border-gray-100 dark:border-white/5 shadow-sm"
        style={{ width: minimized ? "72px" : "260px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100 dark:border-white/5 min-w-0">
          {!minimized && (
            <span className="nav-label font-semibold text-sm tracking-widest uppercase text-gray-400 dark:text-gray-500">
              CRM
            </span>
          )}
          <button
            onClick={() => setMinimized(!minimized)}
            className={`toggle-btn ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 ${minimized ? "rotate-180" : ""}`}
            title={minimized ? "Expand sidebar" : "Minimize sidebar"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* User Profile */}
        {user && (
          <div className={`mx-3 mt-3 rounded-xl border bg-gray-50 dark:bg-white/[0.03] ${minimized ? "p-2 flex justify-center" : "p-3 flex items-center gap-3"} ${roleStyle.border}`}>
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${roleStyle.bg} ${roleStyle.border} ${roleStyle.text}`}>
              {initials}
            </div>
            {!minimized && (
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
            const isActive = location.pathname === item.to;
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
                <span className={`icon-wrap ${isActive ? "text-indigo-500 dark:text-indigo-400" : ""}`}>
                  {item.icon}
                </span>
                {!minimized && <span className="nav-label">{item.label}</span>}
                {minimized && isActive && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
                {minimized && (
                  <span className="tooltip absolute left-16 z-50 bg-gray-900 dark:bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-gray-100 dark:border-white/5 flex flex-col gap-1">

          {/* Theme toggle */}
          <div className={`flex items-center px-3 py-2 ${minimized ? "justify-center" : "justify-between"}`}>
            {!minimized && (
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                Theme
              </span>
            )}
            <ThemeToggle />
          </div>

          {/* Sign out */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className={`logout-btn flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium w-full
              text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300
              ${minimized ? "justify-center" : ""}`}
          >
            <span className="icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            {!minimized && <span className="nav-label">Sign out</span>}
            {minimized && (
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