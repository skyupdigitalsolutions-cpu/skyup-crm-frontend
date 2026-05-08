import { BrowserRouter, Route, Routes, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Campaigns from "./components/Campaigns";
import Dailyreport from "./components/DailyReport";
import UpgradePlan from "./components/UpgradePlan";
import ReportPage from "./components/ReportPage";
import UserLogin from "./pages/UserLogin";
import UserDashboard from "./pages/UserDashboard";
import UserDailyReport from "./pages/UserDailyReport";
import AdminLogin from "./pages/AdminLogin";
import SuperAdminLogin from "./pages/SuperAdminLogin";
import AdminLeadsPage from "./components/AdminLeadsPage";
import UserLeadsPage from "./pages/UserLeadsPage";
import EmailHistory from "./components/EmailHistory";
import AttendancePage from "./pages/AttendancePage";
import WhatsAppChat from "./components/WhatsAppChat";
import CallRecording from "./components/CallRecording";


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

// ── Login Guard — clears session & blocks forward-button bypass ───────────────
// When any login page mounts it means the user intends to be logged out.
// We clear localStorage immediately so protected routes find no token,
// and replace the current history entry so the browser's forward button
// cannot jump back to a protected page without re-authenticating.
function LoginGuard({ children }) {
  const location = useLocation();

  useEffect(() => {
    // Clear any stale session every time a login page is visited
    clearAuth();
    // Replace the history entry for this login page so the forward button
    // cannot skip past it back into a protected route
    window.history.replaceState(null, "", location.pathname);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return children;
}

// ── Role-aware page switches ─────────────────────────────────────────────────
// IMPORTANT: these MUST be components, not IIFEs inside <Route element={...}>.
// IIFEs run once at App's first render and the result is baked into the Route
// element forever (App has no state, so it never re-renders). That caused the
// admin page to show even after a user logged in, until a hard refresh
// remounted <App> and re-ran the IIFE. As components, they re-read localStorage
// every time the route mounts.
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

// ── Protected Route — redirects to /login if no token ─────────────────────────
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
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public login routes 🔓 ── */}
        {/* LoginGuard clears localStorage on mount so any stale token is wiped  */}
        {/* and replaces the history entry so → (forward) cannot skip past login */}
        <Route path="/login"            element={<LoginGuard><UserLogin /></LoginGuard>} />
        <Route path="/admin/login"      element={<LoginGuard><AdminLogin /></LoginGuard>} />
        <Route path="/superadmin/login" element={<LoginGuard><SuperAdminLogin /></LoginGuard>} />

        {/* ── Root redirect: role-aware ── */}
        <Route path="/" element={
          <ProtectedRoute>
            <RootRedirect />
          </ProtectedRoute>
        }/>

        {/* ── Admin Dashboard (/dashboard) — admin & superadmin only ── */}
        <Route path="/dashboard" element={
          <AdminRoute>
            <AppLayout><Dashboard /></AppLayout>
          </AdminRoute>
        }/>

        {/* ── User Dashboard (/user/dashboard) — users only ── */}
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
        <Route path="/email-history" element={
          <AdminRoute>
            <AppLayout><EmailHistory /></AppLayout>
          </AdminRoute>
        }/>

        {/* ── Leads — role-aware (/leads) ── */}
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

        {/* ── WhatsApp Chat — admin only ── */}
        <Route path="/whatsapp" element={
          <AdminRoute>
            <AppLayout><WhatsAppChat /></AppLayout>
          </AdminRoute>
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
    </BrowserRouter>
  );
}
