import { BrowserRouter, Route, Routes, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import React from "react";
import { Sidebar } from "./components/Sidebar";
import ThemeToggle from "./components/ThemeToggle";
import api from "./data/axiosConfig";
import ExpiryBanner, { SuspensionScreen } from "./components/ExpiryBanner";
import EntitlementStatusBanner from "./components/EntitlementStatusBanner";
import TrialGate from "./components/TrialGate";
import FeatureGate from "./components/FeatureGate";
import ClockInGate from "./components/ClockInGate";
import { NotificationProvider, NotificationBell } from "./components/NotificationProvider";
import { clearFeaturesCache } from "./hooks/usePlanFeatures";
import TelegramSettings from "./components/TelegramSettings";

// ── Lazy-loaded pages — each becomes its own chunk ────────────────────────────
const Dashboard      = lazy(() => import("./components/Dashboard"));
const Campaigns      = lazy(() => import("./components/Campaigns"));
const Dailyreport    = lazy(() => import("./components/DailyReport"));
const ReportPage     = lazy(() => import("./components/ReportPage"));
const AdminLeadsPage = lazy(() => import("./components/AdminLeadsPage"));
const Communications = lazy(() => import("./components/Communications"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const UpgradePlan    = lazy(() => import("./components/UpgradePlan"));

// User pages
const UserLogin              = lazy(() => import("./pages/UserLogin"));
const UserDashboard          = lazy(() => import("./pages/UserDashboard"));
const UserDailyReport        = lazy(() => import("./pages/UserDailyReport"));
const UserLeadsPage          = lazy(() => import("./pages/UserLeadsPage"));
const UserLeadCommunication  = lazy(() => import("./pages/UserLeadCommunication"));

// Developer pages
const DeveloperDashboard         = lazy(() => import("./pages/developer/DeveloperDashboard"));
const DeveloperCompanies         = lazy(() => import("./pages/developer/Companies"));
const DeveloperCompanyDetails    = lazy(() => import("./pages/developer/CompanyDetails"));
const DeveloperSubscriptions     = lazy(() => import("./pages/developer/Subscriptions"));
const DeveloperPlanCustomization = lazy(() => import("./pages/developer/PlanCustomization"));
const DeveloperAddonManager      = lazy(() => import("./pages/developer/AddonManagerPage"));

// Auth pages
const AdminLogin      = lazy(() => import("./pages/UserLogin")); // /admin/login now redirects to the unified login
const SuperAdminLogin = lazy(() => import("./pages/SuperAdminLogin"));
const ForgotPassword  = lazy(() => import("./pages/ForgotPassword"));

// ── Page loader ───────────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-screen bg-[#F0F4FF] dark:bg-[#0D0F14]">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <p className="text-[13px] text-[#8B92A9] font-medium">Loading…</p>
      </div>
    </div>
  );
}

// ── Error boundary — catches lazy chunk load failures and auto-retries ────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, retrying: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("dynamically imported module") ||
      error?.message?.includes("Failed to fetch dynamically");

    if (isChunkError && !this.state.retrying) {
      this.setState({ retrying: true });
      setTimeout(() => {
        this.setState({ hasError: false, retrying: false });
      }, 800);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full min-h-screen bg-[#F0F4FF] dark:bg-[#0D0F14]">
          <div className="flex flex-col items-center gap-4 text-center px-6">
            {this.state.retrying ? (
              <>
                <svg className="w-8 h-8 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <p className="text-[13px] text-[#8B92A9] font-medium">Retrying…</p>
              </>
            ) : (
              <>
                <p className="text-[14px] text-[#4B5168] dark:text-[#9DA3BB] font-medium">
                  Something went wrong loading this page.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition"
                >
                  Reload page
                </button>
              </>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function getStoredAuth() {
  const token = localStorage.getItem("token");
  const user  = JSON.parse(localStorage.getItem("user") || "null");
  return { token, user };
}

// ── Auth Navigation Guard ─────────────────────────────────────────────────────
function useAuthNavGuard() {
  const location = useLocation();

  useEffect(() => {
    const { token } = getStoredAuth();
    if (!token) return;

    window.history.pushState({ appGuard: true }, "", window.location.href);

    const handlePopState = () => {
      const { token: t } = getStoredAuth();
      if (t) {
        window.history.pushState({ appGuard: true }, "", window.location.href);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [location.pathname]);
}

// ── Login Guard ────────────────────────────────────────────────────────────────
function LoginGuard({ children }) {
  const location = useLocation();
  const navigate  = useNavigate();
  const { token, user } = getStoredAuth();

  useEffect(() => {
    const { token: t, user: u } = getStoredAuth();
    if (t && u) {
      let home = "/dashboard";
      if (u.role === "developer") home = "/developer/dashboard";
      else if (u.role === "user") home = "/user/dashboard";
      navigate(home, { replace: true });
      return;
    }
    window.history.replaceState(null, "", location.pathname);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (token && user) return null;
  return children;
}

// ── Role-aware page switches ──────────────────────────────────────────────────
function LeadsRoleSwitch() {
  const { user } = getStoredAuth();
  return user?.role === "user" ? <UserLeadsPage /> : <AdminLeadsPage />;
}

function DailyReportRoleSwitch() {
  const { user } = getStoredAuth();
  return user?.role === "user" ? <UserDailyReport /> : <Dailyreport />;
}

function RootRedirect() {
  const { user } = getStoredAuth();
  if (user?.role === "developer") return <Navigate to="/developer/dashboard" replace />;
  if (user?.role === "user")      return <Navigate to="/user/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}

// ── Protected Route ────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { token, user } = getStoredAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const { token: t, user: u } = getStoredAuth();
    if (!t || !u) navigate("/login", { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token || !user) return <Navigate to="/login" replace />;
  return children;
}

// ── Admin-only Route ───────────────────────────────────────────────────────────
function AdminRoute({ children }) {
  const { token, user } = getStoredAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const { token: t, user: u } = getStoredAuth();
    if (!t || !u) {
      navigate("/login", { replace: true });
    } else if (u.role === "user") {
      navigate("/user/dashboard", { replace: true });
    } else if (u.role === "developer") {
      navigate("/developer/dashboard", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role === "user")      return <Navigate to="/user/dashboard" replace />;
  if (user.role === "developer") return <Navigate to="/developer/dashboard" replace />;
  return children;
}

// ── SuperAdmin-only Route ──────────────────────────────────────────────────────
function SuperAdminRoute({ children }) {
  const { token, user } = getStoredAuth();
  const navigate = useNavigate();

  const isSuperAdmin = (r) => r === "super_admin" || r === "superadmin";

  useEffect(() => {
    const { token: t, user: u } = getStoredAuth();
    if (!t || !u) {
      navigate("/login", { replace: true });
    } else if (!isSuperAdmin(u.role)) {
      navigate("/dashboard", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token || !user)          return <Navigate to="/login" replace />;
  if (!isSuperAdmin(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

// ── User-only Route ────────────────────────────────────────────────────────────
function UserRoute({ children }) {
  const { token, user } = getStoredAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const { token: t, user: u } = getStoredAuth();
    if (!t || !u) {
      navigate("/login", { replace: true });
    } else if (u.role !== "user") {
      navigate("/dashboard", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role !== "user") return <Navigate to="/dashboard" replace />;
  return children;
}

// ── Developer-only Route ───────────────────────────────────────────────────────
function DeveloperRoute({ children }) {
  const { token, user } = getStoredAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const { token: t, user: u } = getStoredAuth();
    if (!t || !u) {
      navigate("/login", { replace: true });
    } else if (u.role !== "developer") {
      navigate("/dashboard", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role !== "developer") return <Navigate to="/dashboard" replace />;
  return children;
}

// ── Sticky Company Header ──────────────────────────────────────────────────────
function CompanyHeader() {
  const { user } = getStoredAuth();
  const role = (user?.role || "user").toLowerCase();

  const [brand, setBrand] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("company_brand") || "null"); } catch { return null; }
  });

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || role === "developer" || role === "user") return;
    api.get("/admin/company/brand")
      .then((res) => {
        if (res.data) {
          const b = { ...res.data, _ts: Date.now() };
          setBrand(b);
          localStorage.setItem("company_brand", JSON.stringify(b));
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const handler = () => {
      try { setBrand(JSON.parse(localStorage.getItem("company_brand") || "null")); } catch {}
    };
    window.addEventListener("company_brand_updated", handler);
    return () => window.removeEventListener("company_brand_updated", handler);
  }, []);

  // Render gate AFTER hooks so hook order stays stable across renders.
  if (role === "developer") return null;

  const headerName = brand?.name || brand?.headerName || "SKYUP";
  const headerLogo = brand?.logoUrl || brand?.headerLogoUrl || "/skyup_logo1.svg";

  const roleLabel =
    role === "super_admin" || role === "superadmin" ? "Super Admin" :
    role === "admin" ? "Admin" : "Employee";

  const roleColor =
    role === "super_admin" || role === "superadmin"
      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"
      : role === "admin"
      ? "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30"
      : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30";

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-2 pl-14 pr-3 sm:pr-5 md:px-5 py-2.5 bg-white/90 dark:bg-[#13161E]/90 backdrop-blur-md border-b border-gray-100 dark:border-white/5 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <img
          src={headerLogo}
          alt={headerName}
          className="h-7 w-auto max-w-[100px] object-contain shrink-0"
          onError={e => { e.currentTarget.src = "/skyup_logo1.svg"; }}
        />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight truncate max-w-[90px] sm:max-w-[180px]">
          {headerName}
        </span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <ThemeToggle />
        {/* Notification bell — visible for admin and superadmin only */}
        {(role === 'admin' || role === 'superadmin' || role === 'super_admin') && (
          <NotificationBell />
        )}
        {/* Telegram campaign notifications — admin and superadmin only */}
        {(role === 'admin' || role === 'superadmin' || role === 'super_admin') && (
          <TelegramSettings />
        )}
        <span className={`whitespace-nowrap shrink-0 text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border ${roleColor}`}>
          {roleLabel}
        </span>
      </div>
    </div>
  );
}

// ── Layout with Sidebar ────────────────────────────────────────────────────────
// Changes:
//  1. Added EntitlementStatusBanner — shows persistent read-only indicator
//     at the top of the layout for blocked subscription states.
//  2. EntitlementStatusBanner replaces the duplicate logic that was in
//     ExpiryBanner for read-only states. ExpiryBanner is still kept for
//     "expiring soon" warnings (not blocked yet).
//  3. On plan_updated event: clears entitlement cache so sidebar and
//     feature gates refresh automatically without a page reload.
function AppLayout({ children }) {
  const goToPlans = () => { window.location.href = "/upgrade-plan"; };

  // Clear entitlement cache when plan changes (e.g. after developer update)
  // so usePlanFeatures / useEntitlements pick up fresh data on next render.
  React.useEffect(() => {
    const handler = () => clearFeaturesCache();
    window.addEventListener("plan_updated", handler);
    return () => window.removeEventListener("plan_updated", handler);
  }, []);

  return (
    <NotificationProvider>
      <ClockInGate>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden flex flex-col min-w-0">
            {/* Expiry / suspension banners — ordered from most to least severe */}
            <ExpiryBanner onGoToPlans={goToPlans} />
            {/* EntitlementStatusBanner: persistent read-only indicator
                (separate from ExpiryBanner's "expiring soon" warning) */}
            <EntitlementStatusBanner onGoToPlans={goToPlans} />
            {/* TrialGate: full-screen prompt to add a payment method (trial_pending)
                or pick a plan after the trial (auto-charged). Owns all trial states. */}
            <TrialGate />
            <CompanyHeader />
            <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
          </main>
        </div>
      </ClockInGate>
    </NotificationProvider>
  );
}

function UpgradePlanWithMembers(props) {
  const [currentAdmins, setCurrentAdmins] = useState([]);
  const [currentUsers,  setCurrentUsers]  = useState([]);

  useEffect(() => {
    api.get("/admin/")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data?.admins ?? []);
        setCurrentAdmins(list);
      })
      .catch(() => {});

    api.get("/admin/company/users")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data?.users ?? []);
        setCurrentUsers(list);
      })
      .catch(() => {});
  }, []);

  const UpgradePlanComponent = lazy(() => import("./components/UpgradePlan"));
  return (
    <Suspense fallback={null}>
      <UpgradePlanComponent
        {...props}
        currentAdmins={currentAdmins}
        currentUsers={currentUsers}
        // After payment succeeds, clear the entitlement cache so the
        // sidebar and feature gates pick up the new plan immediately.
        onPlanChange={() => {
          clearFeaturesCache();
          window.dispatchEvent(new Event("plan_updated"));
        }}
      />
    </Suspense>
  );
}

// ── Inner app — rendered inside BrowserRouter so hooks work ───────────────────
function AppInner() {
  const { user } = getStoredAuth();

  // Trap logged-in users inside the app — back/forward buttons won't leave.
  useAuthNavGuard();

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Public login routes ── */}
          <Route path="/login"            element={<LoginGuard><UserLogin /></LoginGuard>} />
          <Route path="/forgot-password"  element={<LoginGuard><ForgotPassword /></LoginGuard>} />
          <Route path="/admin/login"      element={<Navigate to="/login" replace />} />
          <Route path="/superadmin/login" element={<LoginGuard><SuperAdminLogin /></LoginGuard>} />

          {/* ── Root redirect ── */}
          <Route path="/" element={
            <ProtectedRoute><RootRedirect /></ProtectedRoute>
          }/>

          {/* ── Admin Dashboard ── */}
          <Route path="/dashboard" element={
            <AdminRoute>
              <AppLayout><Dashboard /></AppLayout>
            </AdminRoute>
          }/>

          {/* ── User Dashboard ── */}
          <Route path="/user/dashboard" element={
            <UserRoute>
              <AppLayout><UserDashboard /></AppLayout>
            </UserRoute>
          }/>

          {/* ── User Communications (own leads only) ── */}
          <Route path="/user/communications" element={
            <UserRoute>
              <AppLayout><UserLeadCommunication /></AppLayout>
            </UserRoute>
          }/>

          {/* ── Developer pages ── */}
          <Route path="/developer/dashboard" element={
            <DeveloperRoute>
              <AppLayout><DeveloperDashboard /></AppLayout>
            </DeveloperRoute>
          }/>
          <Route path="/developer/companies" element={
            <DeveloperRoute>
              <AppLayout><DeveloperCompanies /></AppLayout>
            </DeveloperRoute>
          }/>
          <Route path="/developer/companies/:id" element={
            <DeveloperRoute>
              <AppLayout><DeveloperCompanyDetails /></AppLayout>
            </DeveloperRoute>
          }/>
          <Route path="/developer/subscriptions" element={
            <DeveloperRoute>
              <AppLayout><DeveloperSubscriptions /></AppLayout>
            </DeveloperRoute>
          }/>
          <Route path="/developer/plan-customization" element={
            <DeveloperRoute>
              <AppLayout><DeveloperPlanCustomization /></AppLayout>
            </DeveloperRoute>
          }/>
          <Route path="/developer/addons" element={
            <DeveloperRoute>
              <AppLayout><DeveloperAddonManager /></AppLayout>
            </DeveloperRoute>
          }/>

          {/* ── Admin-only pages ── */}
          <Route path="/reportpage" element={
            <AdminRoute>
              <AppLayout><FeatureGate featureKey="basic-reports"><ReportPage /></FeatureGate></AppLayout>
            </AdminRoute>
          }/>
          <Route path="/campaigns" element={
            <AdminRoute>
              <AppLayout><FeatureGate featureKey="campaigns"><Campaigns /></FeatureGate></AppLayout>
            </AdminRoute>
          }/>
          <Route path="/attendance" element={
            <AdminRoute>
              <AppLayout><FeatureGate featureKey="attendance"><AttendancePage /></FeatureGate></AppLayout>
            </AdminRoute>
          }/>

          {/* ── Upgrade Plan — SuperAdmin only ── */}
          <Route path="/upgrade-plan" element={
            <SuperAdminRoute>
              <AppLayout><UpgradePlanWithMembers /></AppLayout>
            </SuperAdminRoute>
          }/>

          {/* ── Communications ── */}
          <Route path="/communications" element={
            <AdminRoute>
              <AppLayout>
                {/* Communications hosts WhatsApp, SMS, and Email blasts.
                    Each tab is individually feature-gated on the backend.
                    The page itself only requires the user to be an admin —
                    individual send actions will return 403 if the specific
                    blast feature (emailBlast / smsBlast / whatsappBlast)
                    is disabled for this company. */}
                <Communications currentUser={user} />
              </AppLayout>
            </AdminRoute>
          }/>

          {/* ── Legacy redirects ── */}
          <Route path="/whatsapp"      element={<Navigate to="/communications" replace />} />
          <Route path="/email-history" element={<Navigate to="/communications" replace />} />

          {/* ── Call recordings redirect to dashboard (page removed) ── */}
          <Route path="/call-recordings" element={<Navigate to="/dashboard" replace />} />

          {/* ── Leads — role-aware ── */}
          <Route path="/leads" element={
            <ProtectedRoute>
              <AppLayout><LeadsRoleSwitch /></AppLayout>
            </ProtectedRoute>
          }/>

          {/* ── Daily report — role-aware ── */}
          <Route path="/daily-report" element={
            <ProtectedRoute>
              <AppLayout><FeatureGate featureKey="daily-report"><DailyReportRoleSwitch /></FeatureGate></AppLayout>
            </ProtectedRoute>
          }/>

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
