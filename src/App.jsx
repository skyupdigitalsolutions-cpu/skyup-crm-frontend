import { BrowserRouter, Route, Routes, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { Sidebar } from "./components/Sidebar";

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
const DeveloperDashboard   = lazy(() => import("./pages/developer/DeveloperDashboard"));
const DeveloperCompanies   = lazy(() => import("./pages/developer/Companies"));
const DeveloperSubscriptions = lazy(() => import("./pages/developer/Subscriptions"));

// Auth pages
const AdminLogin      = lazy(() => import("./pages/AdminLogin"));
const SuperAdminLogin = lazy(() => import("./pages/SuperAdminLogin"));

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

function getStoredAuth() {
  const token = localStorage.getItem("token");
  const user  = JSON.parse(localStorage.getItem("user") || "null");
  return { token, user };
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

  useEffect(() => {
    const { token: t, user: u } = getStoredAuth();
    if (!t || !u) {
      navigate("/login", { replace: true });
    } else if (u.role !== "superadmin") {
      navigate("/dashboard", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role !== "superadmin") return <Navigate to="/dashboard" replace />;
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

// ── Layout with Sidebar ────────────────────────────────────────────────────────
function AppLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

export default function App() {
  const { user } = getStoredAuth();

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Public login routes ── */}
          <Route path="/login"            element={<LoginGuard><UserLogin /></LoginGuard>} />
          <Route path="/admin/login"      element={<LoginGuard><AdminLogin /></LoginGuard>} />
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
          <Route path="/developer/subscriptions" element={
            <DeveloperRoute>
              <AppLayout><DeveloperSubscriptions /></AppLayout>
            </DeveloperRoute>
          }/>

          {/* ── Admin-only pages ── */}
          <Route path="/reportpage" element={
            <AdminRoute>
              <AppLayout><ReportPage /></AppLayout>
            </AdminRoute>
          }/>
          <Route path="/campaigns" element={
            <AdminRoute>
              <AppLayout><Campaigns /></AppLayout>
            </AdminRoute>
          }/>
          <Route path="/attendance" element={
            <AdminRoute>
              <AppLayout><AttendancePage /></AppLayout>
            </AdminRoute>
          }/>

          {/* ── Upgrade Plan — SuperAdmin only ── */}
          <Route path="/upgrade-plan" element={
            <SuperAdminRoute>
              <AppLayout><UpgradePlan /></AppLayout>
            </SuperAdminRoute>
          }/>

          {/* ── Communications ── */}
          <Route path="/communications" element={
            <AdminRoute>
              <AppLayout>
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
              <AppLayout><DailyReportRoleSwitch /></AppLayout>
            </ProtectedRoute>
          }/>

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
