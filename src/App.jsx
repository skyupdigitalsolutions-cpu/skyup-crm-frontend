import { BrowserRouter, Route, Routes, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { Sidebar } from "./components/Sidebar";

// ── Lazy-loaded pages — each becomes its own chunk ────────────────────────────
// Heavy admin pages
const Dashboard      = lazy(() => import("./components/Dashboard"));
const Campaigns      = lazy(() => import("./components/Campaigns"));
const Dailyreport    = lazy(() => import("./components/DailyReport"));
const ReportPage     = lazy(() => import("./components/ReportPage"));
const AdminLeadsPage = lazy(() => import("./components/AdminLeadsPage"));
const CallRecording  = lazy(() => import("./components/CallRecording"));
const Communications = lazy(() => import("./components/Communications"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const UpgradePlan    = lazy(() => import("./components/UpgradePlan"));

// User pages
const UserLogin      = lazy(() => import("./pages/UserLogin"));
const UserDashboard  = lazy(() => import("./pages/UserDashboard"));
const UserDailyReport = lazy(() => import("./pages/UserDailyReport"));
const UserLeadsPage  = lazy(() => import("./pages/UserLeadsPage"));

// Auth pages
const AdminLogin      = lazy(() => import("./pages/AdminLogin"));
const SuperAdminLogin = lazy(() => import("./pages/SuperAdminLogin"));

// ── Page loader — shown while a lazy chunk is downloading ─────────────────────
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

// ── Helper to read stored user ─────────────────────────────────────────────────
function getStoredAuth() {
  const token = localStorage.getItem("token");
  const user  = JSON.parse(localStorage.getItem("user") || "null");
  return { token, user };
}

// ── Helper to wipe auth from storage ──────────────────────────────────────────
function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// ── Login Guard ────────────────────────────────────────────────────────────────
function LoginGuard({ children }) {
  const location = useLocation();
  const navigate  = useNavigate();
  const { token, user } = getStoredAuth();

  useEffect(() => {
    const { token: t, user: u } = getStoredAuth();

    if (t && u) {
      const home = u.role === "user" ? "/user/dashboard" : "/dashboard";
      navigate(home, { replace: true });
      return;
    }

    window.history.replaceState(null, "", location.pathname);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (token && user) return null;

  return children;
}

// ── Role-aware page switches ─────────────────────────────────────────────────
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
  return user?.role === "user"
    ? <Navigate to="/user/dashboard" replace />
    : <Navigate to="/dashboard" replace />;
}

// ── Protected Route ────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { token, user } = getStoredAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const { token: t, user: u } = getStoredAuth();
    if (!t || !u) navigate("/login", { replace: true });
  });

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
    }
  });

  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role === "user") return <Navigate to="/user/dashboard" replace />;
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
  });

  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role !== "user") return <Navigate to="/dashboard" replace />;
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
  // Pull current user once for passing as prop where needed
  const { user } = getStoredAuth();

  return (
    <BrowserRouter>
      {/* Suspense wraps all routes — shows PageLoader while any lazy chunk loads */}
      <Suspense fallback={<PageLoader />}>
        <Routes>

          {/* ── Public login routes 🔓 ── */}
          <Route path="/login"            element={<LoginGuard><UserLogin /></LoginGuard>} />
          <Route path="/admin/login"      element={<LoginGuard><AdminLogin /></LoginGuard>} />
          <Route path="/superadmin/login" element={<LoginGuard><SuperAdminLogin /></LoginGuard>} />

          {/* ── Root redirect: role-aware ── */}
          <Route path="/" element={
            <ProtectedRoute>
              <RootRedirect />
            </ProtectedRoute>
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
          <Route path="/upgrade-plan" element={
            <AdminRoute>
              <AppLayout><UpgradePlan /></AppLayout>
            </AdminRoute>
          }/>

          {/* ── Communications (WhatsApp + Email History + Email Blast) ── */}
          <Route path="/communications" element={
            <AdminRoute>
              <AppLayout>
                <Communications currentUser={user} />
              </AppLayout>
            </AdminRoute>
          }/>

          {/* ── Legacy redirects — keep old bookmarks working ── */}
          <Route path="/whatsapp"      element={<Navigate to="/communications" replace />} />
          <Route path="/email-history" element={<Navigate to="/communications" replace />} />

          {/* ── Leads — role-aware ── */}
          <Route path="/leads" element={
            <ProtectedRoute>
              <AppLayout>
                <LeadsRoleSwitch />
              </AppLayout>
            </ProtectedRoute>
          }/>

          {/* ── Daily report — role-aware ── */}
          <Route path="/daily-report" element={
            <ProtectedRoute>
              <AppLayout>
                <DailyReportRoleSwitch />
              </AppLayout>
            </ProtectedRoute>
          }/>

          {/* ── Call Recordings — admin only ── */}
          <Route path="/call-recordings" element={
            <AdminRoute>
              <AppLayout><CallRecording /></AppLayout>
            </AdminRoute>
          }/>

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
