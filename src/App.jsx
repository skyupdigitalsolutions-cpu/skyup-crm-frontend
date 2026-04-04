import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Campaigns from "./components/Campaigns";
import Dailyreport from "./components/DailyReport";
import UpgradePlan from "./components/UpgradePlan";
import ReportPage from "./components/ReportPage";
import UserLogin from "./pages/UserLogin";
import UserDashboard from "./pages/UserDashboard";
import UserTwilioPage from "./pages/UserTwilioPage";
import UserDailyReport from "./pages/UserDailyReport";
import AdminLogin from "./pages/AdminLogin";
import SuperAdminLogin from "./pages/SuperAdminLogin";

// ── Protected Route — redirects to /login if no token ─────────────────────
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  const user  = JSON.parse(localStorage.getItem("user") || "null");

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// ── Admin-only Route — redirects users to their dashboard ────────────────
function AdminRoute({ children }) {
  const token = localStorage.getItem("token");
  const user  = JSON.parse(localStorage.getItem("user") || "null");

  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role === "user") return <Navigate to="/dashboard" replace />;
  return children;
}

// ── Layout with Sidebar — only for protected pages ────────────────────────
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

        {/* ── Public login routes (no sidebar) 🔓 ── */}
        <Route path="/login"            element={<UserLogin />} />
        <Route path="/admin/login"      element={<AdminLogin />} />
        <Route path="/superadmin/login" element={<SuperAdminLogin />} />

        {/* ── Protected routes (with sidebar) 🔒 ── */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout>
              {(() => {
                const u = JSON.parse(localStorage.getItem("user") || "null");
                return u?.role === "user" ? <UserDashboard /> : <Dashboard />;
              })()}
            </AppLayout>
          </ProtectedRoute>
        }/>
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <AppLayout>
              {(() => {
                const u = JSON.parse(localStorage.getItem("user") || "null");
                return u?.role === "user" ? <UserDashboard /> : <Dashboard />;
              })()}
            </AppLayout>
          </ProtectedRoute>
        }/>
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
        <Route path="/daily-report" element={
          <ProtectedRoute>
            <AppLayout>
              {(() => {
                const u = JSON.parse(localStorage.getItem("user") || "null");
                return u?.role === "user" ? <UserDailyReport /> : <Dailyreport />;
              })()}
            </AppLayout>
          </ProtectedRoute>
        }/>
        <Route path="/upgrade-plan" element={ 
          <AdminRoute>
            <AppLayout><UpgradePlan /></AppLayout>
          </AdminRoute>
        }/>

        <Route path="/user/twilio" element={
          <ProtectedRoute>
            <AppLayout><UserTwilioPage /></AppLayout>
          </ProtectedRoute>
        }/>

        {/* ── Fallback — redirect unknown routes to login ── */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}