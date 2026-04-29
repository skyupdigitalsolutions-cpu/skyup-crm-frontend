import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import VoiceflowChat from "./components/VoiceflowChat";
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
import AdminLeadsPage from "./components/AdminLeadsPage";
import EmailHistory from "./components/EmailHistory";
import AttendancePage from "./pages/AttendancePage";
import WhatsAppChat from "./components/WhatsAppChat";


// ── Helper to read stored user ─────────────────────────────────────────────────
function getStoredAuth() {
  const token = localStorage.getItem("token");
  const user  = JSON.parse(localStorage.getItem("user") || "null");
  return { token, user };
}

// ── Protected Route — redirects to /login if no token ─────────────────────────
function ProtectedRoute({ children }) {
  const { token, user } = getStoredAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  return children;
}

// ── Admin-only Route ───────────────────────────────────────────────────────────
function AdminRoute({ children }) {
  const { token, user } = getStoredAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  // If a plain user somehow hits an admin route, send them to user dashboard
  if (user.role === "user") return <Navigate to="/user/dashboard" replace />;
  return children;
}

// ── User-only Route ────────────────────────────────────────────────────────────
function UserRoute({ children }) {
  const { token, user } = getStoredAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  // If an admin somehow hits a user route, send them to admin dashboard
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
      {/* ── Global Voiceflow chatbot — visible on every page ── */}
      <VoiceflowChat />
      <Routes>

        {/* ── Public login routes 🔓 ── */}
        <Route path="/login"            element={<UserLogin />} />
        <Route path="/admin/login"      element={<AdminLogin />} />
        <Route path="/superadmin/login" element={<SuperAdminLogin />} />

        {/* ── Root redirect: role-aware ── */}
        <Route path="/" element={
          <ProtectedRoute>
            {(() => {
              const { user } = getStoredAuth();
              return user?.role === "user"
                ? <Navigate to="/user/dashboard" replace />
                : <Navigate to="/dashboard" replace />;
            })()}
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
        <Route path="/leads" element={
          <AdminRoute>
            <AppLayout><AdminLeadsPage /></AppLayout>
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

        {/* ── Daily report — role-aware ── */}
        <Route path="/daily-report" element={
          <ProtectedRoute>
            <AppLayout>
              {(() => {
                const { user } = getStoredAuth();
                return user?.role === "user" ? <UserDailyReport /> : <Dailyreport />;
              })()}
            </AppLayout>
          </ProtectedRoute>
        }/>

        {/* ── Twilio page — users only ── */}
        <Route path="/user/twilio" element={
          <UserRoute>
            <AppLayout><UserTwilioPage /></AppLayout>
          </UserRoute>
        }/>

        {/* ── WhatsApp Chat — admin only ── */}
        <Route path="/whatsapp" element={
          <AdminRoute>
            <AppLayout><WhatsAppChat /></AppLayout>
          </AdminRoute>
        }/>

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}